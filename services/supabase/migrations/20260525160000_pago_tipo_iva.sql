-- ============================================================
-- IVA en pagos presupuestados
-- El importe en presupuesto_pagos siempre es base imponible.
-- tipo_iva permite calcular el total real de caja para tesorería.
-- ============================================================

ALTER TABLE public.presupuesto_pagos
  ADD COLUMN IF NOT EXISTS tipo_iva NUMERIC(4,1) NOT NULL DEFAULT 0
    CHECK (tipo_iva IN (0, 4, 10, 21));

-- Actualizar compromisos_tesoreria para que el importe de los pagos
-- presupuestados refleje el total de caja (base + IVA).
-- Vencimientos y facturas ya manejan su propio IVA en sus tablas.
CREATE OR REPLACE VIEW public.compromisos_tesoreria AS
-- Pagos de presupuestos planificados (no contingentes)
SELECT
  pr.sociedad_id_ref                                                            AS sociedad_id_ref,
  pp.fecha_prevista                                                             AS fecha,
  CASE
    WHEN pp.tipo_flujo = 'gasto'
      THEN -(pp.importe * (1 + COALESCE(pp.tipo_iva, 0) / 100))
      ELSE   pp.importe * (1 + COALESCE(pp.tipo_iva, 0) / 100)
  END                                                                           AS importe,
  pp.tipo_flujo,
  pp.descripcion                                                                AS concepto,
  'presupuesto'                                                                 AS origen,
  pp.contingente,
  pr.proyecto_nombre                                                            AS proyecto_nombre,
  pp.id                                                                         AS origen_id
FROM public.presupuesto_pagos pp
JOIN public.presupuestos pr ON pr.id = pp.presupuesto_id
WHERE pp.estado = 'pendiente'
  AND pp.fecha_prevista >= CURRENT_DATE

UNION ALL

-- Vencimientos recurrentes con importe
SELECT
  sociedad_id_ref,
  fecha_vencimiento                                         AS fecha,
  -importe                                                  AS importe,
  'gasto'                                                   AS tipo_flujo,
  titulo                                                    AS concepto,
  'vencimiento'                                             AS origen,
  false                                                     AS contingente,
  NULL                                                      AS proyecto_nombre,
  id                                                        AS origen_id
FROM public.vencimientos
WHERE estado = 'pendiente'
  AND importe IS NOT NULL
  AND fecha_vencimiento >= CURRENT_DATE

UNION ALL

-- Facturas recibidas pendientes de pago sin presupuesto asignado
SELECT
  sociedad_id_ref,
  COALESCE(fecha_vencimiento, (created_at::date + interval '30 days')::date)   AS fecha,
  -total_a_pagar                                            AS importe,
  'gasto'                                                   AS tipo_flujo,
  COALESCE(proveedor_nombre, 'Factura pendiente')           AS concepto,
  'factura'                                                 AS origen,
  false                                                     AS contingente,
  NULL                                                      AS proyecto_nombre,
  id                                                        AS origen_id
FROM public.facturas_recibidas
WHERE estado = 'pendiente_pago'
  AND presupuesto_pago_id IS NULL;
