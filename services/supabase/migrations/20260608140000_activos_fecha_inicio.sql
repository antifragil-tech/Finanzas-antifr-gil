-- Fecha de inicio de la inversión en activos de tipo fondo y cotizado.
-- Necesaria para calcular el CAGR (rentabilidad anualizada compuesta).
ALTER TABLE public.activos_patrimonio
  ADD COLUMN IF NOT EXISTS fecha_inicio_inversion DATE;

COMMENT ON COLUMN public.activos_patrimonio.fecha_inicio_inversion IS
'Fecha en que se realizó la primera aportación al fondo/cotizado.
Usada para calcular el CAGR = ((V_actual/coste_base)^(1/años)−1).';
