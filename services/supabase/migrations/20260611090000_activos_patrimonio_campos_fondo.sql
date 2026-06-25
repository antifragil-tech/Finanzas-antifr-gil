-- Añadir campos de rentabilidad a activos_patrimonio
-- Necesarios para fondos y cotizados: CAGR y TAE declarada

ALTER TABLE public.activos_patrimonio
  ADD COLUMN IF NOT EXISTS fecha_inicio_inversion DATE,
  ADD COLUMN IF NOT EXISTS tae_declarada          NUMERIC(6,3);
