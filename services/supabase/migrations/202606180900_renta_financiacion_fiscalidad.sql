-- ============================================================
-- Análisis de renta — financiación detallada + fiscalidad opcional
-- ============================================================
-- Amplía proyecto_analisis_financiero con campos para el análisis
-- ejecutivo de renta patrimonial (Fase 1):
--   · Financiación: tipo de interés, plazo restante y sistema de
--     amortización de la deuda → permiten estimar intereses,
--     amortización, deuda a salida, DSCR, LTV, TIR y VAN más fiables.
--   · Fiscalidad opcional: si se activa, los análisis se calculan
--     después de impuestos (IS, amortización fiscal, costes y
--     plusvalía de la venta). Si no, el análisis es antes de impuestos.
-- Todos los campos son aditivos y opcionales (no rompen datos previos).
-- El tipo de IS reutiliza la columna existente impuesto_sociedades_pct.

ALTER TABLE public.proyecto_analisis_financiero
  -- Financiación detallada de renta
  ADD COLUMN IF NOT EXISTS tipo_interes_deuda_pct      NUMERIC(7,4),
  ADD COLUMN IF NOT EXISTS plazo_restante_anios        NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS sistema_amortizacion_deuda  TEXT,
  -- Fiscalidad opcional de renta
  ADD COLUMN IF NOT EXISTS aplicar_fiscalidad          BOOLEAN,
  ADD COLUMN IF NOT EXISTS amortizacion_fiscal_anual   NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS costes_venta_pct            NUMERIC(7,4),
  ADD COLUMN IF NOT EXISTS impuesto_plusvalia_pct      NUMERIC(7,4);

-- Valores válidos para sistema_amortizacion_deuda:
--   'frances'  → cuota constante (amortización + intereses)
--   'bullet'   → interest-only; principal íntegro a vencimiento
--   'manual'   → se usa la cuota mensual introducida directamente

-- ── QUERY DE VALIDACIÓN ──────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'proyecto_analisis_financiero'
--   AND column_name IN (
--     'tipo_interes_deuda_pct','plazo_restante_anios','sistema_amortizacion_deuda',
--     'aplicar_fiscalidad','amortizacion_fiscal_anual','costes_venta_pct','impuesto_plusvalia_pct');
-- Esperado: 7 filas
