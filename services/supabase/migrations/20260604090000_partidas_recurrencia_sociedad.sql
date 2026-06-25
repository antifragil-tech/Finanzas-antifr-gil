-- ── 1. Limpiar columna duplicada en vencimientos ────────────────────────────
-- sociedad_id_ref nunca tuvo datos (siempre null); el app usa sociedad_id.
ALTER TABLE vencimientos DROP COLUMN IF EXISTS sociedad_id_ref;

-- ── 2. Recurrencia en presupuesto_partidas ───────────────────────────────────
-- Permite definir una partida como recurrente (mensual, trimestral…)
-- y el sistema genera los pagos automáticamente en el rango de fechas.
ALTER TABLE presupuesto_partidas
  ADD COLUMN IF NOT EXISTS recurrencia TEXT
    CHECK (recurrencia IN ('mensual', 'trimestral', 'semestral', 'anual')),
  ADD COLUMN IF NOT EXISTS fecha_inicio_recurrencia DATE,
  ADD COLUMN IF NOT EXISTS fecha_fin_recurrencia    DATE;

-- ── 3. Sociedad en presupuestos: índice para búsqueda por sociedad ───────────
-- sociedad_id_ref ya existe en presupuestos; añadimos índice para el cashflow.
CREATE INDEX IF NOT EXISTS idx_presupuestos_sociedad
  ON presupuestos (sociedad_id_ref)
  WHERE sociedad_id_ref IS NOT NULL;
