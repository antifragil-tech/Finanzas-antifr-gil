-- ============================================================
-- Vista cashflow_consolidado
-- Unifica flujos de proyectos (facturas, presupuestos, manuales)
-- + vencimientos distribuidos por sociedad según porcentaje.
-- Permite ver el cashflow real y forward por sociedad de forma
-- completa, sin tener que cruzar dos vistas distintas.
-- ============================================================

CREATE OR REPLACE VIEW public.cashflow_consolidado AS

-- ── Fuente 1: flujos de proyectos ────────────────────────────────────────────
-- Facturas recibidas, presupuesto_pagos y flujos_caja_proyectos
SELECT
  proyecto_id_ref,
  sociedad_id_ref,
  fecha,
  importe,
  tipo_flujo,
  concepto,
  fuente::text,
  estado,
  es_real,
  es_previsto
FROM public.flujos_proyecto_consolidados

UNION ALL

-- ── Fuente 2: vencimientos distribuidos por sociedad ─────────────────────────
-- Cada vencimiento aparece una vez por sociedad, con el importe
-- escalado al porcentaje de participación de esa sociedad.
-- Si un vencimiento tiene 50% Javier / 50% Iván, cada uno verá
-- la mitad del importe al filtrar por su sociedad.
SELECT
  NULL                                              AS proyecto_id_ref,
  vs.sociedad_id                                    AS sociedad_id_ref,
  v.fecha_vencimiento                               AS fecha,
  ROUND(
    v.importe * vs.porcentaje / 100.0
    * CASE WHEN v.es_entrada THEN 1 ELSE -1 END,
    2
  )                                                 AS importe,
  CASE WHEN v.es_entrada THEN 'ingreso' ELSE 'gasto' END AS tipo_flujo,
  v.titulo                                          AS concepto,
  'vencimiento'                                     AS fuente,
  v.estado::text                                    AS estado,
  (v.estado = 'gestionado')                         AS es_real,
  (v.estado != 'gestionado')                        AS es_previsto
FROM public.vencimientos v
JOIN public.vencimiento_sociedades vs ON vs.vencimiento_id = v.id
WHERE v.importe IS NOT NULL
  AND v.importe > 0;

-- ── QUERIES DE VALIDACIÓN ────────────────────────────────────────────────────
-- Ver todo el cashflow de Javier:
--   SELECT fecha, concepto, importe, fuente, es_real
--   FROM cashflow_consolidado
--   WHERE sociedad_id_ref = '1'
--   ORDER BY fecha DESC
--   LIMIT 20;
--
-- Totales por fuente:
--   SELECT fuente, SUM(importe) FROM cashflow_consolidado GROUP BY fuente;
