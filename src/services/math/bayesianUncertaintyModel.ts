/**
 * Capa 4: Modelo de Incertidumbre Bayesiana y Contracción Empírica (Bühlmann-Straub)
 * Calcula la contracción hacia priors históricos por mercado y determina el Límite Inferior
 * de Credibilidad (Lower Credible Bound - LCB) mediante aproximación Beta-Binomial.
 */

export interface BayesianCredibilityInput {
  category: string;
  observedProbability: number; // Porcentaje 0..100
  formConsistencyScore?: number; // 0..100
  sampleMatchesCount?: number;
  fatiguePenalty?: number; // 0..0.15
  derbyOrRivalry?: boolean;
}

export interface BayesianCredibilityResult {
  priorProbability: number; // Porcentaje 0..100
  credibilityWeight: number; // w en [0, 1]
  posteriorProbability: number; // Porcentaje 0..100
  standardError: number;
  lowerCredibleBound: number; // LCB en % (probabilidad conservadora blindada)
}

// Priors empíricos históricos por mercado (tasa de acierto natural en ligas profesionales)
const CATEGORY_PRIORS: Record<string, number> = {
  DOUBLE_CHANCE: 69.5,
  SAFE_GOALS: 71.5,
  CORNERS: 67.5,
  CARDS: 66.5,
  HALF_GOALS: 70.0,
  SHOTS: 65.5,
  BTTS: 51.5,
  '1X2': 46.0,
  NBA_TOTAL_POINTS: 62.0,
  NBA_MONEYLINE: 58.0,
  NBA_MONEYLINE_2WAY: 50.0,
  NBA_PLAYER_PROP: 64.0,
  DEFAULT: 60.0
};

/**
 * Evalúa la credibilidad Bayesiana empírica y computa el LCB (Lower Credible Bound)
 */
export function evaluateBayesianCredibility(
  input: BayesianCredibilityInput
): BayesianCredibilityResult {
  const {
    category,
    observedProbability,
    formConsistencyScore = 65,
    sampleMatchesCount = 12,
    fatiguePenalty = 0,
    derbyOrRivalry = false
  } = input;

  const priorProbability = CATEGORY_PRIORS[category] ?? CATEGORY_PRIORS.DEFAULT;

  // 1. Tamaño efectivo de muestra n_eff modelado por consistencia táctica y penalizaciones
  let nEff = sampleMatchesCount * (formConsistencyScore / 70);
  if (derbyOrRivalry) nEff *= 0.85; // Menor peso a la muestra en clásicos por alta volatilidad
  if (fatiguePenalty > 0.05) nEff *= (1 - fatiguePenalty * 1.5);
  nEff = Math.max(3.5, Math.min(25, nEff));

  // 2. Parámetro estructural de Bühlmann-Straub (m)
  // m representa la relación entre la varianza esperada del proceso y la varianza de la media hipotética
  const m = 4.8;
  const credibilityWeight = Math.max(0.35, Math.min(0.92, nEff / (nEff + m)));

  // 3. Probabilidad Posterior P(theta | data) = w * P_obs + (1 - w) * P_prior
  const posteriorProbability = Number(
    (credibilityWeight * observedProbability + (1 - credibilityWeight) * priorProbability).toFixed(1)
  );

  // 4. Error Estándar Beta-Binomial: SE = sqrt( (p * (1 - p)) / (n_eff + 2) )
  const pNorm = posteriorProbability / 100;
  const standardError = Math.sqrt((pNorm * (1 - pNorm)) / (nEff + 2));

  // 5. Límite Inferior de Credibilidad (LCB = Posterior - 1.05 * SE)
  // Penaliza selecciones infladas con poco soporte empírico
  const marginPct = Number((1.05 * standardError * 100).toFixed(1));
  const lowerCredibleBound = Number(Math.max(20, posteriorProbability - marginPct).toFixed(1));

  return {
    priorProbability,
    credibilityWeight: Number(credibilityWeight.toFixed(3)),
    posteriorProbability,
    standardError: Number(standardError.toFixed(4)),
    lowerCredibleBound
  };
}

/**
 * Contrae suavemente los goles esperados (lambda) o puntos hacia la media de la liga
 * evitando extrapolaciones atípicas en jornadas con equipos con bajas o registros extremos.
 */
export function shrinkLambdaBayesian(
  teamLambda: number,
  leaguePriorLambda: number,
  formConsistencyScore: number = 70
): number {
  if (teamLambda <= 0 || isNaN(teamLambda)) return leaguePriorLambda;

  // Factor de contracción: a mayor consistencia de forma, más confianza en el lambda del equipo
  const weight = Math.max(0.60, Math.min(0.92, 0.60 + (formConsistencyScore / 100) * 0.30));
  const shrunken = teamLambda * weight + leaguePriorLambda * (1 - weight);
  return Number(shrunken.toFixed(2));
}
