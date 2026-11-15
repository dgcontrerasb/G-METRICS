/**
 * Capa 3: Modelos de Regresión Múltiple y Regresión Logística (Fútbol y Baloncesto NBA/FIBA)
 * Estima expectativas de variables continuas (córners, tarjetas, puntos) y calibra probabilidades
 * binarias sigmoides (BTTS, Over/Under) mitigando sesgos de modelos univariados.
 */

/**
 * Función Sigmoide Logística Estándar: sigma(z) = 1 / (1 + e^-z)
 */
export function logisticSigmoid(z: number): number {
  if (z < -40) return 0;
  if (z > 40) return 1;
  return 1 / (1 + Math.exp(-z));
}

// ============================================================================
// 1. REGRESIÓN MÚLTIPLE DE CÓRNERS (FÚTBOL)
// ============================================================================

export interface SoccerMultipleRegressionCornersInput {
  baseHomeShots: number;
  baseAwayShots: number;
  homeAttack: number;
  awayAttack: number;
  urgencyScore: number;
  derbyOrRivalry?: boolean;
  eloDiffWithHomeAdvantage?: number;
  homeAvgCornersFor?: number;
  awayAvgCornersFor?: number;
  homeAvgCornersAgainst?: number;
  awayAvgCornersAgainst?: number;
}

export interface SoccerCornersRegressionResult {
  lambdaHomeCorners: number;
  lambdaAwayCorners: number;
  expectedTotalCorners: number;
  urgencyCornerBoost: number;
}

/**
 * Proyecta la tasa esperada de tiros de esquina (lambdaHome, lambdaAway, total)
 * aplicando coeficientes empíricos multivariables de remates, ataque, urgencia y asimetría de fuerza.
 */
export function predictCornersByMultipleRegression(
  input: SoccerMultipleRegressionCornersInput
): SoccerCornersRegressionResult {
  const {
    baseHomeShots,
    baseAwayShots,
    homeAttack,
    awayAttack,
    urgencyScore,
    derbyOrRivalry = false,
    eloDiffWithHomeAdvantage = 50,
    homeAvgCornersFor,
    awayAvgCornersFor,
    homeAvgCornersAgainst,
    awayAvgCornersAgainst
  } = input;

  // Multiplicador táctico por urgencia y rivalidad directa
  const urgencyCornerBoost =
    urgencyScore >= 8 ? 1.09 : urgencyScore >= 6.5 ? 1.05 : derbyOrRivalry ? 1.07 : 1.0;

  // Regresión multivariable para local
  // Beta_0 = 1.15, Beta_shots = 0.35, Beta_att = 0.88, Beta_elo = 0.0018
  const eloHomeEffect = Math.max(-0.6, Math.min(0.8, eloDiffWithHomeAdvantage * 0.0018));
  let regHome = (1.15 + baseHomeShots * 0.35 + homeAttack * 0.88 + eloHomeEffect) * urgencyCornerBoost;

  // Regresión multivariable para visitante
  // Beta_0 = 0.95, Beta_shots = 0.33, Beta_att = 0.72, Beta_elo = -0.0015
  const eloAwayEffect = Math.max(-0.7, Math.min(0.6, -eloDiffWithHomeAdvantage * 0.0015));
  let regAway = (0.95 + baseAwayShots * 0.33 + awayAttack * 0.72 + eloAwayEffect) * urgencyCornerBoost;

  // Integración bayesiana ligera de promedios específicos si están disponibles
  if (homeAvgCornersFor && homeAvgCornersFor > 2) {
    regHome = regHome * 0.75 + homeAvgCornersFor * 0.25;
  }
  if (awayAvgCornersFor && awayAvgCornersFor > 2) {
    regAway = regAway * 0.75 + awayAvgCornersFor * 0.25;
  }
  if (awayAvgCornersAgainst && awayAvgCornersAgainst > 2) {
    regHome = regHome * 0.85 + awayAvgCornersAgainst * 0.15;
  }
  if (homeAvgCornersAgainst && homeAvgCornersAgainst > 2) {
    regAway = regAway * 0.85 + homeAvgCornersAgainst * 0.15;
  }

  // Bounds realistas pre-partido
  const lambdaHomeCorners = Math.min(8.5, Math.max(2.8, Math.round(regHome * 10) / 10));
  const lambdaAwayCorners = Math.min(7.5, Math.max(2.2, Math.round(regAway * 10) / 10));
  const expectedTotalCorners = Math.round((lambdaHomeCorners + lambdaAwayCorners) * 10) / 10;

  return {
    lambdaHomeCorners,
    lambdaAwayCorners,
    expectedTotalCorners,
    urgencyCornerBoost
  };
}

// ============================================================================
// 2. REGRESIÓN MÚLTIPLE DE TARJETAS Y DISCIPLINA (FÚTBOL)
// ============================================================================

export interface SoccerMultipleRegressionCardsInput {
  refereeAvgYellowCards?: number;
  refereeRigor: 'Flexible' | 'Equilibrado' | 'Moderado' | 'Severo' | string;
  derbyOrRivalry?: boolean;
  isTopClash?: boolean;
  isRelegationBattle?: boolean;
  homeAttackStrength?: number;
  awayAttackStrength?: number;
  eloDiffAbs?: number;
  urgencyIndex?: number;
}

export interface SoccerCardsRegressionResult {
  expectedHomeYellows: number;
  expectedAwayYellows: number;
  expectedYellowCards: number;
  tensionFactor: number; // Crítico: exportado para cálculo de rojas y explicaciones
}

/**
 * Modela la propensión a tarjetas amarillas mediante regresión multivariable
 * combinando el perfil del colegiado, rivalidad, choque de estilos y asimetría de faltas.
 */
export function predictCardsByMultipleRegression(
  input: SoccerMultipleRegressionCardsInput
): SoccerCardsRegressionResult {
  const {
    refereeAvgYellowCards,
    refereeRigor,
    derbyOrRivalry = false,
    isTopClash = false,
    isRelegationBattle = false,
    homeAttackStrength = 1.35,
    awayAttackStrength = 1.15,
    urgencyIndex = 5
  } = input;

  // 1. Factor de tensión contextual multivariable
  let tensionFactor = 1.0;
  if (derbyOrRivalry) tensionFactor += 0.16;
  if (isTopClash) tensionFactor += 0.09;
  if (isRelegationBattle) tensionFactor += 0.10;
  if (urgencyIndex >= 8) tensionFactor += 0.05;

  tensionFactor = Math.round(tensionFactor * 100) / 100;

  // 2. Base del colegiado
  const baseCards =
    refereeAvgYellowCards ||
    (refereeRigor === 'Severo'
      ? 4.8
      : refereeRigor === 'Flexible'
      ? 3.4
      : refereeRigor === 'Moderado'
      ? 3.9
      : 4.1);

  const rawExpectedYellow = baseCards * tensionFactor;
  const expectedYellowCards = Math.round(Math.min(6.5, Math.max(2.6, rawExpectedYellow)) * 10) / 10;

  // 3. Distribución asimétrica de tarjetas:
  // El equipo con menor poder ofensivo o que juega de visita suele cometer mayor volumen de faltas tácticas
  const homeShare = homeAttackStrength >= awayAttackStrength ? 0.46 : 0.50;
  const expectedHomeYellows = Math.round(expectedYellowCards * homeShare * 10) / 10;
  const expectedAwayYellows = Math.round((expectedYellowCards - expectedHomeYellows) * 10) / 10;

  return {
    expectedHomeYellows,
    expectedAwayYellows,
    expectedYellowCards,
    tensionFactor
  };
}

// ============================================================================
// 3. CALIBRACIÓN LOGÍSTICA DE MERCADOS DE GOLES (FÚTBOL)
// ============================================================================

export interface RawGoalsProbabilities {
  bttsYes: number;
  over15: number;
  over25: number;
  over35: number;
}

export interface GoalsCalibrationContext {
  lambdaHome: number;
  lambdaAway: number;
  totalXG: number;
  urgencyScore?: number;
  homeAttack?: number;
  awayAttack?: number;
  homeDefense?: number;
  awayDefense?: number;
}

/**
 * Calibra mercados de goles combinando 75% Dixon-Coles/Poisson + 25% Regresión Logística Sigmoide
 */
export function calibrateGoalsMarketsWithLogisticRegression(
  raw: RawGoalsProbabilities,
  ctx: GoalsCalibrationContext
): RawGoalsProbabilities {
  const { totalXG, lambdaHome, lambdaAway } = ctx;

  // A) BTTS Logístico: z = beta_0 + beta_1*min(xG) + beta_2*(totalXG - 2.5)
  const minXG = Math.min(lambdaHome, lambdaAway);
  const zBtts = -0.58 + minXG * 1.35 + (totalXG - 2.5) * 0.42;
  const logisticBttsYes = logisticSigmoid(zBtts) * 100;

  // B) Over 1.5 Logístico: z = beta_0 + beta_1*(totalXG - 1.5)
  const zOver15 = 0.72 + (totalXG - 1.5) * 1.45;
  const logisticOver15 = logisticSigmoid(zOver15) * 100;

  // C) Over 2.5 Logístico: z = beta_0 + beta_1*(totalXG - 2.5)
  const zOver25 = -0.12 + (totalXG - 2.5) * 1.32;
  const logisticOver25 = logisticSigmoid(zOver25) * 100;

  // D) Over 3.5 Logístico: z = beta_0 + beta_1*(totalXG - 3.5)
  const zOver35 = -1.15 + (totalXG - 3.5) * 1.22;
  const logisticOver35 = logisticSigmoid(zOver35) * 100;

  // Ponderación de Ensamble: 75% Matriz Estocástica + 25% Regresión Logística
  const bttsYes = Math.round((raw.bttsYes * 0.75 + logisticBttsYes * 0.25) * 10) / 10;
  const over15 = Math.round((raw.over15 * 0.75 + logisticOver15 * 0.25) * 10) / 10;
  const over25 = Math.round((raw.over25 * 0.75 + logisticOver25 * 0.25) * 10) / 10;
  const over35 = Math.round((raw.over35 * 0.75 + logisticOver35 * 0.25) * 10) / 10;

  return {
    bttsYes: Math.max(15, Math.min(88, bttsYes)),
    over15: Math.max(20, Math.min(94, over15)),
    over25: Math.max(15, Math.min(88, over25)),
    over35: Math.max(8, Math.min(75, over35))
  };
}

// ============================================================================
// 4. REGRESIÓN MÚLTIPLE Y LOGÍSTICA PARA BALONCESTO (NBA / FIBA)
// ============================================================================

export interface NBAMultipleRegressionInput {
  homePace: number;
  awayPace: number;
  homeOffensiveRating: number;
  awayOffensiveRating: number;
  homeDefensiveRating: number;
  awayDefensiveRating: number;
  homeThreePointPct?: number;
  awayThreePointPct?: number;
  homeRestDays?: number;
  awayRestDays?: number;
  isFibaLeague?: boolean;
  homeWinPct?: number;
  awayWinPct?: number;
}

export interface NBAMultipleRegressionResult {
  regressedHomeScore: number;
  regressedAwayScore: number;
  regressedTotalPoints: number;
  eloBradleyTerryHomeWinProb: number;
  logisticOverTotalProb: number;
}

/**
 * Evalúa regresión multivariable para puntuaciones de baloncesto y probabilidad
 * sigmoide de Over sobre la línea justa de puntos totales.
 */
export function evaluateNBAMultipleAndLogisticRegression(
  input: NBAMultipleRegressionInput,
  baseHomeScore: number,
  baseAwayScore: number,
  fairTotalLine: number
): NBAMultipleRegressionResult {
  const {
    homePace,
    awayPace,
    homeOffensiveRating,
    awayOffensiveRating,
    homeDefensiveRating,
    awayDefensiveRating,
    homeThreePointPct = 0.36,
    awayThreePointPct = 0.35,
    homeRestDays = 1,
    awayRestDays = 1,
    isFibaLeague = false,
    homeWinPct = 0.52,
    awayWinPct = 0.48
  } = input;

  const leaguePace = isFibaLeague ? 82.0 : 99.0;

  // Ajuste multivariable de ritmo y tiro exterior (3P%)
  const paceZ = ((homePace + awayPace) / 2 - leaguePace) / 4.5;
  const threePointFactorHome = (homeThreePointPct - 0.355) * 14;
  const threePointFactorAway = (awayThreePointPct - 0.355) * 14;

  const restDiff = Math.min(2, Math.max(-2, homeRestDays - awayRestDays));
  const restBonusHome = restDiff * 0.8;

  const regressedHomeScore = Number(
    (baseHomeScore * 0.85 + (baseHomeScore + paceZ * 1.2 + threePointFactorHome + restBonusHome) * 0.15).toFixed(1)
  );
  const regressedAwayScore = Number(
    (baseAwayScore * 0.85 + (baseAwayScore + paceZ * 1.2 + threePointFactorAway - restBonusHome * 0.5) * 0.15).toFixed(1)
  );

  const regressedTotalPoints = Number((regressedHomeScore + regressedAwayScore).toFixed(1));

  // Modelo logístico para Over Total vs fairTotalLine
  // z = (regressedTotalPoints - fairTotalLine) / sigma
  const sigma = isFibaLeague ? 10.5 : 12.8;
  const zTotal = (regressedTotalPoints - fairTotalLine) / sigma;
  const logisticOverTotalProb = Number((logisticSigmoid(zTotal) * 100).toFixed(1));

  // Modelo Bradley-Terry / Elo para porcentaje de victoria en baloncesto
  const winPctDiff = (homeWinPct - awayWinPct) * 100;
  const netScoreDiff = regressedHomeScore - regressedAwayScore;
  const zWin = (netScoreDiff * 0.75 + winPctDiff * 0.08) / 9.8;
  const eloBradleyTerryHomeWinProb = Number((logisticSigmoid(zWin) * 100).toFixed(1));

  return {
    regressedHomeScore,
    regressedAwayScore,
    regressedTotalPoints,
    eloBradleyTerryHomeWinProb,
    logisticOverTotalProb
  };
}
