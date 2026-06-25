-- ═══════════════════════════════════════════════════════════════════════════
-- Estructura societaria real del grupo (corrección 2026-06-12)
--
-- Estructura confirmada por Guille:
--   Javier → Pavier 100% · Iván → Armia 100%
--   Pavier y Armia poseen cada uno: 50% Alsari Inversiones, 25% Perisur, 20% Rialsa
--   Perisur  → Capellanía 50%, UTE Lagunas Park 50%
--   Rialsa   → Alrive 100%, Andalvia 100%
--   Alsari   → Le Toit 5%
--
-- "Alsari Capital" es denominación comercial de Pavier+Armia, NO una sociedad.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Perisur es participada DIRECTA de Pavier (25%) y Armia (25%),
--    no filial de Alsari Inversiones. Sus pct_pavier/pct_armia (0.25/0.25)
--    ya eran correctos; solo sobra el vínculo de parentesco.
UPDATE public.sociedades
SET parent_sociedad_id = NULL,
    pct_en_sociedad_padre = NULL
WHERE id_ref = 'S-001-1';

-- 2. "Transporte" (S-006-2) es la misma sociedad que "Andalvia" (S-002-2)
--    bajo su nombre antiguo. Fila duplicada sin datos (KPIs todo NULL).
--    Se conserva S-002-2 (id coherente bajo Rialsa) y se elimina el duplicado.
DELETE FROM public.kpis_sociedades WHERE id_ref = 'S-006-2';
DELETE FROM public.sociedades WHERE id_ref = 'S-006-2';

-- 3. Consistencia look-through: Alrive y Andalvia (100% de Rialsa, que es
--    20% Pavier + 20% Armia) deben llevar 0.20/0.20, igual que Capellanía y
--    UTE llevan su 0.125/0.125. No altera consolidación (la detección de
--    hijos directos exige parent_sociedad_id NULL).
UPDATE public.sociedades
SET pct_pavier = 0.20,
    pct_armia  = 0.20
WHERE id_ref IN ('S-002-1', 'S-002-2');
