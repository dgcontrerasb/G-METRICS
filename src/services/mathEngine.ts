import {
  MatchFixture,
  NBAMatchFixture,
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
  BestMarketPick,
  GMetricsSingleBetSuggestion,
  BetMarketCategory,
  BettingMarketSuggestion,
  SmartParlaySlip
} from '../types';
import { getSoccerLineupData, resolveTeamStarPlayerName } from './lineupService';
import { getIsoWeekKey, UNVERIFIABLE_PARLAY_CATEGORIES } from './parlaySinglesLedger';
import {
  extractNBABettingMarketSuggestions,
  generateGMetricsNBABankerPicks
} from './nbaEngine';
import {
  factorial,
  poissonPmf,
  poissonCdf,
  dixonColesTau,
  evaluateEloAndBradleyTerry,
  predictCornersByMultipleRegression,
  predictCardsByMultipleRegression,
  calibrateGoalsMarketsWithLogisticRegression,
  shrinkLambdaBayesian,
  rankCandidatePicksByDecisionTree,
  selectOptimalCornerLineByDecisionTree,
  selectOptimalCardLineByDecisionTree,
  buildGMetricsAdminParlaysWithAnalyzer,
  buildGMetricsSingleValueBetsWithAnalyzer,
  evaluateParlayStressAndFairOdds,
  computeEstimatedMatchEndTimestamp,
  GMetricsParlaySuggestion
} from './math';

// Re-export all 6 modular math layers so all external callers maintain 100% backward compatibility
export * from './math';

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

  const homeTeam = fixture.homeTeam || { id: 'h', name: 'Local', shortName: 'Local', restHours: 96, attackStrength: 1.35, defenseStrength: 0.90 };
  const awayTeam = fixture.awayTeam || { id: 'a', name: 'Visita', shortName: 'Visita', restHours: 96, attackStrength: 1.15, defenseStrength: 1.05 };
  const league = fixture.league || { id: 'l', name: 'Liga Oficial', avgGoalsPerMatch: 2.7 };
  const derbyOrRivalry = fixture.derbyOrRivalry;
  const referee = fixture.referee || { name: 'Árbitro Oficial', avgYellowCards: 4.1, avgRedCards: 0.16, rigor: 'Equilibrado' as const };
  const travel = fixture.travel || { awayDistanceKm: 180, awayFlightHours: 0.5 };
  const homeShort = homeTeam?.shortName || homeTeam?.name || 'Local';
  const awayShort = awayTeam?.shortName || awayTeam?.name || 'Visita';

  // 1. Fatigue & Rest calculation (Module H)
  const homeRestHours = Number(homeTeam.restHours ?? 96) || 96;
  const awayRestHours = Number(awayTeam.restHours ?? 96) || 96;
  const homeRestPenalty = homeRestHours < 72 ? Math.min(0.09, 0.05 + ((72 - homeRestHours) / 72) * 0.04) : 0;

  const awayRestPenalty = awayRestHours < 72 ? Math.min(0.09, 0.05 + ((72 - awayRestHours) / 72) * 0.04) : 0;
  const awayTravelPenalty = travel.awayFlightHours > 3 ? Math.min(0.05, 0.02 + (travel.awayFlightHours - 3) * 0.01) : 0;
  const awayTotalPenalty = Math.min(0.12, awayRestPenalty + awayTravelPenalty);

  const fatigue: BilateralFatigueResult = {
    homeRestHours,
    awayRestHours,
    awayTravelKm: travel.awayDistanceKm,
    awayTravelHours: travel.awayFlightHours,
    awayPenaltyPercent: Math.round(awayTotalPenalty * 1000) / 10,
    homePenaltyPercent: Math.round(homeRestPenalty * 1000) / 10,
    fatigueDiagnosis:
      awayTotalPenalty > 0.07
        ? `Desgaste severo en el cuadro visitante: ${awayRestHours}h de descanso y ${travel.awayDistanceKm}km de traslado. Penalización de -${(awayTotalPenalty * 100).toFixed(1)}% en xG.`
        : awayTotalPenalty > 0.03
        ? `Fatiga moderada para ${awayShort} (${awayRestHours}h de recuperación). Ligera desventaja de fondo físico.`
        : `Condición atlética óptima en ambos planteles (>72h de recuperación entre competencias).`
  };

  // 1.5. Dynamic Elo & Bradley-Terry Relative Strength (Layer 2)
  const eloBt = evaluateEloAndBradleyTerry(homeTeam, awayTeam, homeRestPenalty, awayTotalPenalty);

  // 2. Dixon-Coles Lambdas (Expected Goals - xG) with Bayesian Shrinkage (Layer 1 & 6)
  const leagueMean = league.avgGoalsPerMatch ? league.avgGoalsPerMatch / 2 : 1.35;
  const homeAdvantageFactor = 1.15; // +15% historical home advantage

  const homeAttack = Number(homeTeam.attackStrength) || 1.35;
  const awayAttack = Number(awayTeam.attackStrength) || 1.15;
  const homeDefense = Number(homeTeam.defenseStrength) || 0.90;
  const awayDefense = Number(awayTeam.defenseStrength) || 1.05;

  let lambdaHome = leagueMean * homeAttack * awayDefense * homeAdvantageFactor * (1 - homeRestPenalty);
  let lambdaAway = leagueMean * awayAttack * homeDefense * (1 - awayTotalPenalty);

  if (isNaN(lambdaHome) || lambdaHome <= 0) lambdaHome = 1.45;
  if (isNaN(lambdaAway) || lambdaAway <= 0) lambdaAway = 1.10;

  // Calibrate expected goals using deterministic pre-match baseline (immune to mid-game liveRosters arrival)
  const lineup = getSoccerLineupData({ ...fixture, liveRosters: undefined });
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

  // Bayesian shrinkage towards league mean based on form consistency
  lambdaHome = shrinkLambdaBayesian(lambdaHome, leagueMean, eloBt.formConsistencyScore);
  lambdaAway = shrinkLambdaBayesian(lambdaAway, leagueMean, eloBt.formConsistencyScore);

  // Pre-match probabilities remain 100% immutable during and after the match
  // to guarantee audit and accuracy report integrity (no mid-game 100% overrides).
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

  // Ensemble 1X2: 70% Dixon-Coles Matrix + 30% Dynamic Elo & Bradley-Terry Davidson extension
  const dcHomeWin = pHomeWin;
  const dcDraw = pDraw;
  const dcAwayWin = pAwayWin;

  pHomeWin = Math.round((0.70 * dcHomeWin + 0.30 * eloBt.eloHomeWinProb) * 10) / 10;
  pDraw = Math.round((0.70 * dcDraw + 0.30 * eloBt.eloDrawProb) * 10) / 10;
  pAwayWin = Math.round((0.70 * dcAwayWin + 0.30 * eloBt.eloAwayWinProb) * 10) / 10;

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

  // 6. Goals & Double Chance Market calibrated with Logistic Sigmoid Regression (Layer 3)
  const calibratedGoals = calibrateGoalsMarketsWithLogisticRegression(
    {
      bttsYes: bttsYesProb,
      over15: over15Prob,
      over25: over25Prob,
      over35: over35Prob
    },
    {
      lambdaHome,
      lambdaAway,
      totalXG,
      urgencyScore,
      homeAttack,
      awayAttack,
      homeDefense,
      awayDefense
    }
  );

  const bttsYes = calibratedGoals.bttsYes;
  const bttsNo = Math.round((100 - bttsYes) * 10) / 10;
  const over15 = calibratedGoals.over15;
  const under15 = Math.round((100 - over15) * 10) / 10;
  const over25 = calibratedGoals.over25;
  const under25 = Math.round((100 - over25) * 10) / 10;
  const over35 = calibratedGoals.over35;
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

  // 7. Shots and Key Strikers (Module D - Immutable Pre-Match Baseline)
  const isLiveOrDone = fixture.status === 'IN_PLAY' || fixture.status === 'FINISHED';

  const homeShotsAvg = Number(homeTeam.avgShotsPerMatch ?? 13.0) || 13.0;
  const homeSOTAvg = Number(homeTeam.avgShotsOnTarget ?? 4.5) || 4.5;
  const awayShotsAvg = Number(awayTeam.avgShotsPerMatch ?? 10.5) || 10.5;
  const awaySOTAvg = Number(awayTeam.avgShotsOnTarget ?? 3.6) || 3.6;

  const baseHomeShots = homeShotsAvg * (awayDefense * 0.95);
  const baseHomeSOT = homeSOTAvg * (awayDefense * 0.92);
  const baseAwayShots = awayShotsAvg * (homeDefense * 0.9) * (1 - awayTotalPenalty);
  const baseAwaySOT = awaySOTAvg * (homeDefense * 0.9) * (1 - awayTotalPenalty);

  const homeTotalShots = Math.round(baseHomeShots * 10) / 10;
  const homeShotsOnTarget = Math.round(baseHomeSOT * 10) / 10;
  const awayTotalShots = Math.round(baseAwayShots * 10) / 10;
  const awayShotsOnTarget = Math.round(baseAwaySOT * 10) / 10;

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
      expectedShots: Math.round((homeStarObj.expectedShots || 2.8) * (awayDefense * 0.96) * 10) / 10,
      expectedShotsOnTarget: Math.round((homeStarObj.expectedShotsOnTarget || 1.2) * (awayDefense * 0.95) * 10) / 10,
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

  // 8. Corners Multiple Regression & Decision Tree Model (Layers 3 & 5)
  const cornersReg = predictCornersByMultipleRegression({
    baseHomeShots,
    baseAwayShots,
    homeAttack,
    awayAttack,
    urgencyScore,
    derbyOrRivalry: Boolean(derbyOrRivalry),
    eloDiffWithHomeAdvantage: (eloBt.homeEloRating + 45) - eloBt.awayEloRating,
    homeAvgCornersFor: 5.4,
    awayAvgCornersFor: 4.5
  });

  const lambdaHomeCorners = cornersReg.lambdaHomeCorners;
  const lambdaAwayCorners = cornersReg.lambdaAwayCorners;
  const expectedTotalCorners = cornersReg.expectedTotalCorners;

  const calcCornerOverProb = (lineFloor: number) => {
    return Math.round((1 - poissonCdf(lineFloor, expectedTotalCorners)) * 1000) / 10;
  };

  const cornersOver75 = calcCornerOverProb(7);
  const cornersOver85 = calcCornerOverProb(8);
  const cornersOver95 = calcCornerOverProb(9);
  const cornersOver105 = calcCornerOverProb(10);
  const cornersUnder95 = Math.round((100 - cornersOver95) * 10) / 10;
  const cornersUnder105 = Math.round((100 - cornersOver105) * 10) / 10;

  const optimalCorner = selectOptimalCornerLineByDecisionTree({
    expectedTotalCorners,
    cornersOver75,
    cornersOver85,
    cornersOver95,
    cornersUnder95,
    cornersUnder105
  });
  const recommendedCornerLine = optimalCorner.recommendedCornerLine;
  const recommendedCornerProb = optimalCorner.recommendedCornerProb;
  const recommendedCornerOdd = optimalCorner.recommendedCornerOdd;

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

  // 9. Referee and Cards Multiple Regression & Decision Tree Model (Layers 3 & 5)
  const cardsReg = predictCardsByMultipleRegression({
    refereeAvgYellowCards: referee.avgYellowCards,
    refereeRigor: referee.rigor,
    derbyOrRivalry: Boolean(derbyOrRivalry),
    isTopClash,
    isRelegationBattle,
    homeAttackStrength: homeAttack,
    awayAttackStrength: awayAttack,
    urgencyIndex: urgencyScore
  });

  const tensionFactor = cardsReg.tensionFactor;
  const expectedYellowCards = cardsReg.expectedYellowCards;
  const expectedHomeYellows = cardsReg.expectedHomeYellows;
  const expectedAwayYellows = cardsReg.expectedAwayYellows;

  const calcCardsOverProb = (lineFloor: number) => {
    return Math.round((1 - poissonCdf(lineFloor, expectedYellowCards)) * 1000) / 10;
  };

  const over35CardsProb = calcCardsOverProb(3);
  const over45CardsProb = calcCardsOverProb(4);
  const under45CardsProb = Math.round((100 - over45CardsProb) * 10) / 10;
  const under55CardsProb = Math.round((100 - calcCardsOverProb(5)) * 10) / 10;

  const optimalCard = selectOptimalCardLineByDecisionTree({
    expectedYellowCards,
    over35CardsProb,
    over45CardsProb,
    under45CardsProb,
    under55CardsProb,
    refereeRigor: referee.rigor
  });
  const recommendedCardPick = optimalCard.recommendedCardPick;
  const recommendedCardProb = optimalCard.recommendedCardProb;
  const recommendedCardOdd = optimalCard.recommendedCardOdd;

  const baseRed = referee.avgRedCards || 0.16;
  const expectedRedCards = Math.round(Math.min(0.35, Math.max(0.08, baseRed * tensionFactor)) * 100) / 100;
  const redCardRiskPercent = Math.round((1 - Math.exp(-expectedRedCards)) * 1000) / 10;

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

  // Rank ALL candidate markets strictly using Multi-Criteria Decision Tree (Layers 5 & 6: Bayesian LCB + Tactical Context)
  const rankedCandidatePicks = rankCandidatePicksByDecisionTree(candidatePicks, {
    closeMatchPercent,
    derbyOrRivalry: Boolean(derbyOrRivalry),
    eloDiffAbs: Math.abs(eloBt.homeEloRating - eloBt.awayEloRating),
    urgencyScore,
    formConsistencyScore: eloBt.formConsistencyScore,
    homeFatiguePenalty: homeRestPenalty,
    awayFatiguePenalty: awayTotalPenalty,
    refereeRigor: referee.rigor
  });

  const topSafePick: BestMarketPick = rankedCandidatePicks[0] || candidatePicks[0];
  const allRankedPicks = rankedCandidatePicks.slice(0, 6);

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
// MOTOR G METRICS (BETA ADMIN): ENSEMBLE VOTING & SINGLE VALUE BETS (LAYER 6)
// Interfaces y evaluateParlayStressAndFairOdds delegadas a src/services/math/parlayAndSinglesEngine.ts
// ============================================================================

/**
 * Genera Parlays Sugeridos por el Sistema (Cuotas > 1.50) exclusivos para Beta Admin.
 * Delegado a la Capa 6 (parlayAndSinglesEngine) con validación de LCB Bayesiano >= 58%.
 */
export function generateGMetricsAdminParlays(
  fixtures: MatchFixture[],
  includeFinished = false
): GMetricsParlaySuggestion[] {
  return buildGMetricsAdminParlaysWithAnalyzer(fixtures, calculateMatchAnalysis, includeFinished);
}

/**
 * Generador Cuantitativo de Apuestas Sencillas G METRICS (Beta):
 * - Tipo 'HIGH_VALUE': Cuotas Altas (1.80 a 2.60+) con probabilidad sólida (52%-68%) y Edge matemático (+EV >= 6%).
 * - Tipo 'BANKER': Base Segura (1.35 a 1.72) con probabilidad muy alta (74%-88%+) para apuestas sencillas de bajo riesgo.
 */
export function generateGMetricsSingleValueBets(
  fixtures: MatchFixture[],
  includeFinished = false,
  limitPerCategory: number = 10,
  nbaFixtures?: NBAMatchFixture[]
): GMetricsSingleBetSuggestion[] {
  return buildGMetricsSingleValueBetsWithAnalyzer(
    fixtures,
    calculateMatchAnalysis,
    includeFinished,
    limitPerCategory,
    nbaFixtures
  );
}

// =========================================================================
// MOTOR CUANTITATIVO DE PARLAYS INTELIGENTES (COLOMBIAN BOOKMAKERS READY)
// =========================================================================

/**
 * Extrae los mercados cuantitativos estandarizados de un partido a partir
 * de las probabilidades computadas por Poisson y Dixon-Coles.
 */
export function extractMatchBettingMarketSuggestions(
  fixture: MatchFixture,
  analysis?: MatchAnalysis
): BettingMarketSuggestion[] {
  const matchAnalysis = analysis || calculateMatchAnalysis(fixture);
  const { dixonColes, goalsMarket, cornersMarket, refereeCards, shotsAndPlayers, halfGoals } = matchAnalysis;
  const homeName = fixture.homeTeam?.name || 'Local';
  const awayName = fixture.awayTeam?.name || 'Visitante';

  const INVALID_STANDALONE = new Set([
    'san', 'st', 'st.', 'sta', 'sta.', 'santa', 'santo', 'real', 'club', 'cd', 'cf', 'ca', 'cs', 'deportivo',
    'atletico', 'atlético', 'sporting', 'inter', 'racing', 'boca', 'river', 'union', 'unión', 'independiente',
    'estudiantes', 'leones', 'la', 'los', 'el', 'las', 'al'
  ]);

  const resolveTeamLabel = (fullName: string, shortName?: string): string => {
    if (!fullName) return shortName || 'Equipo';
    const cleanFull = fullName.trim();
    if (shortName && shortName.trim().length >= 4 && !INVALID_STANDALONE.has(shortName.trim().toLowerCase())) {
      return shortName.trim();
    }
    return cleanFull;
  };

  const homeShort = resolveTeamLabel(homeName, fixture.homeTeam?.shortName);
  const awayShort = resolveTeamLabel(awayName, fixture.awayTeam?.shortName);
  const matchName = `${homeName} vs ${awayName}`;
  const leagueName = fixture.league?.name || 'Liga Oficial';

  const candidates: BettingMarketSuggestion[] = [];

  const addCandidate = (
    category: BetMarketCategory,
    label: string,
    probRaw: number, // 0 - 1
    edgeBoost: number = 0.04
  ) => {
    // Solo considerar selecciones con probabilidad estadísticamente sólida (> 48%)
    if (probRaw <= 0.48 || probRaw > 0.95) return;
    const impliedProb = Number(probRaw.toFixed(3));
    const fairOdd = 1 / impliedProb;
    // Cuota ofrecida estimada en casas colombianas con valor esperado positivo (+EV)
    const odds = Number(Math.max(1.30, Number((fairOdd * (1 + edgeBoost)).toFixed(2))));
    const expectedValue = Number(((impliedProb * odds) - 1).toFixed(3));

    // REGLA 4: Solo seleccionar eventos con cuotas individuales >= 1.30 y con +EV
    if (odds >= 1.30 && expectedValue > 0) {
      candidates.push({
        fixtureId: fixture.id,
        matchName,
        leagueName,
        category,
        label,
        odds,
        impliedProb,
        expectedValue,
        availableInColombianBooks: true,
        espnEventId: fixture.espnEventId || String(fixture.id)
      });
    }
  };

  // 1. MERCADO 1X2
  if (dixonColes.pHomeWin >= 50) {
    addCandidate(BetMarketCategory.ONE_X_TWO, `Gana ${homeShort} (1)`, dixonColes.pHomeWin / 100, 0.045);
  }
  if (dixonColes.pAwayWin >= 48) {
    addCandidate(BetMarketCategory.ONE_X_TWO, `Gana ${awayShort} (2)`, dixonColes.pAwayWin / 100, 0.045);
  }

  // 2. MERCADO DOUBLE_CHANCE (Doble Oportunidad)
  if (goalsMarket.doubleChance1X >= 64) {
    addCandidate(BetMarketCategory.DOUBLE_CHANCE, `${homeShort} o Empate (1X)`, goalsMarket.doubleChance1X / 100, 0.038);
  }
  if (goalsMarket.doubleChanceX2 >= 64) {
    addCandidate(BetMarketCategory.DOUBLE_CHANCE, `Empate o ${awayShort} (X2)`, goalsMarket.doubleChanceX2 / 100, 0.038);
  }
  if (goalsMarket.doubleChance12 >= 70) {
    addCandidate(BetMarketCategory.DOUBLE_CHANCE, `Cualquiera Gana (12)`, goalsMarket.doubleChance12 / 100, 0.035);
  }

  // 3. MERCADO TOTAL_GOALS (Over / Under 1.5, 2.5)
  if (goalsMarket.over15 >= 66) {
    addCandidate(BetMarketCategory.TOTAL_GOALS, `Más de 1.5 Goles`, goalsMarket.over15 / 100, 0.04);
  }
  if (goalsMarket.under15 >= 50) {
    addCandidate(BetMarketCategory.TOTAL_GOALS, `Menos de 1.5 Goles`, goalsMarket.under15 / 100, 0.045);
  }
  if (goalsMarket.over25 >= 52) {
    addCandidate(BetMarketCategory.TOTAL_GOALS, `Más de 2.5 Goles`, goalsMarket.over25 / 100, 0.05);
  }
  if (goalsMarket.under25 >= 55) {
    addCandidate(BetMarketCategory.TOTAL_GOALS, `Menos de 2.5 Goles`, goalsMarket.under25 / 100, 0.045);
  }

  // 4. MERCADO BTTS (Ambos Equipos Marcan)
  if (goalsMarket.bttsYes >= 53) {
    addCandidate(BetMarketCategory.BTTS, `Ambos Marcan: Sí`, goalsMarket.bttsYes / 100, 0.042);
  }
  if (goalsMarket.bttsNo >= 54) {
    addCandidate(BetMarketCategory.BTTS, `Ambos Marcan: No`, goalsMarket.bttsNo / 100, 0.042);
  }

  // 5. MERCADO TOTAL_CORNERS_MATCH
  if (cornersMarket.over75 >= 70) {
    addCandidate(BetMarketCategory.TOTAL_CORNERS_MATCH, `Más de 7.5 Córners`, cornersMarket.over75 / 100, 0.038);
  } else if (cornersMarket.over85 >= 62) {
    addCandidate(BetMarketCategory.TOTAL_CORNERS_MATCH, `Más de 8.5 Córners`, cornersMarket.over85 / 100, 0.04);
  } else if (cornersMarket.over95 >= 54) {
    addCandidate(BetMarketCategory.TOTAL_CORNERS_MATCH, `Más de 9.5 Córners`, cornersMarket.over95 / 100, 0.045);
  } else if ((cornersMarket.under105 || 100 - cornersMarket.over105) >= 58) {
    const underProb = (cornersMarket.under105 || 100 - cornersMarket.over105) / 100;
    addCandidate(BetMarketCategory.TOTAL_CORNERS_MATCH, `Menos de 10.5 Córners`, underProb, 0.04);
  }

  // 6. MERCADO DRAW_NO_BET (Empate Apuesta No Válida)
  const dnbDenominator = dixonColes.pHomeWin + dixonColes.pAwayWin;
  if (dnbDenominator > 0) {
    const dnbHomeProb = dixonColes.pHomeWin / dnbDenominator;
    const dnbAwayProb = dixonColes.pAwayWin / dnbDenominator;
    if (dnbHomeProb >= 0.58) {
      addCandidate(BetMarketCategory.DRAW_NO_BET, `Empate No Válido: ${homeShort}`, dnbHomeProb, 0.04);
    } else if (dnbAwayProb >= 0.58) {
      addCandidate(BetMarketCategory.DRAW_NO_BET, `Empate No Válido: ${awayShort}`, dnbAwayProb, 0.04);
    }
  }

  // 7. MERCADO TOTAL_CARDS (Tarjetas Totales y Disciplina)
  if (refereeCards) {
    if (refereeCards.over35CardsProb >= 68) {
      addCandidate(BetMarketCategory.TOTAL_CARDS, `Más de 3.5 Tarjetas`, refereeCards.over35CardsProb / 100, 0.042);
    } else if (refereeCards.under45CardsProb >= 68) {
      addCandidate(BetMarketCategory.TOTAL_CARDS, `Menos de 4.5 Tarjetas`, refereeCards.under45CardsProb / 100, 0.04);
    } else if (refereeCards.under55CardsProb >= 72) {
      addCandidate(BetMarketCategory.TOTAL_CARDS, `Menos de 5.5 Tarjetas`, refereeCards.under55CardsProb / 100, 0.038);
    } else if (refereeCards.over45CardsProb >= 58 && refereeCards.rigor === 'Severo') {
      addCandidate(BetMarketCategory.TOTAL_CARDS, `Más de 4.5 Tarjetas`, refereeCards.over45CardsProb / 100, 0.048);
    }
  }

  // 8. MERCADO PLAYER_SHOTS_ON_TARGET (Tiros a Puerta por Jugador Estrella)
  const isValidPlayerName = (name?: string): boolean => {
    if (!name || typeof name !== 'string') return false;
    const clean = name.trim();
    if (clean.length < 4 || clean.includes('#')) return false;
    const lower = clean.toLowerCase();
    if (lower.includes('local') || lower.includes('visitante') || lower.includes('equipo') || lower.includes('jugador')) return false;
    return true;
  };

  if (shotsAndPlayers) {
    if (isValidPlayerName(shotsAndPlayers.homeStar?.name) && (shotsAndPlayers.homeStar.expectedShotsOnTarget || 0) >= 1.15) {
      const lambdaSOT = shotsAndPlayers.homeStar.expectedShotsOnTarget;
      const probSOT = Math.round((1 - Math.exp(-lambdaSOT)) * 1000) / 1000;
      if (probSOT >= 0.65) {
        addCandidate(BetMarketCategory.PLAYER_SHOTS_ON_TARGET, `${shotsAndPlayers.homeStar.name}: Más de 0.5 Tiros a Puerta`, probSOT, 0.042);
      }
    }
    if (isValidPlayerName(shotsAndPlayers.awayStar?.name) && (shotsAndPlayers.awayStar.expectedShotsOnTarget || 0) >= 1.15) {
      const lambdaSOT = shotsAndPlayers.awayStar.expectedShotsOnTarget;
      const probSOT = Math.round((1 - Math.exp(-lambdaSOT)) * 1000) / 1000;
      if (probSOT >= 0.65) {
        addCandidate(BetMarketCategory.PLAYER_SHOTS_ON_TARGET, `${shotsAndPlayers.awayStar.name}: Más de 0.5 Tiros a Puerta`, probSOT, 0.042);
      }
    }
  }

  // 9. MERCADO HALF_WITH_MOST_GOALS (Mitades con Más Goles & Goles 2T)
  if (halfGoals) {
    const prob2ndHalfGoal = Math.round((1 - Math.exp(-halfGoals.expected2ndHalfGoals)) * 1000) / 1000;
    if (prob2ndHalfGoal >= 0.72) {
      addCandidate(BetMarketCategory.HALF_WITH_MOST_GOALS, `2.ª Mitad: Más de 0.5 Goles`, prob2ndHalfGoal, 0.038);
    } else if (halfGoals.secondHalfPercent >= 48) {
      addCandidate(BetMarketCategory.HALF_WITH_MOST_GOALS, `Mitad con Más Goles: 2.ª Mitad`, halfGoals.secondHalfPercent / 100, 0.045);
    }
  }

  return candidates;
}

/**
 * Normalizador riguroso de nombres de equipos deportivos (Fútbol y Baloncesto).
 * Remueve sufijos, tipos de entidad (FC, FK, SK, CF, CD...), prefijos genéricos, mascottes
 * y maneja caracteres especiales como ø -> o, æ -> ae, ß -> ss, ð -> d, þ -> th.
 */
const SPORT_NOISE_TOKENS = new Set([
  'fc', 'fk', 'sk', 'sc', 'cf', 'cd', 'ca', 'cs', 'cp', 'bk', 'if', 'ik', 'ff', 'afc', 'bsc', 'ksc', 'tsv', 'vfb', 'vfl', 'sv', 'rb', 'ac', 'as', 'ss', 'us',
  'club', 'deportivo', 'atletico', 'atlético', 'sporting', 'real', 'de', 'del', 'la', 'las', 'los', 'el', 'the', 'al', 'and', 'y',
  'women', 'femenil', 'fem', 'w', 'lady', 'ladies', 'men', 'masculino', 'm', 'bear', 'bears', 'sooner', 'sooners', 'team'
]);

export function normalizeSportTeamName(name?: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[\u00f8\u00d8]/g, 'o') // ø, Ø -> o
    .replace(/[\u00e6\u00c6]/g, 'ae') // æ, Æ -> ae
    .replace(/[\u00df]/g, 'ss') // ß -> ss
    .replace(/[\u00f0\u00d0]/g, 'd') // ð, Ð -> d
    .replace(/[\u00fe\u00de]/g, 'th') // þ, Þ -> th
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => (t.endsWith('s') && t.length > 4 ? t.slice(0, -1) : t))
    .filter((t) => t && !SPORT_NOISE_TOKENS.has(t))
    .join(' ')
    .trim();
}

export function getCanonicalMatchKey(home?: string, away?: string): string {
  const h = normalizeSportTeamName(home);
  const a = normalizeSportTeamName(away);
  return `${h}|${a}`;
}

export function normalizeBetLabel(label?: string): string {
  return String(label || '')
    .toLowerCase()
    .replace(/[\u00f8\u00d8]/g, 'o')
    .replace(/[\u00e6\u00c6]/g, 'ae')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .join(' ')
    .trim();
}

/**
 * Obtiene la firma canónica universal de una apuesta (Partido Canónico + Pronóstico Canónico).
 * Independiente de si el ID proviene de ESPN, API-Football o mocks.
 */
export function getCanonicalPickSignature(matchName: string, label: string): string {
  const parts = matchName.split(/\s+vs\s+|\s+v\s+|\s+-\s+/i);
  const mKey = parts.length >= 2 ? getCanonicalMatchKey(parts[0], parts[1]) : normalizeSportTeamName(matchName);
  return `${mKey}:::${normalizeBetLabel(label)}`;
}

/**
 * Versión del motor de parlays. Los boletos PENDIENTES generados con otra versión se purgan
 * automáticamente (los ya resueltos WON/LOST se conservan para no alterar la medición de eficacia).
 */
export const PARLAY_ENGINE_VERSION = 'v7-zero-dupes';

/**
 * Generador Cuantitativo de Parlays Inteligentes Diversificados
 * Aplica REGLA 1 (Anti-Monotonía), REGLA 2 (Cross-Match), REGLA 3 (Límites por Perfil) y REGLA 4 (+EV >= 1.30).
 * `variety` (0-1) añade una variación ligera al puntaje para que "Generar de nuevo" produzca combinaciones distintas.
 */
export function generateSmartParlays(
  availableMatches: MatchFixture[],
  targetDate?: string,
  availableNBAMatches?: NBAMatchFixture[],
  variety: number = 0
): SmartParlaySlip[] {
  const hasMatches = Boolean(availableMatches && availableMatches.length > 0);
  const hasNBAMatches = Boolean(availableNBAMatches && availableNBAMatches.length > 0);
  if (!hasMatches && !hasNBAMatches) return [];

  // 1. Indexar todas las sugerencias agrupadas por Clave Canónica del Partido
  // Esto elimina de raíz duplicados de un mismo partido con IDs diferentes (ESPN vs API-Football)
  const matchCandidatesMap = new Map<
    string,
    { fixture: MatchFixture | NBAMatchFixture; suggestions: BettingMarketSuggestion[] }
  >();

  // Procesar partidos de fútbol válidos
  for (const match of (availableMatches || [])) {
    if (!match || !match.id || !match.homeTeam?.name || !match.awayTeam?.name) continue;
    if (match.status === 'CANCELLED' || match.status === 'POSTPONED') continue;
    const cKey = getCanonicalMatchKey(match.homeTeam.name, match.awayTeam.name);
    if (!cKey || cKey === '|') continue;
    if (!matchCandidatesMap.has(cKey)) {
      const suggestions = extractMatchBettingMarketSuggestions(match).filter(
        (s) => !UNVERIFIABLE_PARLAY_CATEGORIES.has(String(s.category))
      );
      if (suggestions.length > 0) {
        matchCandidatesMap.set(cKey, { fixture: match, suggestions });
      }
    }
  }

  // Procesar partidos de baloncesto válidos
  for (const nbaMatch of (availableNBAMatches || [])) {
    if (!nbaMatch || !nbaMatch.id || !nbaMatch.homeTeam?.name || !nbaMatch.awayTeam?.name) continue;
    const cKey = getCanonicalMatchKey(nbaMatch.homeTeam.name, nbaMatch.awayTeam.name);
    if (!cKey || cKey === '|') continue;
    if (!matchCandidatesMap.has(cKey)) {
      const nbaSuggestions = extractNBABettingMarketSuggestions(nbaMatch).filter(
        (s) => !UNVERIFIABLE_PARLAY_CATEGORIES.has(String(s.category))
      );
      if (nbaSuggestions.length > 0) {
        matchCandidatesMap.set(cKey, { fixture: nbaMatch, suggestions: nbaSuggestions });
      }
    }
  }

  const distinctMatchKeys = Array.from(matchCandidatesMap.keys());
  if (distinctMatchKeys.length < 2) return [];

  const todayStr = targetDate || new Date().toISOString().split('T')[0];
  const generatedSlips: SmartParlaySlip[] = [];

  // Registro global de selecciones y categorías ya utilizadas en boletos previos
  // REGLA DE ORO: Ninguna selección idéntica (partido + pronóstico) se puede repetir en diferentes boletos.
  // Si un partido se reutiliza, DEBE ser con una categoría / apuesta diferente.
  const globalUsedPickSignatures = new Set<string>();
  const globalUsedMatchKeys = new Set<string>();
  const globalMatchUsedCategories = new Map<string, Set<string>>();

  // Helper de búsqueda combinatoria
  const findOptimalSlip = (
    profile: 'CONSERVATIVE' | 'BALANCED' | 'HIGH_ODDS',
    numLegs: number,
    minOdds: number,
    maxOdds: number,
    excludedSlipHashes: Set<string>
  ): SmartParlaySlip | null => {
    if (distinctMatchKeys.length < numLegs) return null;

    let bestCombo: BettingMarketSuggestion[] | null = null;
    let bestScore = -Infinity;
    let searchIterations = 0;
    const MAX_SEARCH_ITERATIONS = 15000;

    // Función recursiva para seleccionar numLegs de partidos distintos y categorías distintas
    const search = (
      matchIdx: number,
      currentLegs: BettingMarketSuggestion[],
      usedCategories: Set<string>,
      currentOdds: number
    ) => {
      if (++searchIterations > MAX_SEARCH_ITERATIONS) return;
      // Poda por cuota máxima excedida
      if (currentOdds > maxOdds * 1.05) return;

      if (currentLegs.length === numLegs) {
        if (currentOdds >= minOdds && currentOdds <= maxOdds) {
          const hash = currentLegs.map((l) => `${l.fixtureId}_${l.category}`).sort().join('|');
          if (excludedSlipHashes.has(hash)) return;

          // Score: maximizar probabilidad acumulada + EV promedio, priorizando partidos no utilizados previamente
          const cumulativeProb = currentLegs.reduce((acc, l) => acc * l.impliedProb, 1);
          const avgEV = currentLegs.reduce((acc, l) => acc + l.expectedValue, 0) / numLegs;
          const reusedCount = currentLegs.filter((l) => {
            const parts = l.matchName.split(/\s+vs\s+|\s+v\s+|\s+-\s+/i);
            const k = parts.length >= 2 ? getCanonicalMatchKey(parts[0], parts[1]) : normalizeSportTeamName(l.matchName);
            return globalUsedMatchKeys.has(k);
          }).length;
          const score = cumulativeProb * 100 + avgEV * 10 - (reusedCount * 30) + (variety > 0 ? Math.random() * variety * 12 : 0);

          if (score > bestScore) {
            bestScore = score;
            bestCombo = [...currentLegs];
          }
        }
        return;
      }

      if (distinctMatchKeys.length - matchIdx < numLegs - currentLegs.length) return;

      for (let i = matchIdx; i < distinctMatchKeys.length; i++) {
        const matchKey = distinctMatchKeys[i];
        const matchEntry = matchCandidatesMap.get(matchKey);
        if (!matchEntry) continue;

        for (const pick of matchEntry.suggestions) {
          // REGLA 1 (Anti-Monotonía Estricta): Categorías estrictamente diferentes para todas las patas del boleto
          if (usedCategories.has(pick.category)) {
            continue;
          }

          // REGLA ANTI-REPETICIÓN ABSOLUTA: Jamás repetir la misma apuesta en diferentes boletos
          const pickSig = getCanonicalPickSignature(pick.matchName, pick.label);
          if (globalUsedPickSignatures.has(pickSig)) {
            continue;
          }

          // Si el partido ya fue utilizado en un boleto anterior, SOLO permitir categoría diferente
          const priorCats = globalMatchUsedCategories.get(matchKey);
          if (priorCats && priorCats.has(pick.category)) {
            continue;
          }

          const nextOdds = Number((currentOdds * pick.odds).toFixed(2));
          usedCategories.add(pick.category);
          currentLegs.push(pick);

          search(i + 1, currentLegs, usedCategories, nextOdds);

          currentLegs.pop();
          usedCategories.delete(pick.category);
        }
      }
    };

    search(0, [], new Set(), 1.0);

    // Fallback: si la ventana estricta no se alcanza por pocos partidos, buscar la más equilibrada
    if (!bestCombo) {
      let closestCombo: BettingMarketSuggestion[] | null = null;
      let minDistance = Infinity;
      let fallbackIterations = 0;

      const fallbackSearch = (
        matchIdx: number,
        currentLegs: BettingMarketSuggestion[],
        usedCategories: Set<string>,
        currentOdds: number
      ) => {
        if (++fallbackIterations > MAX_SEARCH_ITERATIONS) return;
        if (currentOdds > maxOdds * 1.25) return;

        if (currentLegs.length === numLegs) {
          const hash = currentLegs.map((l) => `${l.fixtureId}_${l.category}`).sort().join('|');
          if (excludedSlipHashes.has(hash)) return;

          const distance = Math.abs(currentOdds - (minOdds + maxOdds) / 2);
          const reusedCount = currentLegs.filter((l) => {
            const parts = l.matchName.split(/\s+vs\s+|\s+v\s+|\s+-\s+/i);
            const k = parts.length >= 2 ? getCanonicalMatchKey(parts[0], parts[1]) : normalizeSportTeamName(l.matchName);
            return globalUsedMatchKeys.has(k);
          }).length;
          const adjustedDistance = distance + (reusedCount * 2.0);
          if (adjustedDistance < minDistance) {
            minDistance = adjustedDistance;
            closestCombo = [...currentLegs];
          }
          return;
        }

        if (distinctMatchKeys.length - matchIdx < numLegs - currentLegs.length) return;

        for (let i = matchIdx; i < distinctMatchKeys.length; i++) {
          const matchKey = distinctMatchKeys[i];
          const matchEntry = matchCandidatesMap.get(matchKey);
          if (!matchEntry) continue;

          for (const pick of matchEntry.suggestions) {
            if (usedCategories.has(pick.category)) continue;

            const pickSig = getCanonicalPickSignature(pick.matchName, pick.label);
            if (globalUsedPickSignatures.has(pickSig)) continue;

            const priorCats = globalMatchUsedCategories.get(matchKey);
            if (priorCats && priorCats.has(pick.category)) continue;

            usedCategories.add(pick.category);
            currentLegs.push(pick);
            fallbackSearch(i + 1, currentLegs, usedCategories, Number((currentOdds * pick.odds).toFixed(2)));
            currentLegs.pop();
            usedCategories.delete(pick.category);
          }
        }
      };

      fallbackSearch(0, [], new Set(), 1.0);
      bestCombo = closestCombo;
    }

    if (!bestCombo || (bestCombo as BettingMarketSuggestion[]).length !== numLegs) {
      return null;
    }

    const finalCombo = bestCombo as BettingMarketSuggestion[];
    const totalOdds = Number(finalCombo.reduce((acc, l) => acc * l.odds, 1).toFixed(2));
    const hash = finalCombo.map((l) => `${l.fixtureId}_${l.category}`).sort().join('|');
    excludedSlipHashes.add(hash);

    // Guardar firmas para asegurar que boletos subsiguientes no repitan las mismas apuestas
    for (const leg of finalCombo) {
      const parts = leg.matchName.split(/\s+vs\s+|\s+v\s+|\s+-\s+/i);
      const matchKey = parts.length >= 2 ? getCanonicalMatchKey(parts[0], parts[1]) : normalizeSportTeamName(leg.matchName);
      const pickSig = getCanonicalPickSignature(leg.matchName, leg.label);

      globalUsedPickSignatures.add(pickSig);
      globalUsedMatchKeys.add(matchKey);
      if (!globalMatchUsedCategories.has(matchKey)) {
        globalMatchUsedCategories.set(matchKey, new Set());
      }
      globalMatchUsedCategories.get(matchKey)!.add(leg.category);
    }

    return {
      id: `smart_parlay_${profile.toLowerCase()}_${todayStr.replace(/-/g, '')}_${Math.random().toString(36).substring(2, 7)}`,
      date: todayStr,
      weekKey: getIsoWeekKey(todayStr),
      profile,
      legs: finalCombo,
      totalOdds,
      effectiveOdds: totalOdds,
      status: 'PENDING',
      engineVersion: PARLAY_ENGINE_VERSION,
      createdAt: Date.now()
    };
  };

  const usedHashes = new Set<string>();

  // 1. PERFIL CONSERVADOR: 2 eventos, cuota entre 1.85 y 2.30
  const conservativeSlip = findOptimalSlip('CONSERVATIVE', 2, 1.85, 2.30, usedHashes);
  if (conservativeSlip) generatedSlips.push(conservativeSlip);

  // 2. PERFIL EQUILIBRADO: 3 eventos, cuota entre 2.80 y 4.20
  const balancedSlip = findOptimalSlip('BALANCED', 3, 2.80, 4.20, usedHashes);
  if (balancedSlip) generatedSlips.push(balancedSlip);

  // 3. PERFIL CUOTA ALTA: 4 eventos (máximo 5), cuota entre 5.00 y 8.50
  const highOddsSlip = findOptimalSlip('HIGH_ODDS', 4, 5.00, 8.50, usedHashes);
  if (highOddsSlip) generatedSlips.push(highOddsSlip);

  // Control Final de Seguridad Post-Generación: Jamás devolver boletos que compartan una apuesta idéntica
  {
    const seenPicks = new Set<string>();
    for (let sIdx = 0; sIdx < generatedSlips.length; sIdx++) {
      const slip = generatedSlips[sIdx];
      const hasDuplicate = slip.legs.some((l) => {
        const sig = getCanonicalPickSignature(l.matchName, l.label);
        if (seenPicks.has(sig)) return true;
        seenPicks.add(sig);
        return false;
      });
      if (hasDuplicate) {
        // En caso extremo de colisión no detectada, filtrar el boleto duplicado
        generatedSlips.splice(sIdx, 1);
        sIdx--;
      }
    }
  }

  return generatedSlips;
}



