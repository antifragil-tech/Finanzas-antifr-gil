-- Fix: facturas_recibidas.estado default era 'recibida' (fuera del CHECK constraint)
-- El constraint ya es borrador_ocr|revision_javi|pendiente_pago|pagada|rechazada
-- desde migración 20260521100000. Solo corregimos el DEFAULT.

ALTER TABLE public.facturas_recibidas
  ALTER COLUMN estado SET DEFAULT 'borrador_ocr';
