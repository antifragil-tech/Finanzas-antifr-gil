-- Nuevos campos descriptivos en proyectos + tabla de flujos de caja
-- para soporte de TIR (XIRR), VAN, MOIC y análisis temporal por proyecto.

-- ── 1. Campos descriptivos en proyectos ───────────────────────────────────────
ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS fecha_inicio          DATE,
  ADD COLUMN IF NOT EXISTS fecha_prevista_salida DATE,
  ADD COLUMN IF NOT EXISTS fecha_salida_real     DATE,
  ADD COLUMN IF NOT EXISTS tipo_activo           TEXT,
  ADD COLUMN IF NOT EXISTS ubicacion             TEXT,
  ADD COLUMN IF NOT EXISTS superficie_m2         NUMERIC(10,2);

-- ── 2. Tabla de flujos de caja por proyecto ───────────────────────────────────
-- Convención de signo: negativo = salida de caja (inversión, gastos),
--                      positivo = entrada de caja (ventas, dividendos, ingresos)
CREATE TABLE IF NOT EXISTS flujos_caja_proyectos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id TEXT        NOT NULL REFERENCES proyectos(id_ref) ON DELETE CASCADE,
  fecha       DATE        NOT NULL,
  importe     NUMERIC(15,2) NOT NULL,
  tipo_flujo  TEXT        NOT NULL CHECK (tipo_flujo IN (
                'inversion', 'recapex', 'venta',
                'dividendo', 'ingreso_operativo', 'gasto_operativo', 'otro'
              )),
  concepto    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flujos_proyecto_fecha
  ON flujos_caja_proyectos (proyecto_id, fecha);

-- ── 3. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE flujos_caja_proyectos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon and authenticated" ON flujos_caja_proyectos
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
