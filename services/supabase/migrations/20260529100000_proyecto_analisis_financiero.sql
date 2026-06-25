-- ──────────────────────────────────────────────────────────────────────────────
-- proyecto_analisis_financiero: parámetros de inversión por proyecto
-- Los KPIs se calculan en el frontend; aquí solo se almacenan los inputs.
-- Un único registro por proyecto (UNIQUE en proyecto_id).
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.proyecto_analisis_financiero (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id                 TEXT NOT NULL UNIQUE REFERENCES public.proyectos(id_ref) ON DELETE CASCADE,
  tipo_analisis               TEXT NOT NULL CHECK (tipo_analisis IN ('compra_venta','renta','alternativo')),

  -- ── Campos comunes ──────────────────────────────────────────────────────────
  equity_aportado             NUMERIC(14,2),   -- capital propio Alsari
  valoracion_actual           NUMERIC(14,2),   -- tasación / estimación mercado (manual)
  tasa_descuento              NUMERIC(5,4) NOT NULL DEFAULT 0.08,

  -- ── Compra/Venta ────────────────────────────────────────────────────────────
  precio_adquisicion          NUMERIC(14,2),
  gastos_adquisicion          NUMERIC(14,2),   -- ITP/AJD, notaría, registro (~8-12%)
  presupuesto_obra            NUMERIC(14,2),   -- coste construcción/reforma previsto
  gastos_venta                NUMERIC(14,2),   -- comisión agencia, plusvalía estimada
  precio_venta_previsto       NUMERIC(14,2),
  deuda_promotora             NUMERIC(14,2),
  coste_financiero_deuda      NUMERIC(14,2),   -- intereses totales durante el proyecto

  -- ── Renta ───────────────────────────────────────────────────────────────────
  renta_mensual_bruta         NUMERIC(14,2),
  gastos_operativos_anuales   NUMERIC(14,2),   -- IBI, seguro, comunidad, mantenimiento
  capex_inicial               NUMERIC(14,2),   -- reforma/adecuación antes de arrendar
  deuda_hipotecaria           NUMERIC(14,2),
  cuota_hipoteca_mensual      NUMERIC(14,2),

  -- ── Alternativo ─────────────────────────────────────────────────────────────
  descripcion_operacion       TEXT,
  retorno_previsto_total      NUMERIC(14,2),

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.proyecto_analisis_financiero ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON public.proyecto_analisis_financiero
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
