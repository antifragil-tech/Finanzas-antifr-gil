-- ============================================================
-- Análisis de explotación — valor de continuidad / terminal (opcional)
-- ============================================================
-- Amplía proyecto_analisis_financiero con campos para el valor terminal
-- del análisis de negocio operativo (Fase 4.2). Opcional y desactivado por
-- defecto: si no se aplica, el VAN/TIR van sin valor residual (conservador).
--   · aplicar_valor_terminal: activa el cálculo del valor de continuidad.
--   · metodo_valor_terminal: 'manual' | 'multiplo_ebitda'.
--   · valor_terminal_manual: valor esperado del negocio al final del horizonte.
--   · multiplo_ebitda_salida: EBITDA del último año × este múltiplo.
-- El horizonte reutiliza horizonte_analisis_anios, el crecimiento
-- tasa_crecimiento_anual_pct y la fiscalidad impuesto_sociedades_pct.
-- Todos los campos son aditivos y opcionales (no rompen datos previos).

ALTER TABLE public.proyecto_analisis_financiero
  ADD COLUMN IF NOT EXISTS aplicar_valor_terminal  BOOLEAN,
  ADD COLUMN IF NOT EXISTS metodo_valor_terminal   TEXT,
  ADD COLUMN IF NOT EXISTS valor_terminal_manual   NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS multiplo_ebitda_salida  NUMERIC(7,2);

-- ── QUERY DE VALIDACIÓN ──────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'proyecto_analisis_financiero'
--   AND column_name IN ('aplicar_valor_terminal','metodo_valor_terminal',
--     'valor_terminal_manual','multiplo_ebitda_salida');
-- Esperado: 4 filas
