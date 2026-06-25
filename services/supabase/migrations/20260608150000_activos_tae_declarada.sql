-- TAE declarada por el fondo / producto financiero.
-- Para fondos monetarios y productos de liquidez donde el objetivo es
-- aparcar cash con rentabilidad conocida en vez de tenerlo al 0%.
-- Permite calcular el rendimiento mensual estimado sin necesidad de
-- historial de movimientos ni CAGR.
ALTER TABLE public.activos_patrimonio
  ADD COLUMN IF NOT EXISTS tae_declarada NUMERIC(6,3);

COMMENT ON COLUMN public.activos_patrimonio.tae_declarada IS
'TAE (%) publicada por el fondo o producto. Ejemplo: 3.25 para un 3.25%.
Usada para calcular rendimiento_mensual = valor_actual × tae/100 / 12.';
