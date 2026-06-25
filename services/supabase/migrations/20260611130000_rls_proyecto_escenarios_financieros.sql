-- ──────────────────────────────────────────────────────────────────────────────
-- RLS para proyecto_escenarios_financieros
-- ──────────────────────────────────────────────────────────────────────────────
-- La migración 20260531000002_proyecto_escenarios.sql creó la tabla sin activar
-- Row Level Security — era la única tabla del schema sin RLS (regla innegociable
-- nº 5 del proyecto). Esta migración la alinea con el patrón estándar del resto
-- de tablas del holding.
--
-- Idempotente: se puede ejecutar varias veces sin error.

ALTER TABLE public.proyecto_escenarios_financieros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon and authenticated" ON public.proyecto_escenarios_financieros;

CREATE POLICY "anon and authenticated" ON public.proyecto_escenarios_financieros
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Verificación:
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'proyecto_escenarios_financieros';
--   → debe devolver true
