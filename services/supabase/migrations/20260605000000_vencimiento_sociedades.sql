-- ============================================================
-- Vencimientos multi-sociedad
-- Permite asignar un vencimiento a varias sociedades con el
-- porcentaje de responsabilidad que corresponde a cada una.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vencimiento_sociedades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vencimiento_id  UUID NOT NULL
    REFERENCES public.vencimientos(id) ON DELETE CASCADE,
  sociedad_id     TEXT NOT NULL
    REFERENCES public.sociedades(id_ref) ON DELETE CASCADE,
  porcentaje      NUMERIC(5,2) NOT NULL DEFAULT 100
    CHECK (porcentaje > 0 AND porcentaje <= 100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vencimiento_id, sociedad_id)
);

ALTER TABLE public.vencimiento_sociedades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access on vencimiento_sociedades"
  ON public.vencimiento_sociedades FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS vencimiento_sociedades_vencimiento_idx
  ON public.vencimiento_sociedades (vencimiento_id);
CREATE INDEX IF NOT EXISTS vencimiento_sociedades_sociedad_idx
  ON public.vencimiento_sociedades (sociedad_id);

-- Migrar datos existentes: cada vencimiento con sociedad_id => 100%
INSERT INTO public.vencimiento_sociedades (vencimiento_id, sociedad_id, porcentaje)
SELECT id, sociedad_id, 100
FROM public.vencimientos
WHERE sociedad_id IS NOT NULL
ON CONFLICT (vencimiento_id, sociedad_id) DO NOTHING;

-- ── QUERIES DE VALIDACIÓN ────────────────────────────────────────────────────
-- Verificar migración de datos existentes:
--   SELECT v.titulo, vs.sociedad_id, vs.porcentaje
--   FROM vencimientos v
--   JOIN vencimiento_sociedades vs ON vs.vencimiento_id = v.id
--   ORDER BY v.titulo;
--
-- Vencimientos aún sin sociedad asignada:
--   SELECT id, titulo FROM vencimientos
--   WHERE id NOT IN (SELECT DISTINCT vencimiento_id FROM vencimiento_sociedades);
