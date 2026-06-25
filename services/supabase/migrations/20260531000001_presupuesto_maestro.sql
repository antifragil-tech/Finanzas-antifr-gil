-- ============================================================
-- Presupuesto maestro por proyecto — Fase 3A
-- ============================================================
-- 1. Añadir columnas a presupuestos
-- 2. Índice único parcial: solo un maestro por proyecto
-- ============================================================

ALTER TABLE public.presupuestos
  ADD COLUMN IF NOT EXISTS es_presupuesto_maestro BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_aprobacion       DATE,
  ADD COLUMN IF NOT EXISTS aprobado_por           TEXT;

-- Garantiza unicidad: solo un presupuesto con es_presupuesto_maestro = true
-- por proyecto. Permite múltiples presupuestos sin maestro.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_presupuesto_maestro_por_proyecto
  ON public.presupuestos (proyecto_id_ref)
  WHERE es_presupuesto_maestro = true
    AND proyecto_id_ref IS NOT NULL;

-- ── QUERIES DE VALIDACIÓN ────────────────────────────────────────────────────
-- Presupuesto maestro de un proyecto:
--   SELECT id, nombre, estado FROM presupuestos WHERE proyecto_id_ref = 'P-XXX' AND es_presupuesto_maestro = true;
-- Proyectos sin maestro:
--   SELECT DISTINCT proyecto_id_ref FROM presupuestos WHERE proyecto_id_ref IS NOT NULL
--   AND proyecto_id_ref NOT IN (SELECT proyecto_id_ref FROM presupuestos WHERE es_presupuesto_maestro = true AND proyecto_id_ref IS NOT NULL);
