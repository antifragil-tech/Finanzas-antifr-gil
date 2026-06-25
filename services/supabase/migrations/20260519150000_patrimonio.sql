-- Módulo de patrimonio personal y societario
-- Titulares: personas físicas (Javier, Iván) + sociedades del holding
-- Activos: inmobiliario, fondos, cotizados, bienes de valor

-- ── 1. Personas físicas ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personas_patrimonio (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE personas_patrimonio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon and authenticated" ON personas_patrimonio;
CREATE POLICY "anon and authenticated" ON personas_patrimonio
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Registrar socios por defecto
INSERT INTO personas_patrimonio (nombre) VALUES ('Javier'), ('Iván')
  ON CONFLICT (nombre) DO NOTHING;

-- ── 2. Activos patrimoniales ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activos_patrimonio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Titular: persona física XOR sociedad
  titular_tipo        TEXT NOT NULL CHECK (titular_tipo IN ('persona', 'sociedad')),
  titular_persona_id  UUID REFERENCES personas_patrimonio(id) ON DELETE CASCADE,
  titular_sociedad_id TEXT REFERENCES sociedades(id_ref) ON DELETE SET NULL,

  -- Clasificación
  categoria    TEXT NOT NULL CHECK (categoria IN ('inmobiliario', 'fondo', 'cotizado', 'bien_valor')),
  subcategoria TEXT,   -- vivienda_habitual, indexado, accion, embarcacion, ...
  nombre       TEXT NOT NULL,

  -- Campos comunes
  valor_adquisicion     NUMERIC(15,2),
  valor_actual          NUMERIC(15,2) NOT NULL DEFAULT 0,
  deuda_viva            NUMERIC(15,2) NOT NULL DEFAULT 0,
  porcentaje_propiedad  NUMERIC(5,2)  NOT NULL DEFAULT 100,
  moneda                TEXT          NOT NULL DEFAULT 'EUR',
  fecha_valoracion      DATE,
  notas                 TEXT,

  -- Inmobiliario
  cuota_mensual  NUMERIC(10,2),
  renta_mensual  NUMERIC(10,2),

  -- Fondo / Cotizado
  isin                       TEXT,
  ticker                     TEXT,
  gestora_broker             TEXT,
  num_unidades               NUMERIC(15,6),
  precio_coste_medio         NUMERIC(15,4),
  dividendo_anual_por_unidad NUMERIC(10,4),

  -- Bien de valor
  coste_mantenimiento_anual NUMERIC(10,2),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT titular_exclusivo CHECK (
    (titular_tipo = 'persona'  AND titular_persona_id  IS NOT NULL AND titular_sociedad_id IS NULL) OR
    (titular_tipo = 'sociedad' AND titular_sociedad_id IS NOT NULL AND titular_persona_id  IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_activos_persona  ON activos_patrimonio (titular_persona_id);
CREATE INDEX IF NOT EXISTS idx_activos_sociedad ON activos_patrimonio (titular_sociedad_id);
CREATE INDEX IF NOT EXISTS idx_activos_categoria ON activos_patrimonio (categoria);

ALTER TABLE activos_patrimonio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon and authenticated" ON activos_patrimonio;
CREATE POLICY "anon and authenticated" ON activos_patrimonio
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
