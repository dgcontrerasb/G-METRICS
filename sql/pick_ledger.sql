-- Ejecutar UNA vez en Supabase > SQL Editor
CREATE TABLE IF NOT EXISTS gmetrics_pick_ledger (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_key TEXT NOT NULL,
  sport TEXT NOT NULL,
  league TEXT,
  home TEXT,
  away TEXT,
  kickoff_ts BIGINT NOT NULL,
  market_key TEXT NOT NULL,
  line NUMERIC NOT NULL DEFAULT -1,
  category TEXT,
  label TEXT,
  prob_model NUMERIC NOT NULL,
  fair_odd NUMERIC,
  book_odd NUMERIC,
  rank INTEGER NOT NULL DEFAULT 1,
  model_version TEXT,
  source TEXT NOT NULL DEFAULT 'PRE',
  sealed_at BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  settled_at BIGINT,
  final_home INTEGER,
  final_away INTEGER,
  final_corners INTEGER,
  final_cards INTEGER
);
-- Insert-only: un mismo pick de un mismo partido solo se sella UNA vez (el primero gana)
CREATE UNIQUE INDEX IF NOT EXISTS uq_pick_ledger_pick ON gmetrics_pick_ledger(match_key, market_key, line, source);
CREATE INDEX IF NOT EXISTS idx_pick_ledger_status ON gmetrics_pick_ledger(status, kickoff_ts);
CREATE INDEX IF NOT EXISTS idx_pick_ledger_market ON gmetrics_pick_ledger(market_key, source);
ALTER TABLE gmetrics_pick_ledger ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow server full access pick ledger" ON gmetrics_pick_ledger;
  CREATE POLICY "Allow server full access pick ledger" ON gmetrics_pick_ledger FOR ALL TO service_role USING (true) WITH CHECK (true);
END $$;
