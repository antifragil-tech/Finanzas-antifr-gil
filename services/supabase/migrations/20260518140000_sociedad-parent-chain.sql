-- Migration: sociedad-parent-chain
-- Añade relación padre-hijo entre sociedades intermedias para consolidación recursiva.
-- Las sociedades directamente participadas por S-001/S-002 usan pct_pavier/pct_armia.
-- Las sub-participaciones (ALSARI → PERISUR, PERISUR → UTEs) usan estas columnas.
-- Seguro ejecutar múltiples veces (IF NOT EXISTS / DO UPDATE).

-- ─────────────────────────────────────────────
-- 1. Añadir columnas
-- ─────────────────────────────────────────────
ALTER TABLE sociedades
  ADD COLUMN IF NOT EXISTS parent_sociedad_id      TEXT REFERENCES sociedades(id_ref) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pct_en_sociedad_padre   NUMERIC(7,4);

-- ─────────────────────────────────────────────
-- 2. Seed: relaciones extraídas del mapa corporativo
--    Ajustar si los id_ref en producción difieren.
-- ─────────────────────────────────────────────

-- RIALSA → filiales operativas (100%)
UPDATE sociedades SET parent_sociedad_id = 'S-RIALSA',          pct_en_sociedad_padre = 1.0000 WHERE id_ref = 'S-ALRIVE';
UPDATE sociedades SET parent_sociedad_id = 'S-RIALSA',          pct_en_sociedad_padre = 1.0000 WHERE id_ref = 'S-TRANSPORTE';

-- ALSARI INVERSIONES → participadas (50% Perisur, 5% Le Toit)
UPDATE sociedades SET parent_sociedad_id = 'alsari_inversiones', pct_en_sociedad_padre = 0.5000 WHERE id_ref = 'S-PERISUR';
UPDATE sociedades SET parent_sociedad_id = 'alsari_inversiones', pct_en_sociedad_padre = 0.0500 WHERE id_ref = 'S-LETOIT';

-- PERISUR → UTEs (50% cada una)
UPDATE sociedades SET parent_sociedad_id = 'S-PERISUR',         pct_en_sociedad_padre = 0.5000 WHERE id_ref = 'S-003-1-2';
UPDATE sociedades SET parent_sociedad_id = 'S-PERISUR',         pct_en_sociedad_padre = 0.5000 WHERE id_ref = 'S-003-1-1';
