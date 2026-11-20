/**
 * Capa 5: Árboles de Decisión Multicriterio para Selección de Picks
 * Aplica árboles de decisión jerárquicos ponderando el LCB Bayesiano, la volatilidad táctica,
 * la asimetría de urgencia y la penalización de mercados propensos al empate.
 */

import { BestMarketPick } from '../../types';
import { evaluateBayesianCredibility } from './bayesianUncertaintyModel';

export interface DecisionTreeContext {
  closeMatchPercent: number;
  derbyOrRivalry?: boolean;
  eloDiffAbs?: number;
  urgencyScore?: number;
  formConsistencyScore?: number;
  homeFatiguePenalty?: number;
  awayFatiguePenalty?: number;
  refereeRigor?: string;
}

export interface CornerLineDecisionInput {
  cornersOver75: number;
  cornersOver85: number;
  cornersOver95: number;
  cornersUnder95: number;
  cornersUnder105: number;
  expectedTotalCorners: number;
  urgencyScore?: number;
}

export interface CornerLineDecisionResult {
  recommendedCornerLine: string;
  recommendedCornerProb: number;
  recommendedCornerOdd: number;
}

export interface CardLineDecisionInput {
  over35CardsProb: number;
  over45CardsProb: number;
  under45CardsProb: number;
  under55CardsProb: number;
  expectedYellowCards: number;
  refereeName?: string;
  refereeRigor: string;
  derbyOrRivalry?: boolean;
}

export interface CardLineDecisionResult {
  recommendedCardPick: string;
  recommendedCardProb: number;
  recommendedCardOdd: number;
}

/**
 * Ordena y jerarquiza los mercados candidatos mediante Árbol de Decisión Multicriterio
 */
export function rankCandidatePicksByDecisionTree(
  candidates: BestMarketPick[],
  context: DecisionTreeContext
): BestMarketPick[] {
  if (!candidates || candidates.length === 0) return [];

  const {
    closeMatchPercent = 50,
    derbyOrRivalry = false,
    eloDiffAbs = 80,
    urgencyScore = 5,
    formConsistencyScore = 65,
    homeFatiguePenalty = 0,
    awayFatiguePenalty = 0
  } = context;

  const totalFatigue = homeFatiguePenalty + awayFatiguePenalty;

  // Evaluamos cada pick en las ramas del árbol de decisión
  const scored = candidates.map((pick) => {
    const bayes = evaluateBayesianCredibility({
      category: pick.category,
      observedProbability: pick.probability,
      formConsistencyScore,
      fatiguePenalty: totalFatigue,
      derbyOrRivalry
    });

    // NODO 1: Score base combinando LCB Bayesiano (60%) y probabilidad puntual del modelo (40%)
    let treeScore = bayes.lowerCredibleBound * 0.60 + pick.probability * 0.40;

    // NODO 2: Filtro anti-trampa para 1X2 directo
    if (pick.category === '1X2') {
      if (closeMatchPercent >= 68) treeScore -= 8.5; // Penaliza si el partido es muy cerrado
      if (eloDiffAbs < 75) treeScore -= 6.0; // Penaliza si los equipos tienen fuerzas similares
      if (derbyOrRivalry) treeScore -= 7.5; // Penaliza fuertemente en clásicos por imprevisibilidad

      // NODO 2b: Filtro de calibración para Victoria Visitante (históricamente ~30% de acierto salvo brecha abrumadora)
      const isAwayPick = /visita|visitante/i.test(pick.label) || (!/local/i.test(pick.label) && eloDiffAbs < 110);
      if (isAwayPick && eloDiffAbs < 120) {
        treeScore -= 12.0; // Previene que la victoria visitante desplace a selecciones de mayor convicción (1X o +1.5 goles)
      }
    }

    // NODO 2c: Calibración empírica para Ambos Equipos Anotan (BTTS)
    if (pick.category === 'BTTS') {
      // En ligas profesionales el BTTS natural es ~52%; no debe ser pick de alta convicción a menos que supere 74% de probabilidad pura
      if (pick.probability < 74) {
        treeScore -= 7.5;
      }
    }

    // NODO 3: Bonificación de mercados tácticos inmunes al ganador en partidos tensos
    if (pick.category === 'DOUBLE_CHANCE') {
      if (closeMatchPercent >= 65) treeScore += 4.5;
    } else if (pick.category === 'CORNERS') {
      if (urgencyScore >= 7) treeScore += 3.8;
      if (derbyOrRivalry) treeScore += 3.2;
    } else if (pick.category === 'CARDS') {
      if (derbyOrRivalry) treeScore += 5.0;
      if (urgencyScore >= 8) treeScore += 3.5;
    } else if (pick.category === 'SAFE_GOALS') {
      if (pick.label.includes('Más de 1.5') && urgencyScore >= 6.5) treeScore += 2.5;
      if (pick.label.includes('Menos de 3.5') && closeMatchPercent >= 70) treeScore += 3.0;
    } else if (pick.category === 'HALF_GOALS') {
      if (totalFatigue > 0.05) treeScore += 2.8; // Mayor resolución en 2T por desgaste
    }

    return {
      pick,
      treeScore,
      lcb: bayes.lowerCredibleBound
    };
  });

  // Ordenar descendentemente por treeScore
  scored.sort((a, b) => b.treeScore - a.treeScore);

  return scored.map((s) => s.pick);
}

/**
 * Selecciona la línea óptima de córners mediante Árbol de Decisión
 */
export function selectOptimalCornerLineByDecisionTree(
  input: CornerLineDecisionInput
): CornerLineDecisionResult {
  const {
    cornersOver75,
    cornersOver85,
    cornersOver95,
    cornersUnder105,
    expectedTotalCorners
  } = input;

  let recommendedCornerLine = `Más de 8.5 Tiros de Esquina`;
  let recommendedCornerProb = cornersOver85;

  // Árbol de Decisión para Línea de Córners
  if (expectedTotalCorners >= 10.4 && cornersOver85 >= 68) {
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

  const recommendedCornerOdd = Math.max(
    1.22,
    Math.round((100 / Math.max(1, recommendedCornerProb)) * 100) / 100
  );

  return {
    recommendedCornerLine,
    recommendedCornerProb,
    recommendedCornerOdd
  };
}

/**
 * Selecciona la línea óptima de tarjetas mediante Árbol de Decisión
 */
export function selectOptimalCardLineByDecisionTree(
  input: CardLineDecisionInput
): CardLineDecisionResult {
  const {
    over35CardsProb,
    over45CardsProb,
    under45CardsProb,
    under55CardsProb,
    expectedYellowCards
  } = input;

  let recommendedCardPick = `Más de 3.5 Tarjetas`;
  let recommendedCardProb = over35CardsProb;

  // Árbol de Decisión para Tarjetas
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

  const recommendedCardOdd = Math.max(
    1.22,
    Math.round((100 / Math.max(1, recommendedCardProb)) * 100) / 100
  );

  return {
    recommendedCardPick,
    recommendedCardProb,
    recommendedCardOdd
  };
}
