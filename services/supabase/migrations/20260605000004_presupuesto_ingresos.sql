-- ============================================================
-- Presupuesto de Ingresos y Recurrencia
-- ============================================================
-- 1. presupuestos.categoria: distingue gasto vs ingreso
-- 2. presupuesto_partidas: recurrencia para ingresos periódicos
-- 3. presupuesto_pagos: enlace a facturas emitidas (lado cobro)
-- ============================================================

-- 1. Categoría del presupuesto
ALTER TABLE public.presupuestos
  ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'gasto'
    CHECK (categoria IN ('gasto', 'ingreso'));

CREATE INDEX IF NOT EXISTS presupuestos_categoria_idx
  ON public.presupuestos (categoria);

-- 2. Recurrencia en partidas presupuestarias
--    Permite definir ingresos o gastos periódicos sin crear cada
--    pago manualmente: al guardar la partida se generan los pagos.
ALTER TABLE public.presupuesto_partidas
  ADD COLUMN IF NOT EXISTS recurrencia               TEXT
    CHECK (recurrencia IN ('mensual','trimestral','semestral','anual')),
  ADD COLUMN IF NOT EXISTS fecha_inicio_recurrencia  DATE,
  ADD COLUMN IF NOT EXISTS fecha_fin_recurrencia     DATE;

-- 3. Enlace a facturas emitidas desde presupuesto_pagos
--    Las líneas de presupuesto de ingresos se vinculan a la
--    factura emitida real cuando se emite/cobra.
ALTER TABLE public.presupuesto_pagos
  ADD COLUMN IF NOT EXISTS factura_emitida_id UUID
    REFERENCES public.facturas_emitidas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS presupuesto_pagos_factura_emitida_idx
  ON public.presupuesto_pagos (factura_emitida_id)
  WHERE factura_emitida_id IS NOT NULL;

-- ── QUERIES DE VALIDACIÓN ────────────────────────────────────────────────────
-- Presupuestos de ingreso por proyecto:
--   SELECT id, nombre, categoria FROM presupuestos WHERE categoria = 'ingreso';
--
-- Partidas con recurrencia:
--   SELECT descripcion, recurrencia, fecha_inicio_recurrencia, importe_presupuestado
--   FROM presupuesto_partidas WHERE recurrencia IS NOT NULL;
