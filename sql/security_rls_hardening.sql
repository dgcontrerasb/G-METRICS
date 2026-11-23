-- G-METRICS · Hardening RLS en Supabase (Costo $0 USD/mes)
-- Ejecutar UNA sola vez en Supabase > SQL Editor.
-- Restringe todas las tablas internas del esquema public exclusivamente al rol `service_role`
-- (bloqueando lecturas/escrituras directas desde navegadores con `anon` o `authenticated`).

DO $$
DECLARE
  t TEXT;
  p RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sportstats_users',
    'sportstats_config',
    'sportstats_push_subscriptions',
    'sportstats_feedback',
    'gmetrics_pick_ledger',
    'gmetrics_parlay_history',
    'gmetrics_singles_history'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
      FOR p IN
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', p.policyname, t);
      END LOOP;
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
        'service_role_only_' || t,
        t
      );
    END IF;
  END LOOP;
END $$;
