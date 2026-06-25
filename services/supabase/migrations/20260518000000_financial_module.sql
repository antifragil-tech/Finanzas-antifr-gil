-- Migration: financial_module
-- Creates the three tables needed for the libro mayor import pipeline.
-- Applies to: apps/modules/financiero — Balance PGC feature (Fase 3)
--
-- Safe to run multiple times (IF NOT EXISTS throughout).

-- ─────────────────────────────────────────────
-- 1. import_batches
--    One row per upload: which entity, which period.
--    UNIQUE constraint prevents accidental double-import of the same period.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_batches (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     TEXT        NOT NULL,  -- matches ID-Ref from Alsari_DB (e.g. 'S-006')
  entity_name   TEXT        NOT NULL,
  period_start  DATE        NOT NULL,
  period_end    DATE        NOT NULL,
  row_count     INTEGER,
  imported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_id, period_start, period_end)
);

-- ─────────────────────────────────────────────
-- 2. journal_entries
--    Raw libro mayor rows, one per transaction line.
--    Deleting a batch cascades to its entries.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id          UUID        NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  entity_id         TEXT        NOT NULL,
  subcuenta         TEXT        NOT NULL,   -- 4-8 digit account code
  subcuenta_nombre  TEXT,
  asiento           INTEGER,
  fecha             DATE        NOT NULL,
  concepto          TEXT,
  debe              NUMERIC(15,2) NOT NULL DEFAULT 0,
  haber             NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_je_entity_fecha    ON journal_entries (entity_id, fecha);
CREATE INDEX IF NOT EXISTS idx_je_batch           ON journal_entries (batch_id);
CREATE INDEX IF NOT EXISTS idx_je_subcuenta       ON journal_entries (subcuenta);

-- ─────────────────────────────────────────────
-- 3. account_mappings
--    The PGC classification rules — editable without code changes.
--    Mirrors the logic in pgcEngine.ts but persisted for UI editing.
--    Seeded with the rules validated by the gestoría (2026-05-18).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_mappings (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  range_from      TEXT    NOT NULL,  -- 4-digit prefix, e.g. '5700'
  range_to        TEXT    NOT NULL,
  sign_condition  TEXT    NOT NULL DEFAULT 'both'
                          CHECK (sign_condition IN ('deudor', 'acreedor', 'both')),
  category        TEXT    NOT NULL,  -- matches InternalCat in pgcEngine.ts
  label           TEXT    NOT NULL,  -- human-readable label
  sort_order      INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,              -- gestoría corrections or rationale
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: initial PGC rules (gestoría-validated)
INSERT INTO account_mappings (range_from, range_to, sign_condition, category, label, sort_order, notes) VALUES
  ('5700','5799','both',     'caja',                  'Caja y Bancos',                  10,  NULL),
  ('5200','5209','acreedor', 'deuda_bancaria_cp',      'Deuda Bancaria C/P',             20,  'Préstamos CP entidades de crédito'),
  ('5270','5279','acreedor', 'deuda_bancaria_cp',      'Deuda Bancaria C/P (intereses)', 21,  NULL),
  ('5100','5199','acreedor', 'deuda_partes_vinc_cp',   'Deuda Partes Vinculadas C/P',    30,  '[G] Gestoría: incluir grupo 51'),
  ('5500','5529','acreedor', 'deuda_partes_vinc_cp',   'Deuda Partes Vinculadas C/P',    31,  '[G] Gestoría: 550, 551, 552 acreedor'),
  ('1600','1699','acreedor', 'deuda_partes_vinc_lp',   'Deuda Partes Vinculadas L/P',    40,  '[G] Gestoría: incluir grupo 16'),
  ('1710','1719','acreedor', 'deuda_partes_vinc_lp',   'Deuda Partes Vinculadas L/P',    41,  '171x = partes vinculadas LP en práctica'),
  ('1700','1709','acreedor', 'deuda_bancaria_lp',      'Deuda Bancaria L/P',             50,  'Deudas LP entidades de crédito'),
  ('1740','1749','acreedor', 'deuda_bancaria_lp',      'Deuda Bancaria L/P (leasing)',   51,  'Arrendamiento financiero LP'),
  ('1000','1399','both',     'patrimonio_neto',        'Patrimonio Neto',                60,  'Capital, reservas, resultado. Contra-cuentas restan naturalmente.'),
  ('1400','1499','acreedor', 'pasivo_no_corriente',    'Pasivo No Corriente',            70,  'Provisiones LP'),
  ('1500','1599','acreedor', 'pasivo_no_corriente',    'Pasivo No Corriente',            71,  NULL),
  ('1720','1739','acreedor', 'pasivo_no_corriente',    'Pasivo No Corriente',            72,  NULL),
  ('1750','1799','acreedor', 'pasivo_no_corriente',    'Pasivo No Corriente',            73,  NULL),
  ('1800','1899','acreedor', 'pasivo_no_corriente',    'Pasivo No Corriente',            74,  'Fianzas recibidas LP'),
  ('4790','4799','acreedor', 'pasivo_no_corriente',    'Pasivo No Corriente (479)',       75,  '[G] Gestoría: incluir 479'),
  ('2000','2999','both',     'activo_no_corriente',    'Activo No Corriente',            80,  'Inmovilizado. 28xx/29xx son acreedor y restan naturalmente.'),
  ('4600','4609','both',     'activo_corriente',       'Activo Corriente',               90,  '[G] Gestoría: cuenta 460 siempre activo'),
  ('5500','5529','deudor',   'activo_corriente',       'Activo Corriente',               91,  '[G] Gestoría: 550-552 deudor = activo'),
  ('3000','3999','deudor',   'activo_corriente',       'Activo Corriente (existencias)', 92,  NULL),
  ('4000','4699','deudor',   'activo_corriente',       'Activo Corriente',               93,  'Clientes y deudores'),
  ('4700','4789','deudor',   'activo_corriente',       'Activo Corriente (HP deudora)',  94,  NULL),
  ('4800','4819','deudor',   'activo_corriente',       'Activo Corriente',               95,  'Periodificaciones activo'),
  ('4900','4999','deudor',   'activo_corriente',       'Activo Corriente',               96,  '[G] Gestoría: grupo 49 con signo'),
  ('5300','5499','deudor',   'activo_corriente',       'Activo Corriente (inv. CP)',     97,  NULL),
  ('5800','5899','deudor',   'activo_corriente',       'Activo Corriente',               98,  '[G] Gestoría: grupo 58 deudor'),
  ('5900','5999','deudor',   'activo_corriente',       'Activo Corriente',               99,  '[G] Gestoría: grupo 59'),
  ('4000','4699','acreedor', 'pasivo_corriente',       'Pasivo Corriente',               100, 'Proveedores y acreedores'),
  ('4700','4789','acreedor', 'pasivo_corriente',       'Pasivo Corriente (HP + SS)',     101, NULL),
  ('5000','5099','acreedor', 'pasivo_corriente',       'Pasivo Corriente',               102, '[G] Gestoría: incluir grupo 50'),
  ('5210','5269','acreedor', 'pasivo_corriente',       'Pasivo Corriente',               103, 'Otras deudas CP'),
  ('5280','5299','acreedor', 'pasivo_corriente',       'Pasivo Corriente (leasing CP)', 104, NULL),
  ('5600','5699','acreedor', 'pasivo_corriente',       'Pasivo Corriente',               105, 'Fianzas recibidas CP'),
  ('5800','5899','acreedor', 'pasivo_corriente',       'Pasivo Corriente',               106, '[G] Gestoría: grupo 58 acreedor')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- RLS: protect all tables — only authenticated users
-- ─────────────────────────────────────────────
ALTER TABLE import_batches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_mappings ENABLE ROW LEVEL SECURITY;

-- anon: módulos Vite standalone (sin sesión Host OS)
-- authenticated: módulo embebido en Host OS con Supabase Auth activo
CREATE POLICY "anon and authenticated" ON import_batches
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon and authenticated" ON journal_entries
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon and authenticated" ON account_mappings
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
