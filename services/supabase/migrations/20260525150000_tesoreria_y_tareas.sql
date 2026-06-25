-- ============================================================
-- Tesorería y panel de tareas
-- ============================================================

-- 1. Campo contingente en presupuesto_pagos
--    Earn-outs y liberaciones condicionadas: no se incluyen
--    en el cálculo de saldo previsto hasta que estén confirmadas.
ALTER TABLE public.presupuesto_pagos
  ADD COLUMN IF NOT EXISTS contingente      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notas_condicion  TEXT;

-- 2. Tabla vencimientos (obligaciones recurrentes: seguros, deuda, contratos)
CREATE TABLE IF NOT EXISTS public.vencimientos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id_ref TEXT NOT NULL REFERENCES public.sociedades(id_ref) ON DELETE CASCADE,
  titulo          TEXT NOT NULL,
  descripcion     TEXT,
  importe         NUMERIC(14,2),
  fecha_vencimiento DATE NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','pagado','cancelado')),
  recurrente      BOOLEAN NOT NULL DEFAULT false,
  periodicidad    TEXT CHECK (periodicidad IN ('mensual','trimestral','anual','unico')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vencimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access on vencimientos"
  ON public.vencimientos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS vencimientos_sociedad_idx        ON public.vencimientos(sociedad_id_ref);
CREATE INDEX IF NOT EXISTS vencimientos_fecha_idx           ON public.vencimientos(fecha_vencimiento);

-- 3. Vista: saldo bancario actual por sociedad
--    Suma neta de todos los movimientos importados.
--    IMPORTANTE: refleja la posición desde el primer movimiento importado,
--    no desde fecha 0. Mostrar siempre la fecha del último movimiento en la UI.
CREATE OR REPLACE VIEW public.saldo_bancario_por_sociedad AS
SELECT
  sociedad_id_ref,
  COALESCE(SUM(importe), 0)                   AS saldo_actual,
  COUNT(*)                                    AS num_movimientos,
  MAX(fecha)                                  AS ultimo_movimiento
FROM public.movimientos_bancarios
GROUP BY sociedad_id_ref;

-- 4. Vista: compromisos de tesorería futuros (todas las fuentes)
--    Consolida presupuesto_pagos + vencimientos + facturas_recibidas pendientes
--    en una única vista ordenada por fecha para la línea temporal.
CREATE OR REPLACE VIEW public.compromisos_tesoreria AS
-- Pagos de presupuestos planificados (no contingentes)
SELECT
  pr.sociedad_id_ref                                        AS sociedad_id_ref,
  pp.fecha_prevista                                         AS fecha,
  CASE WHEN pp.tipo_flujo = 'gasto' THEN -pp.importe ELSE pp.importe END AS importe,
  pp.tipo_flujo,
  pp.descripcion                                            AS concepto,
  'presupuesto'                                             AS origen,
  pp.contingente,
  pr.proyecto_nombre                                        AS proyecto_nombre,
  pp.id                                                     AS origen_id
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
  COALESCE(fecha_vencimiento, (created_at::date + interval '30 days')::date) AS fecha,
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
