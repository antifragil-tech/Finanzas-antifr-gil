-- ──────────────────────────────────────────────────────────────────────────────
-- proyecto_sociedades: propiedad parcial de proyectos por sociedades del holding
--
-- Un proyecto puede tener N sociedades del holding con su % de participación.
-- La suma puede ser < 100% (el resto pertenece a terceros no rastreados).
-- sociedad_tenedora en proyectos se mantiene como sociedad principal (mayor %).
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.proyecto_sociedades (
  proyecto_id_ref  TEXT        NOT NULL REFERENCES public.proyectos(id_ref) ON DELETE CASCADE,
  sociedad_id_ref  TEXT        NOT NULL REFERENCES public.sociedades(id_ref) ON DELETE RESTRICT,
  porcentaje       NUMERIC(5,2) NOT NULL CHECK (porcentaje > 0 AND porcentaje <= 100),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (proyecto_id_ref, sociedad_id_ref)
);

-- Índice para queries por sociedad
CREATE INDEX IF NOT EXISTS idx_proyecto_sociedades_sociedad
  ON public.proyecto_sociedades (sociedad_id_ref);

-- RLS
ALTER TABLE public.proyecto_sociedades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON public.proyecto_sociedades
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Poblar desde datos existentes: proyectos con sociedad_tenedora = 100% holding
INSERT INTO public.proyecto_sociedades (proyecto_id_ref, sociedad_id_ref, porcentaje)
SELECT p.id_ref, p.sociedad_tenedora, 100
FROM public.proyectos p
WHERE p.sociedad_tenedora IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.sociedades s WHERE s.id_ref = p.sociedad_tenedora)
ON CONFLICT DO NOTHING;

-- Permitir insertar proyectos sin id_ref prefijado (se usa TEXT libre)
-- La columna ya acepta cualquier TEXT como PK, no hay cambios de esquema.
