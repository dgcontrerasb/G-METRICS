-- Ejecutar UNA vez en Supabase > SQL Editor
-- Tablas ligeras para historial semanal/mensual de Parlays y Apuestas Sencillas (+EV / Bankers)
-- Espacio estimado: ~250 KB por 35 días (0.05% del Free Tier de 500 MB) con auto-purga rodante.

CREATE TABLE IF NOT EXISTS gmetrics_parlay_history (
  id TEXT PRIMARY KEY,
  bet_date TEXT NOT NULL,
  week_key TEXT NOT NULL,
  profile TEXT NOT NULL,
  total_odds NUMERIC NOT NULL,
  effective_odds NUMERIC,
  legs JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING',
  engine_version TEXT,
  created_at BIGINT NOT NULL,
  settled_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_parlay_hist_date ON gmetrics_parlay_history(bet_date DESC);
CREATE INDEX IF NOT EXISTS idx_parlay_hist_week ON gmetrics_parlay_history(week_key);
CREATE INDEX IF NOT EXISTS idx_parlay_hist_status ON gmetrics_parlay_history(status);
ALTER TABLE gmetrics_parlay_history ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS gmetrics_singles_history (
  id TEXT PRIMARY KEY,
  bet_date TEXT NOT NULL,
  week_key TEXT NOT NULL,
  fixture_id TEXT NOT NULL,
  espn_event_id TEXT,
  sport TEXT NOT NULL,
  league TEXT,
  match_title TEXT NOT NULL,
  home_team TEXT,
  away_team TEXT,
  bet_type TEXT NOT NULL,
  market_key TEXT NOT NULL,
  selection_label TEXT NOT NULL,
  category_label TEXT,
  probability NUMERIC NOT NULL,
  fair_odd NUMERIC,
  estimated_odd NUMERIC NOT NULL,
  value_edge_pct NUMERIC,
  status TEXT NOT NULL DEFAULT 'PENDING',
  actual_result TEXT,
  created_at BIGINT NOT NULL,
  settled_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_singles_hist_date ON gmetrics_singles_history(bet_date DESC);
CREATE INDEX IF NOT EXISTS idx_singles_hist_week ON gmetrics_singles_history(week_key);
CREATE INDEX IF NOT EXISTS idx_singles_hist_status ON gmetrics_singles_history(status);
CREATE INDEX IF NOT EXISTS idx_singles_hist_type ON gmetrics_singles_history(bet_type);
ALTER TABLE gmetrics_singles_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gmetrics_parlay_history' AND policyname = 'Allow server full access parlay history') THEN
    CREATE POLICY "Allow server full access parlay history" ON gmetrics_parlay_history FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gmetrics_singles_history' AND policyname = 'Allow server full access singles history') THEN
    CREATE POLICY "Allow server full access singles history" ON gmetrics_singles_history FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
