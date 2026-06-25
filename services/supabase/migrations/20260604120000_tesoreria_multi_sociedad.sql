-- ─────────────────────────────────────────────────────────────────────────────
-- Tesorería multi-sociedad — corrección de bugs y soporte completo
--
-- BUGS CORREGIDOS:
--   1. La rama vencimientos del view referenciaba sociedad_id_ref pero la
--      columna real de la tabla es sociedad_id (nunca se añadió _ref).
--   2. La rama presupuesto_pagos usaba pr.sociedad_id_ref directamente; cuando
--      el presupuesto pertenece a un proyecto la sociedad debe derivarse de
--      proyectos.sociedad_tenedora si sociedad_id_ref es NULL.
--   3. es_entrada en vencimientos no se respetaba (siempre se negaba el importe
--      aunque el vencimiento sea una entrada de caja).
--   4. La fecha de corte (>= CURRENT_DATE) en vencimientos ocultaba vencidos
--      pendientes, que deben aparecer como alerta.
--
-- CAMPOS NUEVOS EN LA VISTA:
--   · es_entrada  BOOLEAN  — true = flujo positivo (cobro), false = salida
--   · estado      TEXT     — estado del ítem origen (para filtros UI)
--   · fuente      TEXT     — mismo que 'origen', renombrado para legibilidad
--                            (alias; origen sigue existiendo)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.compromisos_tesoreria AS

-- ── A. Pagos de presupuestos (pendientes, incluyendo vencidos) ────────────────
SELECT
  -- Bug 2 fix: derivar sociedad del proyecto si el presupuesto no la tiene
  COALESCE(pr.sociedad_id_ref, proy.sociedad_tenedora)                AS sociedad_id_ref,
  pp.fecha_prevista                                                   AS fecha,
  CASE WHEN pp.tipo_flujo = 'ingreso' THEN pp.importe
                                       ELSE -pp.importe END           AS importe,
  pp.tipo_flujo,
  COALESCE(pp.descripcion, pa.descripcion)                            AS concepto,
  'presupuesto'::text                                                 AS origen,
  'presupuesto'::text                                                 AS fuente,
  pp.contingente,
  pr.proyecto_nombre                                                  AS proyecto_nombre,
  pp.id                                                               AS origen_id,
  pp.estado                                                           AS estado,
  (pp.tipo_flujo = 'ingreso')                                         AS es_entrada,
  pr.id                                                               AS presupuesto_id,
  pp.partida_id                                                       AS partida_id,
  pp.factura_recibida_id                                              AS factura_id,
  NULL::uuid                                                          AS vencimiento_id
FROM public.presupuesto_pagos pp
JOIN public.presupuestos pr      ON pr.id       = pp.presupuesto_id
JOIN public.presupuesto_partidas pa ON pa.id    = pp.partida_id
LEFT JOIN public.proyectos proy  ON proy.id_ref = pr.proyecto_id_ref
WHERE pp.estado = 'pendiente'

UNION ALL

-- ── B. Vencimientos (todos los pendientes, incluidos los ya vencidos) ─────────
SELECT
  -- Bug 1 fix: columna es sociedad_id, no sociedad_id_ref
  v.sociedad_id                                                       AS sociedad_id_ref,
  v.fecha_vencimiento                                                 AS fecha,
  -- Bug 3 fix: respetar es_entrada en vez de negar siempre
  CASE WHEN v.es_entrada THEN v.importe ELSE -v.importe END           AS importe,
  CASE WHEN v.es_entrada THEN 'ingreso' ELSE 'gasto' END              AS tipo_flujo,
  v.titulo                                                            AS concepto,
  'vencimiento'::text                                                 AS origen,
  'vencimiento'::text                                                 AS fuente,
  false                                                               AS contingente,
  NULL::text                                                          AS proyecto_nombre,
  v.id                                                                AS origen_id,
  v.estado                                                            AS estado,
  v.es_entrada                                                        AS es_entrada,
  NULL::uuid                                                          AS presupuesto_id,
  NULL::uuid                                                          AS partida_id,
  NULL::uuid                                                          AS factura_id,
  v.id                                                                AS vencimiento_id
FROM public.vencimientos v
WHERE v.estado = 'pendiente'
  AND v.importe IS NOT NULL
  -- Bug 4 fix: eliminado filtro fecha >= CURRENT_DATE para mostrar vencidos

UNION ALL

-- ── C. Facturas pendientes sin presupuesto asignado (sin doble conteo) ────────
SELECT
  f.sociedad_id_ref                                                   AS sociedad_id_ref,
  COALESCE(
    f.fecha_vencimiento,
    (f.created_at::date + interval '30 days')::date
  )                                                                   AS fecha,
  -f.total_a_pagar                                                    AS importe,
  'gasto'::text                                                       AS tipo_flujo,
  COALESCE(f.proveedor_nombre, 'Factura pendiente')                   AS concepto,
  'factura'::text                                                     AS origen,
  'factura'::text                                                     AS fuente,
  false                                                               AS contingente,
  NULL::text                                                          AS proyecto_nombre,
  f.id                                                                AS origen_id,
  f.estado                                                            AS estado,
  false                                                               AS es_entrada,
  NULL::uuid                                                          AS presupuesto_id,
  NULL::uuid                                                          AS partida_id,
  f.id                                                                AS factura_id,
  NULL::uuid                                                          AS vencimiento_id
FROM public.facturas_recibidas f
WHERE f.estado = 'pendiente_pago'
  AND f.presupuesto_pago_id IS NULL;  -- doble conteo: si ya está en presupuesto_pagos, no contar aquí

COMMENT ON VIEW public.compromisos_tesoreria IS
'Vista consolidada de compromisos de tesorería: presupuesto_pagos + vencimientos + facturas.
Evita doble conteo: facturas vinculadas a presupuesto_pago_id quedan excluidas de la rama C.
La sociedad se deriva del proyecto cuando presupuesto.sociedad_id_ref es NULL.
es_entrada=true → flujo positivo (cobro/ingreso). es_entrada=false → salida.
Los vencidos (fecha < hoy) se incluyen para que la UI los muestre como alertas.';
