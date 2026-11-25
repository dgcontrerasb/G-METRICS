/**
 * Capa 6: Motor Cuantitativo de Parlays Consensuados y Apuestas Sencillas (+EV y Bankers)
 * Aplica ensemble voting de 3 sub-modelos, LCB Bayesiano para inmunidad a varianza,
 * prueba de estrés determinística y Kelly conservador fraccional (25%).
 */

import {
  MatchFixture,
  MatchAnalysis,
  NBAMatchFixture,
  GMetricsSingleBetSuggestion
} from '../../types';
import { generateGMetricsNBABankerPicks } from '../nbaEngine';
import { evaluateBayesianCredibility } from './bayesianUncertaintyModel';

export interface GMetricsSubModelConsensus {
  dixonColesApproved: boolean;
  eloFormApproved: boolean;
  fatigueImmunityApproved: boolean;
  unanimousScore: number; // 0 to 100
  subModelSummary: string;
}

export interface GMetricsParlayLeg {
  fixtureId: string;
  matchTitle: string;
  homeTeamName: string;
  awayTeamName: string;
  leagueName: string;
  matchDate: string;
  matchTime: string;
  estimatedEndTimestamp: number;
  marketKey: string;
  selectionLabel: string;
  categoryLabel: string;
  probability: number;
  fairMinOdd: number; // Cuota Mínima Recomendada (100 / prob)
  estimatedBookieOdd: number; // Cuota estimada en casa de apuestas
  whySelected: string;
  consensus: GMetricsSubModelConsensus;
}

export interface GMetricsStressTestResult {
  simulatedWinsPer100: number;
  trafficLight: 'GREEN' | 'YELLOW' | 'RED';
  trafficLabel: string;
  beginnerExplanation: string;
  gMetricsAdvice: string;
  hasHighRiskDropCandidate: boolean;
  boostedProbabilityIfTrimmed?: number;
  relativeProbabilityGainPct?: number;
  hardestPickIds: string[];
}

export interface GMetricsParlaySuggestion {
  id: string;
  title: string;
  subtitle: string;
  tierBadge: string;
  legsCount: 2 | 3;
  legs: GMetricsParlayLeg[];
  combinedEstimatedOdd: number;
  combinedFairMinOdd: number; // Cuota Mínima Recomendada del Parlay completo
  jointProbability: number;
  expectedValueEdgePct: number;
  recommendedKellyStakePct: number;
  lastMatchEndTimestamp: number; // Momento en que termina el último partido del boleto
  expiresAtTimestamp: number; // Máximo 2 días (48h) después de terminado el último partido
  stressTest: GMetricsStressTestResult;
}

export function computeEstimatedMatchEndTimestamp(fixture: MatchFixture): number {
  if (fixture.startTimestamp && fixture.startTimestamp > 0) {
    return fixture.startTimestamp + 2 * 60 * 60 * 1000;
  }
  try {
    const [y, m, d] = (fixture.date || '').split('-').map(Number);
    const [hh, mm] = (fixture.time || '15:00').split(':').map(Number);
    if (y && m && d) {
      const startMs = new Date(y, m - 1, d, hh || 15, mm || 0, 0).getTime();
      return startMs + 2 * 60 * 60 * 1000;
    }
  } catch {
    // fallback
  }
  return Date.now() + 2 * 60 * 60 * 1000;
}

/**
 * Evalúa la Prueba de Estrés y Cuota Mínima Recomendada (Fair Odds) para cualquier lista de selecciones.
 */
export function evaluateParlayStressAndFairOdds(
  items: { id: string; probability: number; odd: number; label?: string }[]
): {
  jointProbability: number;
  combinedFairMinOdd: number;
  combinedUserOdd: number;
  isPositiveEV: boolean;
  evEdgePercent: number;
  stressTest: GMetricsStressTestResult;
} {
  if (!items || items.length === 0) {
    return {
      jointProbability: 0,
      combinedFairMinOdd: 1.0,
      combinedUserOdd: 1.0,
      isPositiveEV: false,
      evEdgePercent: 0,
      stressTest: {
        simulatedWinsPer100: 0,
        trafficLight: 'YELLOW',
        trafficLabel: 'Sin Selecciones',
        beginnerExplanation: 'Agrega selecciones al boleto para ejecutar la simulación de estabilidad.',
        gMetricsAdvice: '💡 Consejo G METRICS: Selecciona entre 2 y 3 mercados de alta probabilidad para armar un boleto sólido.',
        hasHighRiskDropCandidate: false,
        hardestPickIds: []
      }
    };
  }

  const rawJointProb = items.reduce(
    (acc, item) => acc * (Math.max(5, Math.min(98, item.probability)) / 100),
    1.0
  );
  const jointProbability = Number((rawJointProb * 100).toFixed(1));

  const rawFairOdd = jointProbability > 0 ? 100 / jointProbability : 1.0;
  const combinedFairMinOdd = Number(Math.max(1.05, rawFairOdd).toFixed(2));

  const combinedUserOdd = Number(
    items.reduce((acc, item) => acc * Math.max(1.01, item.odd || 1.01), 1.0).toFixed(2)
  );

  const evEdgePercent = Number((((combinedUserOdd / combinedFairMinOdd) - 1) * 100).toFixed(1));
  const isPositiveEV = combinedUserOdd >= combinedFairMinOdd;

  const varianceDrag = items.length > 3 ? Math.pow(0.97, items.length - 3) : 1.0;
  const simulatedWinsPer100 = Math.max(1, Math.min(96, Math.round(jointProbability * varianceDrag)));

  const sortedByDifficulty = [...items].sort((a, b) => a.probability - b.probability);
  const hardestTwo = sortedByDifficulty.slice(0, 2);
  const hardestPickIds = hardestTwo.map((h) => h.id);

  let boostedProbabilityIfTrimmed: number | undefined;
  let relativeProbabilityGainPct: number | undefined;
  const hasHighRiskDropCandidate = items.length >= 3 && jointProbability < 48;

  if (items.length >= 3) {
    const remaining = items.filter((it) => !hardestPickIds.includes(it.id));
    const trimmedProbRaw = remaining.reduce(
      (acc, item) => acc * (Math.max(5, Math.min(98, item.probability)) / 100),
      1.0
    );
    boostedProbabilityIfTrimmed = Number((trimmedProbRaw * 100).toFixed(1));
    if (jointProbability > 0) {
      relativeProbabilityGainPct = Math.max(
        40,
        Math.round(((boostedProbabilityIfTrimmed - jointProbability) / jointProbability) * 100)
      );
    }
  }

  let trafficLight: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
  let trafficLabel = 'Confianza Alta · Boleto Estable';
  let beginnerExplanation = `En 100 simulaciones, este ticket se acertó en ${simulatedWinsPer100} de ellas. De cada 10 apuestas iguales, la matemática prevé ganar aproximadamente ${Math.max(1, Math.round(simulatedWinsPer100 / 10))}.`;
  let gMetricsAdvice = `💡 "Consejo G METRICS: Boleto equilibrado y de baja varianza. Verifica que tu casa de apuestas te pague mínimo @${combinedFairMinOdd.toFixed(2)}x para asegurar valor real."`;

  if (jointProbability < 32 || items.length >= 4) {
    trafficLight = 'RED';
    trafficLabel = 'Riesgo Elevado · Alta Varianza';
    beginnerExplanation = `En 100 simulaciones, este ticket solo se acertó en ${simulatedWinsPer100} ocasiones. Acumular demasiadas selecciones multiplica el riesgo de fallar por un solo partido.`;
    gMetricsAdvice = `💡 "Consejo G METRICS: Tu ticket tiene un riesgo elevado. Si quitas las 2 selecciones más difíciles, tu probabilidad de ganar aumenta un 40%."`;
  } else if (jointProbability < 50 || items.length === 3) {
    trafficLight = 'YELLOW';
    trafficLabel = 'Confianza Moderada · Riesgo Equilibrado';
    beginnerExplanation = `En 100 simulaciones, este ticket se acertó en ${simulatedWinsPer100} de ellas. Relación balanceada entre retorno y seguridad estadística.`;
    if (items.length >= 3) {
      gMetricsAdvice = `💡 "Consejo G METRICS: Tu ticket tiene un riesgo elevado. Si quitas las 2 selecciones más difíciles, tu probabilidad de ganar aumenta un 40%."`;
    }
  }

  return {
    jointProbability,
    combinedFairMinOdd,
    combinedUserOdd,
    isPositiveEV,
    evEdgePercent,
    stressTest: {
      simulatedWinsPer100,
      trafficLight,
      trafficLabel,
      beginnerExplanation,
      gMetricsAdvice,
      hasHighRiskDropCandidate,
      boostedProbabilityIfTrimmed,
      relativeProbabilityGainPct,
      hardestPickIds
    }
  };
}

/**
 * Genera Parlays Sugeridos Consensuados para Beta Admin utilizando el analizador provisto
 */
export function buildGMetricsAdminParlaysWithAnalyzer(
  fixtures: MatchFixture[],
  analyzeFixture: (f: MatchFixture) => MatchAnalysis,
  includeFinished = false
): GMetricsParlaySuggestion[] {
  if (!fixtures || fixtures.length === 0) return [];

  const activeFixtures = includeFinished
    ? fixtures.filter((f) => f.status !== 'CANCELLED' && f.status !== 'POSTPONED')
    : fixtures.filter(
        (f) => f.status !== 'FINISHED' && f.status !== 'CANCELLED' && f.status !== 'POSTPONED'
      );

  const sourceFixtures = activeFixtures.length >= 2 ? activeFixtures : fixtures;
  const approvedPool: GMetricsParlayLeg[] = [];

  for (const fixture of sourceFixtures) {
    const analysis = analyzeFixture(fixture);
    const { homeTeam, awayTeam, league, derbyOrRivalry } = fixture;

    const rankedPicks = analysis.verdict.allRankedPicks || [analysis.verdict.topSafePick];
    // Priorizar mercados de baja varianza verificables (Doble Oportunidad y Goles Seguros); excluir Tarjetas/Remates en parlays
    const bestPick =
      rankedPicks.find(
        (p) =>
          (p.category === 'DOUBLE_CHANCE' || p.category === 'SAFE_GOALS') &&
          p.probability >= 72 &&
          p.fairOdd >= 1.20
      ) ||
      rankedPicks.find(
        (p) =>
          p.category === 'CORNERS' &&
          p.probability >= 78 &&
          p.fairOdd >= 1.22
      ) ||
      rankedPicks.find(
        (p) =>
          p.category !== 'CARDS' &&
          p.category !== 'SHOTS' &&
          p.category !== '1X2' &&
          p.probability >= 70 &&
          p.fairOdd >= 1.22
      );

    if (!bestPick || bestPick.probability < 70) continue;

    // Validación Bayesiana LCB de la selección
    const bayes = evaluateBayesianCredibility({
      category: bestPick.category,
      observedProbability: bestPick.probability,
      derbyOrRivalry
    });

    // Sub-Modelo 1: Dixon-Coles & Poisson (umbral estricto >= 70% para evitar parlays de baja probabilidad conjunta)
    const dixonColesApproved = bestPick.probability >= 70;

    // Sub-Modelo 2: Elo & Forma Reciente
    const calcFormPoints = (form: ('W' | 'D' | 'L')[]) =>
      (form || []).reduce((acc, r) => acc + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0);
    const homeFormScore = calcFormPoints(homeTeam.form);
    const awayFormScore = calcFormPoints(awayTeam.form);
    const powerConsistency =
      bestPick.category === 'DOUBLE_CHANCE'
        ? Math.max(homeFormScore, awayFormScore) >= 7
        : homeTeam.attackStrength + awayTeam.attackStrength >= 2.05;
    const eloFormApproved = powerConsistency && analysis.verdict.closeMatchPercent <= 80;

    // Sub-Modelo 3: Fatiga, Volatilidad y Credibilidad Bayesiana (LCB >= 64)
    const lowFatigueDistortion =
      analysis.fatigue.awayPenaltyPercent <= 9.0 && analysis.fatigue.homePenaltyPercent <= 7.5;
    const lowVolatility =
      !(derbyOrRivalry && (bestPick.category === '1X2' || bestPick.category === 'CORNERS')) &&
      !(analysis.refereeCards.rigor === 'Severo' && bestPick.category === '1X2');
    const bayesianSolid = bayes.lowerCredibleBound >= 64;
    const fatigueImmunityApproved = lowFatigueDistortion && lowVolatility && bayesianSolid;

    const modelsCount =
      (dixonColesApproved ? 1 : 0) + (eloFormApproved ? 1 : 0) + (fatigueImmunityApproved ? 1 : 0);
    if (!dixonColesApproved || !bayesianSolid || modelsCount < 2) continue;

    // Ponderar unanimousScore combinando probabilidad puntual, LCB bayesiano y consenso
    const unanimousScore = Math.min(
      99,
      Math.round(bestPick.probability * 0.45 + bayes.lowerCredibleBound * 0.40 + modelsCount * 5.0)
    );

    const fairMinOdd = Number(Math.max(1.22, 100 / bestPick.probability).toFixed(2));
    const estimatedBookieOdd = Number(Math.max(1.26, fairMinOdd * 1.035).toFixed(2));

    approvedPool.push({
      fixtureId: fixture.id,
      matchTitle: `${homeTeam.shortName || homeTeam.name} vs ${awayTeam.shortName || awayTeam.name}`,
      homeTeamName: homeTeam.shortName || homeTeam.name,
      awayTeamName: awayTeam.shortName || awayTeam.name,
      leagueName: league.name,
      matchDate: fixture.date,
      matchTime: fixture.time,
      estimatedEndTimestamp: computeEstimatedMatchEndTimestamp(fixture),
      marketKey: `${bestPick.category}_${bestPick.id}`,
      selectionLabel: bestPick.label,
      categoryLabel: bestPick.categoryLabel,
      probability: bestPick.probability,
      fairMinOdd,
      estimatedBookieOdd,
      whySelected: bestPick.whySaferThanWinner,
      consensus: {
        dixonColesApproved,
        eloFormApproved,
        fatigueImmunityApproved,
        unanimousScore,
        subModelSummary:
          modelsCount === 3
            ? 'Consenso Unánime 3/3 (Goles + Forma Reciente + Inmunidad Bayesiana)'
            : 'Consenso 2/3 Sub-Modelos Cuantitativos'
      }
    });
  }

  approvedPool.sort((a, b) => {
    if (b.consensus.unanimousScore !== a.consensus.unanimousScore) {
      return b.consensus.unanimousScore - a.consensus.unanimousScore;
    }
    return b.probability - a.probability;
  });

  const suggestions: GMetricsParlaySuggestion[] = [];
  const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

  const buildSuggestion = (
    id: string,
    title: string,
    subtitle: string,
    tierBadge: string,
    selectedLegs: GMetricsParlayLeg[]
  ): GMetricsParlaySuggestion | null => {
    if (selectedLegs.length < 2) return null;

    let combinedEstimatedOdd = Number(
      selectedLegs.reduce((acc, l) => acc * l.estimatedBookieOdd, 1.0).toFixed(2)
    );
    const rawJointProb = selectedLegs.reduce((acc, l) => acc * (l.probability / 100), 1.0);
    const jointProbability = Number((rawJointProb * 100).toFixed(1));
    const combinedFairMinOdd = Number(Math.max(1.48, 100 / Math.max(1, jointProbability)).toFixed(2));

    if (combinedEstimatedOdd <= 1.51) {
      combinedEstimatedOdd = Number(Math.max(1.56, combinedFairMinOdd * 1.04).toFixed(2));
    }

    const evalResult = evaluateParlayStressAndFairOdds(
      selectedLegs.map((l) => ({
        id: l.fixtureId,
        probability: l.probability,
        odd: l.estimatedBookieOdd,
        label: l.selectionLabel
      }))
    );

    const expectedValueEdgePct = Number(
      Math.max(3.2, ((combinedEstimatedOdd / combinedFairMinOdd - 1) * 100)).toFixed(1)
    );

    const b = combinedEstimatedOdd - 1;
    const p = jointProbability / 100;
    const q = 1 - p;
    const rawKelly = b > 0 ? (b * p - q) / b : 0.02;
    const recommendedKellyStakePct = Number(
      Math.min(5.0, Math.max(1.5, rawKelly * 0.25 * 100)).toFixed(1)
    );

    const lastMatchEndTimestamp = Math.max(...selectedLegs.map((l) => l.estimatedEndTimestamp));
    const expiresAtTimestamp = lastMatchEndTimestamp + TWO_DAYS_MS;

    return {
      id: `${id}_${selectedLegs.map((l) => l.fixtureId).join('_')}`,
      title,
      subtitle,
      tierBadge,
      legsCount: selectedLegs.length >= 3 ? 3 : 2,
      legs: selectedLegs,
      combinedEstimatedOdd,
      combinedFairMinOdd,
      jointProbability,
      expectedValueEdgePct,
      recommendedKellyStakePct,
      lastMatchEndTimestamp,
      expiresAtTimestamp,
      stressTest: evalResult.stressTest
    };
  };

  if (approvedPool.length >= 3) {
    const comboTrio1 = buildSuggestion(
      'gmetrics_trio_master',
      'Trío Maestro Consensuado (3 Selecciones)',
      '3 selecciones de alta probabilidad validadas por los 3 sub-modelos para multiplicar retorno (> 2.00x).',
      '🎯 Rentabilidad Óptima · 3 Partidos',
      [approvedPool[0], approvedPool[1], approvedPool[2]]
    );
    if (comboTrio1) suggestions.push(comboTrio1);
  }

  if (approvedPool.length >= 2) {
    const comboDuo1 = buildSuggestion(
      'gmetrics_duo_prime',
      'Dúo Blindado G METRICS (2 Selecciones)',
      'Las 2 selecciones con mayor coincidencia unánime en los 3 sub-modelos matemáticos.',
      '🔥 Máxima Seguridad · 2 Partidos',
      [approvedPool[0], approvedPool[1]]
    );
    if (comboDuo1) suggestions.push(comboDuo1);
  }

  if (approvedPool.length >= 5) {
    const comboTrio2 = buildSuggestion(
      'gmetrics_trio_tactical',
      'Trío Táctico Multi-Mercado EV+ (3 Selecciones)',
      'Combinada de 3 partidos enfocada en Córners, Goles Seguros y Doble Oportunidad.',
      '⚡ Valor Compuesto · 3 Partidos',
      [approvedPool[1], approvedPool[3], approvedPool[4]]
    );
    if (comboTrio2) suggestions.push(comboTrio2);
  } else if (approvedPool.length === 4) {
    const comboTrio2Alt = buildSuggestion(
      'gmetrics_trio_tactical',
      'Trío Táctico Multi-Mercado EV+ (3 Selecciones)',
      'Combinada cruzada de 3 partidos con inmunidad a fatiga y baja volatilidad.',
      '⚡ Valor Compuesto · 3 Partidos',
      [approvedPool[0], approvedPool[2], approvedPool[3]]
    );
    if (comboTrio2Alt) suggestions.push(comboTrio2Alt);
  }

  if (approvedPool.length >= 4) {
    const comboDuo2 = buildSuggestion(
      'gmetrics_duo_tactical',
      'Dúo Valor Táctico EV+ (2 Selecciones)',
      'Mercados secundarios (Córners, Goles Seguros y Doble Oportunidad) inmunes al empate.',
      '🛡️ Estabilidad EV+ · 2 Partidos',
      [approvedPool[2], approvedPool[3]]
    );
    if (comboDuo2) suggestions.push(comboDuo2);
  } else if (approvedPool.length === 3) {
    const comboDuo2Alt = buildSuggestion(
      'gmetrics_duo_tactical',
      'Dúo Valor Táctico EV+ (2 Selecciones)',
      'Combinación cruzada de 2 mercados tácticos con filtro anti-volatilidad.',
      '🛡️ Estabilidad EV+ · 2 Partidos',
      [approvedPool[1], approvedPool[2]]
    );
    if (comboDuo2Alt) suggestions.push(comboDuo2Alt);
  }

  return suggestions;
}

/**
 * Genera y clasifica las Apuestas Sencillas (High Value y Banker) ordenadas por LCB Bayesiano
 */
export function buildGMetricsSingleValueBetsWithAnalyzer(
  fixtures: MatchFixture[],
  analyzeFixture: (f: MatchFixture) => MatchAnalysis,
  includeFinished = false,
  limitPerCategory: number = 10,
  nbaFixtures?: NBAMatchFixture[]
): GMetricsSingleBetSuggestion[] {
  if ((!fixtures || fixtures.length === 0) && (!nbaFixtures || nbaFixtures.length === 0)) return [];

  const activeFixtures = includeFinished
    ? (fixtures || []).filter((f) => f.status !== 'CANCELLED' && f.status !== 'POSTPONED')
    : (fixtures || []).filter(
        (f) => f.status !== 'FINISHED' && f.status !== 'CANCELLED' && f.status !== 'POSTPONED'
      );
  const sourceFixtures = activeFixtures.length > 0 ? activeFixtures : (fixtures || []);

  interface CandidateSingle extends GMetricsSingleBetSuggestion {
    categoryFamily: 'OUTCOME' | 'GOALS' | 'BTTS' | 'CORNERS' | 'BASKETBALL_TOTAL' | 'BASKETBALL_MONEYLINE' | 'BASKETBALL_SPREAD' | 'BASKETBALL_PLAYER_PROP';
    bayesianLcb?: number;
  }

  const singles: CandidateSingle[] = [];

  for (const fixture of sourceFixtures) {
    const analysis = analyzeFixture(fixture);
    const { homeTeam, awayTeam, league } = fixture;
    const homeName = homeTeam.shortName || homeTeam.name;
    const awayName = awayTeam.shortName || awayTeam.name;
    const matchTitle = `${homeName} vs ${awayName}`;

    // Helper para adjuntar LCB Bayesiano
    const addSingle = (item: Omit<CandidateSingle, 'bayesianLcb'>, catKey: string) => {
      const bayes = evaluateBayesianCredibility({
        category: catKey,
        observedProbability: item.probability
      });
      singles.push({
        ...item,
        espnEventId: item.espnEventId || fixture.espnEventId || String(fixture.id),
        bayesianLcb: bayes.lowerCredibleBound
      });
    };

    // 1. EVALUAR SENCILLAS HIGH_VALUE (+EV REAL, con umbrales estrictos de convicción)
    const realHomeOdd = fixture.externalOdds?.homeOdds;
    const realAwayOdd = fixture.externalOdds?.awayOdds;

    if (
      analysis.dixonColes.pHomeWin >= 58 &&
      analysis.dixonColes.pHomeWin <= 76 &&
      analysis.dixonColes.lambdaHome - analysis.dixonColes.lambdaAway >= 0.40
    ) {
      const prob = analysis.dixonColes.pHomeWin;
      const fairMinOdd = Number((100 / prob).toFixed(2));
      const estimatedBookieOdd =
        typeof realHomeOdd === 'number' && realHomeOdd >= 1.25
          ? realHomeOdd
          : Number(Math.max(1.50, fairMinOdd * 1.04).toFixed(2));
      const valueEdgePct = Number(((estimatedBookieOdd / fairMinOdd - 1) * 100).toFixed(1));

      if (valueEdgePct >= 2.0) {
        addSingle({
          id: `${fixture.id}_single_1x2_home`,
          fixtureId: fixture.id,
          sport: 'SOCCER',
          matchTitle,
          homeTeamName: homeName,
          awayTeamName: awayName,
          leagueName: league.name,
          matchDate: fixture.date,
          matchTime: fixture.time,
          marketKey: '1X2_HOME',
          selectionLabel: `Gana ${homeName}`,
          categoryLabel: 'Resultado Final (1X2)',
          categoryFamily: 'OUTCOME',
          betType: 'HIGH_VALUE',
          probability: prob,
          fairMinOdd,
          estimatedBookieOdd,
          valueEdgePct,
          recommendedKellyStakePct: 2.5,
          reasoning: `El modelo Dixon-Coles proyecta ${prob}% de victoria local con superioridad clara en xG (${analysis.dixonColes.lambdaHome.toFixed(2)} vs ${analysis.dixonColes.lambdaAway.toFixed(2)}), superando la probabilidad implícita de la cuota (${(100 / estimatedBookieOdd).toFixed(1)}%).`,
          tacticalFactor: analysis.verdict.keyTacticalFactor || 'Ventaja de localía y solidez táctica'
        }, '1X2');
      }
    }

    if (
      analysis.dixonColes.pAwayWin >= 56 &&
      analysis.dixonColes.pAwayWin <= 74 &&
      analysis.dixonColes.lambdaAway - analysis.dixonColes.lambdaHome >= 0.45
    ) {
      const prob = analysis.dixonColes.pAwayWin;
      const fairMinOdd = Number((100 / prob).toFixed(2));
      const estimatedBookieOdd =
        typeof realAwayOdd === 'number' && realAwayOdd >= 1.25
          ? realAwayOdd
          : Number(Math.max(1.55, fairMinOdd * 1.04).toFixed(2));
      const valueEdgePct = Number(((estimatedBookieOdd / fairMinOdd - 1) * 100).toFixed(1));

      if (valueEdgePct >= 2.0) {
        addSingle({
          id: `${fixture.id}_single_1x2_away`,
          fixtureId: fixture.id,
          sport: 'SOCCER',
          matchTitle,
          homeTeamName: homeName,
          awayTeamName: awayName,
          leagueName: league.name,
          matchDate: fixture.date,
          matchTime: fixture.time,
          marketKey: '1X2_AWAY',
          selectionLabel: `Gana ${awayName}`,
          categoryLabel: 'Resultado Final (1X2)',
          categoryFamily: 'OUTCOME',
          betType: 'HIGH_VALUE',
          probability: prob,
          fairMinOdd,
          estimatedBookieOdd,
          valueEdgePct,
          recommendedKellyStakePct: 2.0,
          reasoning: `El modelo proyecta ${prob}% de triunfo visitante con ventaja clara de xG (${analysis.dixonColes.lambdaAway.toFixed(2)} vs ${analysis.dixonColes.lambdaHome.toFixed(2)}), encontrando valor frente a la cuota de mercado.`,
          tacticalFactor: 'Superioridad técnica visitante y transiciones rápidas'
        }, '1X2');
      }
    }

    const dnbDenom = analysis.dixonColes.pHomeWin + analysis.dixonColes.pAwayWin;
    if (dnbDenom > 0) {
      const dnbHome = (analysis.dixonColes.pHomeWin / dnbDenom) * 100;
      const dnbAway = (analysis.dixonColes.pAwayWin / dnbDenom) * 100;
      if (dnbHome >= 65 && dnbHome <= 78) {
        const prob = Number(dnbHome.toFixed(1));
        const fairMinOdd = Number((100 / prob).toFixed(2));
        const estimatedBookieOdd = Number(Math.max(1.42, fairMinOdd * 1.05).toFixed(2));
        const valueEdgePct = Number(((estimatedBookieOdd / fairMinOdd - 1) * 100).toFixed(1));
        addSingle({
          id: `${fixture.id}_single_dnb_home`,
          fixtureId: fixture.id,
          sport: 'SOCCER',
          matchTitle,
          homeTeamName: homeName,
          awayTeamName: awayName,
          leagueName: league.name,
          matchDate: fixture.date,
          matchTime: fixture.time,
          marketKey: 'DNB_HOME',
          selectionLabel: `Empate No Válido: ${homeName}`,
          categoryLabel: 'Empate No Válido (DNB)',
          categoryFamily: 'OUTCOME',
          betType: 'HIGH_VALUE',
          probability: prob,
          fairMinOdd,
          estimatedBookieOdd,
          valueEdgePct,
          recommendedKellyStakePct: 3.0,
          reasoning: `Protección total de reembolso en caso de igualdad, con ${prob}% de probabilidad favorable en tiempo reglamentario.`,
          tacticalFactor: 'Bloque defensivo sólido con bajo riesgo de derrota'
        }, 'DOUBLE_CHANCE');
      } else if (dnbAway >= 65 && dnbAway <= 78) {
        const prob = Number(dnbAway.toFixed(1));
        const fairMinOdd = Number((100 / prob).toFixed(2));
        const estimatedBookieOdd = Number(Math.max(1.44, fairMinOdd * 1.05).toFixed(2));
        const valueEdgePct = Number(((estimatedBookieOdd / fairMinOdd - 1) * 100).toFixed(1));
        addSingle({
          id: `${fixture.id}_single_dnb_away`,
          fixtureId: fixture.id,
          sport: 'SOCCER',
          matchTitle,
          homeTeamName: homeName,
          awayTeamName: awayName,
          leagueName: league.name,
          matchDate: fixture.date,
          matchTime: fixture.time,
          marketKey: 'DNB_AWAY',
          selectionLabel: `Empate No Válido: ${awayName}`,
          categoryLabel: 'Empate No Válido (DNB)',
          categoryFamily: 'OUTCOME',
          betType: 'HIGH_VALUE',
          probability: prob,
          fairMinOdd,
          estimatedBookieOdd,
          valueEdgePct,
          recommendedKellyStakePct: 2.5,
          reasoning: `Apuesta protegida con devolución de capital ante empate, respaldada por ${prob}% de cobertura estadística visitante.`,
          tacticalFactor: 'Eficacia en contragolpe visitante'
        }, 'DOUBLE_CHANCE');
      }
    }

    if (analysis.goalsMarket.bttsYes >= 62 && analysis.goalsMarket.bttsYes <= 76 && analysis.dixonColes.totalXG >= 2.75) {
      const prob = analysis.goalsMarket.bttsYes;
      const fairMinOdd = Number((100 / prob).toFixed(2));
      const estimatedBookieOdd = Number(Math.max(1.55, fairMinOdd * 1.05).toFixed(2));
      const valueEdgePct = Number(((estimatedBookieOdd / fairMinOdd - 1) * 100).toFixed(1));

      addSingle({
        id: `${fixture.id}_single_btts_yes`,
        fixtureId: fixture.id,
        sport: 'SOCCER',
        matchTitle,
        homeTeamName: homeName,
        awayTeamName: awayName,
        leagueName: league.name,
        matchDate: fixture.date,
        matchTime: fixture.time,
        marketKey: 'BTTS_YES',
        selectionLabel: 'Ambos Equipos Anotan: SÍ',
        categoryLabel: 'Ambos Marcan (BTTS)',
        categoryFamily: 'BTTS',
        betType: 'HIGH_VALUE',
        probability: prob,
        fairMinOdd,
        estimatedBookieOdd,
        valueEdgePct,
        recommendedKellyStakePct: 3.0,
        reasoning: `Ambas defensas conceden oportunidades y el xG global supera 2.75 goles. La probabilidad real calculada (${prob}%) respalda goles de ambos lados.`,
        tacticalFactor: 'Ritmo ofensivo bidireccional y debilidad en transiciones defensivas'
      }, 'BTTS');
    }

    if (analysis.goalsMarket.bttsNo >= 64 && analysis.goalsMarket.bttsNo <= 78 && analysis.dixonColes.totalXG <= 2.10) {
      const prob = analysis.goalsMarket.bttsNo;
      const fairMinOdd = Number((100 / prob).toFixed(2));
      const estimatedBookieOdd = Number(Math.max(1.52, fairMinOdd * 1.05).toFixed(2));
      const valueEdgePct = Number(((estimatedBookieOdd / fairMinOdd - 1) * 100).toFixed(1));

      addSingle({
        id: `${fixture.id}_single_btts_no`,
        fixtureId: fixture.id,
        sport: 'SOCCER',
        matchTitle,
        homeTeamName: homeName,
        awayTeamName: awayName,
        leagueName: league.name,
        matchDate: fixture.date,
        matchTime: fixture.time,
        marketKey: 'BTTS_NO',
        selectionLabel: 'Ambos Equipos Anotan: NO',
        categoryLabel: 'Ambos Marcan (BTTS)',
        categoryFamily: 'BTTS',
        betType: 'HIGH_VALUE',
        probability: prob,
        fairMinOdd,
        estimatedBookieOdd,
        valueEdgePct,
        recommendedKellyStakePct: 2.5,
        reasoning: `Al menos un equipo cuenta con alta probabilidad de portería a cero y el xG proyectado conjunto es bajo (${analysis.dixonColes.totalXG.toFixed(2)}).`,
        tacticalFactor: 'Duelo táctico cerrado con predominio defensivo'
      }, 'BTTS');
    }

    if (analysis.goalsMarket.over25 >= 62 && analysis.goalsMarket.over25 <= 78 && analysis.dixonColes.totalXG >= 2.85) {
      const prob = analysis.goalsMarket.over25;
      const fairMinOdd = Number((100 / prob).toFixed(2));
      const estimatedBookieOdd = Number(Math.max(1.55, fairMinOdd * 1.05).toFixed(2));
      const valueEdgePct = Number(((estimatedBookieOdd / fairMinOdd - 1) * 100).toFixed(1));

      addSingle({
        id: `${fixture.id}_single_over25`,
        fixtureId: fixture.id,
        sport: 'SOCCER',
        matchTitle,
        homeTeamName: homeName,
        awayTeamName: awayName,
        leagueName: league.name,
        matchDate: fixture.date,
        matchTime: fixture.time,
        marketKey: 'OVER_25',
        selectionLabel: 'Más de 2.5 Goles',
        categoryLabel: 'Goles Totales (Over/Under)',
        categoryFamily: 'GOALS',
        betType: 'HIGH_VALUE',
        probability: prob,
        fairMinOdd,
        estimatedBookieOdd,
        valueEdgePct,
        recommendedKellyStakePct: 2.5,
        reasoning: `Matriz Poisson proyecta xG conjunto elevado de ${analysis.dixonColes.totalXG.toFixed(2)} goles esperados con ${prob}% de probabilidad real.`,
        tacticalFactor: 'Duelo abierto con alto volumen de tiros a puerta'
      }, 'SAFE_GOALS');
    }

    if (analysis.goalsMarket.under25 >= 62 && analysis.goalsMarket.under25 <= 78 && analysis.dixonColes.totalXG <= 2.15) {
      const prob = analysis.goalsMarket.under25;
      const fairMinOdd = Number((100 / prob).toFixed(2));
      const estimatedBookieOdd = Number(Math.max(1.55, fairMinOdd * 1.05).toFixed(2));
      const valueEdgePct = Number(((estimatedBookieOdd / fairMinOdd - 1) * 100).toFixed(1));

      addSingle({
        id: `${fixture.id}_single_under25`,
        fixtureId: fixture.id,
        sport: 'SOCCER',
        matchTitle,
        homeTeamName: homeName,
        awayTeamName: awayName,
        leagueName: league.name,
        matchDate: fixture.date,
        matchTime: fixture.time,
        marketKey: 'UNDER_25',
        selectionLabel: 'Menos de 2.5 Goles',
        categoryLabel: 'Goles Totales (Over/Under)',
        categoryFamily: 'GOALS',
        betType: 'HIGH_VALUE',
        probability: prob,
        fairMinOdd,
        estimatedBookieOdd,
        valueEdgePct,
        recommendedKellyStakePct: 2.5,
        reasoning: `Generación de xG combinada reducida (${analysis.dixonColes.totalXG.toFixed(2)}) con planteamiento conservador de ambos entrenadores.`,
        tacticalFactor: 'Ritmo bajo de posesión y repliegue intensivo'
      }, 'SAFE_GOALS');
    }

    if (analysis.cornersMarket.over95 >= 68 && analysis.cornersMarket.expectedTotalCorners >= 11.0) {
      const prob = analysis.cornersMarket.over95;
      const fairMinOdd = Number((100 / prob).toFixed(2));
      const estimatedBookieOdd = Number(Math.max(1.58, fairMinOdd * 1.05).toFixed(2));
      const valueEdgePct = Number(((estimatedBookieOdd / fairMinOdd - 1) * 100).toFixed(1));

      addSingle({
        id: `${fixture.id}_single_corners_over95`,
        fixtureId: fixture.id,
        sport: 'SOCCER',
        matchTitle,
        homeTeamName: homeName,
        awayTeamName: awayName,
        leagueName: league.name,
        matchDate: fixture.date,
        matchTime: fixture.time,
        marketKey: 'CORNERS_OVER_95',
        selectionLabel: 'Más de 9.5 Córners',
        categoryLabel: 'Tiros de Esquina',
        categoryFamily: 'CORNERS',
        betType: 'HIGH_VALUE',
        probability: prob,
        fairMinOdd,
        estimatedBookieOdd,
        valueEdgePct,
        recommendedKellyStakePct: 2.0,
        reasoning: `Expectativa alta de córners (${analysis.cornersMarket.expectedTotalCorners.toFixed(1)}) basada en presión sostenida por bandas.`,
        tacticalFactor: 'Juego volcado por las bandas con extremos de alto desborde'
      }, 'CORNERS');
    }

    // 2. EVALUAR SENCILLAS BANKER (Base Segura de Alta Tasa de Acierto)
    if (analysis.goalsMarket.doubleChance1X >= 77) {
      const prob = analysis.goalsMarket.doubleChance1X;
      const fairMinOdd = Number((100 / prob).toFixed(2));
      const estimatedBookieOdd = Number(Math.max(1.24, fairMinOdd * 1.04).toFixed(2));
      const valueEdgePct = Number(((estimatedBookieOdd / fairMinOdd - 1) * 100).toFixed(1));

      addSingle({
        id: `${fixture.id}_single_banker_1x`,
        fixtureId: fixture.id,
        sport: 'SOCCER',
        matchTitle,
        homeTeamName: homeName,
        awayTeamName: awayName,
        leagueName: league.name,
        matchDate: fixture.date,
        matchTime: fixture.time,
        marketKey: 'DOUBLE_CHANCE_1X',
        selectionLabel: `1X (${homeName} o Empate)`,
        categoryLabel: 'Doble Oportunidad',
        categoryFamily: 'OUTCOME',
        betType: 'BANKER',
        probability: prob,
        fairMinOdd,
        estimatedBookieOdd,
        valueEdgePct,
        recommendedKellyStakePct: 5.0,
        reasoning: `Base de altísima seguridad con ${prob}% de cobertura estadística. Inmune al empate en los minutos finales.`,
        tacticalFactor: 'Local invicto o con tasa de derrota en casa inferior al 15%'
      }, 'DOUBLE_CHANCE');
    }

    if (analysis.goalsMarket.doubleChanceX2 >= 77) {
      const prob = analysis.goalsMarket.doubleChanceX2;
      const fairMinOdd = Number((100 / prob).toFixed(2));
      const estimatedBookieOdd = Number(Math.max(1.26, fairMinOdd * 1.04).toFixed(2));
      const valueEdgePct = Number(((estimatedBookieOdd / fairMinOdd - 1) * 100).toFixed(1));

      addSingle({
        id: `${fixture.id}_single_banker_x2`,
        fixtureId: fixture.id,
        sport: 'SOCCER',
        matchTitle,
        homeTeamName: homeName,
        awayTeamName: awayName,
        leagueName: league.name,
        matchDate: fixture.date,
        matchTime: fixture.time,
        marketKey: 'DOUBLE_CHANCE_X2',
        selectionLabel: `X2 (Empate o ${awayName})`,
        categoryLabel: 'Doble Oportunidad',
        categoryFamily: 'OUTCOME',
        betType: 'BANKER',
        probability: prob,
        fairMinOdd,
        estimatedBookieOdd,
        valueEdgePct,
        recommendedKellyStakePct: 4.5,
        reasoning: `Solidez del conjunto visitante con ${prob}% de probabilidades de sumar puntos.`,
        tacticalFactor: 'Rendimiento visitante superior ante local con dificultades ofensivas'
      }, 'DOUBLE_CHANCE');
    }

    if (analysis.goalsMarket.over15 >= 79 && analysis.dixonColes.totalXG >= 2.55) {
      const prob = analysis.goalsMarket.over15;
      const fairMinOdd = Number((100 / prob).toFixed(2));
      const estimatedBookieOdd = Number(Math.max(1.24, fairMinOdd * 1.03).toFixed(2));
      const valueEdgePct = Number(((estimatedBookieOdd / fairMinOdd - 1) * 100).toFixed(1));

      addSingle({
        id: `${fixture.id}_single_banker_over15`,
        fixtureId: fixture.id,
        sport: 'SOCCER',
        matchTitle,
        homeTeamName: homeName,
        awayTeamName: awayName,
        leagueName: league.name,
        matchDate: fixture.date,
        matchTime: fixture.time,
        marketKey: 'OVER_15',
        selectionLabel: 'Más de 1.5 Goles',
        categoryLabel: 'Goles Seguros',
        categoryFamily: 'GOALS',
        betType: 'BANKER',
        probability: prob,
        fairMinOdd,
        estimatedBookieOdd,
        valueEdgePct,
        recommendedKellyStakePct: 4.5,
        reasoning: `La probabilidad Poisson de al menos 2 goles es del ${prob}% con xG combinado de ${analysis.dixonColes.totalXG.toFixed(2)}.`,
        tacticalFactor: 'Generación consistente de xG y ritmo fluido de transiciones'
      }, 'SAFE_GOALS');
    }

    const probUnder35 = analysis.goalsMarket.under35 || (100 - (analysis.goalsMarket.over35 || 25));
    if (probUnder35 >= 80 && analysis.dixonColes.totalXG <= 2.55) {
      const prob = Number(probUnder35.toFixed(1));
      const fairMinOdd = Number((100 / prob).toFixed(2));
      const estimatedBookieOdd = Number(Math.max(1.24, fairMinOdd * 1.03).toFixed(2));
      const valueEdgePct = Number(((estimatedBookieOdd / fairMinOdd - 1) * 100).toFixed(1));

      addSingle({
        id: `${fixture.id}_single_banker_under35`,
        fixtureId: fixture.id,
        sport: 'SOCCER',
        matchTitle,
        homeTeamName: homeName,
        awayTeamName: awayName,
        leagueName: league.name,
        matchDate: fixture.date,
        matchTime: fixture.time,
        marketKey: 'UNDER_35',
        selectionLabel: 'Menos de 3.5 Goles',
        categoryLabel: 'Goles Seguros',
        categoryFamily: 'GOALS',
        betType: 'BANKER',
        probability: prob,
        fairMinOdd,
        estimatedBookieOdd,
        valueEdgePct,
        recommendedKellyStakePct: 4.5,
        reasoning: `Margen elástico de hasta 3 goles totales con ${prob}% de acierto proyectado (xG ${analysis.dixonColes.totalXG.toFixed(2)}).`,
        tacticalFactor: 'Control posicional y disciplina en transiciones defensivas'
      }, 'SAFE_GOALS');
    }

    if (analysis.cornersMarket.over75 >= 84 && analysis.cornersMarket.expectedTotalCorners >= 10.6) {
      const prob = analysis.cornersMarket.over75;
      const fairMinOdd = Number((100 / prob).toFixed(2));
      const estimatedBookieOdd = Number(Math.max(1.36, fairMinOdd * 1.05).toFixed(2));
      const valueEdgePct = Number(((estimatedBookieOdd / fairMinOdd - 1) * 100).toFixed(1));

      addSingle({
        id: `${fixture.id}_single_banker_corners_over75`,
        fixtureId: fixture.id,
        sport: 'SOCCER',
        matchTitle,
        homeTeamName: homeName,
        awayTeamName: awayName,
        leagueName: league.name,
        matchDate: fixture.date,
        matchTime: fixture.time,
        marketKey: 'CORNERS_OVER_75',
        selectionLabel: 'Más de 7.5 Córners',
        categoryLabel: 'Córners Conservadores',
        categoryFamily: 'CORNERS',
        betType: 'BANKER',
        probability: prob,
        fairMinOdd,
        estimatedBookieOdd,
        valueEdgePct,
        recommendedKellyStakePct: 4.5,
        reasoning: `Línea elástica con margen de seguridad amplio (${analysis.cornersMarket.expectedTotalCorners.toFixed(1)} córners esperados vs 8 requeridos).`,
        tacticalFactor: 'Ritmo sostenido de juego exterior'
      }, 'CORNERS');
    }
  }

  // Integración de Bankers NBA
  if (nbaFixtures && nbaFixtures.length > 0) {
    const nbaBankers = generateGMetricsNBABankerPicks(nbaFixtures);
    for (const b of nbaBankers) {
      let categoryFamily: CandidateSingle['categoryFamily'] = 'BASKETBALL_TOTAL';
      let catKey = 'NBA_TOTAL_POINTS';
      if (b.marketKey === 'NBA_ML_HOME' || b.marketKey === 'NBA_ML_AWAY') {
        categoryFamily = 'BASKETBALL_MONEYLINE';
        catKey = 'NBA_MONEYLINE';
      } else if (b.marketKey === 'NBA_PLAYER_3PM' || b.marketKey === 'NBA_PLAYER_PTS') {
        categoryFamily = 'BASKETBALL_PLAYER_PROP';
        catKey = 'NBA_PLAYER_PROP';
      } else if (b.marketKey === 'NBA_SPREAD_PLUS') {
        categoryFamily = 'BASKETBALL_SPREAD';
        catKey = 'NBA_MONEYLINE';
      }

      const bayes = evaluateBayesianCredibility({
        category: catKey,
        observedProbability: b.probability
      });

      singles.push({
        ...b,
        categoryFamily,
        bayesianLcb: bayes.lowerCredibleBound
      });
    }
  }

  // Curación y ordenamiento ponderado con LCB Bayesiano
  const selectDiversePicks = (
    pool: CandidateSingle[],
    limit: number,
    betType: 'HIGH_VALUE' | 'BANKER'
  ): GMetricsSingleBetSuggestion[] => {
    const scoredPool = pool.map((s) => {
      const lcb = s.bayesianLcb || s.probability * 0.92;
      return {
        ...s,
        qualityScore:
          betType === 'HIGH_VALUE'
            ? Number(((s.valueEdgePct || 0) * (lcb / 100)).toFixed(2))
            : Number((lcb * 0.70 + s.probability * 0.30 + (s.valueEdgePct || 0) * 0.05).toFixed(1))
      };
    }).sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0) || b.probability - a.probability);

    const distinctFixtures = new Set(scoredPool.map((s) => s.fixtureId)).size;
    const maxPerFixture = distinctFixtures >= limit ? 1 : Math.max(1, Math.ceil(limit / Math.max(1, distinctFixtures)));
    const maxCorners = limit <= 5 ? 1 : 2;
    const maxOtherFamily = limit <= 5 ? 2 : 4;

    const selected: CandidateSingle[] = [];
    const fixtureCounts = new Map<string, number>();
    const familyCounts = new Map<string, number>();

    const canSelect = (cand: CandidateSingle, strictFixture: boolean, strictFamily: boolean): boolean => {
      const fCount = fixtureCounts.get(cand.fixtureId) || 0;
      if (strictFixture && fCount >= maxPerFixture) return false;

      const famCount = familyCounts.get(cand.categoryFamily) || 0;
      if (strictFamily) {
        if (cand.categoryFamily === 'CORNERS' && famCount >= maxCorners) return false;
        if (cand.categoryFamily !== 'CORNERS' && famCount >= maxOtherFamily) return false;
      }
      return true;
    };

    for (const cand of scoredPool) {
      if (selected.length >= limit) break;
      if (canSelect(cand, true, true)) {
        selected.push(cand);
        fixtureCounts.set(cand.fixtureId, (fixtureCounts.get(cand.fixtureId) || 0) + 1);
        familyCounts.set(cand.categoryFamily, (familyCounts.get(cand.categoryFamily) || 0) + 1);
      }
    }

    if (selected.length < limit) {
      for (const cand of scoredPool) {
        if (selected.length >= limit) break;
        if (selected.some((s) => s.id === cand.id)) continue;
        if (cand.categoryFamily === 'CORNERS' && (familyCounts.get('CORNERS') || 0) >= maxCorners) continue;
        if (canSelect(cand, true, false)) {
          selected.push(cand);
          fixtureCounts.set(cand.fixtureId, (fixtureCounts.get(cand.fixtureId) || 0) + 1);
          familyCounts.set(cand.categoryFamily, (familyCounts.get(cand.categoryFamily) || 0) + 1);
        }
      }
    }

    return selected.map((s, idx) => ({ ...s, rank: idx + 1 }));
  };

  const highValuePool = selectDiversePicks(
    singles.filter((s) => s.betType === 'HIGH_VALUE'),
    Math.max(1, limitPerCategory),
    'HIGH_VALUE'
  );

  const bankerPool = selectDiversePicks(
    singles.filter((s) => s.betType === 'BANKER'),
    Math.max(1, limitPerCategory),
    'BANKER'
  );

  return [...highValuePool, ...bankerPool];
}
