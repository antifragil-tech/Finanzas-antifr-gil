-- balance_sumas_saldos: raw sumas y saldos por sociedad y período
-- El parser de la app sube las filas aquí y deriva los KPIs automáticamente.

CREATE TABLE IF NOT EXISTS balance_sumas_saldos (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id    TEXT         NOT NULL,
  periodo        DATE         NOT NULL,
  cuenta         TEXT         NOT NULL,
  descripcion    TEXT,
  debe           NUMERIC(15,2) NOT NULL DEFAULT 0,
  haber          NUMERIC(15,2) NOT NULL DEFAULT 0,
  saldo_deudor   NUMERIC(15,2) NOT NULL DEFAULT 0,
  saldo_acreedor NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_balance UNIQUE (sociedad_id, periodo, cuenta)
);

CREATE INDEX IF NOT EXISTS idx_balance_soc_periodo
  ON balance_sumas_saldos (sociedad_id, periodo);

-- Vista agregada para listar períodos importados (evita traer miles de filas al cliente)
CREATE OR REPLACE VIEW v_balance_periodos AS
SELECT
  sociedad_id,
  periodo,
  COUNT(*) AS lineas,
  MAX(created_at) AS importado_en
FROM balance_sumas_saldos
GROUP BY sociedad_id, periodo
ORDER BY sociedad_id, periodo DESC;

-- RLS
ALTER TABLE balance_sumas_saldos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon read balance_sumas_saldos"   ON balance_sumas_saldos;
DROP POLICY IF EXISTS "anon insert balance_sumas_saldos" ON balance_sumas_saldos;
DROP POLICY IF EXISTS "anon delete balance_sumas_saldos" ON balance_sumas_saldos;

CREATE POLICY "anon read balance_sumas_saldos"
  ON balance_sumas_saldos FOR SELECT USING (true);

CREATE POLICY "anon insert balance_sumas_saldos"
  ON balance_sumas_saldos FOR INSERT WITH CHECK (true);

CREATE POLICY "anon delete balance_sumas_saldos"
  ON balance_sumas_saldos FOR DELETE USING (true);
