-- ============================================================
-- Horizonte de análisis para tipo renta — Fase operativa
-- ============================================================
-- Añade campos para calcular TIR sin necesidad de fecha de venta real.
-- La TIR se calcula sobre un horizonte teórico con valor residual estimado.

ALTER TABLE public.proyecto_analisis_financiero
  ADD COLUMN IF NOT EXISTS horizonte_analisis_anios   INT,
  ADD COLUMN IF NOT EXISTS valor_residual_estimado    NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS metodo_valor_residual      TEXT,
  ADD COLUMN IF NOT EXISTS fecha_inicio_explotacion   DATE;

-- Valores válidos para metodo_valor_residual:
--   'manual'           → usuario introduce valor_residual_estimado directamente
--   'valor_actual'     → usa valoracion_actual (default)
--   'crecimiento_anual'→ valoracion_actual × (1 + tasa_crecimiento_anual_pct/100)^horizonte
--   'cap_rate_salida'  → NOI / (cap_rate_salida_pct/100)

-- ── QUERIES DE VALIDACIÓN ────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'proyecto_analisis_financiero'
--   AND column_name IN ('horizonte_analisis_anios','valor_residual_estimado','metodo_valor_residual','fecha_inicio_explotacion');
-- Esperado: 4 filas
