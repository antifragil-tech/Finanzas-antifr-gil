-- ============================================================
-- Escenarios financieros por proyecto — Fase 3A
-- ============================================================
-- 1. Crear tabla proyecto_escenarios_financieros
-- 2. Actualizar vista metricas_proyecto_resumen para presupuesto maestro
-- ============================================================

-- ── 1. Tabla de escenarios ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.proyecto_escenarios_financieros (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id_ref TEXT         NOT NULL REFERENCES public.proyectos(id_ref) ON DELETE CASCADE,
  tipo_analisis   TEXT         NOT NULL,
  nombre          TEXT         NOT NULL,
  escenario       TEXT         NOT NULL CHECK (escenario IN ('conservador', 'base', 'optimista')),
  parametros      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  resultado       JSONB        NOT NULL DEFAULT '{}'::jsonb,
  es_activo       BOOLEAN      DEFAULT false,
  created_at      TIMESTAMPTZ  DEFAULT now(),
  updated_at      TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proyecto_escenarios_proyecto
  ON public.proyecto_escenarios_financieros(proyecto_id_ref);

-- Un solo escenario de cada tipo por proyecto y tipo_analisis
CREATE UNIQUE INDEX IF NOT EXISTS uniq_escenario_tipo_por_proyecto
  ON public.proyecto_escenarios_financieros(proyecto_id_ref, tipo_analisis, escenario);

-- ── 2. Vista metricas_proyecto_resumen actualizada con presupuesto maestro ──

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

  -- Saldo neto real
  (SELECT COALESCE(SUM(fc.importe), 0)
   FROM public.flujos_proyecto_consolidados fc
   WHERE fc.proyecto_id_ref = p.id_ref
     AND fc.es_real = TRUE) AS saldo_neto_real,

  -- Presupuesto total aprobado (solo del presupuesto maestro)
  (SELECT COALESCE(SUM(pp.importe_presupuestado), 0)
   FROM public.presupuesto_partidas pp
   JOIN public.presupuestos pr ON pr.id = pp.presupuesto_id
   WHERE pr.proyecto_id_ref = p.id_ref
     AND pr.es_presupuesto_maestro = true) AS presupuesto_total_aprobado,

  -- Presupuesto pagado (pagos del presupuesto maestro)
  (SELECT COALESCE(SUM(pag.importe), 0)
   FROM public.presupuesto_pagos pag
   JOIN public.presupuestos pr ON pr.id = pag.presupuesto_id
   WHERE pr.proyecto_id_ref = p.id_ref
     AND pr.es_presupuesto_maestro = true
     AND pag.estado = 'pagado'
     AND pag.tipo_flujo = 'gasto') AS presupuesto_pagado,

  -- Presupuesto pendiente (del presupuesto maestro)
  (SELECT COALESCE(SUM(pag.importe), 0)
   FROM public.presupuesto_pagos pag
   JOIN public.presupuestos pr ON pr.id = pag.presupuesto_id
   WHERE pr.proyecto_id_ref = p.id_ref
     AND pr.es_presupuesto_maestro = true
     AND pag.estado = 'pendiente'
     AND pag.tipo_flujo = 'gasto') AS presupuesto_pendiente,

  -- Desviación presupuesto vs real (solo si hay maestro y total > 0)
  CASE
    WHEN (SELECT COUNT(*) FROM public.presupuestos pr
          WHERE pr.proyecto_id_ref = p.id_ref AND pr.es_presupuesto_maestro = true) = 0
    THEN NULL
    WHEN (SELECT COALESCE(SUM(pp.importe_presupuestado), 0)
          FROM public.presupuesto_partidas pp
          JOIN public.presupuestos pr ON pr.id = pp.presupuesto_id
          WHERE pr.proyecto_id_ref = p.id_ref AND pr.es_presupuesto_maestro = true) = 0
    THEN NULL
    ELSE
      (SELECT COALESCE(SUM(ABS(fc.importe)), 0)
       FROM public.flujos_proyecto_consolidados fc
       WHERE fc.proyecto_id_ref = p.id_ref AND fc.es_real = TRUE AND fc.importe < 0)
      -
      (SELECT COALESCE(SUM(pp.importe_presupuestado), 0)
       FROM public.presupuesto_partidas pp
       JOIN public.presupuestos pr ON pr.id = pp.presupuesto_id
       WHERE pr.proyecto_id_ref = p.id_ref AND pr.es_presupuesto_maestro = true)
  END AS desviacion_presupuesto_importe,

  -- Desviación % (desviacion / presupuesto_total_aprobado)
  CASE
    WHEN (SELECT COUNT(*) FROM public.presupuestos pr
          WHERE pr.proyecto_id_ref = p.id_ref AND pr.es_presupuesto_maestro = true) = 0
    THEN NULL
    WHEN (SELECT COALESCE(SUM(pp.importe_presupuestado), 0)
          FROM public.presupuesto_partidas pp
          JOIN public.presupuestos pr ON pr.id = pp.presupuesto_id
          WHERE pr.proyecto_id_ref = p.id_ref AND pr.es_presupuesto_maestro = true) = 0
    THEN NULL
    ELSE
      (
        (SELECT COALESCE(SUM(ABS(fc.importe)), 0)
         FROM public.flujos_proyecto_consolidados fc
         WHERE fc.proyecto_id_ref = p.id_ref AND fc.es_real = TRUE AND fc.importe < 0)
        -
        (SELECT COALESCE(SUM(pp.importe_presupuestado), 0)
         FROM public.presupuesto_partidas pp
         JOIN public.presupuestos pr ON pr.id = pp.presupuesto_id
         WHERE pr.proyecto_id_ref = p.id_ref AND pr.es_presupuesto_maestro = true)
      )
      /
      NULLIF(
        (SELECT SUM(pp.importe_presupuestado)
         FROM public.presupuesto_partidas pp
         JOIN public.presupuestos pr ON pr.id = pp.presupuesto_id
         WHERE pr.proyecto_id_ref = p.id_ref AND pr.es_presupuesto_maestro = true),
        0
      )
  END AS desviacion_presupuesto_pct,

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

  -- Flujos manuales neto
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

-- ── QUERIES DE VALIDACIÓN ────────────────────────────────────────────────────
-- Verificar escenarios de un proyecto:
--   SELECT proyecto_id_ref, tipo_analisis, escenario, es_activo FROM proyecto_escenarios_financieros WHERE proyecto_id_ref = 'P-XXX';
-- Verificar desviación:
--   SELECT proyecto_id_ref, presupuesto_total_aprobado, gasto_real_acumulado, desviacion_presupuesto_importe, desviacion_presupuesto_pct FROM metricas_proyecto_resumen WHERE proyecto_id_ref = 'P-XXX';
