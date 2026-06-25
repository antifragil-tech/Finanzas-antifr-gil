-- ============================================================
-- Impuesto de sociedades configurable para tipo compra_venta
-- ============================================================
-- Permite al usuario introducir el tipo de IS del proyecto.
-- Por defecto 26% (tipo general en España 2024-2025).
-- La app usa este valor para calcular beneficio neto y TIR neta.

ALTER TABLE public.proyecto_analisis_financiero
  ADD COLUMN IF NOT EXISTS impuesto_sociedades_pct NUMERIC(5,2);

-- Si no hay valor, el cliente usa 26 como default en el cálculo.

-- ── QUERY DE VALIDACIÓN ──────────────────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'proyecto_analisis_financiero'
--   AND column_name = 'impuesto_sociedades_pct';
-- Esperado: 1 fila
