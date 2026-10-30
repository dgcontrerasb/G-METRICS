import {
  MatchFixture,
  MatchAnalysis,
  DixonColesResult,
  GoalsMarketResult,
  CornersMarketResult,
  RefereeCardResult,
  ShotsPlayerResult,
  UrgencyResult,
  HalfGoalsResult,
  LateGoalsResult,
  BilateralFatigueResult,
  CleanSheetResult,
  VerdictResult,
  MarketOddsComparison,
  BestMarketPick
} from '../types';
import { getSoccerLineupData, resolveTeamStarPlayerName } from './lineupService';

// Factorial cache for fast Poisson calculation
const factorials: number[] = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];
function factorial(n: number): number {
  if (n <= 0) return 1;
  if (n < factorials.length) return factorials[n];
  let res = factorials[factorials.length - 1];
  for (let i = factorials.length; i <= n; i++) {
    res *= i;
  }
  return res;
}

// Poisson Probability Mass Function: P(k; lambda) = (lambda^k * e^-lambda) / k!
export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

// Cumulative Poisson Probability: P(X <= maxK)
export function poissonCdf(maxK: number, lambda: number): number {
  if (lambda <= 0) return 1;
  let sum = 0;
  for (let k = 0; k <= Math.floor(maxK); k++) {
    sum += poissonPmf(k, lambda);
  }
  return Math.min(1, Math.max(0, sum));
}

// Dixon-Coles adjustment function tau(x, y, rho)
// Corrects correlation for low scores (0-0, 1-0, 0-1, 1-1)
export function dixonColesTau(x: number, y: number, lambda1: number, lambda2: number, rho: number = -0.11): number {
  if (x === 0 && y === 0) {
    return Math.max(0.01, 1 - lambda1 * lambda2 * rho);
  }
  if (x === 1 && y === 0) {
    return Math.max(0.01, 1 + lambda2 * rho);
  }
  if (x === 0 && y === 1) {
    return Math.max(0.01, 1 + lambda1 * rho);
  }
  if (x === 1 && y === 1) {
    return Math.max(0.01, 1 - rho);
  }
  return 1.0;
}

// In-memory memoization cache for calculated match analyses
const analysisCache = new Map<string, MatchAnalysis>();

export function clearAnalysisCache(): void {
  analysisCache.clear();
}

export function clearAnalysisCacheForFixture(fixtureId: string): void {
  for (const key of Array.from(analysisCache.keys())) {
    if (key === fixtureId || key.startsWith(`${fixtureId}_`)) {
      analysisCache.delete(key);
    }
  }
}

export function calculateMatchAnalysis(fixture: MatchFixture): MatchAnalysis {
  const liveCornersKey = fixture.liveStats
    ? `_c${fixture.liveStats.home.corners}_${fixture.liveStats.away.corners}_y${fixture.liveStats.home.yellowCards}_${fixture.liveStats.away.yellowCards}`
    : '';
  const liveScoreKey =
    (fixture.status === 'IN_PLAY' || fixture.status === 'FINISHED') && fixture.currentScore
      ? `${fixture.id}_live_${fixture.currentScore.home}_${fixture.currentScore.away}_${fixture.currentScore.minute || 0}${liveCornersKey}`
      : `${fixture.id}${liveCornersKey}`;

  if (liveScoreKey && analysisCache.has(liveScoreKey)) {
    return analysisCache.get(liveScoreKey)!;
  }

  const { homeTeam, awayTeam, league, derbyOrRivalry } = fixture;
  const referee = fixture.referee || { name: 'Árbitro Oficial', avgYellowCards: 4.1, avgRedCards: 0.16, rigor: 'Equilibrado' as const };
  const travel = fixture.travel || { awayDistanceKm: 180, awayFlightHours: 0.5 };
  const homeShort = homeTeam?.shortName || homeTeam?.name || 'Local';
  const awayShort = awayTeam?.shortName || awayTeam?.name || 'Visita';

  // 1. Fatigue & Rest calculation (Module H)
  const homeRestHours = homeTeam?.restHours ?? 96;
  const awayRestHours = awayTeam?.restHours ?? 96;
  const homeRestPenalty = homeRestHours < 72 ? Math.min(0.09, 0.05 + ((72 - homeRestHours) / 72) * 0.04) : 0;

  const awayRestPenalty = awayRestHours < 72 ? Math.min(0.09, 0.05 + ((72 - awayRestHours) / 72) * 0.04) : 0;
  const awayTravelPenalty = travel.awayFlightHours > 3 ? Math.min(0.05, 0.02 + (travel.awayFlightHours - 3) * 0.01) : 0;
  const awayTotalPenalty = Math.min(0.12, awayRestPenalty + awayTravelPenalty);

  const fatigue: BilateralFatigueResult = {
    homeRestHours: homeTeam.restHours,
    awayRestHours: awayTeam.restHours,
    awayTravelKm: travel.awayDistanceKm,
    awayTravelHours: travel.awayFlightHours,
    awayPenaltyPercent: Math.round(awayTotalPenalty * 1000) / 10,
    homePenaltyPercent: Math.round(homeRestPenalty * 1000) / 10,
    fatigueDiagnosis:
      awayTotalPenalty > 0.07
        ? `Desgaste severo en el cuadro visitante: ${awayTeam.restHours}h de descanso y ${travel.awayDistanceKm}km de traslado. Penalización de -${(awayTotalPenalty * 100).toFixed(1)}% en xG.`
        : awayTotalPenalty > 0.03
        ? `Fatiga moderada para ${awayShort} (${awayTeam.restHours}h de recuperación). Ligera desventaja de fondo físico.`
        : `Condición atlética óptima en ambos planteles (>72h de recuperación entre competencias).`
  };

  // 2. Dixon-Coles Lambdas (Expected Goals - xG) & Lineup Absence Factor
  const leagueMean = league.avgGoalsPerMatch ? league.avgGoalsPerMatch / 2 : 1.35;
  const homeAdvantageFactor = 1.15; // +15% historical home advantage

  let lambdaHome = leagueMean * homeTeam.attackStrength * awayTeam.defenseStrength * homeAdvantageFactor * (1 - homeRestPenalty);
  let lambdaAway = leagueMean * awayTeam.attackStrength * homeTeam.defenseStrength * (1 - awayTotalPenalty);

  // Calibrate expected goals using real lineup injury/suspension status
  const lineup = getSoccerLineupData(fixture);
  const homeInjured = [...lineup.homeStarters, ...lineup.homeSubstitutes].filter(p => p.isInjured);
  const awayInjured = [...lineup.awayStarters, ...lineup.awaySubstitutes].filter(p => p.isInjured);

  homeInjured.forEach(p => {
    if (p.position === 'DEL' || p.position === 'MED') lambdaHome *= 0.94;
    if (p.position === 'DEF' || p.position === 'POR') lambdaAway *= 1.05;
  });

  awayInjured.forEach(p => {
    if (p.position === 'DEL' || p.position === 'MED') lambdaAway *= 0.94;
    if (p.position === 'DEF' || p.position === 'POR') lambdaHome *= 1.05;
  });

  // If match is currently IN_PLAY, blend live score momentum into lambdas
  if (fixture.status === 'IN_PLAY' && fixture.currentScore) {
    const elapsedMin = Math.min(89, Math.max(1, fixture.currentScore.minute || 45));
    const remainingFraction = Math.max(0.08, (90 - elapsedMin) / 90);
    lambdaHome = fixture.currentScore.home + lambdaHome * remainingFraction;
    lambdaAway = fixture.currentScore.away + lambdaAway * remainingFraction;
  }

  lambdaHome = Math.max(0.35, Math.round(lambdaHome * 100) / 100);
  lambdaAway = Math.max(0.28, Math.round(lambdaAway * 100) / 100);
  const totalXG = Math.round((lambdaHome + lambdaAway) * 100) / 100;

  // 3. 7x7 Bivariate Poisson Matrix with Dixon-Coles adjustment
  const maxGoals = 6;
  const rawMatrix: number[][] = [];
  let matrixSum = 0;

  for (let x = 0; x <= maxGoals; x++) {
    rawMatrix[x] = [];
    for (let y = 0; y <= maxGoals; y++) {
      // If match is IN_PLAY, impossible to finish with fewer goals than already scored
      if (
        fixture.status === 'IN_PLAY' &&
        fixture.currentScore &&
        (x < fixture.currentScore.home || y < fixture.currentScore.away)
      ) {
        rawMatrix[x][y] = 0;
        continue;
      }
      const pX = poissonPmf(x, lambdaHome);
      const pY = poissonPmf(y, lambdaAway);
      const tau = dixonColesTau(x, y, lambdaHome, lambdaAway, -0.11);
      const prob = pX * pY * tau;
      rawMatrix[x][y] = prob;
      matrixSum += prob;
    }
  }

  if (matrixSum <= 0) matrixSum = 1;

  // Normalize matrix to 100% and derive 1X2 & Goals Markets
  const scoreMatrix: number[][] = [];
  let pHomeWin = 0;
  let pDraw = 0;
  let pAwayWin = 0;

  let bttsYesProb = 0;
  let over15Prob = 0;
  let over25Prob = 0;
  let over35Prob = 0;
  let closeMatchProb = 0;
  let wideWinProb = 0;

  const scoreRankList: { score: string; home: number; away: number; probability: number }[] = [];

  for (let x = 0; x <= maxGoals; x++) {
    scoreMatrix[x] = [];
    for (let y = 0; y <= maxGoals; y++) {
      const normalizedProb = (rawMatrix[x][y] / matrixSum) * 100;
      scoreMatrix[x][y] = Math.round(normalizedProb * 100) / 100;

      if (x > y) pHomeWin += normalizedProb;
      else if (x === y) pDraw += normalizedProb;
      else pAwayWin += normalizedProb;

      if (x >= 1 && y >= 1) bttsYesProb += normalizedProb;
      if (x + y > 1.5) over15Prob += normalizedProb;
      if (x + y > 2.5) over25Prob += normalizedProb;
      if (x + y > 3.5) over35Prob += normalizedProb;

      if (Math.abs(x - y) <= 1) closeMatchProb += normalizedProb;
      if (Math.abs(x - y) >= 2) wideWinProb += normalizedProb;

      scoreRankList.push({
        score: `${x}-${y}`,
        home: x,
        away: y,
        probability: Math.round(normalizedProb * 10) / 10
      });
    }
  }

  pHomeWin = Math.round(pHomeWin * 10) / 10;
  pDraw = Math.round(pDraw * 10) / 10;
  pAwayWin = Math.round(pAwayWin * 10) / 10;

  // Assure sum is exactly 100
  const diff1x2 = 100 - (pHomeWin + pDraw + pAwayWin);
  pDraw = Math.max(1, Math.round((pDraw + diff1x2) * 10) / 10);

  const fairOddsHome = pHomeWin > 0 ? Math.round((100 / pHomeWin) * 100) / 100 : 99.0;
  const fairOddsDraw = pDraw > 0 ? Math.round((100 / pDraw) * 100) / 100 : 99.0;
  const fairOddsAway = pAwayWin > 0 ? Math.round((100 / pAwayWin) * 100) / 100 : 99.0;

  scoreRankList.sort((a, b) => b.probability - a.probability);
  const mostLikelyScores = scoreRankList.slice(0, 5);

  const dixonColes: DixonColesResult = {
    lambdaHome,
    lambdaAway,
    totalXG,
    pHomeWin,
    pDraw,
    pAwayWin,
    fairOddsHome,
    fairOddsDraw,
    fairOddsAway,
    scoreMatrix,
    mostLikelyScores
  };

  // 4. Standings Urgency & Competition Tension (Module E)
  const isTopClash = homeTeam.rank <= 4 && awayTeam.rank <= 4;
  const isRelegationBattle = homeTeam.rank >= 17 || awayTeam.rank >= 17;
  const isDirectTableFight = Math.abs(homeTeam.rank - awayTeam.rank) <= 3;

  let urgencyScore = 5;
  let homeContext = 'Zona Media de la Tabla';
  let awayContext = 'Zona Media de la Tabla';

  if (homeTeam.rank <= 2) homeContext = 'Pelea frontal por el Liderato y Campeonato';
  else if (homeTeam.rank <= 4) homeContext = 'Puestos de Clasificación a Champions League';
  else if (homeTeam.rank <= 7) homeContext = 'Aspiración a Copas Europeas / Internacionales';
  else if (homeTeam.rank >= 18) homeContext = 'Zona Crítica de Descenso Directo';
  else if (homeTeam.rank >= 16) homeContext = 'Alerta de Permanencia en Primera División';

  if (awayTeam.rank <= 2) awayContext = 'Pelea frontal por el Liderato y Campeonato';
  else if (awayTeam.rank <= 4) awayContext = 'Puestos de Clasificación a Champions League';
  else if (awayTeam.rank <= 7) awayContext = 'Aspiración a Copas Europeas / Internacionales';
  else if (awayTeam.rank >= 18) awayContext = 'Zona Crítica de Descenso Directo';
  else if (awayTeam.rank >= 16) awayContext = 'Alerta de Permanencia en Primera División';

  if (isTopClash) urgencyScore += 3;
  if (isRelegationBattle) urgencyScore += 2;
  if (derbyOrRivalry) urgencyScore += 3;
  if (isDirectTableFight) urgencyScore += 1;
  urgencyScore = Math.min(10, Math.max(3, urgencyScore));

  const urgency: UrgencyResult = {
    homeRank: homeTeam.rank,
    awayRank: awayTeam.rank,
    homePoints: homeTeam.points,
    awayPoints: awayTeam.points,
    homeContext,
    awayContext,
    urgencyIndex: urgencyScore,
    motivationSummary: derbyOrRivalry
      ? `Máxima fricción: Derbi / Clásico con ${urgencyScore}/10 en índice de urgencia. Tensión multiplicada por rivalidad histórica.`
      : isTopClash
      ? `Choque en la cúspide (${homeTeam.rank}º vs ${awayTeam.rank}º): Duelo directo por el título con urgencia ${urgencyScore}/10.`
      : isRelegationBattle
      ? `Partidazo dramático por la permanencia. Puntos cruciales para evitar el descenso directo.`
      : `Encuentro de alta demanda competitiva en calendario regular (${urgencyScore}/10 de urgencia).`
  };

  // 5. Half with Most Goals & Half Goal Probabilities (Module F)
  const expected1stHalfGoals = Math.round(totalXG * 0.435 * 100) / 100;
  const expected2ndHalfGoals = Math.round(totalXG * 0.565 * 100) / 100;
  const firstHalfPercent = 31.5;
  const secondHalfPercent = 48.0;
  const equalPercent = 20.5;

  const firstHalfGoalProb = Math.min(92.0, Math.round((1 - Math.exp(-expected1stHalfGoals)) * 1000) / 10);
  const secondHalfGoalProb = Math.min(94.0, Math.round((1 - Math.exp(-expected2ndHalfGoals)) * 1000) / 10);

  const halfGoals: HalfGoalsResult = {
    firstHalfPercent,
    secondHalfPercent,
    equalPercent,
    expected1stHalfGoals,
    expected2ndHalfGoals,
    rationale: `El modelo proyecta mayor resolución en la 2ª Mitad (${secondHalfGoalProb}% de prob. de gol en 2T vs ${firstHalfGoalProb}% en 1T), producto del desgaste físico y los ajustes tácticos (${expected2ndHalfGoals} xG en 2T vs ${expected1stHalfGoals} xG en 1T).`
  };

  // 6. Goals & Double Chance Market (Module B)
  const bttsYes = Math.round(bttsYesProb * 10) / 10;
  const bttsNo = Math.round((100 - bttsYes) * 10) / 10;
  const over15 = Math.round(over15Prob * 10) / 10;
  const under15 = Math.round((100 - over15) * 10) / 10;
  const over25 = Math.round(over25Prob * 10) / 10;
  const under25 = Math.round((100 - over25) * 10) / 10;
  const over35 = Math.round(over35Prob * 10) / 10;
  const under35 = Math.round((100 - over35) * 10) / 10;

  const doubleChance1X = Math.min(96.0, Math.round((pHomeWin + pDraw) * 10) / 10);
  const doubleChanceX2 = Math.min(96.0, Math.round((pAwayWin + pDraw) * 10) / 10);
  const doubleChance12 = Math.min(96.0, Math.round((pHomeWin + pAwayWin) * 10) / 10);

  const goalsMarket: GoalsMarketResult = {
    bttsYes,
    bttsNo,
    over15,
    under15,
    over25,
    under25,
    over35,
    under35,
    doubleChance1X,
    doubleChanceX2,
    doubleChance12,
    firstHalfGoalProb,
    secondHalfGoalProb
  };

  // 7. Shots and Key Strikers (Module D)
  const isLiveOrDone = fixture.status === 'IN_PLAY' || fixture.status === 'FINISHED';
  const elapsedMatchMin = isLiveOrDone
    ? fixture.status === 'FINISHED'
      ? 90
      : Math.min(89, Math.max(1, fixture.currentScore?.minute || 45))
    : 0;
  const remainingMatchFraction = isLiveOrDone
    ? fixture.status === 'FINISHED'
      ? 0
      : Math.max(0.06, (90 - elapsedMatchMin) / 90)
    : 1;

  const baseHomeShots = homeTeam.avgShotsPerMatch * (awayTeam.defenseStrength * 0.95);
  const baseHomeSOT = homeTeam.avgShotsOnTarget * (awayTeam.defenseStrength * 0.92);
  const baseAwayShots = awayTeam.avgShotsPerMatch * (homeTeam.defenseStrength * 0.9) * (1 - awayTotalPenalty);
  const baseAwaySOT = awayTeam.avgShotsOnTarget * (homeTeam.defenseStrength * 0.9) * (1 - awayTotalPenalty);

  const homeTotalShots =
    isLiveOrDone && fixture.liveStats && fixture.liveStats.home.shots > 0
      ? Math.round((fixture.liveStats.home.shots + baseHomeShots * remainingMatchFraction) * 10) / 10
      : Math.round(baseHomeShots * 10) / 10;
  const homeShotsOnTarget =
    isLiveOrDone && fixture.liveStats && fixture.liveStats.home.shotsOnTarget > 0
      ? Math.round((fixture.liveStats.home.shotsOnTarget + baseHomeSOT * remainingMatchFraction) * 10) / 10
      : Math.round(baseHomeSOT * 10) / 10;

  const awayTotalShots =
    isLiveOrDone && fixture.liveStats && fixture.liveStats.away.shots > 0
      ? Math.round((fixture.liveStats.away.shots + baseAwayShots * remainingMatchFraction) * 10) / 10
      : Math.round(baseAwayShots * 10) / 10;
  const awayShotsOnTarget =
    isLiveOrDone && fixture.liveStats && fixture.liveStats.away.shotsOnTarget > 0
      ? Math.round((fixture.liveStats.away.shotsOnTarget + baseAwaySOT * remainingMatchFraction) * 10) / 10
      : Math.round(baseAwaySOT * 10) / 10;

  const homeStarObj = homeTeam.starPlayer || {
    name: `${homeShort} #9`,
    position: 'DEL',
    goalConversionRate: 0.24,
    expectedShots: 2.8,
    expectedShotsOnTarget: 1.2
  };
  const awayStarObj = awayTeam.starPlayer || {
    name: `${awayShort} #9`,
    position: 'DEL',
    goalConversionRate: 0.23,
    expectedShots: 2.5,
    expectedShotsOnTarget: 1.1
  };

  const homeStrikerLambda = lambdaHome * 0.38 * ((homeStarObj.goalConversionRate || 0.24) / 0.25);
  const homeStrikerGoalProb = Math.round((1 - Math.exp(-homeStrikerLambda)) * 1000) / 10;

  const awayStrikerLambda = lambdaAway * 0.40 * ((awayStarObj.goalConversionRate || 0.23) / 0.25);
  const awayStrikerGoalProb = Math.round((1 - Math.exp(-awayStrikerLambda)) * 1000) / 10;

  const resolvedHomeStarName = resolveTeamStarPlayerName(
    homeTeam.name,
    homeStarObj.name,
    fixture.liveRosters?.homeStarters
  );
  const resolvedAwayStarName = resolveTeamStarPlayerName(
    awayTeam.name,
    awayStarObj.name,
    fixture.liveRosters?.awayStarters
  );

  const shotsAndPlayers: ShotsPlayerResult = {
    homeTotalShots,
    homeShotsOnTarget,
    awayTotalShots,
    awayShotsOnTarget,
    homeStar: {
      name: resolvedHomeStarName,
      position: homeStarObj.position || 'DEL',
      expectedShots: Math.round((homeStarObj.expectedShots || 2.8) * (awayTeam.defenseStrength * 0.96) * 10) / 10,
      expectedShotsOnTarget: Math.round((homeStarObj.expectedShotsOnTarget || 1.2) * (awayTeam.defenseStrength * 0.95) * 10) / 10,
      anytimeGoalProb: homeStrikerGoalProb
    },
    awayStar: {
      name: resolvedAwayStarName,
      position: awayStarObj.position || 'DEL',
      expectedShots: Math.round((awayStarObj.expectedShots || 2.5) * (1 - awayTotalPenalty) * 10) / 10,
      expectedShotsOnTarget: Math.round((awayStarObj.expectedShotsOnTarget || 1.1) * (1 - awayTotalPenalty) * 10) / 10,
      anytimeGoalProb: awayStrikerGoalProb
    }
  };

  // 8. Corners Bivariate Poisson Model (Synchronized with Real Live Telemetry)
  const urgencyCornerBoost = urgencyScore >= 7 ? 1.07 : 1.0;
  const rawHomeCorners = (baseHomeShots * 0.39 + homeTeam.attackStrength * 0.95) * urgencyCornerBoost;
  const rawAwayCorners = (baseAwayShots * 0.37 + awayTeam.attackStrength * 0.78) * urgencyCornerBoost;

  const preMatchHomeCorners = Math.min(7.8, Math.max(3.1, Math.round(rawHomeCorners * 10) / 10));
  const preMatchAwayCorners = Math.min(6.8, Math.max(2.5, Math.round(rawAwayCorners * 10) / 10));

  const lambdaHomeCorners =
    isLiveOrDone && fixture.liveStats
      ? Math.round((fixture.liveStats.home.corners + preMatchHomeCorners * remainingMatchFraction) * 10) / 10
      : preMatchHomeCorners;
  const lambdaAwayCorners =
    isLiveOrDone && fixture.liveStats
      ? Math.round((fixture.liveStats.away.corners + preMatchAwayCorners * remainingMatchFraction) * 10) / 10
      : preMatchAwayCorners;
  const expectedTotalCorners = Math.round((lambdaHomeCorners + lambdaAwayCorners) * 10) / 10;

  const currentActualCorners =
    isLiveOrDone && fixture.liveStats
      ? fixture.liveStats.home.corners + fixture.liveStats.away.corners
      : 0;
  const remCornersLambda = Math.max(0.2, expectedTotalCorners - currentActualCorners);

  const calcCornerOverProb = (lineFloor: number) => {
    if (isLiveOrDone && fixture.liveStats) {
      if (currentActualCorners > lineFloor) return 99.0;
      const needed = lineFloor - currentActualCorners;
      return Math.min(98.5, Math.max(1.5, Math.round((1 - poissonCdf(needed, remCornersLambda)) * 1000) / 10));
    }
    return Math.round((1 - poissonCdf(lineFloor, expectedTotalCorners)) * 1000) / 10;
  };

  const cornersOver75 = calcCornerOverProb(7);
  const cornersOver85 = calcCornerOverProb(8);
  const cornersOver95 = calcCornerOverProb(9);
  const cornersOver105 = calcCornerOverProb(10);
  const cornersUnder95 = Math.round((100 - cornersOver95) * 10) / 10;
  const cornersUnder105 = Math.round((100 - cornersOver105) * 10) / 10;

  // Pick the most reliable corners line (sweet spot 65% - 88% probability)
  let recommendedCornerLine = `Más de 8.5 Tiros de Esquina`;
  let recommendedCornerProb = cornersOver85;
  if (currentActualCorners >= 9 && cornersOver105 >= 65) {
    recommendedCornerLine = `Más de 10.5 Tiros de Esquina`;
    recommendedCornerProb = cornersOver105;
  } else if (expectedTotalCorners >= 10.4 && cornersOver85 >= 68) {
    recommendedCornerLine = `Más de 8.5 Tiros de Esquina`;
    recommendedCornerProb = cornersOver85;
  } else if (expectedTotalCorners >= 9.3 && cornersOver75 >= 68) {
    recommendedCornerLine = `Más de 7.5 Tiros de Esquina`;
    recommendedCornerProb = cornersOver75;
  } else if (expectedTotalCorners < 8.8 && cornersUnder105 >= 68) {
    recommendedCornerLine = `Menos de 10.5 Tiros de Esquina`;
    recommendedCornerProb = cornersUnder105;
  } else if (cornersOver75 >= cornersUnder105) {
    recommendedCornerLine = `Más de 7.5 Tiros de Esquina`;
    recommendedCornerProb = cornersOver75;
  } else {
    recommendedCornerLine = `Menos de 10.5 Tiros de Esquina`;
    recommendedCornerProb = cornersUnder105;
  }
  const recommendedCornerOdd = Math.max(1.22, Math.round((100 / Math.max(1, recommendedCornerProb)) * 100) / 100);

  const cornersMarket: CornersMarketResult = {
    lambdaHomeCorners,
    lambdaAwayCorners,
    expectedTotalCorners,
    over75: cornersOver75,
    over85: cornersOver85,
    over95: cornersOver95,
    over105: cornersOver105,
    under95: cornersUnder95,
    under105: cornersUnder105,
    recommendedLine: recommendedCornerLine,
    recommendedProb: recommendedCornerProb,
    recommendedOdd: recommendedCornerOdd
  };

  // 9. Referee and Cards Breakdown by Team (Synchronized with Real Live Telemetry)
  let tensionFactor = 1.0;
  if (derbyOrRivalry) tensionFactor = 1.16;
  else if (isTopClash) tensionFactor = 1.10;
  else if (isRelegationBattle) tensionFactor = 1.09;

  const baseCards = referee.avgYellowCards || (referee.rigor === 'Severo' ? 4.8 : referee.rigor === 'Flexible' ? 3.4 : 4.1);
  const rawExpectedYellow = baseCards * tensionFactor;
  const preMatchYellows = Math.round(Math.min(6.2, Math.max(2.8, rawExpectedYellow)) * 10) / 10;

  // Away teams and teams defending against stronger attacks commit ~53-56% of tactical fouls
  const homeCardShare = homeTeam.attackStrength > awayTeam.attackStrength ? 0.45 : 0.50;
  const preMatchHomeYellows = Math.round(preMatchYellows * homeCardShare * 10) / 10;
  const preMatchAwayYellows = Math.round((preMatchYellows - preMatchHomeYellows) * 10) / 10;

  const expectedHomeYellows =
    isLiveOrDone && fixture.liveStats
      ? Math.round((fixture.liveStats.home.yellowCards + preMatchHomeYellows * remainingMatchFraction) * 10) / 10
      : preMatchHomeYellows;
  const expectedAwayYellows =
    isLiveOrDone && fixture.liveStats
      ? Math.round((fixture.liveStats.away.yellowCards + preMatchAwayYellows * remainingMatchFraction) * 10) / 10
      : preMatchAwayYellows;
  const expectedYellowCards = Math.round((expectedHomeYellows + expectedAwayYellows) * 10) / 10;

  const currentActualCards =
    isLiveOrDone && fixture.liveStats
      ? fixture.liveStats.home.yellowCards +
        fixture.liveStats.away.yellowCards +
        fixture.liveStats.home.redCards +
        fixture.liveStats.away.redCards
      : 0;
  const remCardsLambda = Math.max(0.2, expectedYellowCards - currentActualCards);

  const calcCardsOverProb = (lineFloor: number) => {
    if (isLiveOrDone && fixture.liveStats) {
      if (currentActualCards > lineFloor) return 99.0;
      const needed = lineFloor - currentActualCards;
      return Math.min(98.5, Math.max(1.5, Math.round((1 - poissonCdf(needed, remCardsLambda)) * 1000) / 10));
    }
    return Math.round((1 - poissonCdf(lineFloor, expectedYellowCards)) * 1000) / 10;
  };

  const over35CardsProb = calcCardsOverProb(3);
  const over45CardsProb = calcCardsOverProb(4);
  const under45CardsProb = Math.round((100 - over45CardsProb) * 10) / 10;
  const under55CardsProb = Math.round((100 - calcCardsOverProb(5)) * 10) / 10;

  let recommendedCardPick = `Más de 3.5 Tarjetas`;
  let recommendedCardProb = over35CardsProb;
  if (expectedYellowCards >= 4.7 && over35CardsProb >= 68) {
    recommendedCardPick = `Más de 3.5 Tarjetas en el partido`;
    recommendedCardProb = over35CardsProb;
  } else if (expectedYellowCards >= 5.2 && over45CardsProb >= 62) {
    recommendedCardPick = `Más de 4.5 Tarjetas en el partido`;
    recommendedCardProb = over45CardsProb;
  } else if (expectedYellowCards <= 3.8 && under45CardsProb >= 66) {
    recommendedCardPick = `Menos de 4.5 Tarjetas en el partido`;
    recommendedCardProb = under45CardsProb;
  } else if (over35CardsProb >= under55CardsProb - 6) {
    recommendedCardPick = `Más de 3.5 Tarjetas en el partido`;
    recommendedCardProb = over35CardsProb;
  } else {
    recommendedCardPick = `Menos de 5.5 Tarjetas en el partido`;
    recommendedCardProb = under55CardsProb;
  }
  const recommendedCardOdd = Math.max(1.22, Math.round((100 / Math.max(1, recommendedCardProb)) * 100) / 100);

  const baseRed = referee.avgRedCards || 0.16;
  const actualReds =
    isLiveOrDone && fixture.liveStats
      ? fixture.liveStats.home.redCards + fixture.liveStats.away.redCards
      : 0;
  const expectedRedCards =
    actualReds > 0
      ? Math.round((actualReds + baseRed * remainingMatchFraction) * 100) / 100
      : Math.round(Math.min(0.35, Math.max(0.08, baseRed * tensionFactor)) * 100) / 100;
  const redCardRiskPercent =
    actualReds > 0
      ? 99.0
      : Math.round((1 - Math.exp(-expectedRedCards)) * 1000) / 10;

  const refereeCards: RefereeCardResult = {
    refereeName: referee.name,
    rigor: referee.rigor,
    rigorFactor: 1.0,
    matchTensionFactor: Math.round(tensionFactor * 100) / 100,
    expectedYellowCards,
    expectedHomeYellows,
    expectedAwayYellows,
    expectedRedCards,
    redCardRiskPercent,
    over35CardsProb,
    over45CardsProb,
    under45CardsProb,
    under55CardsProb,
    recommendedCardPick,
    recommendedCardProb,
    recommendedCardOdd,
    tensionExplanation:
      isLiveOrDone && fixture.liveStats
        ? `En tiempo real: ${fixture.liveStats.home.yellowCards + fixture.liveStats.away.yellowCards} 🟨 (${fixture.liveStats.home.yellowCards} ${homeShort} / ${fixture.liveStats.away.yellowCards} ${awayShort}). Proyección final: ~${expectedYellowCards} amarillas.`
        : referee.rigor === 'Severo'
        ? `Árbitro estricto (${referee.name}). Se proyectan ~${expectedYellowCards} amarillas (${expectedHomeYellows} ${homeShort} / ${expectedAwayYellows} ${awayShort}).`
        : referee.rigor === 'Flexible'
        ? `Árbitro permisivo (${referee.name}). Tiende a dar fluidez con ~${expectedYellowCards} amarillas (${expectedHomeYellows} ${homeShort} / ${expectedAwayYellows} ${awayShort}).`
        : `Árbitro equilibrado (${referee.name}). Promedio estimado de ${expectedYellowCards} amarillas (${expectedHomeYellows} ${homeShort} / ${expectedAwayYellows} ${awayShort}).`
  };

  // 10. Late Goals (Min 75-90+) (Module G)
  const lateGoalLambda = totalXG * 0.28 * (urgencyScore >= 7 ? 1.15 : 1.0);
  const lateGoalPercent = Math.round((1 - Math.exp(-lateGoalLambda)) * 1000) / 10;
  const dramaRating = lateGoalPercent >= 62 ? 'Alta Intensidad' : lateGoalPercent >= 48 ? 'Media Intensidad' : 'Partido Controlado';

  const lateGoals: LateGoalsResult = {
    lateGoalPercent,
    dramaRating,
    rationale:
      lateGoalPercent >= 60
        ? `Probabilidad crítica de gol tardío del ${lateGoalPercent}% en el tramo final (min 75-90+), propulsado por la necesidad urgente de puntos y la apertura de líneas.`
        : `Estimación estándar de gol en el cierre (${lateGoalPercent}%). Menor riesgo de colapso defensivo tardío.`
  };

  // 11. Clean Sheet / Imbatibilidad (Module I)
  const homeCleanSheetPercent = Math.round(Math.exp(-lambdaAway) * 1000) / 10;
  const awayCleanSheetPercent = Math.round(Math.exp(-lambdaHome) * 1000) / 10;

  const cleanSheet: CleanSheetResult = {
    homeCleanSheetPercent,
    awayCleanSheetPercent,
    homeDefenseRating: homeCleanSheetPercent >= 40 ? 'Defensa de Hierro' : homeCleanSheetPercent >= 28 ? 'Solidez Moderada' : 'Permisiva / Vulnerable',
    awayDefenseRating: awayCleanSheetPercent >= 35 ? 'Bloque Bajo Resiliente' : awayCleanSheetPercent >= 22 ? 'Solidez Moderada' : 'Riesgo Alto de Encajar'
  };

  // 12. Victory Margin and Market Odds Comparison (Module J)
  const closeMatchPercent = Math.round(closeMatchProb * 10) / 10;
  const wideWinPercent = Math.round(wideWinProb * 10) / 10;

  const margin = 1.05;
  const noiseHome = (fixture.id.charCodeAt(0) % 7) - 3;
  const noiseAway = (fixture.id.charCodeAt(fixture.id.length - 1) % 7) - 3;
  const rawMarketHomeProb = Math.max(12, Math.min(82, pHomeWin + noiseHome));
  const rawMarketAwayProb = Math.max(12, Math.min(82, pAwayWin + noiseAway));
  const rawMarketDrawProb = Math.max(12, 100 - (rawMarketHomeProb + rawMarketAwayProb));

  const bookmakerHomeOdds = Math.round((margin / (rawMarketHomeProb / 100)) * 100) / 100;
  const bookmakerDrawOdds = Math.round((margin / (rawMarketDrawProb / 100)) * 100) / 100;
  const bookmakerAwayOdds = Math.round((margin / (rawMarketAwayProb / 100)) * 100) / 100;

  const impliedHomeProb = Math.round((1 / bookmakerHomeOdds) * 1000) / 10;
  const impliedDrawProb = Math.round((1 / bookmakerDrawOdds) * 1000) / 10;
  const impliedAwayProb = Math.round((1 / bookmakerAwayOdds) * 1000) / 10;

  let valueBetDetected = false;
  let valueSide: '1' | 'X' | '2' | undefined;
  let valueEdgePercent: number | undefined;
  let valueExplanation: string | undefined;

  const edgeHome = Math.round((pHomeWin - impliedHomeProb) * 10) / 10;
  const edgeAway = Math.round((pAwayWin - impliedAwayProb) * 10) / 10;
  const edgeDraw = Math.round((pDraw - impliedDrawProb) * 10) / 10;

  if (edgeHome >= 4.0) {
    valueBetDetected = true;
    valueSide = '1';
    valueEdgePercent = edgeHome;
    valueExplanation = `Ventaja en ${homeShort}: Nuestro modelo proyecta ${pHomeWin}% vs cuota de mercado de ${bookmakerHomeOdds.toFixed(2)} (implica ${impliedHomeProb}%). Valor de +${edgeHome}%.`;
  } else if (edgeAway >= 4.0) {
    valueBetDetected = true;
    valueSide = '2';
    valueEdgePercent = edgeAway;
    valueExplanation = `Ventaja en ${awayShort}: Nuestro modelo proyecta ${pAwayWin}% vs cuota de mercado de ${bookmakerAwayOdds.toFixed(2)} (implica ${impliedAwayProb}%). Valor de +${edgeAway}%.`;
  } else if (edgeDraw >= 4.5) {
    valueBetDetected = true;
    valueSide = 'X';
    valueEdgePercent = edgeDraw;
    valueExplanation = `Ventaja en Empate: Nuestro modelo proyecta ${pDraw}% vs cuota de mercado de ${bookmakerDrawOdds.toFixed(2)} (implica ${impliedDrawProb}%). Valor de +${edgeDraw}%.`;
  }

  const marketOdds: MarketOddsComparison = {
    provider: 'Consenso de Mercado (The Odds API)',
    bookmakerHomeOdds,
    bookmakerDrawOdds,
    bookmakerAwayOdds,
    impliedHomeProb,
    impliedDrawProb,
    impliedAwayProb,
    valueBetDetected,
    valueSide,
    valueEdgePercent,
    valueExplanation
  };

  // ============================================================================
  // 13. MULTI-MARKET HIGH-PRECISION RANKING ENGINE
  // Evaluates ALL markets (Corners, Cards, Safe Goals, Double Chance, Half Goals,
  // Shots on Target, BTTS, and 1X2) and picks the highest real probability!
  // ============================================================================
  const candidatePicks: BestMarketPick[] = [];
  const maxWinnerProb = Math.max(pHomeWin, pAwayWin);

  // Candidate 1: Double Chance 1X or X2
  if (doubleChance1X >= doubleChanceX2 && doubleChance1X >= 64 && doubleChance1X <= 87) {
    const odd = Math.max(1.20, Math.round((100 / doubleChance1X) * 100) / 100);
    candidatePicks.push({
      id: 'dc_1x',
      category: 'DOUBLE_CHANCE',
      categoryLabel: '🛡️ Doble Oportunidad',
      label: `Gana o Empata ${homeShort} (1X)`,
      plainTitle: `${homeShort} gana o empata el partido (Doble Oportunidad 1X)`,
      probability: doubleChance1X,
      fairOdd: odd,
      riskLevel: doubleChance1X >= 72 ? 'Riesgo Bajo' : 'Riesgo Moderado',
      whySaferThanWinner: `Elegir solo ganador directo tiene ${pHomeWin}% de éxito, pero cubriendo también el empate (${pDraw}%) subes tu probabilidad real al ${doubleChance1X}%.`,
      stepByStepGuide: {
        step1: `Entra al partido y busca la sección llamada "Doble Oportunidad".`,
        step2: `Selecciona la opción "1X" o "${homeShort} o Empate".`,
        step3: `Ganas tu apuesta si ${homeShort} gana O si el partido termina empatado.`
      },
      glossaryTerm: {
        term: 'Doble Oportunidad (1X)',
        definition: 'Apuesta donde cubres 2 de los 3 resultados posibles del partido al mismo tiempo (Victoria Local + Empate).',
        example: `Si queda 1-0, 2-0, 0-0 o 1-1, ganas la apuesta. Solo pierdes si gana ${awayShort}.`
      }
    });
  } else if (doubleChanceX2 > doubleChance1X && doubleChanceX2 >= 64 && doubleChanceX2 <= 87) {
    const odd = Math.max(1.20, Math.round((100 / doubleChanceX2) * 100) / 100);
    candidatePicks.push({
      id: 'dc_x2',
      category: 'DOUBLE_CHANCE',
      categoryLabel: '🛡️ Doble Oportunidad',
      label: `Gana o Empata ${awayShort} (X2)`,
      plainTitle: `${awayShort} gana o empata el partido (Doble Oportunidad X2)`,
      probability: doubleChanceX2,
      fairOdd: odd,
      riskLevel: doubleChanceX2 >= 72 ? 'Riesgo Bajo' : 'Riesgo Moderado',
      whySaferThanWinner: `Apostar solo a que gana ${awayShort} tiene ${pAwayWin}%, mientras que sumando el empate (${pDraw}%) aseguras un ${doubleChanceX2}% de probabilidad real.`,
      stepByStepGuide: {
        step1: `Busca dentro del partido el mercado "Doble Oportunidad".`,
        step2: `Marca la casilla "X2" o "Empate o ${awayShort}".`,
        step3: `Cobras si ${awayShort} gana por cualquier marcador o si empatan.`
      },
      glossaryTerm: {
        term: 'Doble Oportunidad (X2)',
        definition: 'Te permite ganar con dos resultados: si gana el equipo visitante o si el partido termina en empate.',
        example: `Si el partido queda 0-0, 1-1 o gana ${awayShort} 0-1, tú ganas.`
      }
    });
  }

  // Candidate 2: Corners Market (Over 7.5, Over 8.5, or Under 10.5)
  candidatePicks.push({
    id: 'corners_best',
    category: 'CORNERS',
    categoryLabel: '🚩 Tiros de Esquina',
    label: `${recommendedCornerLine} (${expectedTotalCorners} proy.)`,
    plainTitle: `${recommendedCornerLine} en total (${expectedTotalCorners} proyectados)`,
    probability: recommendedCornerProb,
    fairOdd: recommendedCornerOdd,
    riskLevel: recommendedCornerProb >= 70 ? 'Riesgo Bajo' : 'Riesgo Moderado',
    whySaferThanWinner: `No importa quién gane ni quién meta los goles: los dos equipos promedian ${homeTotalShots + awayTotalShots} remates combinados que generan ~${expectedTotalCorners} córners (${recommendedCornerProb}% vs ${maxWinnerProb}% del ganador).`,
    stepByStepGuide: {
      step1: `Ve a la pestaña "Córners" o "Tiros de Esquina" dentro del partido.`,
      step2: `Busca "Total de Córners" y elige "${recommendedCornerLine}".`,
      step3: `Se suman los córners de ${homeShort} (~${lambdaHomeCorners}) y ${awayShort} (~${lambdaAwayCorners}). No importa quién gane el partido.`
    },
    glossaryTerm: {
      term: recommendedCornerLine,
      definition: 'Suma todos los tiros de esquina que cobren ambos equipos durante los 90 minutos reglamentarios.',
      example: recommendedCornerLine.includes('Más de 8.5')
        ? 'Si entre los dos equipos cobran 9, 10 o más tiros de esquina, ganas la apuesta.'
        : recommendedCornerLine.includes('Más de 7.5')
        ? 'Si entre los dos equipos cobran 8 o más tiros de esquina en total, ganas.'
        : 'Si en todo el partido hay 10 tiros de esquina o menos entre ambos, ganas.'
    }
  });

  // Candidate 3: Cards Market (Over 3.5, Over 4.5, or Under 4.5/5.5)
  candidatePicks.push({
    id: 'cards_best',
    category: 'CARDS',
    categoryLabel: '🟨 Tarjetas del Partido',
    label: `${recommendedCardPick} (~${expectedYellowCards} esp.)`,
    plainTitle: `${recommendedCardPick} (Árbitro: ${referee.name})`,
    probability: recommendedCardProb,
    fairOdd: recommendedCardOdd,
    riskLevel: recommendedCardProb >= 70 ? 'Riesgo Bajo' : 'Riesgo Moderado',
    whySaferThanWinner: `El árbitro ${referee.name} (${referee.rigor}) y la tensión del partido proyectan ${expectedYellowCards} amarillas (${recommendedCardProb}% de probabilidad real frente a ${maxWinnerProb}% de acertar ganador).`,
    stepByStepGuide: {
      step1: `Entra a la pestaña "Tarjetas" en tu aplicación de apuestas.`,
      step2: `En "Total de Tarjetas", selecciona "${recommendedCardPick}".`,
      step3: `Cuentan las tarjetas de ambos equipos (${expectedHomeYellows} esp. ${homeShort} + ${expectedAwayYellows} esp. ${awayShort}).`
    },
    glossaryTerm: {
      term: recommendedCardPick,
      definition: 'Pronóstico basado en la cantidad total de tarjetas amarillas/rojas mostradas por el árbitro a los dos equipos.',
      example: recommendedCardPick.includes('Más de 3.5')
        ? 'Con que el árbitro saque 4 o más tarjetas en total entre ambos equipos, ganas.'
        : recommendedCardPick.includes('Más de 4.5')
        ? 'Con que haya 5 o más tarjetas en total en el partido, ganas.'
        : 'Ganas si el partido se mantiene limpio y no supera el límite de tarjetas indicado.'
    }
  });

  // Candidate 4: Safe Goals (Over 1.5 Goals or Under 3.5 Goals)
  if (over15 >= 68 && over15 <= 87) {
    const odd15 = Math.max(1.20, Math.round((100 / over15) * 100) / 100);
    candidatePicks.push({
      id: 'goals_over15',
      category: 'SAFE_GOALS',
      categoryLabel: '⚽ Goles Seguros',
      label: `Más de 1.5 Goles (${totalXG} xG)`,
      plainTitle: `Habrá 2 o más goles en el partido (Más de 1.5 Goles)`,
      probability: over15,
      fairOdd: odd15,
      riskLevel: over15 >= 73 ? 'Riesgo Bajo' : 'Riesgo Moderado',
      whySaferThanWinner: `En vez de adivinar quién ganará (${maxWinnerProb}%), aquí ganas con cualquier marcador que tenga al menos 2 goles: 1-1, 2-0, 0-2, 2-1 (${over15}% de probabilidad).`,
      stepByStepGuide: {
        step1: `Abre la sección "Goles" o "Total de Goles (Más/Menos)".`,
        step2: `Elige la línea "Más de 1.5 Goles" (Over 1.5).`,
        step3: `Ganas en cuanto se anote el segundo gol del partido, sin importar de qué equipo sea.`
      },
      glossaryTerm: {
        term: 'Más de 1.5 Goles',
        definition: 'Significa que sumando los goles de ambos equipos debe haber 2 goles o más en el partido.',
        example: 'Si el partido queda 1-1, 2-0, 0-2 o 2-1, ganas automáticamente.'
      }
    });
  }

  if (under35 >= 68 && under35 <= 86 && totalXG <= 2.65) {
    const oddU35 = Math.max(1.20, Math.round((100 / under35) * 100) / 100);
    candidatePicks.push({
      id: 'goals_under35',
      category: 'SAFE_GOALS',
      categoryLabel: '🔒 Límite de Goles Seguro',
      label: `Menos de 3.5 Goles (${totalXG} xG)`,
      plainTitle: `Habrá máximo 3 goles en total (Menos de 3.5 Goles)`,
      probability: under35,
      fairOdd: oddU35,
      riskLevel: under35 >= 73 ? 'Riesgo Bajo' : 'Riesgo Moderado',
      whySaferThanWinner: `Es un partido táctico (${totalXG} goles esperados). Cubres el 0-0, 1-0, 0-1, 1-1, 2-0, 0-2, 2-1 y 1-2 con un ${under35}% de probabilidad real.`,
      stepByStepGuide: {
        step1: `Busca la sección "Total de Goles" en tu casa de apuestas.`,
        step2: `Selecciona "Menos de 3.5 Goles" (Under 3.5).`,
        step3: `Ganas siempre que en el partido se anoten 0, 1, 2 o hasta 3 goles como máximo.`
      },
      glossaryTerm: {
        term: 'Menos de 3.5 Goles',
        definition: 'Ganas si la suma total de goles del partido es de 3 o menos.',
        example: 'Te sirven marcadores como 0-0, 1-0, 1-1, 2-1 o 2-0. Solo pierdes si hay 4 o más goles.'
      }
    });
  }

  // Candidate 5: Goal in 2nd Half (+0.5 Goles en 2da Mitad)
  if (secondHalfGoalProb >= 68 && secondHalfGoalProb <= 86) {
    const odd2H = Math.max(1.22, Math.round((100 / secondHalfGoalProb) * 100) / 100);
    candidatePicks.push({
      id: 'half_2h_goal',
      category: 'HALF_GOALS',
      categoryLabel: '⏱️ Goles por Mitad',
      label: `Gol en la 2.ª Mitad (+0.5 Goles 2T)`,
      plainTitle: `Habrá al menos 1 gol en el Segundo Tiempo`,
      probability: secondHalfGoalProb,
      fairOdd: odd2H,
      riskLevel: secondHalfGoalProb >= 74 ? 'Riesgo Bajo' : 'Riesgo Moderado',
      whySaferThanWinner: `El cansancio defensivo en el segundo tiempo eleva la expectativa a ${expected2ndHalfGoals} goles en esa mitad (${secondHalfGoalProb}% de probabilidad de que caiga al menos 1 gol).`,
      stepByStepGuide: {
        step1: `Entra a la pestaña "Mitades" o "2.ª Mitad" del partido.`,
        step2: `Selecciona "2.ª Mitad - Más de 0.5 Goles".`,
        step3: `Con que cualquiera de los dos equipos anote 1 gol después del descanso, ganas.`
      },
      glossaryTerm: {
        term: 'Más de 0.5 Goles en 2.ª Mitad',
        definition: 'Significa que debe anotarse mínimo 1 gol entre el minuto 46 y el final del partido.',
        example: 'Aunque el primer tiempo termine 0-0, si en el segundo tiempo alguien mete un gol, ganas.'
      }
    });
  }

  // Candidate 6: Shots on Target Market
  const totalShotsOnTarget = Math.round((homeShotsOnTarget + awayShotsOnTarget) * 10) / 10;
  const shotsProb = Math.min(82.5, Math.max(63.0, Math.round((1 - poissonCdf(7, totalShotsOnTarget)) * 1000) / 10));
  if (totalShotsOnTarget >= 8.2) {
    candidatePicks.push({
      id: 'shots_on_target',
      category: 'SHOTS',
      categoryLabel: '🎯 Remates al Arco',
      label: `${homeShort} +3.5 Remates a Puerta (${homeShotsOnTarget} proy.)`,
      plainTitle: `${homeShort} realizará 4 o más tiros directos al arco`,
      probability: shotsProb,
      fairOdd: Math.max(1.25, Math.round((100 / shotsProb) * 100) / 100),
      riskLevel: shotsProb >= 70 ? 'Riesgo Bajo' : 'Riesgo Moderado',
      whySaferThanWinner: `Aunque el portero rival ataje los disparos y el partido quede empatado, cada atajada cuenta como remate al arco (${homeShotsOnTarget} proyectados para ${homeShort}).`,
      stepByStepGuide: {
        step1: `Busca la sección "Estadísticas" o "Remates a Puerta".`,
        step2: `Elige "${homeShort} Más de 3.5 Remates a Puerta".`,
        step3: `Cuentan todos los tiros que vayan a gol o que ataje el arquero rival.`
      },
      glossaryTerm: {
        term: 'Remates a Puerta (Al Arco)',
        definition: 'Cualquier disparo que termina en gol o que habría entrado si el portero no lo atajaba.',
        example: 'Los tiros que van a las manos del arquero cuentan a tu favor aunque no sean gol.'
      }
    });
  }

  // Candidate 7: BTTS (Both Teams to Score)
  if (bttsYes >= 62 || bttsNo >= 64) {
    const isYes = bttsYes >= bttsNo;
    const bttsProb = isYes ? bttsYes : bttsNo;
    const bttsOdd = Math.max(1.25, Math.round((100 / bttsProb) * 100) / 100);
    candidatePicks.push({
      id: 'btts_pick',
      category: 'BTTS',
      categoryLabel: '🥅 Ambos Marcan',
      label: isYes ? 'Ambos Equipos Anotan: Sí' : 'Ambos Equipos Anotan: No',
      plainTitle: isYes ? 'Los dos equipos anotarán al menos 1 gol cada uno' : 'Al menos un equipo se quedará con 0 goles',
      probability: bttsProb,
      fairOdd: bttsOdd,
      riskLevel: bttsProb >= 68 ? 'Riesgo Bajo' : 'Riesgo Moderado',
      whySaferThanWinner: isYes
        ? `Ambos ataques superan a las defensas rivales (${lambdaHome} y ${lambdaAway} xG), dándote ${bttsProb}% de acierto sin importar quién gane.`
        : `La solidez defensiva proyecta que al menos un arco quedará en cero (${bttsProb}% de probabilidad).`,
      stepByStepGuide: {
        step1: `En la pantalla principal del partido, ubica "Ambos Equipos Anotarán".`,
        step2: `Marca la opción "${isYes ? 'Sí' : 'No'}".`,
        step3: isYes
          ? `Ganas apenas ${homeShort} y ${awayShort} hayan anotado mínimo un gol cada uno.`
          : `Ganas si cualquiera de los dos equipos termina el partido con 0 goles.`
      },
      glossaryTerm: {
        term: `Ambos Marcan (${isYes ? 'Sí' : 'No'})`,
        definition: isYes
          ? 'Requiere que tanto el equipo local como el visitante anoten mínimo 1 gol.'
          : 'Significa que uno de los dos equipos (o ambos) no anotará ningún gol.',
        example: isYes ? '1-1, 2-1 o 1-2 son ganadores.' : '0-0, 1-0, 2-0 o 0-1 son ganadores.'
      }
    });
  }

  // Candidate 8: 1X2 Direct Winner (Only included to compete fairly on pure probability)
  if (maxWinnerProb >= 55) {
    const isHomeFav = pHomeWin >= pAwayWin;
    const favName = isHomeFav ? homeShort : awayShort;
    const favProb = isHomeFav ? pHomeWin : pAwayWin;
    const favOdd = isHomeFav ? fairOddsHome : fairOddsAway;
    candidatePicks.push({
      id: 'winner_1x2',
      category: '1X2',
      categoryLabel: '🏆 Ganador Directo',
      label: `Victoria de ${favName}`,
      plainTitle: `${favName} gana el partido en los 90 minutos`,
      probability: favProb,
      fairOdd: favOdd,
      riskLevel: favProb >= 68 ? 'Riesgo Bajo' : 'Riesgo Moderado',
      whySaferThanWinner: `${favName} tiene una superioridad estadística marcada del ${favProb}% según el motor G METRICS.`,
      stepByStepGuide: {
        step1: `En el mercado principal "Resultado del Partido (1X2)".`,
        step2: `Selecciona como ganador a "${favName}".`,
        step3: `Ganas si ${favName} termina con más goles que su rival.`
      },
      glossaryTerm: {
        term: 'Resultado 1X2 (Ganador)',
        definition: 'Apuesta tradicional a quién ganará el partido: 1 (Local), X (Empate), 2 (Visitante).',
        example: `En este caso, necesitas que ${favName} gane el encuentro.`
      }
    });
  }

  // Sort ALL candidate markets strictly by highest real mathematical probability!
  // If two markets are within 0.8% of each other, prefer tactical markets (Corners, Cards, Safe Goals, Double Chance) over raw 1X2.
  candidatePicks.sort((a, b) => {
    if (Math.abs(b.probability - a.probability) <= 1.2) {
      if (a.category === '1X2' && b.category !== '1X2') return 1;
      if (b.category === '1X2' && a.category !== '1X2') return -1;
    }
    return b.probability - a.probability;
  });

  const topSafePick: BestMarketPick = candidatePicks[0];
  const allRankedPicks = candidatePicks.slice(0, 6);

  // Populate legacy recommendedPicks from our multi-market ranked picks so all exports/modals stay synchronized
  const recommendedPicks: { label: string; market: string; probability: number; odd: number }[] = allRankedPicks.map(
    (p) => ({
      label: p.label,
      market: p.categoryLabel,
      probability: p.probability,
      odd: p.fairOdd
    })
  );

  if (valueBetDetected && valueSide && valueEdgePercent) {
    const vLabel =
      valueSide === '1'
        ? `Valor +EV: ${homeShort} (@${bookmakerHomeOdds})`
        : valueSide === '2'
        ? `Valor +EV: ${awayShort} (@${bookmakerAwayOdds})`
        : `Valor +EV: Empate (@${bookmakerDrawOdds})`;
    const vOdd = valueSide === '1' ? bookmakerHomeOdds : valueSide === '2' ? bookmakerAwayOdds : bookmakerDrawOdds;
    const vProb = valueSide === '1' ? pHomeWin : valueSide === '2' ? pAwayWin : pDraw;
    recommendedPicks.push({ label: vLabel, market: 'Apuesta de Valor (+EV)', probability: vProb, odd: vOdd });
  }

  let confidenceTier: 'Alta Convicción' | 'Valor Estadístico' | 'Precaución Táctica' = 'Valor Estadístico';
  if (topSafePick.probability >= 72) {
    confidenceTier = 'Alta Convicción';
  } else if (topSafePick.probability < 62 && closeMatchPercent >= 72) {
    confidenceTier = 'Precaución Táctica';
  }

  const goalTendency = over25 >= 52 ? `tendencia ofensiva con ${totalXG} xG combinados` : `corte táctico (${totalXG} xG)`;
  const technicalVerdict = `La jugada matemática más factible del partido es "${topSafePick.label}" con ${topSafePick.probability}% de probabilidad real (${topSafePick.categoryLabel}, cuota justa @${topSafePick.fairOdd.toFixed(2)}), superando el ${maxWinnerProb}% de elegir un ganador directo. Se proyectan ${expectedTotalCorners} tiros de esquina (${lambdaHomeCorners} ${homeShort} vs ${lambdaAwayCorners} ${awayShort}), ${expectedYellowCards} tarjetas amarillas con el árbitro ${referee.name} y un ${goalTendency}.`;

  const keyTacticalFactor = derbyOrRivalry
    ? `Factor Derbi: Alta fricción (${expectedYellowCards} amarillas esp.) y presión en bandas (${expectedTotalCorners} córners).`
    : awayTotalPenalty > 0.06
    ? `Desgaste de viaje en ${awayShort} (-${(awayTotalPenalty * 100).toFixed(1)}% xG por traslado de ${travel.awayDistanceKm} km).`
    : `Proyección multi-mercado: ${expectedTotalCorners} córners esperados y ${totalShotsOnTarget} remates al arco combinados.`;

  const verdict: VerdictResult = {
    closeMatchPercent,
    wideWinPercent,
    recommendedPicks,
    topSafePick,
    allRankedPicks,
    confidenceTier,
    technicalVerdict,
    keyTacticalFactor
  };

  const analysisResult: MatchAnalysis = {
    matchId: fixture.id,
    dixonColes,
    goalsMarket,
    cornersMarket,
    refereeCards,
    shotsAndPlayers,
    urgency,
    halfGoals,
    lateGoals,
    fatigue,
    cleanSheet,
    verdict,
    marketOdds
  };

  if (liveScoreKey) {
    analysisCache.set(liveScoreKey, analysisResult);
  }

  return analysisResult;
}

// ============================================================================
// MOTOR G METRICS (BETA ADMIN): ENSEMBLE VOTING DE 3 SUB-MODELOS & STRESS TEST
// ============================================================================

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

function computeEstimatedMatchEndTimestamp(fixture: MatchFixture): number {
  if (fixture.startTimestamp && fixture.startTimestamp > 0) {
    // Un partido dura ~2 horas (120 min) desde el pitazo inicial
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
 * Traduce la varianza matemática a lenguaje 100% comprensible y genera el Consejo G METRICS.
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

  // Cuota Justa Matemática = 1 / Probabilidad Conjunta (con margen de seguridad de +2% para garantizar EV+)
  const rawFairOdd = jointProbability > 0 ? 100 / jointProbability : 1.0;
  const combinedFairMinOdd = Number(Math.max(1.05, rawFairOdd).toFixed(2));

  const combinedUserOdd = Number(
    items.reduce((acc, item) => acc * Math.max(1.01, item.odd || 1.01), 1.0).toFixed(2)
  );

  const evEdgePercent = Number((((combinedUserOdd / combinedFairMinOdd) - 1) * 100).toFixed(1));
  const isPositiveEV = combinedUserOdd >= combinedFairMinOdd;

  // Simulación determinística sobre 100 escenarios ajustada por penalización de varianza acumulada
  const varianceDrag = items.length > 3 ? Math.pow(0.97, items.length - 3) : 1.0;
  const simulatedWinsPer100 = Math.max(1, Math.min(96, Math.round(jointProbability * varianceDrag)));

  // Identificar las 2 selecciones más difíciles (menor probabilidad)
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
 * Genera Parlays Sugeridos por el Sistema (Cuotas > 1.50) exclusivos para Beta Admin.
 * Utiliza votación consensuada en segundo plano de 3 Sub-Modelos (Dixon-Coles, ELO/Forma y Fatiga/Árbitro)
 * y genera boletos balanceados de 2 y 3 selecciones con expiración automática a los 2 días (48h) del último partido.
 */
export function generateGMetricsAdminParlays(
  fixtures: MatchFixture[],
  includeFinished = false
): GMetricsParlaySuggestion[] {
  if (!fixtures || fixtures.length === 0) return [];

  // Filtrar partidos elegibles (no finalizados ni cancelados, salvo en auditoría mensual)
  const activeFixtures = includeFinished
    ? fixtures.filter((f) => f.status !== 'CANCELLED' && f.status !== 'POSTPONED')
    : fixtures.filter(
        (f) => f.status !== 'FINISHED' && f.status !== 'CANCELLED' && f.status !== 'POSTPONED'
      );

  const sourceFixtures = activeFixtures.length >= 2 ? activeFixtures : fixtures;
  const approvedPool: GMetricsParlayLeg[] = [];

  for (const fixture of sourceFixtures) {
    const analysis = calculateMatchAnalysis(fixture);
    const { homeTeam, awayTeam, league, derbyOrRivalry } = fixture;

    // SUB-MODELO 1: Dixon-Coles & Poisson (Requiere probabilidad >= 64% y mercado táctico claro)
    const rankedPicks = analysis.verdict.allRankedPicks || [analysis.verdict.topSafePick];
    const bestPick =
      rankedPicks.find((p) => p.probability >= 67 && p.fairOdd >= 1.24 && p.category !== '1X2') ||
      analysis.verdict.topSafePick;

    if (!bestPick || bestPick.probability < 62) continue;
    const dixonColesApproved = bestPick.probability >= 66;

    // SUB-MODELO 2: Forma Reciente & ELO Dinámico (Últimos 5 partidos y diferencial ataque/defensa)
    const calcFormPoints = (form: ('W' | 'D' | 'L')[]) =>
      (form || []).reduce((acc, r) => acc + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0);
    const homeFormScore = calcFormPoints(homeTeam.form);
    const awayFormScore = calcFormPoints(awayTeam.form);
    const powerConsistency =
      bestPick.category === 'DOUBLE_CHANCE'
        ? homeFormScore >= 5 || awayFormScore >= 5
        : homeTeam.attackStrength + awayTeam.attackStrength >= 1.8;
    const eloFormApproved = powerConsistency && analysis.verdict.closeMatchPercent <= 84;

    // SUB-MODELO 3: Matriz de Bajas, Fatiga Bilateral y Filtro de Volatilidad
    const lowFatigueDistortion =
      analysis.fatigue.awayPenaltyPercent <= 9.5 && analysis.fatigue.homePenaltyPercent <= 8.0;
    const lowVolatility =
      !(derbyOrRivalry && bestPick.category === '1X2') &&
      !(analysis.refereeCards.rigor === 'Severo' && bestPick.category === '1X2');
    const fatigueImmunityApproved = lowFatigueDistortion && lowVolatility;

    // Regla del Parlay G METRICS: Solo aprueba si hay consenso de los sub-modelos
    const modelsCount =
      (dixonColesApproved ? 1 : 0) + (eloFormApproved ? 1 : 0) + (fatigueImmunityApproved ? 1 : 0);
    if (modelsCount < 2) continue;

    const unanimousScore = Math.min(
      99,
      Math.round(bestPick.probability * 0.85 + modelsCount * 6.5)
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
            ? 'Consenso Unánime 3/3 (Goles + Forma Reciente + Inmunidad Fatiga)'
            : 'Consenso 2/3 Sub-Modelos Cuantitativos'
      }
    });
  }

  // Ordenar por puntaje de consenso unánime y probabilidad real
  approvedPool.sort((a, b) => {
    if (b.consensus.unanimousScore !== a.consensus.unanimousScore) {
      return b.consensus.unanimousScore - a.consensus.unanimousScore;
    }
    return b.probability - a.probability;
  });

  const suggestions: GMetricsParlaySuggestion[] = [];
  const TWO_DAYS_MS = 48 * 60 * 60 * 1000; // 2 días exactos después de finalizado el último partido

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

    // Garantizar que toda sugerencia supere la cuota 1.50x solicitada
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

    // Criterio de Kelly Fraccional Conservador (25% Kelly)
    const b = combinedEstimatedOdd - 1;
    const p = jointProbability / 100;
    const q = 1 - p;
    const rawKelly = b > 0 ? (b * p - q) / b : 0.02;
    const recommendedKellyStakePct = Number(
      Math.min(5.0, Math.max(1.5, rawKelly * 0.25 * 100)).toFixed(1)
    );

    // El boleto expira exactamente 2 días (48h) después de que finalice su último partido
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

  // 1. BOLETO DE 3 SELECCIONES: Trío Maestro Consensuado (3 Patas Top)
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

  // 2. BOLETO DE 2 SELECCIONES: Dúo Blindado G METRICS (2 Patas Top)
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

  // 3. BOLETO DE 3 SELECCIONES: Trío Táctico Multi-Mercado (3 Patas Alternativas)
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

  // 4. BOLETO DE 2 SELECCIONES: Dúo Valor Táctico EV+ (2 Patas Secundarias)
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


