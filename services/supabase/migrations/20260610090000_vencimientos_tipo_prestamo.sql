-- Añade 'prestamo' como tipo válido en la tabla vencimientos.
-- El CHECK constraint existente no incluía préstamos como categoría propia.
ALTER TABLE public.vencimientos
  DROP CONSTRAINT IF EXISTS vencimientos_tipo_check;

ALTER TABLE public.vencimientos
  ADD CONSTRAINT vencimientos_tipo_check
    CHECK (tipo IN ('seguro','deuda','prestamo','contrato','impuesto','compromiso','otro','pignorado'));
