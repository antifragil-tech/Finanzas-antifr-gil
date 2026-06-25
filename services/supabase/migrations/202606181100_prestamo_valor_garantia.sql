-- ============================================================
-- Análisis de préstamo / inversión financiera — valor de garantía
-- ============================================================
-- Añade el valor cuantificado de la garantía para calcular la cobertura
-- (valor_garantia / capital prestado) en el análisis del instrumento
-- (Fase 4.3). Aditivo y opcional (nullable): si no hay valor, no se
-- calcula cobertura numérica y la UI muestra un aviso. No rompe proyectos
-- previos.

ALTER TABLE public.proyecto_analisis_financiero
  ADD COLUMN IF NOT EXISTS valor_garantia NUMERIC(14,2);

-- ── QUERY DE VALIDACIÓN ──────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'proyecto_analisis_financiero' AND column_name = 'valor_garantia';
-- Esperado: 1 fila
