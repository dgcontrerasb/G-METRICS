/**
 * Cliente del Pick Ledger: envía al backend los picks pre-partido para sellarlos (insert-only).
 * - Deduplicado en localStorage: cada pick se envía una sola vez por dispositivo.
 * - Lotes de ≤ 60 picks, 1 petición por ejecución → impacto nulo en cuotas.
 */
import type { MatchFixture, MatchAnalysis, NBAMatchFixture, NBAAnalysis } from '../types';
import { buildSoccerLedgerPicks, buildNBALedgerPicks, LedgerPick } from './pickLedger';

const SENT_KEY = 'gmetrics_ledger_sent_v1';
const MAX_BATCH = 60;

function loadSent(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SENT_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    // Purga entradas con más de 3 días
    Object.keys(obj).forEach((k) => {
      if (now - obj[k] > 3 * 86400_000) delete obj[k];
    });
    return obj;
  } catch {
    return {};
  }
}

let inFlight = false;

export async function sealPrematchPicks(
  soccer: { fixtures: MatchFixture[]; analyses: Record<string, MatchAnalysis> },
  nba: { fixtures: NBAMatchFixture[]; analyses: Record<string, NBAAnalysis> }
): Promise<void> {
  if (inFlight || typeof window === 'undefined') return;
  try {
    const sent = loadSent();
    const batch: LedgerPick[] = [];

    for (const f of soccer.fixtures) {
      const a = soccer.analyses[f.id];
      if (!a) continue;
      for (const p of buildSoccerLedgerPicks(f, a)) {
        const k = `${p.matchKey}|${p.marketKey}|${p.line ?? ''}`;
        if (!sent[k]) batch.push(p);
      }
    }
    for (const f of nba.fixtures) {
      const a = nba.analyses[f.id];
      if (!a) continue;
      for (const p of buildNBALedgerPicks(f, a)) {
        const k = `${p.matchKey}|${p.marketKey}|${p.line ?? ''}`;
        if (!sent[k]) batch.push(p);
      }
    }
    if (batch.length === 0) return;

    inFlight = true;
    const slice = batch.slice(0, MAX_BATCH);
    const res = await fetch('/api/pick-ledger/seal', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ picks: slice })
    });
    if (res.ok) {
      const now = Date.now();
      slice.forEach((p) => {
        sent[`${p.matchKey}|${p.marketKey}|${p.line ?? ''}`] = now;
      });
      localStorage.setItem(SENT_KEY, JSON.stringify(sent));
    }
  } catch {
    // silencioso: el sellado nunca debe afectar la experiencia del usuario
  } finally {
    inFlight = false;
  }
}
