-- Añade cuenta_gasto a facturas_recibidas para sugerir/registrar la cuenta PGC
alter table public.facturas_recibidas
  add column if not exists cuenta_gasto text;
