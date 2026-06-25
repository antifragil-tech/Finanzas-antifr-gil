-- ============================================================
-- flujos_proyecto_consolidados: corrección sociedad en presupuestos
--
-- Problema: presupuesto_pagos tomaba sociedad_id_ref del presupuesto,
-- que suele ser NULL. La sociedad correcta viene del proyecto asociado
-- (proyectos.sociedad_tenedora).
--
-- Cambios:
-- 1. COALESCE(pr.sociedad_id_ref, proy.sociedad_tenedora) para que la
--    sociedad siempre esté informada cuando hay proyecto.
-- 2. es_previsto incluye los nuevos estados de necesidades de tesorería
--    (estimado, confirmado, facturado).
-- 3. Excluye filas con fecha NULL (sin_fecha) — no tienen posición en
--    la línea temporal; se gestionan en la vista de partidas.
-- ============================================================

CREATE OR REPLACE VIEW public.flujos_proyecto_consolidados AS

-- 1. Flujos manuales explícitos
SELECT
  f.proyecto_id         AS proyecto_id_ref,
  f.fecha,
  f.importe,
  f.tipo_flujo,
  f.concepto,
  'flujo_manual'::TEXT  AS fuente,
  NULL::TEXT            AS sociedad_id_ref,
  NULL::UUID            AS factura_id,
  NULL::UUID            AS presupuesto_pago_id,
  NULL::TEXT            AS estado,
  TRUE                  AS es_real,
  FALSE                 AS es_previsto
FROM public.flujos_caja_proyectos f

UNION ALL

-- 2. Pagos de presupuesto vinculados a proyectos
--    sociedad: del presupuesto si existe, si no del proyecto asociado
SELECT
  pr.proyecto_id_ref,
  COALESCE(pp.fecha_real_pago, pp.fecha_prevista)             AS fecha,
  CASE pp.tipo_flujo
    WHEN 'gasto'   THEN -ABS(pp.importe)
    ELSE                 ABS(pp.importe)
  END                                                         AS importe,
  pp.tipo_flujo,
  pp.descripcion                                              AS concepto,
  'presupuesto_pago'::TEXT                                    AS fuente,
  COALESCE(pr.sociedad_id_ref, proy.sociedad_tenedora)        AS sociedad_id_ref,
  pp.factura_recibida_id::UUID                                AS factura_id,
  pp.id                                                       AS presupuesto_pago_id,
  pp.estado,
  (pp.estado = 'pagado')                                      AS es_real,
  (pp.estado IN (
    'pendiente','estimado','confirmado','facturado'
  ))                                                          AS es_previsto
FROM public.presupuesto_pagos pp
JOIN public.presupuestos pr   ON pr.id       = pp.presupuesto_id
LEFT JOIN public.proyectos proy ON proy.id_ref = pr.proyecto_id_ref
WHERE pr.proyecto_id_ref IS NOT NULL
  -- Excluir necesidades sin fecha del timeline (se gestionan en la vista
  -- de partidas como "sin calendarizar")
  AND (pp.fecha_prevista IS NOT NULL OR pp.fecha_real_pago IS NOT NULL)

UNION ALL

-- 3. Facturas recibidas vinculadas a proyectos (sin presupuesto_pago)
SELECT
  fr.proyecto_id_ref,
  COALESCE(fr.fecha_vencimiento, fr.fecha_factura)            AS fecha,
  -ABS(fr.total)                                              AS importe,
  'gasto'::TEXT                                               AS tipo_flujo,
  COALESCE(fr.concepto, fr.proveedor_nombre)                  AS concepto,
  'factura_recibida'::TEXT                                    AS fuente,
  fr.sociedad_id_ref,
  fr.id                                                       AS factura_id,
  fr.presupuesto_pago_id,
  fr.estado,
  (fr.estado = 'pagada')                                      AS es_real,
  (fr.estado IN ('pendiente_pago','revision_javi'))            AS es_previsto
FROM public.facturas_recibidas fr
WHERE fr.proyecto_id_ref IS NOT NULL
  AND fr.presupuesto_pago_id IS NULL;

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────
-- Comprobar que presupuesto_pagos tienen sociedad:
--   SELECT fuente, sociedad_id_ref, COUNT(*)
--   FROM flujos_proyecto_consolidados
--   WHERE fuente = 'presupuesto_pago'
--   GROUP BY fuente, sociedad_id_ref;
--
-- Verificar que cashflow_consolidado hereda los cambios:
--   SELECT fuente, sociedad_id_ref, COUNT(*)
--   FROM cashflow_consolidado
--   GROUP BY fuente, sociedad_id_ref
--   ORDER BY fuente;
