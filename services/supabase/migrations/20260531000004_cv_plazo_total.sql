-- ============================================================
-- Duración de la operación para tipo compra_venta
-- ============================================================
-- Permite calcular TIR sin depender de las fechas del proyecto.
-- Prioridad en calcKpisCV:
--   1. fecha_inicio_operacion + fecha_salida_prevista (del análisis)
--   2. fecha_inicio + fecha_prevista_salida (del proyecto)
--   3. plazo_total_operacion_meses / 12
--   4. plazo_ejecucion_obra_meses / 12 (fallback, muestra aviso en UI)

ALTER TABLE public.proyecto_analisis_financiero
  ADD COLUMN IF NOT EXISTS fecha_inicio_operacion      DATE,
  ADD COLUMN IF NOT EXISTS fecha_salida_prevista       DATE,
  ADD COLUMN IF NOT EXISTS plazo_total_operacion_meses INT;

-- Distinción con el campo ya existente plazo_ejecucion_obra_meses:
--   plazo_ejecucion_obra_meses   = duración solo de la fase constructiva
--   plazo_total_operacion_meses  = duración total desde entrada hasta desinversión

-- ── QUERIES DE VALIDACIÓN ────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'proyecto_analisis_financiero'
--   AND column_name IN ('fecha_inicio_operacion','fecha_salida_prevista','plazo_total_operacion_meses');
-- Esperado: 3 filas
