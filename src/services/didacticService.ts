import { MatchFixture, MatchAnalysis, NBAMatchFixture, NBAAnalysis, BestMarketPick } from '../types';
import { isGenericPlaceholderPlayerName, generateHumanPlayerName } from './lineupService';

export interface DidacticAdvice {
  signal: 'GREEN' | 'YELLOW' | 'RED';
  badgeLabel: string;
  badgeColorClass: string;
  badgeBgClass: string;
  badgeBorderClass: string;
  headline: string;
  plainExplanation: string;
  payoutExample: string;
  actionAdvice: string;
  topPick?: BestMarketPick;
}

export interface GlossaryItem {
  id: string;
  shortLabel: string;
  title: string;
  meaning: string;
  example: string;
}

export const BEGINNER_GLOSSARY_ITEMS: GlossaryItem[] = [
  {
    id: 'dc',
    shortLabel: '🛡️ Doble Oportunidad (1X / X2)',
    title: '¿Qué es Doble Oportunidad (1X o X2)?',
    meaning: 'Es una apuesta segura donde ganas con 2 de los 3 resultados posibles: si tu equipo gana O si el partido termina en empate.',
    example: 'Ejemplo: Si eliges "1X", ganas si el equipo local gana (1-0, 2-1) y también ganas si empatan (0-0, 1-1).'
  },
  {
    id: 'corners',
    shortLabel: '🚩 Más de 8.5 Córners',
    title: '¿Qué significa Más de 7.5 u 8.5 Tiros de Esquina?',
    meaning: 'Se suman los tiros de esquina (córners) que cobren los dos equipos en todo el partido. No importa quién gane el juego.',
    example: 'Ejemplo: "Más de 8.5 Córners" significa que entre los dos equipos deben cobrar 9 o más tiros de esquina en total.'
  },
  {
    id: 'cards',
    shortLabel: '🟨 Más de 3.5 Tarjetas',
    title: '¿Qué significa Más/Menos de 3.5 o 4.5 Tarjetas?',
    meaning: 'Cuenta el total de tarjetas amarillas que el árbitro les saca a los dos equipos sumados durante el partido.',
    example: 'Ejemplo: "Más de 3.5 Tarjetas" gana si hay 4, 5 o más tarjetas en total entre ambos equipos.'
  },
  {
    id: 'over15',
    shortLabel: '⚽ Más de 1.5 Goles',
    title: '¿Qué significa Más de 1.5 Goles o Menos de 3.5 Goles?',
    meaning: '"Más de 1.5 Goles" significa que habrá 2 o más goles en el partido. "Menos de 3.5 Goles" significa que habrá máximo 3 goles.',
    example: 'Ejemplo: En "Más de 1.5 Goles" ganas con 1-1, 2-0, 0-2, 2-1, etc., sin importar quién sea el ganador.'
  },
  {
    id: 'btts',
    shortLabel: '🥅 Ambos Marcan (Sí/No)',
    title: '¿Qué es Ambos Equipos Anotan (BTTS)?',
    meaning: '"Sí" significa que cada equipo meterá al menos 1 gol. "No" significa que al menos uno de los dos se quedará en 0 goles.',
    example: 'Ejemplo: Si queda 1-1 o 2-1, gana "Ambos Marcan: Sí". Si queda 1-0, 2-0 o 0-0, gana "No".'
  }
];

/**
 * Formats a decimal betting odd (e.g., 1.85) into a crystal-clear financial payout example.
 * Example: "@1.85 -> Si apuestas $10 ganas $18.50 ($8.50 de ganancia neta)"
 */
export function formatOddsPayout(odd: number, stake: number = 10): string {
  if (!odd || isNaN(odd) || odd <= 1) return 'Cuota no disponible';
  const totalReturn = (stake * odd).toFixed(2);
  const netProfit = (stake * (odd - 1)).toFixed(2);
  return `Si juegas $${stake}, recibes $${totalReturn} (+$${netProfit} ganancia)`;
}

/**
 * Returns a standardized, ultracompact betting label (max 12-16 characters)
 * for mobile rows to prevent ellipsis truncation like "Ambos Eq...".
 */
export function formatCompactPickLabel(label?: string): string {
  if (!label) return '+1.5 Goles';
  const clean = label.replace(/^[⚽🚩🟨🥅🎯🛡️⏱️]\s*/, '').trim();

  // BTTS (Ambos Equipos Anotan)
  if (clean.toLowerCase().includes('ambos equipos anotan') || clean.toLowerCase().includes('ambos marcan')) {
    if (clean.toLowerCase().includes('no')) return 'Ambos Marcan: No';
    return 'Ambos Marcan';
  }

  // Doble Oportunidad & 1X2
  if (clean.includes('(1X)') || (clean.toLowerCase().includes('gana o empata') && clean.includes('1X'))) {
    const team = clean.replace(/Gana o Empata\s*/i, '').replace(/\(1X\)/i, '').trim();
    return `1X ${team}`.trim().slice(0, 15);
  }
  if (clean.includes('(X2)') || (clean.toLowerCase().includes('gana o empata') && clean.includes('X2'))) {
    const team = clean.replace(/Gana o Empata\s*/i, '').replace(/\(X2\)/i, '').trim();
    return `X2 ${team}`.trim().slice(0, 15);
  }
  if (clean.startsWith('Victoria de')) {
    const team = clean.replace('Victoria de', '').trim();
    return `Gana ${team}`.trim().slice(0, 15);
  }

  // Goles Over/Under
  if (clean.toLowerCase().includes('más de 1.5') || clean.toLowerCase().includes('over 1.5')) {
    return '+1.5 Goles';
  }
  if (clean.toLowerCase().includes('más de 2.5') || clean.toLowerCase().includes('over 2.5')) {
    return '+2.5 Goles';
  }
  if (clean.toLowerCase().includes('menos de 3.5') || clean.toLowerCase().includes('under 3.5')) {
    return '-3.5 Goles';
  }
  if (clean.toLowerCase().includes('menos de 2.5') || clean.toLowerCase().includes('under 2.5')) {
    return '-2.5 Goles';
  }

  // Goles por mitad
  if (clean.toLowerCase().includes('2.ª mitad') || clean.toLowerCase().includes('segundo tiempo') || clean.toLowerCase().includes('2t')) {
    return '+0.5 Gol 2T';
  }
  if (clean.toLowerCase().includes('1er tiempo') || clean.toLowerCase().includes('1t') || clean.toLowerCase().includes('1.ª mitad')) {
    return '+0.5 Gol 1T';
  }

  // Córners
  if (clean.toLowerCase().includes('córners') || clean.toLowerCase().includes('tiros de esquina')) {
    const num = clean.match(/(\d+\.?\d*)/);
    return num ? `+${num[1]} Córners` : '+8.5 Córners';
  }

  // Tarjetas
  if (clean.toLowerCase().includes('tarjetas')) {
    const num = clean.match(/(\d+\.?\d*)/);
    return num ? `+${num[1]} Tarjetas` : '+3.5 Tarjetas';
  }

  // Disparos
  if (clean.toLowerCase().includes('remates') || clean.toLowerCase().includes('disparos')) {
    const rawPlayer = clean.split('(')[0].trim();
    const safePlayer = isGenericPlaceholderPlayerName(rawPlayer)
      ? generateHumanPlayerName(rawPlayer || 'Club', 9, false)
      : rawPlayer;
    const lastName = safePlayer.split(' ').pop() || safePlayer;
    return `${lastName} +0.5 Puerta`.slice(0, 16);
  }

  return clean.length > 15 ? clean.slice(0, 15).trim() : clean;
}

/**
 * Evaluates a soccer match and returns a beginner-friendly verdict prioritizing
 * the highest-probability multi-market pick (Corners, Cards, Safe Goals, Double Chance, etc.)
 * rather than defaulting to the 1X2 match winner.
 */
export function getSoccerDidacticAdvice(fixture: MatchFixture, analysis: MatchAnalysis): DidacticAdvice {
  const { dixonColes, verdict } = analysis;
  const topPick = verdict.topSafePick;
  const maxWinnerProb = Math.max(dixonColes.pHomeWin, dixonColes.pAwayWin);

  // 1. CASO VERDE (🟢 JUGADA DE ALTA PROBABILIDAD REAL >= 68%):
  if (topPick && topPick.probability >= 68) {
    return {
      signal: 'GREEN',
      badgeLabel: `🟢 Jugada #1 Más Factible · ${topPick.categoryLabel} (${topPick.probability}%)`,
      badgeColorClass: 'text-emerald-300',
      badgeBgClass: 'bg-emerald-950/45',
      badgeBorderClass: 'border-emerald-500/45 ring-1 ring-emerald-500/20',
      headline: `Recomendación Principal: ${topPick.plainTitle}`,
      plainExplanation: topPick.whySaferThanWinner,
      payoutExample: formatOddsPayout(topPick.fairOdd, 10),
      actionAdvice: `Paso rápido: ${topPick.stepByStepGuide.step1} → ${topPick.stepByStepGuide.step2}`,
      topPick
    };
  }

  // 2. CASO AMARILLO (🟡 PROBABILIDAD MODERADA 60% - 67.9%):
  if (topPick && topPick.probability >= 60) {
    return {
      signal: 'YELLOW',
      badgeLabel: `🟡 Opción Táctica · ${topPick.categoryLabel} (${topPick.probability}%)`,
      badgeColorClass: 'text-amber-300',
      badgeBgClass: 'bg-amber-950/35',
      badgeBorderClass: 'border-amber-500/40 ring-1 ring-amber-500/20',
      headline: `Opción más sólida del partido: ${topPick.plainTitle}`,
      plainExplanation: `${topPick.whySaferThanWinner} (El ganador directo solo tiene ${maxWinnerProb}% de probabilidad).`,
      payoutExample: formatOddsPayout(topPick.fairOdd, 10),
      actionAdvice: `Jugar con prudencia en: ${topPick.label}.`,
      topPick
    };
  }

  // 3. CASO ROJO (🔴 EVITAR / RIESGO ALTO):
  return {
    signal: 'RED',
    badgeLabel: '🔴 Partido Impredecible (Mejor Evitar)',
    badgeColorClass: 'text-rose-300',
    badgeBgClass: 'bg-rose-950/30',
    badgeBorderClass: 'border-rose-500/40 ring-1 ring-rose-500/20',
    headline: 'Ningún mercado supera el umbral de seguridad deseado',
    plainExplanation: `Las estadísticas muestran alta volatilidad. Aún así, el mercado menos arriesgado es ${topPick?.label || 'Doble Oportunidad'} (${topPick?.probability || 58}%).`,
    payoutExample: formatOddsPayout(topPick?.fairOdd || 1.85, 10),
    actionAdvice: `Si estás empezando, te recomendamos saltar este partido y elegir uno con Semáforo Verde.`,
    topPick
  };
}

/**
 * Evaluates an NBA match and returns a beginner-friendly verdict with traffic-light signal.
 */
export function getNBADidacticAdvice(fixture: NBAMatchFixture, analysis: NBAAnalysis): DidacticAdvice {
  const homeName = fixture.homeTeam.shortName || fixture.homeTeam.name;
  const awayName = fixture.awayTeam.shortName || fixture.awayTeam.name;
  const { pHomeWin, pAwayWin, threePointersMarket, projectedTotalPoints, fairSpread, marketOdds } = analysis;

  const isValueBet = Boolean(marketOdds?.valueBetDetected);

  // 1. CASO VERDE (🟢 TE CONVIENE):
  if (isValueBet) {
    const sideName = marketOdds?.valueSide === 'HOME' ? homeName : awayName;
    const chosenOdd = marketOdds?.valueSide === 'HOME' ? marketOdds.bookmakerHomeOdds : marketOdds?.bookmakerAwayOdds || 1.9;
    return {
      signal: 'GREEN',
      badgeLabel: '🟢 Te Conviene (Valor en Cuota NBA)',
      badgeColorClass: 'text-emerald-300',
      badgeBgClass: 'bg-emerald-950/40',
      badgeBorderClass: 'border-emerald-500/40 ring-1 ring-emerald-500/20',
      headline: `Excelente oportunidad: Valor en ${sideName}`,
      plainExplanation: `El modelo matemático calcula que ${sideName} ganará con mayor frecuencia de la que anticipa la casa de apuestas (ventaja de +${marketOdds?.valueEdgePercent}%).`,
      payoutExample: formatOddsPayout(chosenOdd, 10),
      actionAdvice: `Apuesta favorable en victoria (Moneyline) de ${sideName}.`
    };
  }

  if (pHomeWin >= 65) {
    const fairOdd = Math.round((100 / pHomeWin) * 100) / 100;
    return {
      signal: 'GREEN',
      badgeLabel: '🟢 Te Conviene (Favorito Muy Claro)',
      badgeColorClass: 'text-emerald-300',
      badgeBgClass: 'bg-emerald-950/40',
      badgeBorderClass: 'border-emerald-500/40 ring-1 ring-emerald-500/20',
      headline: `${homeName} tiene amplia ventaja para ganar`,
      plainExplanation: `Con un ${pHomeWin}% de probabilidad, ${homeName} supera en ritmo ofensivo y defensa a su rival.`,
      payoutExample: formatOddsPayout(fairOdd, 10),
      actionAdvice: `Opción sólida: Ganador ${homeName} o Hándicap favorable (${fairSpread} pts).`
    };
  }

  if (pAwayWin >= 62) {
    const fairOdd = Math.round((100 / pAwayWin) * 100) / 100;
    return {
      signal: 'GREEN',
      badgeLabel: '🟢 Te Conviene (Visita Fuerte)',
      badgeColorClass: 'text-emerald-300',
      badgeBgClass: 'bg-emerald-950/40',
      badgeBorderClass: 'border-emerald-500/40 ring-1 ring-emerald-500/20',
      headline: `${awayName} es claramente superior`,
      plainExplanation: `A pesar de ser visitante, ${awayName} proyecta dominar el encuentro con ${pAwayWin}% de probabilidad.`,
      payoutExample: formatOddsPayout(fairOdd, 10),
      actionAdvice: `Opción recomendada: Victoria directa de ${awayName}.`
    };
  }

  if (threePointersMarket && threePointersMarket.over3PMProb >= 56) {
    return {
      signal: 'GREEN',
      badgeLabel: '🟢 Te Conviene (Lluvia de Triples)',
      badgeColorClass: 'text-amber-300',
      badgeBgClass: 'bg-amber-950/30',
      badgeBorderClass: 'border-amber-500/40 ring-1 ring-amber-500/20',
      headline: `Gran opción: Más de ${threePointersMarket.threePointLine} Triples`,
      plainExplanation: `Se espera un partido muy abierto con ${threePointersMarket.projectedTotal3PM} triples combinados. El tirador estrella es ${threePointersMarket.topShooterName}.`,
      payoutExample: formatOddsPayout(1.85, 10),
      actionAdvice: `Es más confiable apostar al Over de triples que a un ganador apretado.`
    };
  }

  // 2. CASO AMARILLO (🟡 PRECAUCIÓN):
  if (Math.abs(pHomeWin - pAwayWin) <= 12) {
    return {
      signal: 'YELLOW',
      badgeLabel: '🟡 Precaución (Partido Apretado)',
      badgeColorClass: 'text-amber-300',
      badgeBgClass: 'bg-amber-950/30',
      badgeBorderClass: 'border-amber-500/40 ring-1 ring-amber-500/20',
      headline: `Duelo parejo: Margen menor a 4 puntos`,
      plainExplanation: `Cualquiera de los dos puede ganar (${pHomeWin}% vs ${pAwayWin}%). Los finales cerrados se deciden en los últimos segundos.`,
      payoutExample: formatOddsPayout(1.90, 10),
      actionAdvice: `Te conviene apostar a puntos totales (${projectedTotalPoints} pts proyectados) en vez de elegir un ganador.`
    };
  }

  // 3. CASO ROJO (🔴 EVITAR):
  return {
    signal: 'RED',
    badgeLabel: '🔴 Evitar (Riesgo Alto)',
    badgeColorClass: 'text-rose-300',
    badgeBgClass: 'bg-rose-950/30',
    badgeBorderClass: 'border-rose-500/40 ring-1 ring-rose-500/20',
    headline: 'Juego impredecible o con alta variabilidad',
    plainExplanation: `Rotaciones inciertas o estilos de juego poco consistentes. El margen de error es alto.`,
    payoutExample: formatOddsPayout(2.10, 10),
    actionAdvice: `No se recomienda apostar en este partido.`
  };
}
