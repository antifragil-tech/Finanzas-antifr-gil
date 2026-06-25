-- ============================================================
-- Análisis alternativo — nivel de riesgo y liquidez (cualitativos)
-- ============================================================
-- Añade dos campos cualitativos simples para el análisis de inversiones
-- alternativas (Fase 4.5). Modulan el veredicto y la calidad del dato.
-- Aditivos y opcionales (nullable): si no se informan, la UI muestra
-- "No informado", baja la calidad del dato y el veredicto es más prudente.
-- No rompe proyectos previos. No es un modelo de riesgo complejo.
--   · nivel_riesgo:   'bajo' | 'medio' | 'alto'
--   · nivel_liquidez: 'alta' | 'media' | 'baja'

ALTER TABLE public.proyecto_analisis_financiero
  ADD COLUMN IF NOT EXISTS nivel_riesgo   TEXT,
  ADD COLUMN IF NOT EXISTS nivel_liquidez TEXT;

-- ── QUERY DE VALIDACIÓN ──────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'proyecto_analisis_financiero'
--   AND column_name IN ('nivel_riesgo','nivel_liquidez');
-- Esperado: 2 filas
