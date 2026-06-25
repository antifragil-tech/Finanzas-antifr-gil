-- Fix: actualizar parent_sociedad_id con IDs reales de Supabase
-- La migración anterior (20260518140000) usó IDs del SVG del organigrama que no coincidían con la BD.

-- Alsari Inversiones (S-001) → filiales directas
UPDATE sociedades SET parent_sociedad_id = 'S-001',   pct_en_sociedad_padre = 0.50 WHERE id_ref = 'S-001-1';   -- Perisur
UPDATE sociedades SET parent_sociedad_id = 'S-001',   pct_en_sociedad_padre = 0.05 WHERE id_ref = 'S-001-2';   -- Le Toit

-- Perisur (S-001-1) → sub-filiales (UTEs)
UPDATE sociedades SET parent_sociedad_id = 'S-001-1', pct_en_sociedad_padre = 0.50 WHERE id_ref = 'S-001-1-1'; -- Capellanía
UPDATE sociedades SET parent_sociedad_id = 'S-001-1', pct_en_sociedad_padre = 0.50 WHERE id_ref = 'S-001-1-2'; -- UTE Lagunas Park

-- Rialsa (S-002) → filiales directas
UPDATE sociedades SET parent_sociedad_id = 'S-002',   pct_en_sociedad_padre = 1.00 WHERE id_ref = 'S-002-1';   -- Alrive
UPDATE sociedades SET parent_sociedad_id = 'S-002',   pct_en_sociedad_padre = 1.00 WHERE id_ref = 'S-002-2';   -- Andalvia
