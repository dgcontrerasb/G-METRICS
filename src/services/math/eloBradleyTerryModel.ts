/**
 * Capa 2: Modelo Elo Dinámico & Bradley-Terry con Extensión de Davidson para Empates
 * Modela la fuerza relativa de los competidores, consistencia de forma y probabilidad
 * intrínseca de victoria/empate/derrota con ajuste bilateral de fatiga y localía.
 */

import { TeamInfo } from '../../types';

export interface WeightedFormResult {
  weightedPoints: number;
  maxPossibleWeightedPoints: number;
  weightedRatio: number; // 0..1
}

export interface EloBradleyTerryResult {
  homeEloRating: number;
  awayEloRating: number;
  bradleyTerryHomePower: number;
  bradleyTerryAwayPower: number;
  davidsonNu: number;
  eloHomeWinProb: number; // Porcentaje 0..100
  eloDrawProb: number; // Porcentaje 0..100
  eloAwayWinProb: number; // Porcentaje 0..100
  formConsistencyScore: number; // 0..100
}

/**
 * Pondera los últimos 5 partidos con pesos decrecientes [1.35, 1.18, 1.0, 0.85, 0.72]
 * donde el primer elemento representa el resultado más reciente.
 */
export function calculateWeightedFormPoints(form?: ('W' | 'D' | 'L')[]): WeightedFormResult {
  const weights = [1.35, 1.18, 1.0, 0.85, 0.72];
  if (!form || form.length === 0) {
    return { weightedPoints: 4.5, maxPossibleWeightedPoints: 15.3, weightedRatio: 0.35 };
  }

  let weightedPoints = 0;
  let maxPossible = 0;

  for (let i = 0; i < Math.min(form.length, weights.length); i++) {
    const outcome = form[i];
    const w = weights[i];
    maxPossible += 3 * w;
    if (outcome === 'W') {
      weightedPoints += 3 * w;
    } else if (outcome === 'D') {
      weightedPoints += 1 * w;
    }
  }

  if (maxPossible <= 0) maxPossible = 15.3;
  const weightedRatio = Math.max(0.05, Math.min(0.95, weightedPoints / maxPossible));

  return {
    weightedPoints: Number(weightedPoints.toFixed(2)),
    maxPossibleWeightedPoints: Number(maxPossible.toFixed(2)),
    weightedRatio: Number(weightedRatio.toFixed(3))
  };
}

/**
 * Evalúa los Ratings Elo dinámicos y probabilidades Bradley-Terry (Davidson)
 */
export function evaluateEloAndBradleyTerry(
  homeTeam: TeamInfo,
  awayTeam: TeamInfo,
  homeRestPenalty: number = 0,
  awayTotalPenalty: number = 0
): EloBradleyTerryResult {
  const BASE_ELO = 1500;
  const HOME_ADVANTAGE_ELO = 65; // Ventaja de localía estándar

  // 1. Análisis de Forma Ponderada
  const homeForm = calculateWeightedFormPoints(homeTeam.form);
  const awayForm = calculateWeightedFormPoints(awayTeam.form);

  // 2. Cálculo de Elo Dinámico Base para cada equipo
  // Ajustado por posición en tabla, métricas xG de ataque/defensa y ratio de forma
  const homeRankFactor = (20 - Math.min(20, Math.max(1, homeTeam.rank || 10))) * 9.5;
  const awayRankFactor = (20 - Math.min(20, Math.max(1, awayTeam.rank || 10))) * 9.5;

  const homeAttack = Number(homeTeam.attackStrength) || 1.35;
  const awayAttack = Number(awayTeam.attackStrength) || 1.15;
  const homeDefense = Number(homeTeam.defenseStrength) || 0.90;
  const awayDefense = Number(awayTeam.defenseStrength) || 1.05;

  const homePwrFactor = (homeAttack - 1.0) * 130 + (1.0 - homeDefense) * 110;
  const awayPwrFactor = (awayAttack - 1.0) * 130 + (1.0 - awayDefense) * 110;

  const homeFormFactor = (homeForm.weightedRatio - 0.40) * 180;
  const awayFormFactor = (awayForm.weightedRatio - 0.40) * 180;

  const homeFatiguePenaltyElo = homeRestPenalty * 220;
  const awayFatiguePenaltyElo = awayTotalPenalty * 240;

  const homeEloRating = Math.round(
    BASE_ELO + homeRankFactor + homePwrFactor + homeFormFactor - homeFatiguePenaltyElo
  );
  const awayEloRating = Math.round(
    BASE_ELO + awayRankFactor + awayPwrFactor + awayFormFactor - awayFatiguePenaltyElo
  );

  // 3. Modelo Bradley-Terry con Potencias Exponenciales
  // pi = 10^(Elo / 400)
  const effectiveHomeElo = homeEloRating + HOME_ADVANTAGE_ELO;
  const effectiveAwayElo = awayEloRating;

  const bradleyTerryHomePower = Math.pow(10, effectiveHomeElo / 400);
  const bradleyTerryAwayPower = Math.pow(10, effectiveAwayElo / 400);

  // 4. Extensión de Davidson para empates
  // nu modula la propensión al empate según la cercanía de fuerzas y solidez defensiva conjunta
  const defenseFactor = Math.max(0.8, Math.min(1.4, (2.2 - (homeDefense + awayDefense) / 2)));
  const davidsonNu = Number((0.52 * defenseFactor).toFixed(3));

  const denominator =
    bradleyTerryHomePower +
    bradleyTerryAwayPower +
    davidsonNu * Math.sqrt(bradleyTerryHomePower * bradleyTerryAwayPower);

  let pHomeWin = (bradleyTerryHomePower / denominator) * 100;
  let pDraw = ((davidsonNu * Math.sqrt(bradleyTerryHomePower * bradleyTerryAwayPower)) / denominator) * 100;
  let pAwayWin = (bradleyTerryAwayPower / denominator) * 100;

  pHomeWin = Math.round(pHomeWin * 10) / 10;
  pDraw = Math.round(pDraw * 10) / 10;
  pAwayWin = Math.round(pAwayWin * 10) / 10;

  // Ajuste de suma exacta 100%
  const sumDiff = 100 - (pHomeWin + pDraw + pAwayWin);
  pDraw = Math.max(1, Math.round((pDraw + sumDiff) * 10) / 10);

  // 5. Score de Consistencia de Forma (0..100)
  // Mide qué tan estables y predecibles son los equipos en base a forma, descanso y balance Elo
  const eloDiffAbs = Math.abs(homeEloRating - awayEloRating);
  const formAgreement = 100 - Math.abs(homeForm.weightedRatio - awayForm.weightedRatio) * 45;
  const fatigueImpact = (homeRestPenalty + awayTotalPenalty) * 180;
  const formConsistencyScore = Math.max(
    25,
    Math.min(96, Math.round(formAgreement * 0.55 + Math.min(45, eloDiffAbs * 0.15) - fatigueImpact))
  );

  return {
    homeEloRating,
    awayEloRating,
    bradleyTerryHomePower: Number(bradleyTerryHomePower.toFixed(2)),
    bradleyTerryAwayPower: Number(bradleyTerryAwayPower.toFixed(2)),
    davidsonNu,
    eloHomeWinProb: pHomeWin,
    eloDrawProb: pDraw,
    eloAwayWinProb: pAwayWin,
    formConsistencyScore
  };
}
