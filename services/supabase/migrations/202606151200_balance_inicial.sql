-- ═══════════════════════════════════════════════════════════════════════════
-- Balance "Inicial" por sociedad (2026-06-15)
--
-- Decisión de Guille: el balance de sumas y saldos más antiguo de cada sociedad
-- es su "Inicial" (balance de partida tomado de un sumas y saldos antiguo). Los
-- balances posteriores se nombran por su mes/año. El frontend muestra "Inicial"
-- cuando el período es la fecha sentinela 1900-01-01.
--
-- Estado previo (balance_sumas_saldos):
--   Pavier, Armia, Capellanía → solo mayo 2026          → mayo = Inicial
--   Alsari Inversiones, Perisur → marzo 2026 + mayo 2026 → marzo = Inicial
--   Le Toit → abril 2026 + mayo 2026                     → abril = Inicial
--
-- Idempotente: si se reejecuta, MIN(periodo) ya es la sentinela y el UPDATE es
-- un no-op (no colisiona con la UNIQUE (sociedad_id, periodo, cuenta) porque cada
-- sociedad tiene como mucho un período mínimo).
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.balance_sumas_saldos b
SET periodo = DATE '1900-01-01'
FROM (
  SELECT sociedad_id, MIN(periodo) AS min_periodo
  FROM public.balance_sumas_saldos
  GROUP BY sociedad_id
) m
WHERE b.sociedad_id = m.sociedad_id
  AND b.periodo = m.min_periodo;
