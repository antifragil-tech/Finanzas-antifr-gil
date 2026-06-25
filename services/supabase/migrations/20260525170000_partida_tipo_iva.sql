-- IVA a nivel de partida presupuestaria
-- El IVA se define en la partida (como llega el presupuesto del contratista)
-- y los pagos lo heredan como valor por defecto.
ALTER TABLE public.presupuesto_partidas
  ADD COLUMN IF NOT EXISTS tipo_iva NUMERIC(4,1) NOT NULL DEFAULT 0
    CHECK (tipo_iva IN (0, 4, 10, 21));
