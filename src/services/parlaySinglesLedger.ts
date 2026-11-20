/**
 * PARLAYS & SINGLES LEDGER ENGINE (Módulo Isomórfico Puro)
 * -----------------------------------------------------------------------------
 * Fuente única de verdad para:
 *  - Agrupación semanal ISO (YYYY-Www) y mensual (YYYY-MM).
 *  - Normalización de IDs y emparejamiento canónico de equipos (inmune a LA Lakers vs LA Clippers).
 *  - Liquidación honesta pata por pata / sencilla (VOID cuando falta telemetría oficial tras 12h).
 *  - Métricas reales de eficiencia (Win Rate, Cuota Promedio, Yield/ROI Flat 1u, Acierto por Mercado).
 *  - Generación de informes CSV planos con UTF-8 BOM (cero JSON, cero dependencias pesadas).
 */
import type {
  BettingMarketSuggestion,
  SmartParlaySlip,
  GMetricsSingleBetSuggestion
} from '../types';

export type SettlementStatus = 'PENDING' | 'WON' | 'LOST' | 'VOID';

export const UNVERIFIABLE_PARLAY_CATEGORIES: ReadonlySet<string> = new Set([
  'PLAYER_SHOTS_ON_TARGET',
  'NBA_PLAYER_POINTS',
  'NBA_PLAYER_THREES'
]);

const NOISE_TEAM_TOKENS = new Set([
  'fc', 'cf', 'cd', 'ca', 'cs', 'cp', 'sc', 'fk', 'sk', 'bk', 'if', 'ik', 'ff',
  'afc', 'bsc', 'ksc', 'tsv', 'vfb', 'vfl', 'sv', 'rb', 'ac', 'as', 'ss', 'us',
  'club', 'deportivo', 'atletico', 'sporting', 'real', 'de', 'del', 'la', 'las',
  'los', 'el', 'the', 'al', 'and', 'y', 'women', 'femenil', 'fem', 'w', 'lady', 'ladies'
]);

const MONTHS_ES_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

const MONTHS_ES_FULL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/** Normaliza IDs quitando prefijos como `nba-espn-`, `espn-`, etc. */
export function normalizeMatchId(rawId?: string | number | null): string {
  if (rawId === undefined || rawId === null) return '';
  const s = String(rawId).trim();
  if (!s) return '';
  const stripped = s
    .replace(/^nba-espn-/i, '')
    .replace(/^espn-/i, '')
    .replace(/^soccer-espn-/i, '')
    .trim();
  return stripped;
}

/** Normaliza un nombre de equipo eliminando tildes, signos y tokens genéricos (conserva nombre distintivo completo). */
export function normalizeTeamCanonical(name?: string): string {
  if (!name) return '';
  const clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ø/gi, 'o')
    .replace(/æ/gi, 'ae')
    .replace(/ß/gi, 'ss')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .toLowerCase()
    .trim();
  const tokens = clean.split(/\s+/).filter((t) => t.length > 0 && !NOISE_TEAM_TOKENS.has(t));
  return tokens.join(' ').trim();
}

function teamsMatch(candidateA: string, candidateB: string): boolean {
  const a = normalizeTeamCanonical(candidateA);
  const b = normalizeTeamCanonical(candidateB);
  if (!a || !b) return false;
  if (a === b) return true;

  // Para ciudades compartidas (ej: Los Angeles / New York / Manchester), exigir coincidencia completa de tokens distintivos
  const tokA = a.split(' ').filter((t) => t.length >= 2);
  const tokB = b.split(' ').filter((t) => t.length >= 2);
  if (tokA.length === 0 || tokB.length === 0) return false;

  if (tokA.length >= 2 && tokB.length >= 2) {
    // El último token suele ser la franquicia o nombre distintivo (lakers vs clippers, united vs city)
    const lastA = tokA[tokA.length - 1];
    const lastB = tokB[tokB.length - 1];
    if (lastA !== lastB && !a.includes(b) && !b.includes(a)) {
      return false;
    }
  }

  // Solo aceptar subcadena si uno contiene todos los tokens significativos del otro y longitud >= 5
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length >= 5 && longer.includes(shorter)) {
    const shortToks = shorter.split(' ');
    const longToks = new Set(longer.split(' '));
    if (shortToks.every((t) => longToks.has(t))) return true;
  }
  return false;
}

/** Calcula la clave de semana ISO (YYYY-Www, Lunes a Domingo) para cualquier fecha YYYY-MM-DD. */
export function getIsoWeekKey(dateStr: string): string {
  const clean = String(dateStr || '').slice(0, 10);
  const m = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = m
    ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
    : new Date();
  if (isNaN(d.getTime())) return '2026-W01';

  const dayNum = d.getUTCDay() || 7; // 1=Lunes .. 7=Domingo
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${isoYear}-W${String(weekNo).padStart(2, '0')}`;
}

/** Convierte YYYY-Www en una etiqueta legible: "Sem 47 · 16–22 Nov". */
export function getSpanishWeekLabel(weekKey: string): string {
  const m = String(weekKey || '').match(/^(\d{4})-W(\d{2})$/);
  if (!m) return weekKey;
  const year = Number(m[1]);
  const week = Number(m[2]);

  // Jueves de la semana 1 siempre cae en esa semana ISO
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayW1 = new Date(jan4.getTime() - (jan4Day - 1) * 86400000);
  const monday = new Date(mondayW1.getTime() + (week - 1) * 7 * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);

  const d1 = monday.getUTCDate();
  const m1 = MONTHS_ES_SHORT[monday.getUTCMonth()] || '';
  const d2 = sunday.getUTCDate();
  const m2 = MONTHS_ES_SHORT[sunday.getUTCMonth()] || '';

  if (m1 === m2) {
    return `Sem ${week} · ${d1}–${d2} ${m2}`;
  }
  return `Sem ${week} · ${d1} ${m1}–${d2} ${m2}`;
}

export function getSpanishMonthLabelLedger(monthKey: string): string {
  const [y, m] = String(monthKey || '').split('-');
  const idx = Number(m) - 1;
  return `${MONTHS_ES_FULL[idx] || monthKey} ${y || ''}`.trim();
}

export interface NormalizedFinishedMatch {
  id: string;
  espnEventId: string;
  sport: 'SOCCER' | 'NBA';
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  corners: number | null;
  yellowCards: number | null;
  redCards: number | null;
  hasStatsTelemetry: boolean;
  secondHalfGoals: number | null;
  firstHalfGoals: number | null;
  hasEventsTelemetry: boolean;
  finishedAtMs?: number;
  dateStr?: string;
}

/** Busca un partido finalizado por ID normalizado o coincidencia estricta de ambos equipos. */
export function findMatchingFinishedMatch(
  target: { fixtureId?: string; espnEventId?: string; matchName?: string; homeTeamName?: string; awayTeamName?: string; sport?: string },
  pool: NormalizedFinishedMatch[]
): NormalizedFinishedMatch | undefined {
  if (!pool || pool.length === 0) return undefined;

  const targetEspn = normalizeMatchId(target.espnEventId);
  const targetFix = normalizeMatchId(target.fixtureId);

  if (targetEspn || targetFix) {
    const byId = pool.find((m) => {
      if (target.sport && m.sport !== target.sport) return false;
      const mId = normalizeMatchId(m.id);
      const mEspn = normalizeMatchId(m.espnEventId);
      return Boolean(
        (targetEspn && (mEspn === targetEspn || mId === targetEspn)) ||
        (targetFix && (mId === targetFix || mEspn === targetFix))
      );
    });
    if (byId) return byId;
  }

  let homeTarget = target.homeTeamName || '';
  let awayTarget = target.awayTeamName || '';
  if ((!homeTarget || !awayTarget) && target.matchName) {
    const parts = target.matchName.split(/\s+vs\.?\s+|\s+v\s+|\s+@\s+/i);
    if (parts.length >= 2) {
      homeTarget = parts[0].trim();
      awayTarget = parts[1].trim();
    }
  }
  if (!homeTarget || !awayTarget) return undefined;

  return pool.find((m) => {
    if (target.sport && m.sport !== target.sport) return false;
    return teamsMatch(homeTarget, m.homeName) && teamsMatch(awayTarget, m.awayName);
  });
}

function isMatchSettlementStale(matchDate?: string, finishedAtMs?: number, nowMs = Date.now()): boolean {
  if (finishedAtMs && isFinite(finishedAtMs) && nowMs - finishedAtMs >= 6 * 3600_000) {
    return true;
  }
  if (matchDate && /^\d{4}-\d{2}-\d{2}$/.test(matchDate)) {
    const endOfDayMs = new Date(`${matchDate}T23:59:59-05:00`).getTime();
    if (isFinite(endOfDayMs) && nowMs - endOfDayMs >= 12 * 3600_000) {
      return true;
    }
  }
  return false;
}

/** Determina qué lado de equipo coincide con una etiqueta ("Gana X", "Empate No Válido: X", etc.). */
function detectSelectedSideFromLabel(
  label: string,
  homeName: string,
  awayName: string,
  hintHome?: string,
  hintAway?: string
): 'HOME' | 'AWAY' | null {
  const low = label.toLowerCase();
  if (/\(1\)/.test(low) || /\blocal\b/.test(low)) return 'HOME';
  if (/\(2\)/.test(low) || /\bvisitante\b/.test(low)) return 'AWAY';

  // Extraer nombre después de ":" o "gana " o antes de "(ML)" / "(Spread)"
  const stripped = low
    .replace(/^(gana|victoria de|empate no válido:|draw no bet:)\s*/i, '')
    .replace(/\s*\((ml|1|2|1x|x2)\)\s*$/i, '')
    .replace(/\s+[+-]\d+(?:\.\d+)?\s*$/i, '')
    .trim();

  const matchesHome =
    teamsMatch(stripped, homeName) ||
    (hintHome ? teamsMatch(stripped, hintHome) : false);
  const matchesAway =
    teamsMatch(stripped, awayName) ||
    (hintAway ? teamsMatch(stripped, hintAway) : false);

  if (matchesHome && !matchesAway) return 'HOME';
  if (matchesAway && !matchesHome) return 'AWAY';

  // Última verificación: buscar el nombre canónico completo dentro de la etiqueta
  const normLow = normalizeTeamCanonical(label);
  const normH = normalizeTeamCanonical(homeName);
  const normA = normalizeTeamCanonical(awayName);
  const inH = normH.length >= 4 && normLow.includes(normH);
  const inA = normA.length >= 4 && normLow.includes(normA);
  if (inH && !inA) return 'HOME';
  if (inA && !inH) return 'AWAY';
  return null;
}

export interface PickEvaluationInput {
  category?: string;
  marketKey?: string;
  label: string;
  sport?: string;
  matchDate?: string;
  homeTeamName?: string;
  awayTeamName?: string;
}

export interface PickEvaluationResult {
  status: SettlementStatus;
  actualResult: string;
}

/**
 * Liquidador unificado y honesto para una pata de Parlay o una Apuesta Sencilla.
 * Nunca marca LOST por ausencia de telemetría: espera mientras es reciente y liquida VOID tras 12h.
 */
export function evaluatePickAgainstFinishedMatch(
  pick: PickEvaluationInput,
  m: NormalizedFinishedMatch | undefined,
  nowMs = Date.now()
): PickEvaluationResult {
  if (!m) {
    return { status: 'PENDING', actualResult: '' };
  }

  const hg = m.homeScore;
  const ag = m.awayScore;
  const tot = hg + ag;
  const scoreStr = `${hg}-${ag}`;
  const stale = isMatchSettlementStale(pick.matchDate || m.dateStr, m.finishedAtMs, nowMs);

  const cat = String(pick.category || '').toUpperCase();
  const mKey = String(pick.marketKey || '').toUpperCase();
  const low = String(pick.label || '').toLowerCase();

  const win = (cond: boolean, detail = scoreStr): PickEvaluationResult => ({
    status: cond ? 'WON' : 'LOST',
    actualResult: detail
  });

  // 1. Player Props sin boxscore individual (Fútbol & NBA)
  if (
    cat === 'PLAYER_SHOTS_ON_TARGET' ||
    cat === 'NBA_PLAYER_POINTS' ||
    cat === 'NBA_PLAYER_THREES' ||
    mKey === 'NBA_PLAYER_3PM' ||
    mKey === 'NBA_PLAYER_PTS' ||
    (cat === 'NBA_TOTAL_POINTS' && (low.includes(':') || low.includes('triples')))
  ) {
    return stale
      ? { status: 'VOID', actualResult: 'Sin boxscore individual (Nula)' }
      : { status: 'PENDING', actualResult: `${scoreStr} · Esperando boxscore` };
  }

  // 2. NBA Total Puntos (con manejo exacto de Push -> VOID)
  if (cat === 'NBA_TOTAL_POINTS' || mKey === 'NBA_OVER_TOTAL' || mKey === 'NBA_UNDER_TOTAL') {
    const lineMatch = low.match(/(\d+(?:\.\d+)?)/);
    const line = lineMatch ? parseFloat(lineMatch[1]) : 0;
    if (line <= 0) return { status: 'VOID', actualResult: `Línea inválida (${tot} pts)` };
    const detail = `${scoreStr} (${tot} pts)`;
    if (tot === line) return { status: 'VOID', actualResult: `Push exacto · ${detail}` };
    const isUnder = mKey === 'NBA_UNDER_TOTAL' || low.includes('menos') || low.includes('under');
    return win(isUnder ? tot < line : tot > line, detail);
  }

  // 3. NBA Moneyline (empate en marcador anómalo -> VOID)
  if (cat === 'NBA_MONEYLINE' || mKey === 'NBA_ML_HOME' || mKey === 'NBA_ML_AWAY') {
    if (hg === ag) return { status: 'VOID', actualResult: `Empate ${scoreStr}` };
    if (mKey === 'NBA_ML_HOME') return win(hg > ag);
    if (mKey === 'NBA_ML_AWAY') return win(ag > hg);
    const side = detectSelectedSideFromLabel(pick.label, m.homeName, m.awayName, pick.homeTeamName, pick.awayTeamName);
    if (side === 'HOME') return win(hg > ag);
    if (side === 'AWAY') return win(ag > hg);
    return stale
      ? { status: 'VOID', actualResult: `Equipo no resuelto (${scoreStr})` }
      : { status: 'PENDING', actualResult: scoreStr };
  }

  // 4. NBA Spread / Hándicap
  if (cat === 'NBA_SPREAD' || mKey === 'NBA_SPREAD_PLUS') {
    const spMatch = low.match(/([+-]?\d+(?:\.\d+)?)/);
    const sp = spMatch ? parseFloat(spMatch[1]) : 0;
    const side = detectSelectedSideFromLabel(pick.label, m.homeName, m.awayName, pick.homeTeamName, pick.awayTeamName);
    if (!side) {
      return stale
        ? { status: 'VOID', actualResult: `Spread no resuelto (${scoreStr})` }
        : { status: 'PENDING', actualResult: scoreStr };
    }
    const diff = side === 'HOME' ? (hg + sp) - ag : (ag + sp) - hg;
    if (diff === 0) return { status: 'VOID', actualResult: `Push exacto (${scoreStr})` };
    return win(diff > 0);
  }

  // 5. Fútbol Córners (requiere acta real >= 3; nunca false LOST si falta telemetría)
  if (cat === 'TOTAL_CORNERS_MATCH' || mKey.startsWith('CORNERS_')) {
    if (m.corners === null || m.corners < 3) {
      return stale
        ? { status: 'VOID', actualResult: 'Sin acta de córners (Nula)' }
        : { status: 'PENDING', actualResult: `${scoreStr} · Esperando acta córners` };
    }
    const lineMatch = low.match(/(\d+(?:\.\d+)?)/);
    const line = lineMatch ? parseFloat(lineMatch[1]) : 8.5;
    const detail = `${m.corners} córners (${scoreStr})`;
    if (m.corners === line) return { status: 'VOID', actualResult: `Push · ${detail}` };
    const isUnder = low.includes('menos') || low.includes('under');
    return win(isUnder ? m.corners < line : m.corners > line, detail);
  }

  // 6. Fútbol Tarjetas
  if (cat === 'TOTAL_CARDS' || mKey.startsWith('CARDS_')) {
    const cards = m.yellowCards !== null ? m.yellowCards + (m.redCards || 0) : null;
    if (!m.hasStatsTelemetry || cards === null || cards < 1) {
      return stale
        ? { status: 'VOID', actualResult: 'Sin acta de tarjetas (Nula)' }
        : { status: 'PENDING', actualResult: `${scoreStr} · Esperando acta tarjetas` };
    }
    const lineMatch = low.match(/(\d+(?:\.\d+)?)/);
    const line = lineMatch ? parseFloat(lineMatch[1]) : 3.5;
    const detail = `${cards} tarjetas (${scoreStr})`;
    if (cards === line) return { status: 'VOID', actualResult: `Push · ${detail}` };
    const isUnder = low.includes('menos') || low.includes('under');
    return win(isUnder ? cards < line : cards > line, detail);
  }

  // 7. Fútbol Mitades (2.ª Mitad)
  if (cat === 'HALF_WITH_MOST_GOALS' || cat === 'HALF_GOALS') {
    if (!m.hasEventsTelemetry || m.secondHalfGoals === null) {
      return stale
        ? { status: 'VOID', actualResult: 'Sin desglose de mitades (Nula)' }
        : { status: 'PENDING', actualResult: `${scoreStr} · Esperando eventos` };
    }
    const detail = `1T:${m.firstHalfGoals ?? 0} / 2T:${m.secondHalfGoals} (${scoreStr})`;
    if (low.includes('0.5')) {
      return win(m.secondHalfGoals > 0, detail);
    }
    const first = m.firstHalfGoals ?? Math.max(0, tot - m.secondHalfGoals);
    if (m.secondHalfGoals === first) {
      return { status: 'LOST', actualResult: detail };
    }
    return win(m.secondHalfGoals > first, detail);
  }

  // 8. Fútbol Doble Oportunidad (orden estricto: 1X -> X2 -> 12)
  if (cat === 'DOUBLE_CHANCE' || mKey === 'DOUBLE_CHANCE_1X' || mKey === 'DOUBLE_CHANCE_X2') {
    if (mKey === 'DOUBLE_CHANCE_1X' || low.includes('1x') || low.includes('local o empate')) {
      return win(hg >= ag);
    }
    if (mKey === 'DOUBLE_CHANCE_X2' || low.includes('x2') || low.includes('empate o')) {
      return win(ag >= hg);
    }
    if (low.includes('12') || low.includes('cualquiera gana')) {
      return win(hg !== ag);
    }
    return win(hg >= ag);
  }

  // 9. Fútbol Total de Goles (1.5 / 2.5 / 3.5)
  if (cat === 'TOTAL_GOALS' || cat === 'SAFE_GOALS' || mKey === 'OVER_15' || mKey === 'OVER_25' || mKey === 'UNDER_25' || mKey === 'UNDER_35') {
    const detail = `${scoreStr} (${tot} goles)`;
    if (mKey === 'OVER_15') return win(tot > 1.5, detail);
    if (mKey === 'OVER_25') return win(tot > 2.5, detail);
    if (mKey === 'UNDER_25') return win(tot < 2.5, detail);
    if (mKey === 'UNDER_35') return win(tot < 3.5, detail);
    const lineMatch = low.match(/(\d+(?:\.\d+)?)/);
    const line = lineMatch ? parseFloat(lineMatch[1]) : 1.5;
    const isUnder = low.includes('menos') || low.includes('under');
    return win(isUnder ? tot < line : tot > line, detail);
  }

  // 10. Fútbol Ambos Equipos Anotan (BTTS)
  if (cat === 'BTTS' || mKey === 'BTTS_YES' || mKey === 'BTTS_NO') {
    const both = hg > 0 && ag > 0;
    if (mKey === 'BTTS_NO' || /:\s*no\b|\bno\b$/i.test(low)) {
      return win(!both);
    }
    return win(both);
  }

  // 11. Fútbol Draw No Bet (Empate -> VOID)
  if (cat === 'DRAW_NO_BET' || mKey === 'DNB_HOME' || mKey === 'DNB_AWAY') {
    if (hg === ag) return { status: 'VOID', actualResult: `Empate ${scoreStr} (Reembolso)` };
    if (mKey === 'DNB_HOME') return win(hg > ag);
    if (mKey === 'DNB_AWAY') return win(ag > hg);
    const side = detectSelectedSideFromLabel(pick.label, m.homeName, m.awayName, pick.homeTeamName, pick.awayTeamName);
    if (side === 'HOME') return win(hg > ag);
    if (side === 'AWAY') return win(ag > hg);
    return stale
      ? { status: 'VOID', actualResult: `Equipo DNB no resuelto (${scoreStr})` }
      : { status: 'PENDING', actualResult: scoreStr };
  }

  // 12. Fútbol Resultado 1X2
  if (cat === '1X2' || cat === 'ONE_X_TWO' || mKey === '1X2_HOME' || mKey === '1X2_AWAY') {
    if (mKey === '1X2_HOME') return win(hg > ag);
    if (mKey === '1X2_AWAY') return win(ag > hg);
    if (low.includes('empate') || /\(x\)/.test(low)) return win(hg === ag);
    const side = detectSelectedSideFromLabel(pick.label, m.homeName, m.awayName, pick.homeTeamName, pick.awayTeamName);
    if (side === 'HOME') return win(hg > ag);
    if (side === 'AWAY') return win(ag > hg);
    return stale
      ? { status: 'VOID', actualResult: `Equipo 1X2 no resuelto (${scoreStr})` }
      : { status: 'PENDING', actualResult: scoreStr };
  }

  return stale
    ? { status: 'VOID', actualResult: `Mercado no soportado (${scoreStr})` }
    : { status: 'PENDING', actualResult: scoreStr };
}

/**
 * Evalúa TODAS las patas de un parlay (sin corte anticipado), actualiza legStatus/actualResult
 * y recalcula estado y cuota efectiva (VOID = cuota 1.00).
 */
export function recomputeParlaySlipSettlement(
  slip: SmartParlaySlip,
  finishedPool: NormalizedFinishedMatch[],
  nowMs = Date.now()
): { slip: SmartParlaySlip; changed: boolean } {
  let anyChanged = false;
  const updatedLegs: BettingMarketSuggestion[] = slip.legs.map((leg) => {
    const matched = findMatchingFinishedMatch(
      {
        fixtureId: leg.fixtureId,
        espnEventId: leg.espnEventId,
        matchName: leg.matchName,
        sport: leg.sport
      },
      finishedPool
    );

    if (!matched) {
      return leg;
    }

    const res = evaluatePickAgainstFinishedMatch(
      {
        category: String(leg.category),
        label: leg.label,
        sport: leg.sport || matched.sport,
        matchDate: slip.date
      },
      matched,
      nowMs
    );

    if (leg.legStatus !== res.status || leg.actualResult !== res.actualResult) {
      anyChanged = true;
      return {
        ...leg,
        legStatus: res.status,
        actualResult: res.actualResult
      };
    }
    return leg;
  });

  const hasLost = updatedLegs.some((l) => l.legStatus === 'LOST');
  const hasPending = updatedLegs.some((l) => !l.legStatus || l.legStatus === 'PENDING');
  const wonLegs = updatedLegs.filter((l) => l.legStatus === 'WON');
  const allVoid = updatedLegs.length > 0 && updatedLegs.every((l) => l.legStatus === 'VOID');

  let nextStatus: SettlementStatus = 'PENDING';
  let nextEffectiveOdds = slip.totalOdds;

  if (hasLost) {
    nextStatus = 'LOST';
    nextEffectiveOdds = slip.totalOdds;
  } else if (hasPending) {
    nextStatus = 'PENDING';
    nextEffectiveOdds = slip.totalOdds;
  } else if (allVoid) {
    nextStatus = 'VOID';
    nextEffectiveOdds = 1.0;
  } else {
    nextStatus = 'WON';
    nextEffectiveOdds = Number(
      wonLegs.reduce((acc, l) => acc * Math.max(1.0, l.odds || 1.0), 1.0).toFixed(2)
    );
  }

  const nextWeekKey = slip.weekKey || getIsoWeekKey(slip.date);
  if (
    slip.status !== nextStatus ||
    slip.effectiveOdds !== nextEffectiveOdds ||
    slip.weekKey !== nextWeekKey
  ) {
    anyChanged = true;
  }

  const nextSlip: SmartParlaySlip = {
    ...slip,
    weekKey: nextWeekKey,
    legs: updatedLegs,
    status: nextStatus,
    effectiveOdds: nextEffectiveOdds,
    evaluationDate: nextStatus !== 'PENDING' ? (slip.evaluationDate || new Date(nowMs).toISOString()) : undefined
  };

  return { slip: nextSlip, changed: anyChanged };
}

// ============================================================================
// CÁLCULO DE MÉTRICAS DE EFICIENCIA (PARLAYS Y SENCILLAS)
// ============================================================================

export interface PeriodEfficiencyRow {
  key: string;
  label: string;
  total: number;
  won: number;
  lost: number;
  voidCount: number;
  pending: number;
  resolved: number;
  winRate: number;
  avgOdds: number;
  netYieldUnits: number;
  yieldPercent: number;
}

export interface CategoryAccuracyRow {
  key: string;
  label: string;
  total: number;
  won: number;
  lost: number;
  voidCount: number;
  pending: number;
  resolved: number;
  winRate: number;
  netYieldUnits: number;
  yieldPercent: number;
}

function summarizeGroup(
  key: string,
  label: string,
  items: Array<{ status: SettlementStatus; odd: number }>
): PeriodEfficiencyRow {
  const total = items.length;
  const won = items.filter((i) => i.status === 'WON').length;
  const lost = items.filter((i) => i.status === 'LOST').length;
  const voidCount = items.filter((i) => i.status === 'VOID').length;
  const pending = items.filter((i) => i.status === 'PENDING').length;
  const resolved = won + lost;
  const winRate = resolved > 0 ? Number(((won / resolved) * 100).toFixed(1)) : 0;
  const avgOdds = total > 0
    ? Number((items.reduce((s, i) => s + (i.odd || 1), 0) / total).toFixed(2))
    : 0;

  let net = 0;
  for (const it of items) {
    if (it.status === 'WON') net += Math.max(0, (it.odd || 1) - 1);
    else if (it.status === 'LOST') net -= 1;
  }
  const netYieldUnits = Number(net.toFixed(2));
  const yieldPercent = resolved > 0 ? Number(((net / resolved) * 100).toFixed(1)) : 0;

  return {
    key,
    label,
    total,
    won,
    lost,
    voidCount,
    pending,
    resolved,
    winRate,
    avgOdds,
    netYieldUnits,
    yieldPercent
  };
}

export interface ParlayEfficiencySummary {
  overall: PeriodEfficiencyRow & {
    legTotal: number;
    legWon: number;
    legLost: number;
    legVoid: number;
    legWinRate: number;
  };
  byWeek: PeriodEfficiencyRow[];
  byMonth: PeriodEfficiencyRow[];
  byProfile: CategoryAccuracyRow[];
  byLegMarket: CategoryAccuracyRow[];
}

export function computeParlayEfficiencyStats(slips: SmartParlaySlip[]): ParlayEfficiencySummary {
  const normalized = (slips || []).map((s) => ({
    slip: s,
    status: s.status || 'PENDING',
    odd: s.status === 'WON' ? (s.effectiveOdds ?? s.totalOdds) : s.totalOdds,
    weekKey: s.weekKey || getIsoWeekKey(s.date),
    monthKey: (s.date || '').slice(0, 7) || '2026-11'
  }));

  const overallBase = summarizeGroup('ALL', 'Global', normalized);

  // Acierto pata por pata y por categoría de mercado
  const legMarketMap = new Map<string, Array<{ status: SettlementStatus; odd: number }>>();
  let legTotal = 0;
  let legWon = 0;
  let legLost = 0;
  let legVoid = 0;

  for (const { slip } of normalized) {
    for (const leg of slip.legs || []) {
      const st: SettlementStatus = leg.legStatus || (slip.status === 'WON' ? 'WON' : slip.status === 'VOID' ? 'VOID' : 'PENDING');
      legTotal++;
      if (st === 'WON') legWon++;
      else if (st === 'LOST') legLost++;
      else if (st === 'VOID') legVoid++;
      const cat = String(leg.category || 'OTHER');
      const arr = legMarketMap.get(cat) || [];
      arr.push({ status: st, odd: leg.odds || 1.3 });
      legMarketMap.set(cat, arr);
    }
  }
  const legResolved = legWon + legLost;
  const legWinRate = legResolved > 0 ? Number(((legWon / legResolved) * 100).toFixed(1)) : 0;

  // Por Semana
  const weekMap = new Map<string, Array<{ status: SettlementStatus; odd: number }>>();
  const monthMap = new Map<string, Array<{ status: SettlementStatus; odd: number }>>();
  const profileMap = new Map<string, Array<{ status: SettlementStatus; odd: number }>>();

  for (const item of normalized) {
    weekMap.set(item.weekKey, [...(weekMap.get(item.weekKey) || []), item]);
    monthMap.set(item.monthKey, [...(monthMap.get(item.monthKey) || []), item]);
    profileMap.set(item.slip.profile, [...(profileMap.get(item.slip.profile) || []), item]);
  }

  const byWeek = Array.from(weekMap.entries())
    .map(([k, arr]) => summarizeGroup(k, getSpanishWeekLabel(k), arr))
    .sort((a, b) => b.key.localeCompare(a.key));

  const byMonth = Array.from(monthMap.entries())
    .map(([k, arr]) => summarizeGroup(k, getSpanishMonthLabelLedger(k), arr))
    .sort((a, b) => b.key.localeCompare(a.key));

  const PROFILE_LABELS: Record<string, string> = {
    CONSERVATIVE: 'Conservador (~2.00)',
    BALANCED: 'Equilibrado (~3.00)',
    HIGH_ODDS: 'Cuota Alta (~6.00)'
  };
  const byProfile: CategoryAccuracyRow[] = ['CONSERVATIVE', 'BALANCED', 'HIGH_ODDS'].map((p) => {
    const row = summarizeGroup(p, PROFILE_LABELS[p] || p, profileMap.get(p) || []);
    return { ...row };
  });

  const byLegMarket: CategoryAccuracyRow[] = Array.from(legMarketMap.entries())
    .map(([k, arr]) => summarizeGroup(k, k, arr))
    .sort((a, b) => b.total - a.total);

  return {
    overall: {
      ...overallBase,
      legTotal,
      legWon,
      legLost,
      legVoid,
      legWinRate
    },
    byWeek,
    byMonth,
    byProfile,
    byLegMarket
  };
}

export interface SinglesEfficiencySummary {
  overall: PeriodEfficiencyRow;
  byWeek: PeriodEfficiencyRow[];
  byMonth: PeriodEfficiencyRow[];
  byType: CategoryAccuracyRow[];
  bySport: CategoryAccuracyRow[];
  byMarket: CategoryAccuracyRow[];
}

export function computeSinglesEfficiencyStats(singles: GMetricsSingleBetSuggestion[]): SinglesEfficiencySummary {
  const normalized = (singles || []).map((s) => ({
    s,
    status: (s.status || 'PENDING') as SettlementStatus,
    odd: s.estimatedBookieOdd || 1.4,
    weekKey: s.weekKey || getIsoWeekKey(s.matchDate),
    monthKey: (s.matchDate || '').slice(0, 7) || '2026-11'
  }));

  const overall = summarizeGroup('ALL', 'Global Sencillas', normalized);

  const weekMap = new Map<string, Array<{ status: SettlementStatus; odd: number }>>();
  const monthMap = new Map<string, Array<{ status: SettlementStatus; odd: number }>>();
  const typeMap = new Map<string, Array<{ status: SettlementStatus; odd: number }>>();
  const sportMap = new Map<string, Array<{ status: SettlementStatus; odd: number }>>();
  const marketMap = new Map<string, Array<{ status: SettlementStatus; odd: number }>>();

  for (const item of normalized) {
    weekMap.set(item.weekKey, [...(weekMap.get(item.weekKey) || []), item]);
    monthMap.set(item.monthKey, [...(monthMap.get(item.monthKey) || []), item]);
    typeMap.set(item.s.betType, [...(typeMap.get(item.s.betType) || []), item]);
    sportMap.set(item.s.sport || 'SOCCER', [...(sportMap.get(item.s.sport || 'SOCCER') || []), item]);
    const mKey = item.s.marketKey || 'OTHER';
    marketMap.set(mKey, [...(marketMap.get(mKey) || []), item]);
  }

  const byWeek = Array.from(weekMap.entries())
    .map(([k, arr]) => summarizeGroup(k, getSpanishWeekLabel(k), arr))
    .sort((a, b) => b.key.localeCompare(a.key));

  const byMonth = Array.from(monthMap.entries())
    .map(([k, arr]) => summarizeGroup(k, getSpanishMonthLabelLedger(k), arr))
    .sort((a, b) => b.key.localeCompare(a.key));

  const byType: CategoryAccuracyRow[] = [
    summarizeGroup('BANKER', 'Bankers Seguros', typeMap.get('BANKER') || []),
    summarizeGroup('HIGH_VALUE', 'Alta Cuota (+EV)', typeMap.get('HIGH_VALUE') || [])
  ];

  const bySport: CategoryAccuracyRow[] = [
    summarizeGroup('SOCCER', 'Fútbol', sportMap.get('SOCCER') || []),
    summarizeGroup('NBA', 'Baloncesto (NBA/NCAA)', sportMap.get('NBA') || [])
  ];

  const byMarket: CategoryAccuracyRow[] = Array.from(marketMap.entries())
    .map(([k, arr]) => summarizeGroup(k, k, arr))
    .sort((a, b) => b.total - a.total);

  return { overall, byWeek, byMonth, byType, bySport, byMarket };
}

// ============================================================================
// GENERADORES DE REPORTES CSV PLANOS (SOLO CSV, UTF-8 BOM, CERO JSON)
// ============================================================================

function csvCell(val: unknown): string {
  const s = String(val ?? '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""');
  return `"${s}"`;
}

export function buildParlaysCsvContent(slips: SmartParlaySlip[], weeklyStats: PeriodEfficiencyRow[]): string {
  const lines: string[] = [];
  lines.push([
    'Tipo_Registro', 'Semana_ISO', 'Fecha', 'ID_Boleto', 'Perfil', 'Estado_Boleto',
    'Cuota_Original', 'Cuota_Efectiva', 'N_Patas', 'Ganancia_Neta_U', 'Resumen_Semanal_WinRate_Pct', 'Detalle_Patas_y_Resultados'
  ].map(csvCell).join(';'));

  for (const w of weeklyStats || []) {
    lines.push([
      'RESUMEN_SEMANA', w.key, w.label, '-', 'TODOS', `${w.won}W-${w.lost}L-${w.voidCount}V-${w.pending}P`,
      w.avgOdds.toFixed(2), w.avgOdds.toFixed(2), w.total, w.netYieldUnits.toFixed(2), `${w.winRate}%`, `ROI: ${w.yieldPercent}%`
    ].map(csvCell).join(';'));
  }

  for (const s of slips || []) {
    const eff = s.effectiveOdds ?? s.totalOdds;
    const net = s.status === 'WON' ? (eff - 1).toFixed(2) : s.status === 'LOST' ? '-1.00' : '0.00';
    const detail = (s.legs || [])
      .map((l, idx) => `${idx + 1}) ${l.matchName} [${l.label} @${l.odds.toFixed(2)}] => ${l.legStatus || 'PENDING'}${l.actualResult ? ' (' + l.actualResult + ')' : ''}`)
      .join(' | ');
    lines.push([
      'BOLETO_PARLAY',
      s.weekKey || getIsoWeekKey(s.date),
      s.date,
      s.id,
      s.profile,
      s.status,
      s.totalOdds.toFixed(2),
      eff.toFixed(2),
      s.legs?.length || 0,
      net,
      '-',
      detail
    ].map(csvCell).join(';'));
  }

  return '\uFEFF' + lines.join('\r\n');
}

export function buildSinglesCsvContent(singles: GMetricsSingleBetSuggestion[], weeklyStats: PeriodEfficiencyRow[]): string {
  const lines: string[] = [];
  lines.push([
    'Tipo_Registro', 'Semana_ISO', 'Fecha', 'ID', 'Deporte', 'Liga', 'Partido',
    'Tipo_Apuesta', 'Mercado', 'Seleccion', 'Probabilidad_Pct', 'Cuota_Estimada',
    'Edge_EV_Pct', 'Estado', 'Resultado_Real', 'Ganancia_Neta_U'
  ].map(csvCell).join(';'));

  for (const w of weeklyStats || []) {
    lines.push([
      'RESUMEN_SEMANA', w.key, w.label, '-', 'TODOS', '-', `${w.won}W-${w.lost}L-${w.voidCount}V-${w.pending}P`,
      'ALL', 'ALL', `WinRate ${w.winRate}%`, '-', w.avgOdds.toFixed(2),
      `${w.yieldPercent}% ROI`, 'AUDITADO', '-', w.netYieldUnits.toFixed(2)
    ].map(csvCell).join(';'));
  }

  for (const s of singles || []) {
    const st = s.status || 'PENDING';
    const net = st === 'WON' ? (s.estimatedBookieOdd - 1).toFixed(2) : st === 'LOST' ? '-1.00' : '0.00';
    lines.push([
      'SENCILLA',
      s.weekKey || getIsoWeekKey(s.matchDate),
      s.matchDate,
      s.id,
      s.sport,
      s.leagueName,
      s.matchTitle,
      s.betType,
      s.marketKey,
      s.selectionLabel,
      s.probability,
      s.estimatedBookieOdd.toFixed(2),
      s.valueEdgePct,
      st,
      s.actualResult || '',
      net
    ].map(csvCell).join(';'));
  }

  return '\uFEFF' + lines.join('\r\n');
}
