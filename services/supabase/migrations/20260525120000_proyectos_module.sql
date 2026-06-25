-- ============================================================
-- Módulo Proyectos — OKRs, Kanban y vinculación presupuestaria
-- ============================================================

-- 1. Vincular presupuestos a proyectos con FK real
ALTER TABLE public.presupuestos
  ADD COLUMN IF NOT EXISTS proyecto_id_ref TEXT
    REFERENCES public.proyectos(id_ref) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS presupuestos_proyecto_idx ON public.presupuestos(proyecto_id_ref);

-- 2. Fecha real de pago en presupuesto_pagos
ALTER TABLE public.presupuesto_pagos
  ADD COLUMN IF NOT EXISTS fecha_real_pago DATE;

-- 3. Objetivos OKR por proyecto
CREATE TABLE IF NOT EXISTS public.proyecto_objetivos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     TEXT NOT NULL REFERENCES public.proyectos(id_ref) ON DELETE CASCADE,
  titulo          TEXT NOT NULL,
  descripcion     TEXT,
  fecha_objetivo  DATE,
  estado          TEXT NOT NULL DEFAULT 'activo'
                  CHECK (estado IN ('activo','completado','cancelado')),
  orden           INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.proyecto_objetivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access on proyecto_objetivos"
  ON public.proyecto_objetivos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS proyecto_objetivos_proyecto_idx ON public.proyecto_objetivos(proyecto_id);

-- 4. Key Results por objetivo
CREATE TABLE IF NOT EXISTS public.proyecto_kr (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objetivo_id     UUID NOT NULL REFERENCES public.proyecto_objetivos(id) ON DELETE CASCADE,
  proyecto_id     TEXT NOT NULL REFERENCES public.proyectos(id_ref) ON DELETE CASCADE,
  titulo          TEXT NOT NULL,
  unidad          TEXT NOT NULL DEFAULT 'porcentaje'
                  CHECK (unidad IN ('porcentaje','euros','numero','fecha','booleano')),
  valor_objetivo  NUMERIC(14,2),
  valor_actual    NUMERIC(14,2) NOT NULL DEFAULT 0,
  completado      BOOLEAN NOT NULL DEFAULT false,
  orden           INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.proyecto_kr ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access on proyecto_kr"
  ON public.proyecto_kr FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS proyecto_kr_objetivo_idx ON public.proyecto_kr(objetivo_id);
CREATE INDEX IF NOT EXISTS proyecto_kr_proyecto_idx ON public.proyecto_kr(proyecto_id);

-- 5. Tareas Kanban por proyecto
CREATE TABLE IF NOT EXISTS public.proyecto_tareas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id   TEXT NOT NULL REFERENCES public.proyectos(id_ref) ON DELETE CASCADE,
  titulo        TEXT NOT NULL,
  descripcion   TEXT,
  columna       TEXT NOT NULL DEFAULT 'backlog'
                CHECK (columna IN ('backlog','todo','doing','on_hold','done')),
  categoria     TEXT NOT NULL DEFAULT 'general'
                CHECK (categoria IN ('general','obra','legal','financiero')),
  fecha_limite  DATE,
  orden         INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.proyecto_tareas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access on proyecto_tareas"
  ON public.proyecto_tareas FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS proyecto_tareas_proyecto_idx ON public.proyecto_tareas(proyecto_id);
CREATE INDEX IF NOT EXISTS proyecto_tareas_columna_idx  ON public.proyecto_tareas(columna);

-- 6. Vista: totales presupuestarios por proyecto
CREATE OR REPLACE VIEW public.presupuesto_totales_por_proyecto AS
SELECT
  pr.proyecto_id_ref,
  COALESCE(SUM(pa.importe_presupuestado), 0)                                                      AS total_presupuestado,
  COALESCE(SUM(CASE WHEN pg.tipo_flujo='gasto' AND pg.estado='pagado'   THEN pg.importe END), 0) AS total_pagado,
  COALESCE(SUM(CASE WHEN pg.tipo_flujo='gasto' AND pg.estado='pendiente' THEN pg.importe END), 0) AS total_pendiente
FROM public.presupuestos pr
LEFT JOIN public.presupuesto_partidas pa ON pa.presupuesto_id = pr.id
LEFT JOIN public.presupuesto_pagos    pg ON pg.partida_id = pa.id
WHERE pr.proyecto_id_ref IS NOT NULL
GROUP BY pr.proyecto_id_ref;
