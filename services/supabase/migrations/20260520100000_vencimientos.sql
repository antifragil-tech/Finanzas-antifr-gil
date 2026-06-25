-- Tabla de vencimientos y compromisos recurrentes del holding
-- Cubre: seguros, deuda, contratos, impuestos, compromisos, capital calls, etc.

CREATE TABLE IF NOT EXISTS vencimientos (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo            TEXT        NOT NULL,
  tipo              TEXT        NOT NULL CHECK (tipo IN (
                      'seguro', 'deuda', 'contrato', 'impuesto', 'compromiso', 'otro'
                    )),
  fecha_vencimiento DATE        NOT NULL,
  importe           NUMERIC(15,2),
  sociedad_id       TEXT        REFERENCES sociedades(id_ref) ON DELETE SET NULL,
  notas             TEXT,
  estado            TEXT        NOT NULL DEFAULT 'pendiente'
                                CHECK (estado IN ('pendiente', 'gestionado', 'vencido')),
  recurrencia       TEXT        CHECK (recurrencia IN (
                      'anual', 'semestral', 'trimestral', 'mensual'
                    )),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vencimientos_fecha ON vencimientos (fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_vencimientos_sociedad ON vencimientos (sociedad_id);
CREATE INDEX IF NOT EXISTS idx_vencimientos_estado ON vencimientos (estado);

ALTER TABLE vencimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon and authenticated" ON vencimientos;
CREATE POLICY "anon and authenticated" ON vencimientos
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
