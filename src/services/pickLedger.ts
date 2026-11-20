/**
 * PICK LEDGER (libro de picks inmutable)
 * -----------------------------------------------------------------------------
 * Fuente única de verdad para medir la eficiencia REAL de G-METRICS:
 *  - Los picks se SELLAN antes del inicio del partido (insert-only, nunca se pisan).
 *  - La liquidación (WON/LOST) se hace después con el marcador oficial.
 *  - Módulo puro (sin React / sin red): lo usan el cliente (sellado) y el servidor (validación + liquidación).
 */
import type { MatchFixture, MatchAnalysis, NBAMatchFixture, NBAAnalysis } from '../types';

export const LEDGER_MODEL_VERSION = 'gm-2026-11-19a';
export const LEDGER_MAX_SOCCER_PICKS_PER_MATCH = 4;

export type LedgerSport = 'SOCCER' | 'NBA';
export type LedgerStatus = 'PENDING' | 'WON' | 'LOST' | 'VOID';

export interface LedgerPick {
  matchKey: string; // S:<espnEventId> | N:<espnEventId>
  sport: LedgerSport;
  league: string;
  home: string;
  away: string;
  kickoffTs: number; // epoch ms
  marketKey: string; // clave estructurada (ver LEDGER_MARKET_KEYS)
  line: number | null;
  category: string;
  label: string;
  probModel: number; // 0..100
  fairOdd: number;
  bookOdd: number | null;
  rank: number; // 1 = pick principal mostrado al usuario
  modelVersion: string;
}

export interface LedgerFinalData {
  home: number;
  away: number;
  corners?: number | null;
  cards?: number | null;
}

const FIXED_KEYS = [
  'dc_1x',
  'dc_x2',
  'goals_over15',
  'goals_under35',
  'btts_yes',
  'btts_no',
  'win_home',
  'win_away',
  'corners_over',
  'corners_under',
  'cards_over',
  'cards_under',
  'nba_ml_home',
  'nba_ml_away',
  'nba_total_over',
  'nba_total_under'
] as const;
export const LEDGER_MARKET_KEYS: ReadonlySet<string> = new Set(FIXED_KEYS);

const NEEDS_LINE = new Set(['corners_over', 'corners_under', 'cards_over', 'cards_under', 'nba_total_over', 'nba_total_under']);

function parseLine(label: string): number | null {
  const m = String(label || '').match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function kickoffOf(f: { startTimestamp?: number; date: string; time: string }): number {
  if (f.startTimestamp && f.startTimestamp > 0) {
    return f.startTimestamp < 1e12 ? f.startTimestamp * 1000 : f.startTimestamp;
  }
  const t = new Date(`${f.date}T${f.time || '12:00'}:00-05:00`).getTime();
  return isNaN(t) ? 0 : t;
}

/** Fútbol: sella topSafePick (rank 1) + siguientes mejores (rank 2..N) para ampliar muestra de calibración. */
export function buildSoccerLedgerPicks(fixture: MatchFixture, analysis: MatchAnalysis): LedgerPick[] {
  if (fixture.status !== 'SCHEDULED') return [];
  const kickoffTs = kickoffOf(fixture);
  if (!kickoffTs || kickoffTs <= Date.now() + 60_000) return [];

  const verdict = analysis.verdict;
  if (!verdict?.topSafePick) return [];
  const ranked = [verdict.topSafePick, ...(verdict.allRankedPicks || []).filter((p) => p.id !== verdict.topSafePick.id)];
  const homeFav = analysis.dixonColes.pHomeWin >= analysis.dixonColes.pAwayWin;
  const out: LedgerPick[] = [];
  const seen = new Set<string>();

  for (const p of ranked) {
    if (out.length >= LEDGER_MAX_SOCCER_PICKS_PER_MATCH) break;
    let key: string | null = null;
    let line: number | null = null;
    const isUnder = /menos|under/i.test(p.label);

    if (p.id === 'dc_1x') key = 'dc_1x';
    else if (p.id === 'dc_x2') key = 'dc_x2';
    else if (p.id === 'goals_over15') key = 'goals_over15';
    else if (p.id === 'goals_under35') key = 'goals_under35';
    else if (p.id === 'btts_pick') key = /:\s*no/i.test(p.label) ? 'btts_no' : 'btts_yes';
    else if (p.id === 'winner_1x2') key = homeFav ? 'win_home' : 'win_away';
    else if (p.category === 'CORNERS') {
      key = isUnder ? 'corners_under' : 'corners_over';
      line = parseLine(p.label);
    } else if (p.category === 'CARDS') {
      key = isUnder ? 'cards_under' : 'cards_over';
      line = parseLine(p.label);
    }
    if (!key) continue;
    if (NEEDS_LINE.has(key) && line === null) continue;
    const uniq = `${key}|${line ?? ''}`;
    if (seen.has(uniq)) continue;
    seen.add(uniq);

    out.push({
      matchKey: `S:${fixture.espnEventId || fixture.id}`,
      sport: 'SOCCER',
      league: fixture.league?.name || '',
      home: fixture.homeTeam.name,
      away: fixture.awayTeam.name,
      kickoffTs,
      marketKey: key,
      line,
      category: String(p.category),
      label: String(p.label).slice(0, 120),
      probModel: round1(p.probability),
      fairOdd: Number((p.fairOdd || 100 / Math.max(1, p.probability)).toFixed(2)),
      bookOdd: null,
      rank: out.length + 1,
      modelVersion: LEDGER_MODEL_VERSION
    });
  }
  return out;
}

/** NBA: mismo criterio que el panel (ML favorito si prob >= 58, si no Total); rank 1 y alternativa rank 2. */
export function buildNBALedgerPicks(fixture: NBAMatchFixture, analysis: NBAAnalysis): LedgerPick[] {
  if (fixture.status !== 'SCHEDULED' || !fixture.espnEventId) return [];
  const kickoffTs = kickoffOf(fixture);
  if (!kickoffTs || kickoffTs <= Date.now() + 60_000) return [];

  const base = {
    matchKey: `N:${fixture.espnEventId}`,
    sport: 'NBA' as const,
    league: fixture.league?.name || 'NBA',
    home: fixture.homeTeam.name,
    away: fixture.awayTeam.name,
    kickoffTs,
    modelVersion: LEDGER_MODEL_VERSION
  };
  const picks: LedgerPick[] = [];

  const homeFav = analysis.pHomeWin >= analysis.pAwayWin;
  const favProb = Math.max(analysis.pHomeWin, analysis.pAwayWin);
  const isOver = analysis.overTotalProb >= analysis.underTotalProb;
  const totProb = Math.max(analysis.overTotalProb, analysis.underTotalProb);
  const line = analysis.fairTotalLine;

  const ml: LedgerPick = {
    ...base,
    marketKey: homeFav ? 'nba_ml_home' : 'nba_ml_away',
    line: null,
    category: 'NBA_MONEYLINE',
    label: `Gana ${homeFav ? fixture.homeTeam.name : fixture.awayTeam.name} (ML)`,
    probModel: round1(favProb),
    fairOdd: Number((100 / Math.max(15, favProb)).toFixed(2)),
    bookOdd: null,
    rank: 0
  };
  const tot: LedgerPick = {
    ...base,
    marketKey: isOver ? 'nba_total_over' : 'nba_total_under',
    line,
    category: 'NBA_TOTAL_POINTS',
    label: `${isOver ? 'Más de' : 'Menos de'} ${line} Puntos Totales`,
    probModel: round1(totProb),
    fairOdd: Number((100 / Math.max(15, totProb)).toFixed(2)),
    bookOdd: null,
    rank: 0
  };
  const ordered = favProb >= 58 ? [ml, tot] : [tot, ml];
  ordered.forEach((p, i) => picks.push({ ...p, rank: i + 1 }));
  return picks;
}

/** Valida un pick recibido por red (el servidor NO confía en el cliente). */
export function validateLedgerPickShape(p: unknown, nowMs = Date.now()): LedgerPick | null {
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const matchKey = str(o.matchKey, 40);
  if (!/^[SN]:\d{3,12}$/.test(matchKey)) return null;
  const sport: LedgerSport = matchKey.startsWith('N:') ? 'NBA' : 'SOCCER';
  const marketKey = str(o.marketKey, 30);
  if (!LEDGER_MARKET_KEYS.has(marketKey)) return null;
  if (sport === 'NBA' !== marketKey.startsWith('nba_')) return null;
  const kickoffTs = Number(o.kickoffTs);
  if (!isFinite(kickoffTs) || kickoffTs <= nowMs || kickoffTs > nowMs + 72 * 3600_000) return null;
  const prob = Number(o.probModel);
  if (!isFinite(prob) || prob < 20 || prob > 99.5) return null;
  const fair = Number(o.fairOdd);
  if (!isFinite(fair) || fair < 1.01 || fair > 20) return null;
  let line: number | null = null;
  if (o.line !== null && o.line !== undefined) {
    line = Number(o.line);
    if (!isFinite(line) || line < 0 || line > 400) return null;
  }
  if (NEEDS_LINE.has(marketKey) && line === null) return null;
  const rank = Math.round(Number(o.rank));
  if (!isFinite(rank) || rank < 1 || rank > 6) return null;
  const home = str(o.home, 80);
  const away = str(o.away, 80);
  if (!home || !away) return null;
  return {
    matchKey,
    sport,
    league: str(o.league, 80),
    home,
    away,
    kickoffTs: Math.round(kickoffTs),
    marketKey,
    line,
    category: str(o.category, 30),
    label: str(o.label, 120),
    probModel: round1(prob),
    fairOdd: Number(fair.toFixed(2)),
    bookOdd: null, // la cuota real de mercado solo la puede fijar el servidor
    rank,
    modelVersion: str(o.modelVersion, 40) || LEDGER_MODEL_VERSION
  };
}

/** Liquida un pick. Devuelve null si faltan datos para resolverlo (se reintenta luego). */
export function settleLedgerPick(
  marketKey: string,
  line: number | null,
  d: LedgerFinalData
): Exclude<LedgerStatus, 'PENDING'> | null {
  const { home: h, away: a } = d;
  if (!isFinite(h) || !isFinite(a)) return null;
  const tot = h + a;
  const win = (b: boolean) => (b ? 'WON' : 'LOST') as 'WON' | 'LOST';
  switch (marketKey) {
    case 'dc_1x': return win(h >= a);
    case 'dc_x2': return win(a >= h);
    case 'goals_over15': return win(tot > 1.5);
    case 'goals_under35': return win(tot < 3.5);
    case 'btts_yes': return win(h > 0 && a > 0);
    case 'btts_no': return win(!(h > 0 && a > 0));
    case 'win_home': return win(h > a);
    case 'win_away': return win(a > h);
    case 'nba_ml_home': return h === a ? 'VOID' : win(h > a);
    case 'nba_ml_away': return h === a ? 'VOID' : win(a > h);
    case 'nba_total_over':
      if (line === null) return null;
      return tot === line ? 'VOID' : win(tot > line);
    case 'nba_total_under':
      if (line === null) return null;
      return tot === line ? 'VOID' : win(tot < line);
    case 'corners_over':
    case 'corners_under': {
      if (line === null || d.corners === null || d.corners === undefined || d.corners < 3) return null;
      return marketKey === 'corners_over' ? win(d.corners > line) : win(d.corners < line);
    }
    case 'cards_over':
    case 'cards_under': {
      if (line === null || d.cards === null || d.cards === undefined) return null;
      return marketKey === 'cards_over' ? win(d.cards > line) : win(d.cards < line);
    }
    default:
      return null;
  }
}

/** Intervalo de Wilson al 95% (en %), para no sacar conclusiones con muestras pequeñas. */
export function wilsonInterval(wins: number, n: number, z = 1.96): { low: number; high: number } {
  if (n <= 0) return { low: 0, high: 100 };
  const p = wins / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return {
    low: Math.max(0, round1((center - margin) * 100)),
    high: Math.min(100, round1((center + margin) * 100))
  };
}

export interface LedgerMarketStat {
  marketKey: string;
  n: number;
  wins: number;
  hitRate: number; // %
  avgModelProb: number; // % (lo que el modelo "prometía")
  calibrationGap: number; // hitRate - avgModelProb (negativo = sobreestima)
  brier: number; // 0..1 (menor es mejor)
  wilsonLow: number;
  wilsonHigh: number;
  verdict: 'MUESTRA_INSUFICIENTE' | 'SOBREESTIMADO' | 'SUBESTIMADO' | 'CALIBRADO';
}

export interface LedgerRowLite {
  market_key: string;
  status: LedgerStatus;
  prob_model: number;
}

/** Eficiencia + calibración por mercado (excluye VOID/PENDING). */
export function computeLedgerMarketStats(rows: LedgerRowLite[], minSample = 30): LedgerMarketStat[] {
  const groups = new Map<string, LedgerRowLite[]>();
  rows.forEach((r) => {
    if (r.status !== 'WON' && r.status !== 'LOST') return;
    const arr = groups.get(r.market_key) || [];
    arr.push(r);
    groups.set(r.market_key, arr);
  });
  const stats: LedgerMarketStat[] = [];
  groups.forEach((arr, marketKey) => {
    const n = arr.length;
    const wins = arr.filter((r) => r.status === 'WON').length;
    const hit = (wins / n) * 100;
    const avgP = arr.reduce((s, r) => s + r.prob_model, 0) / n;
    const brier = arr.reduce((s, r) => s + Math.pow(r.prob_model / 100 - (r.status === 'WON' ? 1 : 0), 2), 0) / n;
    const w = wilsonInterval(wins, n);
    const gap = hit - avgP;
    let verdict: LedgerMarketStat['verdict'] = 'CALIBRADO';
    if (n < minSample) verdict = 'MUESTRA_INSUFICIENTE';
    else if (avgP > w.high) verdict = 'SOBREESTIMADO';
    else if (avgP < w.low) verdict = 'SUBESTIMADO';
    stats.push({
      marketKey,
      n,
      wins,
      hitRate: round1(hit),
      avgModelProb: round1(avgP),
      calibrationGap: round1(gap),
      brier: Number(brier.toFixed(4)),
      wilsonLow: w.low,
      wilsonHigh: w.high,
      verdict
    });
  });
  return stats.sort((x, y) => y.n - x.n);
}
