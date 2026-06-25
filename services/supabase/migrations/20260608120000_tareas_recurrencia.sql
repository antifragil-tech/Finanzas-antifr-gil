-- Recurrencia en tareas de proyecto
-- Cuando una tarea recurrente se mueve a "done", el frontend genera
-- automáticamente la siguiente ocurrencia en "todo" con la fecha desplazada.

ALTER TABLE public.proyecto_tareas
  ADD COLUMN IF NOT EXISTS recurrencia TEXT
    CHECK (recurrencia IN ('diaria','semanal','quincenal','mensual','trimestral','anual'));

COMMENT ON COLUMN public.proyecto_tareas.recurrencia IS
'Si está definida, al marcar la tarea como done se crea automáticamente
la siguiente ocurrencia con la fecha_limite desplazada según el periodo.';
