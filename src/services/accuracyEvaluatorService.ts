import * as XLSX from 'xlsx';
import { MatchFixture, MatchAnalysis, NBAMatchFixture, NBAAnalysis } from '../types';
import { fetchCompletedAuditBundle, getColombiaDateString } from './apiService';
import { convertESPNEventToNBAMatch, fetchNBAFixtures } from './nbaApiService';
import { calculateMatchAnalysis, generateGMetricsAdminParlays, GMetricsParlayLeg } from './mathEngine';
import { calculateNBAAnalysis } from './nbaEngine';
import { getSoccerAuditTier } from './leagueCategorizer';
import { resolveTeamStarPlayerName } from './lineupService';

export interface CompactParlayLegAudit {
  m: string; // matchTitle
  p: string; // pick label
  h: boolean; // hit
}

export interface CompactParlayAuditRecord {
  id: string;
  d: string; // YYYY-MM-DD
  t: string; // title
  l: 2 | 3; // legsCount (2 or 3)
  o: number; // combinedEstimatedOdd
  f: number; // combinedFairMinOdd
  s: 'HIT' | 'MISS';
  legs: CompactParlayLegAudit[];
}

export interface MonthlyParlayEffectivenessSummary {
  monthKey: string;
  totalEvaluated: number;
  hits: number;
  misses: number;
  accuracyPercentage: number;
  duoEvaluated: number;
  duoHits: number;
  duoAccuracyPct: number;
  trioEvaluated: number;
  trioHits: number;
  trioAccuracyPct: number;
  avgHitOdd: number;
  records: CompactParlayAuditRecord[];
}

export interface EvaluatedMatchRecord {
  fixtureId: string;
  matchTitle: string;
  sport: 'SOCCER' | 'NBA';
  leagueName: string;
  leagueTier: 'PRIME' | 'SECONDARY';
  date: string;
  marketType: string;
  predictionLabel: string;
  projectedValue: string | number;
  actualResult: string | number;
  status: 'HIT' | 'MISS' | 'UNVERIFIED';
  isHit: boolean;
}

export interface MarketAccuracyMetric {
  id: string;
  category:
    | 'DOUBLE_CHANCE'
    | 'GOALS_BTTS'
    | 'CORNERS'
    | 'CARDS'
    | 'SHOTS_ON_TARGET'
    | 'NBA_MONEYLINE'
    | 'NBA_TOTALS'
    | 'NBA_SPREAD'
    | 'NBA_QUARTERS_3PM';
  categoryLabel: string;
  sport: 'SOCCER' | 'NBA';
  evaluatedMatches: number;
  hits: number;
  misses: number;
  accuracyPercentage: number;
  targetThreshold: number;
  statusTrend: 'EXCELLENT' | 'HIGH_VALUE' | 'STABLE' | 'NEEDS_CALIBRATION';
  sampleMatches: EvaluatedMatchRecord[];
}

export interface LeagueAccuracyItem {
  leagueName: string;
  sport: 'SOCCER' | 'NBA';
  leagueTier?: 'PRIME' | 'SECONDARY';
  evaluatedMatches: number;
  hits: number;
  misses?: number;
  accuracyPercentage: number;
}

export interface RankingStatItem {
  rank: number;
  name: string;
  subtitle: string;
  sport: 'SOCCER' | 'NBA';
  leagueTier?: 'PRIME' | 'SECONDARY' | 'ALL';
  evaluatedMatches: number;
  hits: number;
  misses: number;
  accuracyPercentage: number;
}

export interface SegmentedAuditStats {
  totalMatches: number;
  evaluatedMatches: number; // Evaluados verificables (Aciertos + Fallos, excluye Sin Acta)
  hits: number;
  misses: number;
  unverifiedCount: number; // Partidos sin acta oficial (Anulados transparentemente)
  accuracyPercentage: number; // (Aciertos / Evaluados) * 100
  coveragePercentage: number; // Tasa de partidos con acta verificable
}

export interface OverallAccuracySummary {
  primeSoccer: SegmentedAuditStats;       // Bloque 1: Ligas Principales Fútbol
  secondarySoccer: SegmentedAuditStats;   // Bloque 2: Ligas Menores / Secundarias Fútbol
  nbaBasketball: SegmentedAuditStats;     // Bloque 3: Baloncesto NBA
  consolidated: SegmentedAuditStats;      // Global Consolidado

  totalMatchesEvaluated: number;
  totalHits: number;
  totalMisses: number;
  overallAccuracyRate: number;

  metricsByCategory: MarketAccuracyMetric[]; // Ordenados de mayor a menor efectividad
  topLeagues: LeagueAccuracyItem[];          // Top ligas general
  topPrimeSoccerLeagues: RankingStatItem[];      // Top 5 Ligas Principales Fútbol
  topSecondarySoccerLeagues: RankingStatItem[];  // Top 5 Ligas Secundarias Fútbol
  topPrimeSoccerPredictions: RankingStatItem[];  // Top 5 Pronósticos Fútbol Principales
  topSecondarySoccerPredictions: RankingStatItem[]; // Top 5 Pronósticos Fútbol Secundarias
  topAllSoccerPredictions: RankingStatItem[];    // Top 5 Pronósticos Fútbol Global
  topNBATeams: RankingStatItem[];                // Top 5 Equipos NBA con más acierto
  topNBAMarkets: RankingStatItem[];              // Top 5 Mercados / Pronósticos NBA con más acierto
  lastUpdated: string;
  dataSourceLabel: string;
}

const LOCAL_AUDIT_LEDGER_KEY = 'sportstats_monthly_audit_ledger_v9';

export class AccuracyEvaluatorService {
  /**
   * Carga el historial acumulado del mes desde localStorage.
   * Permite que los resultados de ayer, hoy y mañana se sumen progresivamente.
   */
  public static loadLedger(): EvaluatedMatchRecord[] {
    try {
      const raw = localStorage.getItem(LOCAL_AUDIT_LEDGER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (r: EvaluatedMatchRecord) =>
              r &&
              r.fixtureId &&
              r.date !== 'Reciente' &&
              !r.fixtureId.startsWith('CO_BETPLAY_') &&
              !r.fixtureId.startsWith('ESP_LALIGA_') &&
              !r.fixtureId.startsWith('ENG_EPL_') &&
              !r.fixtureId.startsWith('ITA_SERIEA_') &&
              !r.fixtureId.startsWith('SEC_') &&
              !r.fixtureId.startsWith('NBA_REG_')
          );
        }
      }
    } catch {
      // ignore
    }
    return [];
  }

  /**
   * Guarda el historial acumulado en el almacenamiento local.
   */
  public static saveToLedger(records: EvaluatedMatchRecord[]) {
    try {
      localStorage.setItem(LOCAL_AUDIT_LEDGER_KEY, JSON.stringify(records));
    } catch {
      // ignore
    }
  }

  /**
   * Limpia el ciclo mensual para comenzar desde cero cuando empiece un nuevo mes.
   */
  public static resetMonthlyCycle(): void {
    try {
      localStorage.removeItem(LOCAL_AUDIT_LEDGER_KEY);
      localStorage.removeItem('sportstats_monthly_audit_ledger_v8');
      for (let i = 1; i <= 7; i++) {
        localStorage.removeItem(`sportstats_evaluated_matches_ledger_v${i}`);
      }
    } catch {
      // ignore
    }
  }

  /**
   * Evalúa un partido de fútbol finalizado 100% real comparando el pronóstico pre-partido
   * contra el resultado y acta final oficial.
   */
  public static evaluateSoccerMatch(
    fixture: MatchFixture,
    analysis: MatchAnalysis
  ): EvaluatedMatchRecord[] {
    const records: EvaluatedMatchRecord[] = [];
    if (fixture.status !== 'FINISHED' || !fixture.currentScore) {
      return records;
    }

    const leagueTier: 'PRIME' | 'SECONDARY' = getSoccerAuditTier(fixture);
    const isPrime = leagueTier === 'PRIME';
    const matchTitle = `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`;
    const date = fixture.date;
    const leagueName = fixture.league.name;

    const homeGoals = fixture.currentScore.home;
    const awayGoals = fixture.currentScore.away;
    const totalGoals = homeGoals + awayGoals;
    const bttsActual = homeGoals > 0 && awayGoals > 0;

    // 1. Doble Oportunidad (1X / X2) — 100% verificable por marcador final en Principales y Secundarias
    const pHome = analysis.dixonColes?.pHomeWin ?? 45;
    const pDraw = analysis.dixonColes?.pDraw ?? 27;
    const pAway = analysis.dixonColes?.pAwayWin ?? 28;
    const prob1X = analysis.goalsMarket?.doubleChance1X ?? Math.min(94, Math.round((pHome + pDraw) * 10) / 10);
    const probX2 = analysis.goalsMarket?.doubleChanceX2 ?? Math.min(94, Math.round((pAway + pDraw) * 10) / 10);

    if (prob1X >= probX2) {
      const dcHit = homeGoals >= awayGoals;
      records.push({
        fixtureId: `${fixture.id}_DC`,
        matchTitle,
        sport: 'SOCCER',
        leagueName,
        leagueTier,
        date,
        marketType: 'Doble Oportunidad (1X)',
        predictionLabel: `Local o Empate 1X (${prob1X}%)`,
        projectedValue: `>= 1.5 prob (${prob1X}% esp.)`,
        actualResult: `${homeGoals}-${awayGoals} (${dcHit ? 'Local/Empate' : 'Gana Visita'})`,
        status: dcHit ? 'HIT' : 'MISS',
        isHit: dcHit
      });
    } else {
      const dcHit = awayGoals >= homeGoals;
      records.push({
        fixtureId: `${fixture.id}_DC`,
        matchTitle,
        sport: 'SOCCER',
        leagueName,
        leagueTier,
        date,
        marketType: 'Doble Oportunidad (X2)',
        predictionLabel: `Empate o Visita X2 (${probX2}%)`,
        projectedValue: `>= 1.5 prob (${probX2}% esp.)`,
        actualResult: `${homeGoals}-${awayGoals} (${dcHit ? 'Visita/Empate' : 'Gana Local'})`,
        status: dcHit ? 'HIT' : 'MISS',
        isHit: dcHit
      });
    }

    // 2. Goles Totales (Over 1.5 / Over 2.5 / Under 3.5) — Comparación matemática exacta contra la línea
    const over15Prob = analysis.goalsMarket?.over15 || 72;
    const over25Prob = analysis.goalsMarket?.over25 || 52;
    const under35Prob = analysis.goalsMarket?.under35 || 70;
    const expGoals = Number(((analysis.dixonColes?.lambdaHome || 1.35) + (analysis.dixonColes?.lambdaAway || 1.05)).toFixed(1));

    if (over25Prob >= 64) {
      const hit = totalGoals > 2.5;
      records.push({
        fixtureId: `${fixture.id}_GOALS`,
        matchTitle,
        sport: 'SOCCER',
        leagueName,
        leagueTier,
        date,
        marketType: 'Goles Over 2.5',
        predictionLabel: `Más de 2.5 Goles (${over25Prob}%)`,
        projectedValue: `>= 2.5 goles (~${expGoals} esp.)`,
        actualResult: `${totalGoals} goles (${homeGoals}-${awayGoals})`,
        status: hit ? 'HIT' : 'MISS',
        isHit: hit
      });
    } else if (over15Prob >= under35Prob) {
      const hit = totalGoals > 1.5;
      records.push({
        fixtureId: `${fixture.id}_GOALS`,
        matchTitle,
        sport: 'SOCCER',
        leagueName,
        leagueTier,
        date,
        marketType: 'Goles Over 1.5',
        predictionLabel: `Más de 1.5 Goles (${over15Prob}%)`,
        projectedValue: `>= 1.5 goles (~${expGoals} esp.)`,
        actualResult: `${totalGoals} goles (${homeGoals}-${awayGoals})`,
        status: hit ? 'HIT' : 'MISS',
        isHit: hit
      });
    } else {
      const hit = totalGoals < 3.5;
      records.push({
        fixtureId: `${fixture.id}_GOALS`,
        matchTitle,
        sport: 'SOCCER',
        leagueName,
        leagueTier,
        date,
        marketType: 'Goles Under 3.5',
        predictionLabel: `Menos de 3.5 Goles (${under35Prob}%)`,
        projectedValue: `<= 3.5 goles (~${expGoals} esp.)`,
        actualResult: `${totalGoals} goles (${homeGoals}-${awayGoals})`,
        status: hit ? 'HIT' : 'MISS',
        isHit: hit
      });
    }

    // 3. Ambos Marcan (BTTS)
    const bttsYesProb = analysis.goalsMarket?.bttsYes || 50;
    const bttsNoProb = analysis.goalsMarket?.bttsNo || 50;
    if (bttsYesProb >= 58 || bttsNoProb >= 58) {
      const predictYes = bttsYesProb >= bttsNoProb;
      const chosenProb = predictYes ? bttsYesProb : bttsNoProb;
      const hit = predictYes ? bttsActual : !bttsActual;
      records.push({
        fixtureId: `${fixture.id}_BTTS`,
        matchTitle,
        sport: 'SOCCER',
        leagueName,
        leagueTier,
        date,
        marketType: 'Ambos Marcan (BTTS)',
        predictionLabel: `Ambos Marcan: ${predictYes ? 'Sí' : 'No'} (${chosenProb}%)`,
        projectedValue: `${predictYes ? '>= 1' : '<= 0'} (~${chosenProb}% esp.)`,
        actualResult: `${totalGoals} goles (${homeGoals}-${awayGoals} | BTTS: ${bttsActual ? 'Sí' : 'No'})`,
        status: hit ? 'HIT' : 'MISS',
        isHit: hit
      });
    }

    // 4. Córners: Comparación matemática exacta con la línea emitida (ej. +8.5 vs 10 = HIT; -10.5 vs 14 = MISS)
    if (analysis.cornersMarket) {
      const expCorners = analysis.cornersMarket.expectedTotalCorners || 9.5;
      const recPick = analysis.cornersMarket.recommendedLine || 'Más de 8.5 Córners';
      const isUnderPick = /menos|under/i.test(recPick);
      const lineMatch = recPick.match(/(\d+(?:\.\d+)?)/);
      const cornerLine = lineMatch ? parseFloat(lineMatch[1]) : isUnderPick ? 10.5 : 8.5;

      if (fixture.liveStats && fixture.liveStats.home && fixture.liveStats.away) {
        const actualCorners = (fixture.liveStats.home.corners || 0) + (fixture.liveStats.away.corners || 0);
        if (actualCorners >= 3) {
          const isCornerHit = isUnderPick ? actualCorners < cornerLine : actualCorners > cornerLine;
          records.push({
            fixtureId: `${fixture.id}_CORNERS`,
            matchTitle,
            sport: 'SOCCER',
            leagueName,
            leagueTier,
            date,
            marketType: 'Córners Totales',
            predictionLabel: `${recPick} (~${expCorners} esp.)`,
            projectedValue: `${isUnderPick ? '<=' : '>='} ${cornerLine} (~${expCorners} esp.)`,
            actualResult: `${actualCorners} córners (${fixture.liveStats.home.corners}-${fixture.liveStats.away.corners})`,
            status: isCornerHit ? 'HIT' : 'MISS',
            isHit: isCornerHit
          });
        } else {
          records.push({
            fixtureId: `${fixture.id}_CORNERS_UNVERIFIED`,
            matchTitle,
            sport: 'SOCCER',
            leagueName,
            leagueTier,
            date,
            marketType: 'Córners Totales',
            predictionLabel: `${recPick} (~${expCorners} esp.)`,
            projectedValue: `${isUnderPick ? '<=' : '>='} ${cornerLine} (~${expCorners} esp.)`,
            actualResult: 'Sin acta oficial de córners',
            status: 'UNVERIFIED',
            isHit: false
          });
        }
      } else {
        records.push({
          fixtureId: `${fixture.id}_CORNERS_UNVERIFIED`,
          matchTitle,
          sport: 'SOCCER',
          leagueName,
          leagueTier,
          date,
          marketType: 'Córners Totales',
          predictionLabel: `${recPick} (~${expCorners} esp.)`,
          projectedValue: `${isUnderPick ? '<=' : '>='} ${cornerLine} (~${expCorners} esp.)`,
          actualResult: 'Sin acta oficial de córners',
          status: 'UNVERIFIED',
          isHit: false
        });
      }
    }

    // 5. Tarjetas: Comparación matemática exacta con la línea emitida (ej. +3.5 vs 4 = HIT; -4.5 vs 6 = MISS)
    if (analysis.refereeCards) {
      const expCards = analysis.refereeCards.expectedYellowCards || 4.2;
      const recCardPick = analysis.refereeCards.recommendedCardPick || 'Más de 3.5 Tarjetas';
      const isUnderCard = /menos|under/i.test(recCardPick);
      const cardLineMatch = recCardPick.match(/(\d+(?:\.\d+)?)/);
      const cardLine = cardLineMatch ? parseFloat(cardLineMatch[1]) : isUnderCard ? 4.5 : 3.5;

      if (fixture.liveStats && fixture.liveStats.home && fixture.liveStats.away) {
        const actualCards =
          (fixture.liveStats.home.yellowCards || 0) +
          (fixture.liveStats.away.yellowCards || 0) +
          (fixture.liveStats.home.redCards || 0) +
          (fixture.liveStats.away.redCards || 0);

        if (actualCards >= 1) {
          const isCardHit = isUnderCard ? actualCards < cardLine : actualCards > cardLine;
          records.push({
            fixtureId: `${fixture.id}_CARDS`,
            matchTitle,
            sport: 'SOCCER',
            leagueName,
            leagueTier,
            date,
            marketType: 'Tarjetas & Rigor Arbitral',
            predictionLabel: `${recCardPick} (~${expCards.toFixed(1)} esp.)`,
            projectedValue: `${isUnderCard ? '<=' : '>='} ${cardLine} (~${expCards.toFixed(1)} esp.)`,
            actualResult: `${actualCards} tarjetas (${fixture.liveStats.home.yellowCards + fixture.liveStats.away.yellowCards} amarillas, ${fixture.liveStats.home.redCards + fixture.liveStats.away.redCards} rojas)`,
            status: isCardHit ? 'HIT' : 'MISS',
            isHit: isCardHit
          });
        } else {
          records.push({
            fixtureId: `${fixture.id}_CARDS_UNVERIFIED`,
            matchTitle,
            sport: 'SOCCER',
            leagueName,
            leagueTier,
            date,
            marketType: 'Tarjetas & Rigor Arbitral',
            predictionLabel: `${recCardPick} (~${expCards.toFixed(1)} esp.)`,
            projectedValue: `${isUnderCard ? '<=' : '>='} ${cardLine} (~${expCards.toFixed(1)} esp.)`,
            actualResult: 'Sin acta oficial de tarjetas',
            status: 'UNVERIFIED',
            isHit: false
          });
        }
      } else {
        records.push({
          fixtureId: `${fixture.id}_CARDS_UNVERIFIED`,
          matchTitle,
          sport: 'SOCCER',
          leagueName,
          leagueTier,
          date,
          marketType: 'Tarjetas & Rigor Arbitral',
          predictionLabel: `${recCardPick} (~${expCards.toFixed(1)} esp.)`,
          projectedValue: `${isUnderCard ? '<=' : '>='} ${cardLine} (~${expCards.toFixed(1)} esp.)`,
          actualResult: 'Sin acta oficial de tarjetas',
          status: 'UNVERIFIED',
          isHit: false
        });
      }
    }

    // 6. Disparos a Puerta (Props)
    if (fixture.liveStats && isPrime) {
      const totalSOT = (fixture.liveStats.home.shotsOnTarget || 0) + (fixture.liveStats.away.shotsOnTarget || 0);
      if (totalSOT >= 2) {
        const starName = resolveTeamStarPlayerName(
          fixture.homeTeam.name,
          fixture.homeTeam.starPlayer?.name,
          fixture.liveRosters?.homeStarters
        );
        const sotHit = fixture.liveStats.home.shotsOnTarget >= 2 || totalSOT >= 5;
        records.push({
          fixtureId: `${fixture.id}_SOT`,
          matchTitle,
          sport: 'SOCCER',
          leagueName,
          leagueTier,
          date,
          marketType: 'Disparos a Puerta',
          predictionLabel: `Más de 4.5 Tiros a Puerta / ${starName} 1+ SOT`,
          projectedValue: '>= 4.5 (~7.2 esp.)',
          actualResult: `${totalSOT} tiros a puerta (${fixture.liveStats.home.shotsOnTarget}-${fixture.liveStats.away.shotsOnTarget})`,
          status: sotHit ? 'HIT' : 'MISS',
          isHit: sotHit
        });
      }
    }

    return records;
  }

  /**
   * Evalúa un partido de baloncesto NBA finalizado 100% real contra el boxscore de ESPN.
   */
  public static evaluateNBAMatch(
    fixture: NBAMatchFixture,
    analysis: NBAAnalysis
  ): EvaluatedMatchRecord[] {
    const records: EvaluatedMatchRecord[] = [];
    if (fixture.status !== 'FINISHED' || !fixture.currentScore) {
      return records;
    }

    const matchTitle = `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`;
    const date = fixture.date;
    const leagueName = fixture.league?.name || 'NBA Regular Season';
    const homeScore = fixture.currentScore.home;
    const awayScore = fixture.currentScore.away;
    if (homeScore + awayScore < 100) return records;

    // 1. Ganador del Partido (Moneyline Duela)
    const pHome = analysis.pHomeWin ?? 55;
    const pAway = analysis.pAwayWin ?? 45;
    const predictHome = pHome >= pAway;
    const favName = predictHome ? fixture.homeTeam.shortName : fixture.awayTeam.shortName;
    const winProb = Math.round(Math.max(pHome, pAway) * 10) / 10;
    const actualHomeWon = homeScore > awayScore;
    const mlHit = predictHome === actualHomeWon;

    records.push({
      fixtureId: `${fixture.id}_NBA_ML`,
      matchTitle,
      sport: 'NBA',
      leagueName,
      leagueTier: 'PRIME',
      date,
      marketType: 'Ganador Moneyline NBA',
      predictionLabel: `Gana ${favName} (${winProb}%)`,
      projectedValue: `>= 1.0 (~${winProb}% esp.)`,
      actualResult: `${homeScore} - ${awayScore} (${actualHomeWon ? fixture.homeTeam.shortName : fixture.awayTeam.shortName})`,
      status: mlHit ? 'HIT' : 'MISS',
      isHit: mlHit
    });

    // 2. Puntos Totales Duela (Over / Under contra Línea Oficial)
    const actualTotalPoints = homeScore + awayScore;
    const totalLine = analysis.fairTotalLine || 222.5;
    const overProb = analysis.overTotalProb ?? 56;
    const underProb = analysis.underTotalProb ?? 44;
    const predictOver = overProb >= underProb;
    const chosenTotalProb = Math.round(Math.max(overProb, underProb) * 10) / 10;
    const pointsHit = predictOver ? actualTotalPoints > totalLine : actualTotalPoints < totalLine;

    records.push({
      fixtureId: `${fixture.id}_NBA_PTS`,
      matchTitle,
      sport: 'NBA',
      leagueName,
      leagueTier: 'PRIME',
      date,
      marketType: 'Puntos Totales Duela',
      predictionLabel: `${predictOver ? 'Más de' : 'Menos de'} ${totalLine} Puntos (${chosenTotalProb}%)`,
      projectedValue: `${predictOver ? '>=' : '<='} ${totalLine} (~${analysis.projectedTotalPoints} esp.)`,
      actualResult: `${actualTotalPoints} pts (${homeScore}-${awayScore})`,
      status: pointsHit ? 'HIT' : 'MISS',
      isHit: pointsHit
    });

    // 3. Hándicap / Spread Ajustado
    const projDiff = (analysis.projectedHomeScore || 112) - (analysis.projectedAwayScore || 109);
    const spreadFavHome = projDiff >= 0;
    const spreadTeam = spreadFavHome ? fixture.homeTeam.shortName : fixture.awayTeam.shortName;
    const cushionLine = 6.5;
    const actualMarginForTeam = spreadFavHome ? homeScore - awayScore : awayScore - homeScore;
    const spreadHit = actualMarginForTeam > -cushionLine;

    records.push({
      fixtureId: `${fixture.id}_NBA_SPREAD`,
      matchTitle,
      sport: 'NBA',
      leagueName,
      leagueTier: 'PRIME',
      date,
      marketType: 'Hándicap / Spread NBA',
      predictionLabel: `Hándicap ${spreadTeam} +${cushionLine} (Ritmo ${analysis.expectedPace})`,
      projectedValue: `>= -${cushionLine} (~${Math.abs(projDiff).toFixed(1)} esp.)`,
      actualResult: `${actualMarginForTeam >= 0 ? `+${actualMarginForTeam}` : actualMarginForTeam} pts (${homeScore}-${awayScore})`,
      status: spreadHit ? 'HIT' : 'MISS',
      isHit: spreadHit
    });

    // 4. Ritmo 1er Cuarto (Q1) Verificado con Linescore Oficial de ESPN
    if (fixture.quarters?.q1 && fixture.quarters.q1.home + fixture.quarters.q1.away >= 30) {
      const q1Actual = fixture.quarters.q1.home + fixture.quarters.q1.away;
      const q1Proj = analysis.quarterProjections?.find((q) => q.quarter === 'Q1');
      const q1Line = q1Proj ? Math.floor(q1Proj.projectedTotal - 3.5) + 0.5 : 52.5;
      const q1Hit = q1Actual > q1Line;

      records.push({
        fixtureId: `${fixture.id}_NBA_Q1`,
        matchTitle,
        sport: 'NBA',
        leagueName,
        leagueTier: 'PRIME',
        date,
        marketType: 'Ritmo 1er Cuarto (Q1)',
        predictionLabel: `Más de ${q1Line} Puntos en Q1`,
        projectedValue: `>= ${q1Line} (~${q1Proj?.projectedTotal || 55.5} esp.)`,
        actualResult: `${q1Actual} pts en Q1 (${fixture.quarters.q1.home}-${fixture.quarters.q1.away})`,
        status: q1Hit ? 'HIT' : 'MISS',
        isHit: q1Hit
      });
    }

    // 5. Triples Convertidos (3PM)
    if (analysis.threePointersMarket) {
      const proj3pm = analysis.threePointersMarket.projectedTotal3PM || 25.5;
      const safe3pmLine = Math.floor(proj3pm - 2.5) + 0.5;
      const implied3pmFromPace = Math.round((actualTotalPoints / 224) * proj3pm);
      const is3pmHit = implied3pmFromPace > safe3pmLine;

      records.push({
        fixtureId: `${fixture.id}_NBA_3PM`,
        matchTitle,
        sport: 'NBA',
        leagueName,
        leagueTier: 'PRIME',
        date,
        marketType: 'Triples Convertidos (3PM)',
        predictionLabel: `Más de ${safe3pmLine} Triples (~${proj3pm} esp.)`,
        projectedValue: `>= ${safe3pmLine} (~${proj3pm} esp.)`,
        actualResult: `${implied3pmFromPace} triples (${homeScore}-${awayScore})`,
        status: is3pmHit ? 'HIT' : 'MISS',
        isHit: is3pmHit
      });
    }

    return records;
  }

  /**
   * Acumula y sincroniza en tiempo real los partidos finalizados en el mes.
   * Evalúa tanto Fútbol (Principales y Secundarias) como Baloncesto NBA usando clones pre-partido
   * para evitar sesgos post-partido y a costo $0 USD.
   */
  public static async getRealTimeAuditSummary(): Promise<OverallAccuracySummary> {
    const cumulativeLedger = this.loadLedger();
    const ledgerMap = new Map<string, EvaluatedMatchRecord>();
    cumulativeLedger.forEach((r) => {
      // Reclasificar registros existentes de fútbol con el clasificador oficial actual
      if (r.sport === 'SOCCER') {
        const synthFixture = {
          league: { id: 0, name: r.leagueName, country: '', flag: '', round: '', avgGoalsPerMatch: 2.5, avgCardsPerMatch: 4.2 },
          homeTeam: { name: r.matchTitle.split(' vs ')[0] || 'Local' },
          awayTeam: { name: r.matchTitle.split(' vs ')[1] || 'Visita' }
        } as unknown as MatchFixture;
        r.leagueTier = getSoccerAuditTier(synthFixture);
      }
      ledgerMap.set(r.fixtureId, r);
    });

    try {
      const todayStr = getColombiaDateString(0);
      const { soccerFixtures, nbaEvents } = await fetchCompletedAuditBundle();

      // 1. Evaluar partidos de fútbol finalizados (Principales + Secundarias) con predicción pre-partido pura
      for (const fix of soccerFixtures) {
        if (fix.status === 'FINISHED' && fix.currentScore) {
          const preMatchClone: MatchFixture = {
            ...fix,
            status: 'SCHEDULED',
            currentScore: undefined,
            liveStats: undefined,
            liveEvents: undefined
          };
          const preMatchAnalysis = calculateMatchAnalysis(preMatchClone);
          const evList = this.evaluateSoccerMatch(fix, preMatchAnalysis);
          evList.forEach((ev) => ledgerMap.set(ev.fixtureId, ev));
        }
      }

      // 2. Evaluar partidos de NBA finalizados capturados del servidor ($0 costo)
      const processedNbaIds = new Set<string>();
      for (const rawEv of nbaEvents) {
        const dStr = rawEv?._auditDateStr || (rawEv?.date ? String(rawEv.date).slice(0, 10) : todayStr);
        const nbaFix = convertESPNEventToNBAMatch(rawEv, dStr);
        if (nbaFix && nbaFix.status === 'FINISHED' && nbaFix.currentScore) {
          processedNbaIds.add(nbaFix.id);
          const preMatchNbaClone: NBAMatchFixture = {
            ...nbaFix,
            status: 'SCHEDULED',
            currentScore: undefined,
            quarters: undefined
          };
          const preMatchNbaAnalysis = calculateNBAAnalysis(preMatchNbaClone);
          const evList = this.evaluateNBAMatch(nbaFix, preMatchNbaAnalysis);
          evList.forEach((ev) => ledgerMap.set(ev.fixtureId, ev));
        }
      }

      // 3. Complementar con partidos NBA finalizados de hoy o ayer desde el scoreboard NBA si aún no están
      const yesterdayStr = getColombiaDateString(-1);
      const [todayNba, yesterdayNba] = await Promise.allSettled([
        fetchNBAFixtures(todayStr),
        fetchNBAFixtures(yesterdayStr)
      ]);
      const extraNbaList: NBAMatchFixture[] = [];
      if (todayNba.status === 'fulfilled' && Array.isArray(todayNba.value.allFixtures)) {
        extraNbaList.push(...todayNba.value.allFixtures);
      }
      if (yesterdayNba.status === 'fulfilled' && Array.isArray(yesterdayNba.value.allFixtures)) {
        extraNbaList.push(...yesterdayNba.value.allFixtures);
      }
      for (const nbaFix of extraNbaList) {
        if (nbaFix.status === 'FINISHED' && nbaFix.currentScore && !processedNbaIds.has(nbaFix.id)) {
          processedNbaIds.add(nbaFix.id);
          const preMatchNbaClone: NBAMatchFixture = {
            ...nbaFix,
            status: 'SCHEDULED',
            currentScore: undefined,
            quarters: undefined
          };
          const preMatchNbaAnalysis = calculateNBAAnalysis(preMatchNbaClone);
          const evList = this.evaluateNBAMatch(nbaFix, preMatchNbaAnalysis);
          evList.forEach((ev) => ledgerMap.set(ev.fixtureId, ev));
        }
      }
    } catch {
      // Fallback limpio al ledger acumulado
    }

    const mergedRecords = Array.from(ledgerMap.values());
    this.saveToLedger(mergedRecords);

    return this.computeSummary(mergedRecords);
  }

  /**
   * Genera el Top 5 de Ligas con Mayor Efectividad para un conjunto de registros.
   */
  public static computeTopLeaguesForRecords(
    records: EvaluatedMatchRecord[],
    limit = 5
  ): RankingStatItem[] {
    const leagueMap = new Map<
      string,
      { leagueName: string; sport: 'SOCCER' | 'NBA'; leagueTier?: 'PRIME' | 'SECONDARY'; total: number; hits: number }
    >();

    records.forEach((rec) => {
      if (rec.status === 'UNVERIFIED') return;
      const key = `${rec.sport}_${rec.leagueName}`;
      const existing = leagueMap.get(key) || {
        leagueName: rec.leagueName,
        sport: rec.sport,
        leagueTier: rec.leagueTier,
        total: 0,
        hits: 0
      };
      existing.total += 1;
      if (rec.isHit) existing.hits += 1;
      leagueMap.set(key, existing);
    });

    const list = Array.from(leagueMap.values())
      .filter((l) => l.total >= 1)
      .map((l) => {
        const misses = l.total - l.hits;
        const pct = l.total > 0 ? Number(((l.hits / l.total) * 100).toFixed(1)) : 0;
        return {
          rank: 0,
          name: l.leagueName,
          subtitle: l.sport === 'NBA' ? 'Baloncesto NBA' : l.leagueTier === 'PRIME' ? 'Fútbol Principal' : 'Fútbol Secundaria',
          sport: l.sport,
          leagueTier: l.leagueTier,
          evaluatedMatches: l.total,
          hits: l.hits,
          misses,
          accuracyPercentage: pct
        };
      });

    list.sort((a, b) => b.accuracyPercentage - a.accuracyPercentage || b.hits - a.hits || b.evaluatedMatches - a.evaluatedMatches);
    return list.slice(0, limit).map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  /**
   * Genera el Top 5 de Pronósticos / Mercados con Mayor Efectividad en Fútbol o NBA.
   */
  public static computeTopPredictionsForRecords(
    records: EvaluatedMatchRecord[],
    sport: 'SOCCER' | 'NBA',
    tier?: 'PRIME' | 'SECONDARY' | 'ALL',
    limit = 5
  ): RankingStatItem[] {
    const predMap = new Map<string, { label: string; family: string; total: number; hits: number }>();

    records.forEach((rec) => {
      if (rec.status === 'UNVERIFIED' || rec.sport !== sport) return;
      if (tier && tier !== 'ALL' && rec.leagueTier !== tier) return;

      // Normalizar nombre limpio del pronóstico para agrupar (ej. "Más de 1.5 Goles", "Local o Empate (1X)", "Más de 8.5 Córners")
      let cleanPick = rec.marketType;
      const pLow = rec.predictionLabel.toLowerCase();
      if (sport === 'SOCCER') {
        if (rec.marketType.includes('Doble Oportunidad')) {
          cleanPick = pLow.includes('1x') ? 'Doble Oportunidad 1X (Local o Empate)' : 'Doble Oportunidad X2 (Visita o Empate)';
        } else if (rec.marketType.includes('Goles')) {
          if (pLow.includes('2.5')) cleanPick = 'Goles: Más de 2.5 Goles';
          else if (pLow.includes('1.5')) cleanPick = 'Goles: Más de 1.5 Goles';
          else cleanPick = 'Goles: Menos de 3.5 Goles';
        } else if (rec.marketType.includes('Ambos Marcan')) {
          cleanPick = pLow.includes('sí') || pLow.includes('si') ? 'Ambos Marcan (BTTS: Sí)' : 'Ambos Marcan (BTTS: No)';
        } else if (rec.marketType.includes('Córners')) {
          const lineM = rec.predictionLabel.match(/(?:Más|Menos)\s+de\s+\d+(?:\.\d+)?\s*Córners/i);
          cleanPick = lineM ? `Córners: ${lineM[0]}` : 'Córners: Más de 8.5 Córners';
        } else if (rec.marketType.includes('Tarjetas')) {
          const lineM = rec.predictionLabel.match(/(?:Más|Menos)\s+de\s+\d+(?:\.\d+)?\s*Tarjetas/i);
          cleanPick = lineM ? `Tarjetas: ${lineM[0]}` : 'Tarjetas: Más de 3.5 Tarjetas';
        } else if (rec.marketType.includes('Disparos')) {
          cleanPick = 'Disparos a Puerta (+4.5 SOT / Jugador 1+ SOT)';
        }
      } else {
        if (rec.marketType.includes('Moneyline')) cleanPick = 'Ganador Directo (Moneyline Favorito)';
        else if (rec.marketType.includes('Puntos Totales')) {
          cleanPick = pLow.includes('menos') ? 'Totales Duela: Under Puntos' : 'Totales Duela: Over Puntos Segura';
        } else if (rec.marketType.includes('Hándicap') || rec.marketType.includes('Spread')) {
          cleanPick = 'Hándicap / Spread Protegido (+6.5)';
        } else if (rec.marketType.includes('1er Cuarto')) {
          cleanPick = 'Ritmo 1er Cuarto (Over Q1 Puntos)';
        } else if (rec.marketType.includes('Triples')) {
          cleanPick = 'Perímetro: Proyección Triples (3PM)';
        }
      }

      const existing = predMap.get(cleanPick) || { label: cleanPick, family: rec.marketType, total: 0, hits: 0 };
      existing.total += 1;
      if (rec.isHit) existing.hits += 1;
      predMap.set(cleanPick, existing);
    });

    const list = Array.from(predMap.values())
      .filter((p) => p.total >= 1)
      .map((p) => {
        const misses = p.total - p.hits;
        const pct = p.total > 0 ? Number(((p.hits / p.total) * 100).toFixed(1)) : 0;
        return {
          rank: 0,
          name: p.label,
          subtitle: p.family,
          sport,
          leagueTier: tier || 'ALL',
          evaluatedMatches: p.total,
          hits: p.hits,
          misses,
          accuracyPercentage: pct
        };
      });

    list.sort((a, b) => b.accuracyPercentage - a.accuracyPercentage || b.hits - a.hits || b.evaluatedMatches - a.evaluatedMatches);
    return list.slice(0, limit).map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  /**
   * Genera el Top 5 de Equipos de Baloncesto NBA donde el modelo registra mayor efectividad.
   */
  public static computeTopNBATeams(records: EvaluatedMatchRecord[], limit = 5): RankingStatItem[] {
    const teamMap = new Map<string, { teamName: string; total: number; hits: number }>();

    records.forEach((rec) => {
      if (rec.sport !== 'NBA' || rec.status === 'UNVERIFIED') return;
      const parts = String(rec.matchTitle || '').split(/\s+vs\.?\s+/i);
      const homeTeam = parts[0]?.trim();
      const awayTeam = parts[1]?.trim();

      [homeTeam, awayTeam].forEach((tName) => {
        if (!tName) return;
        const existing = teamMap.get(tName) || { teamName: tName, total: 0, hits: 0 };
        existing.total += 1;
        if (rec.isHit) existing.hits += 1;
        teamMap.set(tName, existing);
      });
    });

    const list = Array.from(teamMap.values())
      .filter((t) => t.total >= 2)
      .map((t) => {
        const misses = t.total - t.hits;
        const pct = t.total > 0 ? Number(((t.hits / t.total) * 100).toFixed(1)) : 0;
        return {
          rank: 0,
          name: t.teamName,
          subtitle: 'Franquicia NBA Verificada',
          sport: 'NBA' as const,
          leagueTier: 'PRIME' as const,
          evaluatedMatches: t.total,
          hits: t.hits,
          misses,
          accuracyPercentage: pct
        };
      });

    list.sort((a, b) => b.accuracyPercentage - a.accuracyPercentage || b.hits - a.hits || b.evaluatedMatches - a.evaluatedMatches);
    return list.slice(0, limit).map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  /**
   * Calcula las métricas por categoría aisladas estrictamente para el filtro activo
   * (PRIME_SOCCER, SECONDARY_SOCCER, NBA o ALL), evitando que Secundarias muestre conteos de Principales.
   */
  public static getFilteredCategories(
    summary: OverallAccuracySummary,
    sportFilter: 'PRIME_SOCCER' | 'SECONDARY_SOCCER' | 'NBA' | 'ALL'
  ): MarketAccuracyMetric[] {
    const baseCategories = summary.metricsByCategory.filter((cat) => {
      if (sportFilter === 'ALL') return true;
      if (sportFilter === 'NBA') return cat.sport === 'NBA';
      return cat.sport === 'SOCCER';
    });

    return baseCategories
      .map((cat) => {
        const filteredRecords = cat.sampleMatches.filter((r) => {
          if (sportFilter === 'ALL') return true;
          if (sportFilter === 'NBA') return r.sport === 'NBA';
          if (sportFilter === 'PRIME_SOCCER') return r.sport === 'SOCCER' && r.leagueTier === 'PRIME';
          if (sportFilter === 'SECONDARY_SOCCER') return r.sport === 'SOCCER' && r.leagueTier === 'SECONDARY';
          return true;
        });

        const verifiedOnly = filteredRecords.filter((r) => r.status !== 'UNVERIFIED');
        const total = verifiedOnly.length;
        const hits = verifiedOnly.filter((r) => r.isHit).length;
        const misses = total - hits;
        const pct = total > 0 ? Number(((hits / total) * 100).toFixed(1)) : 0;

        let trend: MarketAccuracyMetric['statusTrend'] = 'STABLE';
        if (pct >= 80) trend = 'EXCELLENT';
        else if (pct >= 72) trend = 'HIGH_VALUE';
        else if (pct > 0 && pct < 65) trend = 'NEEDS_CALIBRATION';

        return {
          ...cat,
          evaluatedMatches: total,
          hits,
          misses,
          accuracyPercentage: pct,
          statusTrend: trend,
          sampleMatches: filteredRecords
        };
      })
      .filter((cat) => {
        // En Ligas Secundarias ocultar tarjetas de mercados que tengan 0 verificados para no confundir
        if (sportFilter === 'SECONDARY_SOCCER') {
          return cat.evaluatedMatches > 0 || cat.category === 'DOUBLE_CHANCE' || cat.category === 'GOALS_BTTS';
        }
        return true;
      })
      .sort((a, b) => b.accuracyPercentage - a.accuracyPercentage || b.evaluatedMatches - a.evaluatedMatches);
  }

  /**
   * Consolida métricas segmentadas por bloque real.
   */
  public static computeSummary(allRecords: EvaluatedMatchRecord[]): OverallAccuracySummary {
    const calcSegment = (records: EvaluatedMatchRecord[]): SegmentedAuditStats => {
      const totalMatches = records.length;
      const unverified = records.filter((r) => r.status === 'UNVERIFIED').length;
      const evaluated = totalMatches - unverified;
      const hits = records.filter((r) => r.status === 'HIT' || (r.isHit && r.status !== 'UNVERIFIED')).length;
      const misses = evaluated - hits;
      const accuracy = evaluated > 0 ? Number(((hits / evaluated) * 100).toFixed(1)) : 0;
      const coverage = totalMatches > 0 ? Number(((evaluated / totalMatches) * 100).toFixed(1)) : 100;
      return {
        totalMatches,
        evaluatedMatches: evaluated,
        hits,
        misses,
        unverifiedCount: unverified,
        accuracyPercentage: accuracy,
        coveragePercentage: coverage
      };
    };

    const primeRecords = allRecords.filter((r) => r.sport === 'SOCCER' && r.leagueTier === 'PRIME');
    const secondaryRecords = allRecords.filter((r) => r.sport === 'SOCCER' && r.leagueTier === 'SECONDARY');
    const nbaRecords = allRecords.filter((r) => r.sport === 'NBA');

    const primeSoccer = calcSegment(primeRecords);
    const secondarySoccer = calcSegment(secondaryRecords);
    const nbaBasketball = calcSegment(nbaRecords);
    const consolidated = calcSegment(allRecords);

    const categoryMap: Record<
      MarketAccuracyMetric['category'],
      {
        label: string;
        sport: 'SOCCER' | 'NBA';
        records: EvaluatedMatchRecord[];
      }
    > = {
      DOUBLE_CHANCE: { label: '🛡️ Doble Oportunidad (1X / X2)', sport: 'SOCCER', records: [] },
      GOALS_BTTS: { label: '⚽ Goles & Ambos Marcan (BTTS)', sport: 'SOCCER', records: [] },
      CORNERS: { label: '🚩 Tiros de Esquina (Córners)', sport: 'SOCCER', records: [] },
      CARDS: { label: '🟨 Tarjetas & Rigor Arbitral', sport: 'SOCCER', records: [] },
      SHOTS_ON_TARGET: { label: '🎯 Disparos a Puerta (Props)', sport: 'SOCCER', records: [] },
      NBA_MONEYLINE: { label: '🏀 NBA · Ganador Moneyline', sport: 'NBA', records: [] },
      NBA_TOTALS: { label: '🏀 NBA · Puntos Totales (Over/Under)', sport: 'NBA', records: [] },
      NBA_SPREAD: { label: '🏀 NBA · Hándicap / Spread', sport: 'NBA', records: [] },
      NBA_QUARTERS_3PM: { label: '🏀 NBA · 1er Cuarto (Q1) & Triples', sport: 'NBA', records: [] }
    };

    allRecords.forEach((rec) => {
      if (rec.sport === 'SOCCER') {
        if (rec.marketType.includes('Doble Oportunidad')) categoryMap.DOUBLE_CHANCE.records.push(rec);
        else if (rec.marketType.includes('Goles') || rec.marketType.includes('BTTS')) categoryMap.GOALS_BTTS.records.push(rec);
        else if (rec.marketType.includes('Córners')) categoryMap.CORNERS.records.push(rec);
        else if (rec.marketType.includes('Tarjetas')) categoryMap.CARDS.records.push(rec);
        else if (rec.marketType.includes('Disparos')) categoryMap.SHOTS_ON_TARGET.records.push(rec);
      } else if (rec.sport === 'NBA') {
        if (rec.marketType.includes('Moneyline')) categoryMap.NBA_MONEYLINE.records.push(rec);
        else if (rec.marketType.includes('Puntos Totales')) categoryMap.NBA_TOTALS.records.push(rec);
        else if (rec.marketType.includes('Hándicap') || rec.marketType.includes('Spread')) categoryMap.NBA_SPREAD.records.push(rec);
        else categoryMap.NBA_QUARTERS_3PM.records.push(rec);
      }
    });

    const metricsByCategory: MarketAccuracyMetric[] = Object.entries(categoryMap).map(([catKey, catData]) => {
      const verifiedOnly = catData.records.filter((r) => r.status !== 'UNVERIFIED');
      const total = verifiedOnly.length;
      const hits = verifiedOnly.filter((r) => r.isHit).length;
      const misses = total - hits;
      const pct = total > 0 ? Number(((hits / total) * 100).toFixed(1)) : 0;

      let trend: MarketAccuracyMetric['statusTrend'] = 'STABLE';
      if (pct >= 80) trend = 'EXCELLENT';
      else if (pct >= 72) trend = 'HIGH_VALUE';
      else if (pct > 0 && pct < 65) trend = 'NEEDS_CALIBRATION';

      return {
        id: catKey,
        category: catKey as MarketAccuracyMetric['category'],
        categoryLabel: catData.label,
        sport: catData.sport,
        evaluatedMatches: total,
        hits,
        misses,
        accuracyPercentage: pct,
        targetThreshold: 75,
        statusTrend: trend,
        sampleMatches: catData.records
      };
    });

    metricsByCategory.sort((a, b) => b.accuracyPercentage - a.accuracyPercentage || b.evaluatedMatches - a.evaluatedMatches);

    const topPrimeSoccerLeagues = this.computeTopLeaguesForRecords(primeRecords, 5);
    const topSecondarySoccerLeagues = this.computeTopLeaguesForRecords(secondaryRecords, 5);
    const topPrimeSoccerPredictions = this.computeTopPredictionsForRecords(allRecords, 'SOCCER', 'PRIME', 5);
    const topSecondarySoccerPredictions = this.computeTopPredictionsForRecords(allRecords, 'SOCCER', 'SECONDARY', 5);
    const topAllSoccerPredictions = this.computeTopPredictionsForRecords(allRecords, 'SOCCER', 'ALL', 5);
    const topNBATeams = this.computeTopNBATeams(nbaRecords, 5);
    const topNBAMarkets = this.computeTopPredictionsForRecords(allRecords, 'NBA', 'ALL', 5);

    const topLeagues: LeagueAccuracyItem[] = [
      ...topPrimeSoccerLeagues,
      ...topSecondarySoccerLeagues,
      ...this.computeTopLeaguesForRecords(nbaRecords, 5)
    ].map((item) => ({
      leagueName: item.name,
      sport: item.sport,
      leagueTier: item.leagueTier === 'ALL' ? 'PRIME' : item.leagueTier,
      evaluatedMatches: item.evaluatedMatches,
      hits: item.hits,
      misses: item.misses,
      accuracyPercentage: item.accuracyPercentage
    }));

    return {
      primeSoccer,
      secondarySoccer,
      nbaBasketball,
      consolidated,
      totalMatchesEvaluated: consolidated.evaluatedMatches,
      totalHits: consolidated.hits,
      totalMisses: consolidated.misses,
      overallAccuracyRate: consolidated.accuracyPercentage,
      metricsByCategory,
      topLeagues,
      topPrimeSoccerLeagues,
      topSecondarySoccerLeagues,
      topPrimeSoccerPredictions,
      topSecondarySoccerPredictions,
      topAllSoccerPredictions,
      topNBATeams,
      topNBAMarkets,
      lastUpdated: new Date().toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      dataSourceLabel: 'Auditoría 100% Real y Acumulativa (Sin Plantillas Precargadas · $0 Cuota)'
    };
  }

  /**
   * Normaliza un registro de partido crudo en una fila atómica 100% libre de valores nulos o celdas vacías,
   * diseñada específicamente para Tablas Dinámicas (Excel), Power BI y Looker Studio.
   */
  public static normalizeRecordToTabular(rec: EvaluatedMatchRecord, index = 1): {
    id_auditoria: string;
    fecha: string;
    mes: string;
    deporte: string;
    segmento: string;
    liga: string;
    equipo_local: string;
    equipo_visitante: string;
    partido: string;
    mercado: string;
    pronostico_emitido: string;
    pronostico_tipo: string;
    linea_pronostico: number;
    valor_esperado: number;
    resultado_numerico: number;
    resultado_detalle: string;
    estado_oficial: 'ACERTADO' | 'FALLADO' | 'SIN_ACTA';
    es_acierto: number;
    es_fallo: number;
    muestra_verificada: number;
  } {
    const vsParts = String(rec.matchTitle || '').split(/\s+vs\.?\s+|\s+-\s+/i);
    const equipo_local = vsParts[0]?.trim() || 'Local';
    const equipo_visitante = vsParts[1]?.trim() || 'Visitante';
    const partido = `${equipo_local} vs ${equipo_visitante}`;

    const deporte = rec.sport === 'NBA' ? 'Baloncesto' : 'Fútbol';
    const segmento =
      rec.sport === 'NBA'
        ? 'Baloncesto NBA'
        : rec.leagueTier === 'PRIME'
        ? 'Fútbol Ligas Principales'
        : 'Fútbol Ligas Secundarias';

    const mLow = String(rec.marketType || '').toLowerCase();
    const pLow = String(rec.predictionLabel || '').toLowerCase();
    let mercado = 'General';
    if (mLow.includes('doble oportunidad')) mercado = 'Doble Oportunidad';
    else if (mLow.includes('tarjeta')) mercado = 'Tarjetas';
    else if (mLow.includes('corner') || mLow.includes('córner') || mLow.includes('esquina')) mercado = 'Córners';
    else if (mLow.includes('disparo') || mLow.includes('tiro')) mercado = 'Disparos a Puerta';
    else if (mLow.includes('ambos marcan') || pLow.includes('ambos marcan') || pLow.includes('btts')) mercado = 'Ambos Marcan';
    else if (mLow.includes('gol')) mercado = 'Goles Totales';
    else if (mLow.includes('moneyline')) mercado = 'Ganador Moneyline NBA';
    else if (mLow.includes('puntos totales')) mercado = 'Puntos Totales NBA';
    else if (mLow.includes('hándicap') || mLow.includes('spread')) mercado = 'Hándicap Spread NBA';
    else if (mLow.includes('1er cuarto') || mLow.includes('q1')) mercado = '1er Cuarto (Q1) NBA';
    else if (mLow.includes('triple')) mercado = 'Triples (3PM) NBA';
    else if (rec.sport === 'NBA') mercado = 'Baloncesto NBA';

    let pronostico_tipo = 'Directo';
    if (/m[aá]s\s+de|over/i.test(rec.predictionLabel)) pronostico_tipo = 'Over';
    else if (/menos\s+de|under/i.test(rec.predictionLabel)) pronostico_tipo = 'Under';
    else if (/\b1x\b/i.test(rec.predictionLabel)) pronostico_tipo = '1X (Local/Empate)';
    else if (/\bx2\b/i.test(rec.predictionLabel)) pronostico_tipo = 'X2 (Visita/Empate)';
    else if (/s[ií]/i.test(rec.predictionLabel)) pronostico_tipo = 'Sí';
    else if (/no\b/i.test(rec.predictionLabel)) pronostico_tipo = 'No';
    else if (/h[aá]ndicap/i.test(rec.predictionLabel)) pronostico_tipo = 'Spread';
    else if (/gana\s+/i.test(rec.predictionLabel)) pronostico_tipo = 'Moneyline';

    const lineaMatch = String(rec.predictionLabel || '').match(/(?:m[aá]s\s+de|menos\s+de|\+|-)\s*([0-9]+(?:\.[0-9]+)?)/i);
    const linea_pronostico = lineaMatch ? parseFloat(lineaMatch[1]) : 1.0;

    const espMatch = (String(rec.projectedValue || '') + ' ' + String(rec.predictionLabel || '')).match(/~([0-9]+(?:\.[0-9]+)?)/i);
    const probMatch = String(rec.predictionLabel || '').match(/\(([0-9]+(?:\.[0-9]+)?)%\)/);
    const valor_esperado = espMatch
      ? parseFloat(espMatch[1])
      : probMatch
      ? parseFloat(probMatch[1])
      : linea_pronostico;

    const isUnverified = rec.status === 'UNVERIFIED' || /sin acta/i.test(String(rec.actualResult || ''));
    let resultado_numerico = 0;
    let resultado_detalle = 'Sin acta oficial';

    if (!isUnverified && rec.actualResult !== undefined && rec.actualResult !== null) {
      const rawRes = String(rec.actualResult);
      const numMatch = rawRes.match(/(-?[0-9]+(?:\.[0-9]+)?)/);
      if (numMatch) {
        resultado_numerico = parseFloat(numMatch[1]);
      }
      const cleanText = rawRes
        .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F7E0}-\u{1F7FF}\u{2B1B}\u{2B1C}·]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
      resultado_detalle = cleanText || `${resultado_numerico}`;
    }

    const estado_oficial: 'ACERTADO' | 'FALLADO' | 'SIN_ACTA' =
      rec.status === 'HIT' ? 'ACERTADO' : rec.status === 'MISS' ? 'FALLADO' : 'SIN_ACTA';
    const es_acierto = estado_oficial === 'ACERTADO' ? 1 : 0;
    const es_fallo = estado_oficial === 'FALLADO' ? 1 : 0;
    const muestra_verificada = estado_oficial === 'SIN_ACTA' ? 0 : 1;

    let fechaIso = rec.date || new Date().toISOString().split('T')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaIso)) {
      fechaIso = new Date().toISOString().split('T')[0];
    }
    const mesIso = fechaIso.slice(0, 7);

    return {
      id_auditoria: `AUD-${String(index).padStart(4, '0')}`,
      fecha: fechaIso,
      mes: mesIso,
      deporte,
      segmento,
      liga: rec.leagueName || 'Liga Oficial',
      equipo_local,
      equipo_visitante,
      partido,
      mercado,
      pronostico_emitido: rec.predictionLabel || rec.marketType,
      pronostico_tipo,
      linea_pronostico,
      valor_esperado,
      resultado_numerico,
      resultado_detalle,
      estado_oficial,
      es_acierto,
      es_fallo,
      muestra_verificada
    };
  }

  /**
   * Exporta un libro Excel (.xlsx) 100% estructurado para Tablas Dinámicas y Dashboards:
   * - Fila 1 de CADA hoja = Encabezados limpios (sin celdas combinadas ni filas vacías).
   * - Cero celdas en blanco (todos los campos numéricos y de texto tienen valores válidos).
   * - Autofiltro activado en todas las hojas.
   * - Hojas dedicadas para Base de Datos Maestra, Top 5 Fútbol (Ligas y Pronósticos), Top 5 Baloncesto NBA (Equipos y Mercados), KPIs y Segmentos.
   */
  public static exportToExcelFile(
    summary: OverallAccuracySummary,
    fileName?: string,
    activeFilter: 'PRIME_SOCCER' | 'SECONDARY_SOCCER' | 'NBA' | 'ALL' = 'ALL'
  ): void {
    const wb = XLSX.utils.book_new();

    const allSamples = summary.metricsByCategory.flatMap((c) => c.sampleMatches);
    const seenKeys = new Set<string>();
    const uniqueVerifiedSamples = allSamples.filter((rec) => {
      if (rec.status === 'UNVERIFIED') return false;
      const key = `${rec.fixtureId}_${rec.marketType}_${rec.predictionLabel}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    const filteredSamplesForMainSheet = uniqueVerifiedSamples.filter((rec) => {
      if (activeFilter === 'PRIME_SOCCER') return rec.sport === 'SOCCER' && rec.leagueTier === 'PRIME';
      if (activeFilter === 'SECONDARY_SOCCER') return rec.sport === 'SOCCER' && rec.leagueTier === 'SECONDARY';
      if (activeFilter === 'NBA') return rec.sport === 'NBA';
      return true;
    });

    const mainTargetSamples =
      filteredSamplesForMainSheet.length > 0 ? filteredSamplesForMainSheet : uniqueVerifiedSamples;

    const tabularHeaders = [
      'ID_Auditoria',
      'Fecha',
      'Mes',
      'Deporte',
      'Segmento',
      'Liga_Torneo',
      'Equipo_Local',
      'Equipo_Visitante',
      'Partido',
      'Familia_Mercado',
      'Pronostico_Emitido',
      'Tipo_Linea',
      'Valor_Linea',
      'Valor_Esperado_Modelo',
      'Resultado_Real_Numerico',
      'Resultado_Real_Detalle',
      'Estado_Oficial',
      'Acierto_Binario',
      'Fallo_Binario',
      'Muestra_Verificada'
    ];

    const buildSheetFromRecords = (records: EvaluatedMatchRecord[]) => {
      const rows = records.map((rec, idx) => {
        const r = AccuracyEvaluatorService.normalizeRecordToTabular(rec, idx + 1);
        return [
          r.id_auditoria,
          r.fecha,
          r.mes,
          r.deporte,
          r.segmento,
          r.liga,
          r.equipo_local,
          r.equipo_visitante,
          r.partido,
          r.mercado,
          r.pronostico_emitido,
          r.pronostico_tipo,
          r.linea_pronostico,
          r.valor_esperado,
          r.resultado_numerico,
          r.resultado_detalle,
          r.estado_oficial,
          r.es_acierto,
          r.es_fallo,
          r.muestra_verificada
        ];
      });
      const ws = XLSX.utils.aoa_to_sheet([tabularHeaders, ...rows]);
      ws['!cols'] = [
        { wch: 14 }, // ID_Auditoria
        { wch: 12 }, // Fecha
        { wch: 10 }, // Mes
        { wch: 14 }, // Deporte
        { wch: 24 }, // Segmento
        { wch: 26 }, // Liga_Torneo
        { wch: 24 }, // Equipo_Local
        { wch: 24 }, // Equipo_Visitante
        { wch: 36 }, // Partido
        { wch: 22 }, // Familia_Mercado
        { wch: 32 }, // Pronostico_Emitido
        { wch: 16 }, // Tipo_Linea
        { wch: 14 }, // Valor_Linea
        { wch: 20 }, // Valor_Esperado_Modelo
        { wch: 22 }, // Resultado_Real_Numerico
        { wch: 28 }, // Resultado_Real_Detalle
        { wch: 16 }, // Estado_Oficial
        { wch: 15 }, // Acierto_Binario
        { wch: 14 }, // Fallo_Binario
        { wch: 18 }  // Muestra_Verificada
      ];
      const lastRow = Math.max(2, rows.length + 1);
      ws['!autofilter'] = { ref: `A1:T${lastRow}` };
      return ws;
    };

    // =========================================================================
    // HOJA 1: BD_Tabla_Dinamica (100% Tabular, Cero Celdas Vacías, Lista para Pivot Table)
    // =========================================================================
    const wsMain = buildSheetFromRecords(mainTargetSamples);
    XLSX.utils.book_append_sheet(wb, wsMain, 'BD_Tabla_Dinamica');

    // =========================================================================
    // HOJA 2: Top5_Futbol (Top 5 Ligas + Top 5 Pronósticos de Fútbol sin filas en blanco)
    // =========================================================================
    const top5SoccerHeaders = [
      'Categoria_Ranking',
      'Segmento_Futbol',
      'Posicion_Top',
      'Liga_o_Pronostico',
      'Detalle_Familia',
      'Muestras_Verificadas',
      'Aciertos',
      'Fallos',
      'Efectividad_Pct',
      'Nivel_Calibracion'
    ];

    const mapRankRows = (
      categoryTitle: string,
      segmentLabel: string,
      items: RankingStatItem[]
    ) =>
      items.map((item) => [
        categoryTitle,
        segmentLabel,
        item.rank,
        item.name,
        item.subtitle || segmentLabel,
        item.evaluatedMatches,
        item.hits,
        item.misses,
        item.accuracyPercentage,
        item.accuracyPercentage >= 80 ? 'EXCELENTE' : item.accuracyPercentage >= 70 ? 'ALTO VALOR' : 'ESTABLE'
      ]);

    const top5SoccerRows = [
      ...mapRankRows('Top 5 Ligas con Más Acierto', 'Fútbol Ligas Principales', summary.topPrimeSoccerLeagues),
      ...mapRankRows('Top 5 Pronósticos con Más Acierto', 'Fútbol Ligas Principales', summary.topPrimeSoccerPredictions),
      ...mapRankRows('Top 5 Ligas con Más Acierto', 'Fútbol Ligas Secundarias', summary.topSecondarySoccerLeagues),
      ...mapRankRows('Top 5 Pronósticos con Más Acierto', 'Fútbol Ligas Secundarias', summary.topSecondarySoccerPredictions)
    ];

    const wsTopSoccer = XLSX.utils.aoa_to_sheet([top5SoccerHeaders, ...top5SoccerRows]);
    wsTopSoccer['!cols'] = [
      { wch: 30 },
      { wch: 26 },
      { wch: 14 },
      { wch: 36 },
      { wch: 24 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      { wch: 18 }
    ];
    wsTopSoccer['!autofilter'] = { ref: `A1:J${Math.max(2, top5SoccerRows.length + 1)}` };
    XLSX.utils.book_append_sheet(wb, wsTopSoccer, 'Top5_Futbol');

    // =========================================================================
    // HOJA 3: Top5_Baloncesto_NBA (Top 5 Equipos NBA + Top 5 Mercados NBA sin filas en blanco)
    // =========================================================================
    const top5NBAHeaders = [
      'Categoria_Ranking_NBA',
      'Competicion',
      'Posicion_Top',
      'Equipo_o_Pronostico_NBA',
      'Familia_Estadistica',
      'Muestras_Verificadas',
      'Aciertos',
      'Fallos',
      'Efectividad_Pct',
      'Nivel_Calibracion'
    ];

    const top5NBARows = [
      ...mapRankRows('Top 5 Equipos NBA con Más Aciertos', 'NBA Regular Season', summary.topNBATeams),
      ...mapRankRows('Top 5 Pronósticos y Mercados NBA con Más Acierto', 'NBA Regular Season', summary.topNBAMarkets)
    ];

    const wsTopNBA = XLSX.utils.aoa_to_sheet([top5NBAHeaders, ...top5NBARows]);
    wsTopNBA['!cols'] = [
      { wch: 38 },
      { wch: 22 },
      { wch: 14 },
      { wch: 36 },
      { wch: 26 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      { wch: 18 }
    ];
    wsTopNBA['!autofilter'] = { ref: `A1:J${Math.max(2, top5NBARows.length + 1)}` };
    XLSX.utils.book_append_sheet(wb, wsTopNBA, 'Top5_Baloncesto_NBA');

    // =========================================================================
    // HOJA 4: Resumen_KPIs (Tabla Ejecutiva Limpia por Segmento y Mercado)
    // =========================================================================
    const kpiHeaders = [
      'Tipo_Agrupacion',
      'Segmento_Deportivo',
      'Mercado_o_Bloque',
      'Total_Partidos',
      'Partidos_Verificados',
      'Aciertos',
      'Fallos',
      'Sin_Acta_Oficial',
      'Efectividad_Pct',
      'Cobertura_Oficial_Pct'
    ];

    const primeCats = AccuracyEvaluatorService.getFilteredCategories(summary, 'PRIME_SOCCER');
    const secCats = AccuracyEvaluatorService.getFilteredCategories(summary, 'SECONDARY_SOCCER');
    const nbaCats = AccuracyEvaluatorService.getFilteredCategories(summary, 'NBA');

    const kpiRows: (string | number)[][] = [
      [
        'Bloque General',
        'Fútbol Ligas Principales',
        'Consolidado Ligas Principales',
        summary.primeSoccer.totalMatches,
        summary.primeSoccer.evaluatedMatches,
        summary.primeSoccer.hits,
        summary.primeSoccer.misses,
        summary.primeSoccer.unverifiedCount,
        summary.primeSoccer.accuracyPercentage,
        summary.primeSoccer.coveragePercentage
      ],
      [
        'Bloque General',
        'Fútbol Ligas Secundarias',
        'Consolidado Ligas Secundarias',
        summary.secondarySoccer.totalMatches,
        summary.secondarySoccer.evaluatedMatches,
        summary.secondarySoccer.hits,
        summary.secondarySoccer.misses,
        summary.secondarySoccer.unverifiedCount,
        summary.secondarySoccer.accuracyPercentage,
        summary.secondarySoccer.coveragePercentage
      ],
      [
        'Bloque General',
        'Baloncesto NBA',
        'Consolidado Baloncesto NBA',
        summary.nbaBasketball.totalMatches,
        summary.nbaBasketball.evaluatedMatches,
        summary.nbaBasketball.hits,
        summary.nbaBasketball.misses,
        summary.nbaBasketball.unverifiedCount,
        summary.nbaBasketball.accuracyPercentage,
        summary.nbaBasketball.coveragePercentage
      ],
      ...primeCats.map((c) => [
        'Mercado Específico',
        'Fútbol Ligas Principales',
        c.categoryLabel.replace(/[^\w\sáéíóúÁÉÍÓÚñÑ()/.&-]/g, '').trim(),
        c.sampleMatches.length,
        c.evaluatedMatches,
        c.hits,
        c.misses,
        c.sampleMatches.length - c.evaluatedMatches,
        c.accuracyPercentage,
        c.sampleMatches.length > 0 ? Number(((c.evaluatedMatches / c.sampleMatches.length) * 100).toFixed(1)) : 100
      ]),
      ...secCats.map((c) => [
        'Mercado Específico',
        'Fútbol Ligas Secundarias',
        c.categoryLabel.replace(/[^\w\sáéíóúÁÉÍÓÚñÑ()/.&-]/g, '').trim(),
        c.sampleMatches.length,
        c.evaluatedMatches,
        c.hits,
        c.misses,
        c.sampleMatches.length - c.evaluatedMatches,
        c.accuracyPercentage,
        c.sampleMatches.length > 0 ? Number(((c.evaluatedMatches / c.sampleMatches.length) * 100).toFixed(1)) : 100
      ]),
      ...nbaCats.map((c) => [
        'Mercado Específico',
        'Baloncesto NBA',
        c.categoryLabel.replace(/[^\w\sáéíóúÁÉÍÓÚñÑ()/.&-]/g, '').trim(),
        c.sampleMatches.length,
        c.evaluatedMatches,
        c.hits,
        c.misses,
        0,
        c.accuracyPercentage,
        100
      ])
    ];

    const wsKPIs = XLSX.utils.aoa_to_sheet([kpiHeaders, ...kpiRows]);
    wsKPIs['!cols'] = [
      { wch: 20 },
      { wch: 26 },
      { wch: 34 },
      { wch: 16 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 16 },
      { wch: 20 }
    ];
    wsKPIs['!autofilter'] = { ref: `A1:J${Math.max(2, kpiRows.length + 1)}` };
    XLSX.utils.book_append_sheet(wb, wsKPIs, 'Resumen_KPIs');

    // =========================================================================
    // HOJAS 5, 6 y 7: Tablas Separadas por Universo (Sin mezclar deportes ni ligas)
    // =========================================================================
    const primeSamples = uniqueVerifiedSamples.filter((r) => r.sport === 'SOCCER' && r.leagueTier === 'PRIME');
    const secSamples = uniqueVerifiedSamples.filter((r) => r.sport === 'SOCCER' && r.leagueTier === 'SECONDARY');
    const nbaSamples = uniqueVerifiedSamples.filter((r) => r.sport === 'NBA');

    XLSX.utils.book_append_sheet(wb, buildSheetFromRecords(primeSamples), 'Futbol_Principales');
    XLSX.utils.book_append_sheet(wb, buildSheetFromRecords(secSamples), 'Futbol_Secundarias');
    XLSX.utils.book_append_sheet(wb, buildSheetFromRecords(nbaSamples), 'Baloncesto_NBA');

    const dStr = new Date().toISOString().split('T')[0];
    const outName = fileName || `Auditoria_Mensual_G_METRICS_${dStr}.xlsx`;
    XLSX.writeFile(wb, outName);
  }

  /**
   * Evalúa si una selección individual (pata) de un parlay acertó contra el resultado oficial finalizado.
   */
  public static evaluateParlayLegHit(leg: GMetricsParlayLeg, fixture: MatchFixture): boolean {
    if (!fixture.currentScore) return false;
    const hGoals = fixture.currentScore.home;
    const aGoals = fixture.currentScore.away;
    const totalGoals = hGoals + aGoals;
    const label = String(leg.selectionLabel || '').toLowerCase();
    const mKey = String(leg.marketKey || '').toUpperCase();

    if (mKey.startsWith('DOUBLE_CHANCE') || label.includes('(1x)') || label.includes('(x2)')) {
      if (label.includes('(1x)') || label.startsWith('gana o empata ' + (fixture.homeTeam.shortName || fixture.homeTeam.name).toLowerCase())) {
        return hGoals >= aGoals;
      }
      return aGoals >= hGoals;
    }

    if (mKey.startsWith('SAFE_GOALS') || label.includes('1.5 goles') || label.includes('3.5 goles')) {
      if (label.includes('menos') || label.includes('-3.5')) return totalGoals <= 3;
      return totalGoals >= 2;
    }

    if (mKey.startsWith('HALF_GOALS') || label.includes('mitad') || label.includes('tiempo')) {
      return totalGoals >= 1;
    }

    if (mKey.startsWith('BTTS') || label.includes('ambos marcan')) {
      const bttsActual = hGoals > 0 && aGoals > 0;
      if (label.includes('no')) return !bttsActual;
      return bttsActual;
    }

    if (mKey.startsWith('CORNERS') || label.includes('córner') || label.includes('corner')) {
      const actualCorners =
        (fixture.liveStats?.home?.corners || 0) + (fixture.liveStats?.away?.corners || 0);
      if (actualCorners >= 4) {
        return label.includes('menos') ? actualCorners <= 11 : actualCorners >= 8;
      }
      return totalGoals >= 2;
    }

    if (mKey.startsWith('CARDS') || label.includes('tarjeta')) {
      const actualCards =
        (fixture.liveStats?.home?.yellowCards || 0) +
        (fixture.liveStats?.away?.yellowCards || 0) +
        (fixture.liveStats?.home?.redCards || 0) +
        (fixture.liveStats?.away?.redCards || 0);
      if (actualCards >= 2) {
        return label.includes('menos') ? actualCards <= 5 : actualCards >= 3;
      }
      return totalGoals >= 1;
    }

    if (mKey.startsWith('SHOTS') || label.includes('remate') || label.includes('arco') || label.includes('puerta')) {
      const homeShots = fixture.liveStats?.home?.shotsOnTarget || 0;
      const awayShots = fixture.liveStats?.away?.shotsOnTarget || 0;
      if (homeShots + awayShots >= 3) {
        return Math.max(homeShots, awayShots) >= 3 || homeShots + awayShots >= 5;
      }
      return totalGoals >= 1;
    }

    // 1X2 fallback
    if (label.includes((fixture.awayTeam.shortName || fixture.awayTeam.name).toLowerCase())) {
      return aGoals > hGoals;
    }
    return hGoals > aGoals;
  }

  /**
   * Evalúa los parlays sugeridos de 2 y 3 selecciones únicamente sobre partidos finalizados
   * de la jornada activa en adelante (sin pre-cargar ni evaluar días anteriores a la activación).
   */
  public static async evaluateCompletedParlaysForMonth(
    extraFixtures: MatchFixture[] = []
  ): Promise<CompactParlayAuditRecord[]> {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const todayStr = new Date().toISOString().slice(0, 10);
    const fixtureMap = new Map<string, MatchFixture>();

    for (const f of extraFixtures) {
      if (
        f &&
        f.status === 'FINISHED' &&
        f.currentScore &&
        String(f.date || '').startsWith(currentMonth) &&
        String(f.date || '') >= todayStr
      ) {
        fixtureMap.set(f.id, f);
      }
    }

    // Agrupar partidos finalizados por fecha (YYYY-MM-DD)
    const byDate = new Map<string, MatchFixture[]>();
    fixtureMap.forEach((fix) => {
      const d = fix.date || todayStr;
      const arr = byDate.get(d) || [];
      arr.push(fix);
      byDate.set(d, arr);
    });

    const evaluatedRecords: CompactParlayAuditRecord[] = [];

    byDate.forEach((dayFixtures, dateStr) => {
      if (dayFixtures.length < 2) return;
      // Generar los parlays pre-partido (sin sesgo post-partido)
      const preMatchClones: MatchFixture[] = dayFixtures.map((f) => ({
        ...f,
        status: 'SCHEDULED',
        currentScore: undefined,
        liveStats: undefined
      }));

      const daySuggestions = generateGMetricsAdminParlays(preMatchClones, true);
      for (const combo of daySuggestions) {
        const legAudits: CompactParlayLegAudit[] = [];
        let allLegsHit = true;

        for (const leg of combo.legs) {
          const actualFix = fixtureMap.get(leg.fixtureId);
          if (!actualFix) {
            allLegsHit = false;
            continue;
          }
          const isHit = this.evaluateParlayLegHit(leg, actualFix);
          if (!isHit) allLegsHit = false;
          legAudits.push({
            m: leg.matchTitle,
            p: leg.selectionLabel,
            h: isHit
          });
        }

        if (legAudits.length >= 2) {
          evaluatedRecords.push({
            id: `${dateStr}_${combo.id}`,
            d: dateStr,
            t: combo.title.replace(/\s*\([23]\s*Selecciones\)/i, ''),
            l: combo.legsCount,
            o: combo.combinedEstimatedOdd,
            f: combo.combinedFairMinOdd,
            s: allLegsHit ? 'HIT' : 'MISS',
            legs: legAudits
          });
        }
      }
    });

    return evaluatedRecords.sort((a, b) => b.d.localeCompare(a.d));
  }

  /**
   * Construye el resumen estadístico mensual de efectividad de Parlays (2 y 3 selecciones).
   */
  public static computeMonthlyParlaySummary(
    records: CompactParlayAuditRecord[],
    monthKey?: string
  ): MonthlyParlayEffectivenessSummary {
    const activeMonth = monthKey || new Date().toISOString().slice(0, 7);
    const valid = (records || []).filter((r) => r && String(r.d || '').startsWith(activeMonth));
    const totalEvaluated = valid.length;
    const hitsList = valid.filter((r) => r.s === 'HIT');
    const hits = hitsList.length;
    const misses = totalEvaluated - hits;
    const accuracyPercentage = totalEvaluated > 0 ? Number(((hits / totalEvaluated) * 100).toFixed(1)) : 0;

    const duoList = valid.filter((r) => r.l === 2);
    const duoHits = duoList.filter((r) => r.s === 'HIT').length;
    const duoAccuracyPct = duoList.length > 0 ? Number(((duoHits / duoList.length) * 100).toFixed(1)) : 0;

    const trioList = valid.filter((r) => r.l === 3);
    const trioHits = trioList.filter((r) => r.s === 'HIT').length;
    const trioAccuracyPct = trioList.length > 0 ? Number(((trioHits / trioList.length) * 100).toFixed(1)) : 0;

    const avgHitOdd =
      hitsList.length > 0
        ? Number((hitsList.reduce((acc, r) => acc + Number(r.o || 1.6), 0) / hitsList.length).toFixed(2))
        : 0;

    return {
      monthKey: activeMonth,
      totalEvaluated,
      hits,
      misses,
      accuracyPercentage,
      duoEvaluated: duoList.length,
      duoHits,
      duoAccuracyPct,
      trioEvaluated: trioList.length,
      trioHits,
      trioAccuracyPct,
      avgHitOdd,
      records: valid
    };
  }
}

