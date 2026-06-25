-- ─────────────────────────────────────────────────────────────────────────────
-- Ficha completa de sociedades + cuentas bancarias por sociedad
-- Requerido para: mostrar datos legales en facturas emitidas,
--                gestionar cuentas bancarias de cobro por transferencia.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Ampliar la ficha de cada sociedad ─────────────────────────────────────

ALTER TABLE sociedades
  ADD COLUMN IF NOT EXISTS domicilio      TEXT,
  ADD COLUMN IF NOT EXISTS localidad      TEXT,
  ADD COLUMN IF NOT EXISTS codigo_postal  TEXT,
  ADD COLUMN IF NOT EXISTS pais           TEXT DEFAULT 'España',
  ADD COLUMN IF NOT EXISTS email          TEXT,
  ADD COLUMN IF NOT EXISTS telefono       TEXT,
  ADD COLUMN IF NOT EXISTS logo_url       TEXT;

-- ── 2. Cuentas bancarias por sociedad ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cuentas_bancarias_sociedad (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id_ref   TEXT        NOT NULL
                                  REFERENCES sociedades(id_ref) ON DELETE CASCADE,
  alias             TEXT        NOT NULL,
  titular           TEXT        NOT NULL,
  banco             TEXT,
  iban              TEXT        NOT NULL,
  swift             TEXT,
  activa            BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para consultas frecuentes por sociedad
CREATE INDEX IF NOT EXISTS idx_cuentas_bancarias_sociedad_ref
  ON cuentas_bancarias_sociedad(sociedad_id_ref);

-- RLS
ALTER TABLE cuentas_bancarias_sociedad ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users full access cuentas bancarias"
  ON cuentas_bancarias_sociedad
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── 3. Añadir campos de pago a facturas_emitidas ─────────────────────────────
--    (reemplaza el antiguo patrón "[MÉTODO PAGO] X" codificado en notas)

ALTER TABLE facturas_emitidas
  ADD COLUMN IF NOT EXISTS metodo_pago           TEXT,
  ADD COLUMN IF NOT EXISTS cuenta_bancaria_iban  TEXT,
  ADD COLUMN IF NOT EXISTS cuenta_bancaria_alias TEXT,
  ADD COLUMN IF NOT EXISTS cuenta_bancaria_titular TEXT;
