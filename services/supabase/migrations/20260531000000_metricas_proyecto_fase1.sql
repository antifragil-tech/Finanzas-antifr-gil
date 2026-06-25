-- ============================================================
-- Métricas por Proyecto — Fase 1: Arquitectura de datos
-- ============================================================
-- 1. Ampliar tipo_analisis a 6 tipos
-- 2. Añadir columnas para tipos nuevos
-- 3. FK formal facturas_recibidas → proyectos
-- 4. Vista flujos_proyecto_consolidados
-- 5. Vista metricas_proyecto_resumen
-- ============================================================

-- ── 1. Ampliar CHECK constraint tipo_analisis ─────────────────────────────────

ALTER TABLE public.proyecto_analisis_financiero
  DROP CONSTRAINT IF EXISTS proyecto_analisis_financiero_tipo_analisis_check;

ALTER TABLE public.proyecto_analisis_financiero
  ADD CONSTRAINT proyecto_analisis_financiero_tipo_analisis_check
  CHECK (tipo_analisis IN ('compra_venta','renta','alternativo','explotacion','prestamo','capex_interno'));

-- ── 2. Columnas para tipo "explotacion" ──────────────────────────────────────

ALTER TABLE public.proyecto_analisis_financiero
  ADD COLUMN IF NOT EXISTS ingresos_anuales_previstos       NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS costes_variables_pct             NUMERIC(7,4),
  ADD COLUMN IF NOT EXISTS costes_fijos_anuales             NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS ebitda_objetivo_anual            NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS capex_mantenimiento_anual        NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS inversion_circulante             NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS tasa_crecimiento_anual_pct       NUMERIC(7,4),
  ADD COLUMN IF NOT EXISTS anio_break_even_previsto         INT;

-- ── 3. Columnas para tipo "prestamo" / inversión financiera ──────────────────

ALTER TABLE public.proyecto_analisis_financiero
  ADD COLUMN IF NOT EXISTS tipo_instrumento                 TEXT,
  ADD COLUMN IF NOT EXISTS nominal_prestamo                 NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS tipo_interes_pct                 NUMERIC(7,4),
  ADD COLUMN IF NOT EXISTS plazo_meses                      INT,
  ADD COLUMN IF NOT EXISTS sistema_amortizacion             TEXT,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_instrumento    DATE,
  ADD COLUMN IF NOT EXISTS colateral                        TEXT,
  ADD COLUMN IF NOT EXISTS rating_interno                   TEXT,
  ADD COLUMN IF NOT EXISTS probabilidad_impago_pct          NUMERIC(7,4),
  ADD COLUMN IF NOT EXISTS lgd_pct                          NUMERIC(7,4);

-- ── 4. Columnas para tipo "capex_interno" ────────────────────────────────────

ALTER TABLE public.proyecto_analisis_financiero
  ADD COLUMN IF NOT EXISTS beneficio_esperado_anual         NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS vida_util_activo_anios           INT,
  ADD COLUMN IF NOT EXISTS valor_residual_pct               NUMERIC(7,4),
  ADD COLUMN IF NOT EXISTS depreciacion_tipo                TEXT,
  ADD COLUMN IF NOT EXISTS tasa_descuento_interna           NUMERIC(7,4);

-- ── 5. Columnas adicionales para tipo "renta" ────────────────────────────────

ALTER TABLE public.proyecto_analisis_financiero
  ADD COLUMN IF NOT EXISTS tasa_ocupacion_prevista_pct      NUMERIC(7,4),
  ADD COLUMN IF NOT EXISTS superficie_arrendable_m2         NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS renta_por_m2                     NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS cap_rate_salida_pct              NUMERIC(7,4),
  ADD COLUMN IF NOT EXISTS ibi_anual                        NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS seguro_anual                     NUMERIC(14,2);

-- ── 6. Columnas adicionales para tipo "compra_venta" ─────────────────────────

ALTER TABLE public.proyecto_analisis_financiero
  ADD COLUMN IF NOT EXISTS precio_compra_escritura          NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS gastos_financiacion_notarial     NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS iva_soportado_obra               NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS precio_venta_reservado           NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS anticipo_comprador               NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS comision_agente_pct              NUMERIC(7,4),
  ADD COLUMN IF NOT EXISTS plazo_ejecucion_obra_meses       INT,
  ADD COLUMN IF NOT EXISTS contingencia_obra_pct            NUMERIC(7,4);

-- ── 7. FK formal facturas_recibidas → proyectos ──────────────────────────────

-- Diagnosticar y limpiar huérfanos antes de crear FK
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.facturas_recibidas f
  WHERE f.proyecto_id_ref IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.proyectos p WHERE p.id_ref = f.proyecto_id_ref);
  IF v_count > 0 THEN
    RAISE NOTICE 'ADVERTENCIA: % facturas con proyecto_id_ref huérfano. Limpiando antes de crear FK.', v_count;
    UPDATE public.facturas_recibidas SET proyecto_id_ref = NULL
    WHERE proyecto_id_ref IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.proyectos p WHERE p.id_ref = facturas_recibidas.proyecto_id_ref);
  END IF;
END $$;

-- Crear FK (solo si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_facturas_recibidas_proyecto'
      AND table_name = 'facturas_recibidas'
  ) THEN
    ALTER TABLE public.facturas_recibidas
      ADD CONSTRAINT fk_facturas_recibidas_proyecto
      FOREIGN KEY (proyecto_id_ref) REFERENCES public.proyectos(id_ref) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_facturas_recibidas_proyecto
  ON public.facturas_recibidas(proyecto_id_ref) WHERE proyecto_id_ref IS NOT NULL;

-- ── 8. Vista flujos_proyecto_consolidados ────────────────────────────────────
-- Consolida 3 fuentes de gasto/ingreso por proyecto:
--   (a) flujos_caja_proyectos   → flujos manuales explícitos
--   (b) presupuesto_pagos       → pagos de presupuesto vinculados a proyectos
--   (c) facturas_recibidas      → facturas vinculadas directamente (sin pago presupuesto)
-- Regla anti-doble-conteo: las facturas ya capturadas vía presupuesto_pago se excluyen.

CREATE OR REPLACE VIEW public.flujos_proyecto_consolidados AS

-- 1. Flujos manuales explícitos
SELECT
  f.proyecto_id       AS proyecto_id_ref,
  f.fecha,
  f.importe,
  f.tipo_flujo,
  f.concepto,
  'flujo_manual'::TEXT AS fuente,
  NULL::TEXT           AS sociedad_id_ref,
  NULL::UUID           AS factura_id,
  NULL::UUID           AS presupuesto_pago_id,
  NULL::TEXT           AS estado,
  TRUE                 AS es_real,
  FALSE                AS es_previsto
FROM public.flujos_caja_proyectos f

UNION ALL

-- 2. Pagos de presupuesto vinculados a proyectos
SELECT
  pr.proyecto_id_ref,
  COALESCE(pp.fecha_real_pago, pp.fecha_prevista) AS fecha,
  CASE pp.tipo_flujo WHEN 'gasto' THEN -ABS(pp.importe) ELSE ABS(pp.importe) END AS importe,
  pp.tipo_flujo,
  pp.descripcion AS concepto,
  'presupuesto_pago'::TEXT AS fuente,
  pr.sociedad_id_ref,
  pp.factura_recibida_id::UUID AS factura_id,
  pp.id AS presupuesto_pago_id,
  pp.estado,
  (pp.estado = 'pagado')    AS es_real,
  (pp.estado = 'pendiente') AS es_previsto
FROM public.presupuesto_pagos pp
JOIN public.presupuestos pr ON pr.id = pp.presupuesto_id
WHERE pr.proyecto_id_ref IS NOT NULL

UNION ALL

-- 3. Facturas recibidas vinculadas a proyectos (sin presupuesto_pago — evita doble conteo)
SELECT
  fr.proyecto_id_ref,
  COALESCE(fr.fecha_vencimiento, fr.fecha_factura) AS fecha,
  -ABS(fr.total) AS importe,
  'gasto'::TEXT AS tipo_flujo,
  COALESCE(fr.concepto, fr.proveedor_nombre) AS concepto,
  'factura_recibida'::TEXT AS fuente,
  fr.sociedad_id_ref,
  fr.id AS factura_id,
  fr.presupuesto_pago_id,
  fr.estado,
  (fr.estado = 'pagada') AS es_real,
  (fr.estado IN ('pendiente_pago','revision_javi')) AS es_previsto
FROM public.facturas_recibidas fr
WHERE fr.proyecto_id_ref IS NOT NULL
  AND fr.presupuesto_pago_id IS NULL;

-- ── 9. Vista metricas_proyecto_resumen ───────────────────────────────────────
-- KPIs financieros consolidados por proyecto en una sola query.
-- Calculados sobre las 3 fuentes de flujo y el análisis financiero parametrizado.

CREATE OR REPLACE VIEW public.metricas_proyecto_resumen AS
SELECT
  p.id_ref AS proyecto_id_ref,
  p.sociedad_tenedora AS sociedad_id_ref,
  af.tipo_analisis,

  -- Inversión total proyectada (según tipo de análisis)
  CASE af.tipo_analisis
    WHEN 'compra_venta' THEN
      COALESCE(af.precio_adquisicion,0) + COALESCE(af.gastos_adquisicion,0)
      + COALESCE(af.presupuesto_obra,0) + COALESCE(af.gastos_venta,0)
      + COALESCE(af.coste_financiero_deuda,0)
    WHEN 'renta' THEN
      COALESCE(af.precio_adquisicion,0) + COALESCE(af.gastos_adquisicion,0)
      + COALESCE(af.capex_inicial,0)
    WHEN 'explotacion' THEN
      COALESCE(af.precio_adquisicion,0) + COALESCE(af.inversion_circulante,0)
    WHEN 'prestamo' THEN
      COALESCE(af.nominal_prestamo,0)
    WHEN 'capex_interno' THEN
      COALESCE(af.precio_adquisicion,0)
    ELSE COALESCE(af.precio_adquisicion,0)
  END AS inversion_total_proyectada,

  -- Gasto real acumulado (flujos negativos confirmados)
  (SELECT COALESCE(SUM(ABS(fc.importe)), 0)
   FROM public.flujos_proyecto_consolidados fc
   WHERE fc.proyecto_id_ref = p.id_ref
     AND fc.es_real = TRUE
     AND fc.importe < 0) AS gasto_real_acumulado,

  -- Ingreso real acumulado (flujos positivos confirmados)
  (SELECT COALESCE(SUM(fc.importe), 0)
   FROM public.flujos_proyecto_consolidados fc
   WHERE fc.proyecto_id_ref = p.id_ref
     AND fc.es_real = TRUE
     AND fc.importe > 0) AS ingreso_real_acumulado,

  -- Saldo neto real (ingresos - gastos reales)
  (SELECT COALESCE(SUM(fc.importe), 0)
   FROM public.flujos_proyecto_consolidados fc
   WHERE fc.proyecto_id_ref = p.id_ref
     AND fc.es_real = TRUE) AS saldo_neto_real,

  -- Presupuesto total aprobado (partidas de presupuestos activos/cerrados)
  (SELECT COALESCE(SUM(pp.importe_presupuestado), 0)
   FROM public.presupuesto_partidas pp
   JOIN public.presupuestos pr ON pr.id = pp.presupuesto_id
   WHERE pr.proyecto_id_ref = p.id_ref
     AND pr.estado IN ('activo','cerrado')) AS presupuesto_total_aprobado,

  -- Presupuesto pagado
  (SELECT COALESCE(SUM(pag.importe), 0)
   FROM public.presupuesto_pagos pag
   JOIN public.presupuestos pr ON pr.id = pag.presupuesto_id
   WHERE pr.proyecto_id_ref = p.id_ref
     AND pag.estado = 'pagado'
     AND pag.tipo_flujo = 'gasto') AS presupuesto_pagado,

  -- Presupuesto pendiente de pago
  (SELECT COALESCE(SUM(pag.importe), 0)
   FROM public.presupuesto_pagos pag
   JOIN public.presupuestos pr ON pr.id = pag.presupuesto_id
   WHERE pr.proyecto_id_ref = p.id_ref
     AND pag.estado = 'pendiente'
     AND pag.tipo_flujo = 'gasto') AS presupuesto_pendiente,

  -- Desviación (NULL — no calculable de forma fiable sin presupuesto maestro)
  NULL::NUMERIC AS desviacion_presupuesto_importe,
  NULL::NUMERIC AS desviacion_presupuesto_pct,

  -- Facturas pendientes de pago vinculadas al proyecto
  (SELECT COALESCE(SUM(fr.total), 0)
   FROM public.facturas_recibidas fr
   WHERE fr.proyecto_id_ref = p.id_ref
     AND fr.estado IN ('pendiente_pago','revision_javi')) AS facturas_pendientes_importe,

  -- Facturas ya pagadas vinculadas al proyecto
  (SELECT COALESCE(SUM(fr.total), 0)
   FROM public.facturas_recibidas fr
   WHERE fr.proyecto_id_ref = p.id_ref
     AND fr.estado = 'pagada') AS facturas_pagadas_importe,

  -- Flujos manuales (flujos_caja_proyectos — neto)
  (SELECT COALESCE(SUM(f.importe), 0)
   FROM public.flujos_caja_proyectos f
   WHERE f.proyecto_id = p.id_ref) AS flujos_manuales_importe,

  -- Fecha del último movimiento real
  (SELECT MAX(fc.fecha)
   FROM public.flujos_proyecto_consolidados fc
   WHERE fc.proyecto_id_ref = p.id_ref
     AND fc.es_real = TRUE) AS ultimo_movimiento_fecha

FROM public.proyectos p
LEFT JOIN public.proyecto_analisis_financiero af ON af.proyecto_id = p.id_ref;

-- ── QUERIES DE VALIDACIÓN (ejecutar manualmente en Supabase SQL editor) ──────
-- 1. Flujos consolidados por proyecto:
--    SELECT * FROM flujos_proyecto_consolidados WHERE proyecto_id_ref = 'P-XXX' ORDER BY fecha;
-- 2. Facturas huérfanas (sin proyecto válido):
--    SELECT id, proyecto_id_ref, proveedor_nombre FROM facturas_recibidas WHERE proyecto_id_ref IS NOT NULL AND NOT EXISTS (SELECT 1 FROM proyectos WHERE id_ref = facturas_recibidas.proyecto_id_ref);
-- 3. Comparar gasto real por fuente:
--    SELECT fuente, COUNT(*), SUM(ABS(importe)) FROM flujos_proyecto_consolidados WHERE proyecto_id_ref = 'P-XXX' AND es_real GROUP BY fuente;
-- 4. Resumen de métricas por proyecto:
--    SELECT * FROM metricas_proyecto_resumen;
