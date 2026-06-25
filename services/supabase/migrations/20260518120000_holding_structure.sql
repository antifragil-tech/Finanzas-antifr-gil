-- Migration: holding_structure
-- Tablas maestras del holding: sociedades, proyectos, KPIs.
-- Reemplaza la dependencia del CF Worker + Google Sheets.
-- Seguro ejecutar múltiples veces (IF NOT EXISTS + ON CONFLICT DO NOTHING).

-- ─────────────────────────────────────────────
-- 1. sociedades
--    Registro canónico de todas las entidades del holding.
--    IDs: numérico ("1","2") para socios personales, texto ("H-001", "S-001") para sociedades.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sociedades (
  id_ref            TEXT        PRIMARY KEY,
  nombre            TEXT        NOT NULL,
  cif               TEXT,
  holding_principal TEXT,
  pct_pavier        NUMERIC(7,4),
  pct_armia         NUMERIC(7,4),
  estado            TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 2. proyectos
--    Proyectos de inversión del holding.
--    sociedad_tenedora referencia el id_ref de la sociedad propietaria.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proyectos (
  id_ref            TEXT        PRIMARY KEY,
  nombre            TEXT        NOT NULL,
  sociedad_tenedora TEXT        REFERENCES sociedades(id_ref),
  estado            TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 3. kpis_sociedades
--    KPIs financieros por sociedad (balance simplificado).
--    Sin FK hard a sociedades: los IDs del libro Excel pueden divergir históricamente.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kpis_sociedades (
  id_ref                TEXT        PRIMARY KEY,
  nombre                TEXT,
  tipo                  TEXT,
  caja_disponible       NUMERIC(15,2),
  deuda_bancaria_cp     NUMERIC(15,2),
  deuda_bancaria_lp     NUMERIC(15,2),
  deuda_bancaria        NUMERIC(15,2),
  deuda_socios          NUMERIC(15,2),
  deuda_financiera_neta NUMERIC(15,2),
  activo_corriente      NUMERIC(15,2),
  activo_no_corriente   NUMERIC(15,2),
  activo_total          NUMERIC(15,2),
  pasivo_corriente      NUMERIC(15,2),
  pasivo_no_corriente   NUMERIC(15,2),
  pasivo_total          NUMERIC(15,2),
  fondo_maniobra        NUMERIC(15,2),
  patrimonio_neto       NUMERIC(15,2),
  fecha_actualizacion   DATE,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 4. kpis_proyectos
--    KPIs financieros por proyecto (inversión, valoración, márgenes).
--    sociedad_tenedora permite filtrar proyectos por sociedad en el dashboard.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kpis_proyectos (
  id_ref                    TEXT        PRIMARY KEY,
  nombre                    TEXT,
  tipo                      TEXT,
  sociedad_tenedora         TEXT,
  presupuesto               NUMERIC(15,2),
  inversion_inicial         NUMERIC(15,2),
  recapex_acumulado         NUMERIC(15,2),
  capital_expuesto          NUMERIC(15,2),
  deuda                     NUMERIC(15,2),
  beneficio_acumulado_bruto NUMERIC(15,2),
  opex_acumulado            NUMERIC(15,2),
  valoracion                NUMERIC(15,2),
  margen_latente_salida     NUMERIC(15,2),
  margen_latente_salida_pct NUMERIC(12,6),
  fecha_actualizacion       DATE,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kpis_proy_sociedad ON kpis_proyectos (sociedad_tenedora);
CREATE INDEX IF NOT EXISTS idx_proyectos_tenedora  ON proyectos (sociedad_tenedora);

-- ─────────────────────────────────────────────
-- RLS: todos los accesos requieren al menos rol anon
-- ─────────────────────────────────────────────
ALTER TABLE sociedades       ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpis_sociedades  ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpis_proyectos   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon and authenticated" ON sociedades
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon and authenticated" ON proyectos
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon and authenticated" ON kpis_sociedades
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon and authenticated" ON kpis_proyectos
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
