-- ═══════════════════════════════════════════════════════════════════════════
-- Recalcular kpis_sociedades.deuda_socios con la fórmula corregida (2026-06-15)
--
-- Bug: el cálculo de "deuda de socios" sumaba las cuentas 550-553 + 555. La 555
-- (partidas pendientes de aplicación) no es deuda de socios y metía ruido (un
-- apunte de CaixaBank de ~31 €), y FALTABAN las deudas de socios a largo plazo,
-- que es donde está el grueso: subgrupo 16 (partes vinculadas) y 171 (préstamos
-- de socios — p.ej. la 1710 de Perisur: Iván, Javier y Maygar, ~1,71 M).
--
-- kpis_sociedades es un caché de los KPIs del último balance subido, así que su
-- columna deuda_socios quedó obsoleta. Aquí se recalcula desde el período más
-- reciente de cada sociedad en balance_sumas_saldos, con la fórmula nueva.
-- El parser (deriveKpis) ya usa la fórmula correcta para las vistas en vivo.
--
-- Idempotente: recalcula siempre el mismo valor a partir de los balances.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.kpis_sociedades k
SET deuda_socios = COALESCE(sub.ds, 0),
    updated_at   = now()
FROM (
  SELECT b.sociedad_id,
         SUM(b.saldo_acreedor) FILTER (
           WHERE b.cuenta LIKE '550%' OR b.cuenta LIKE '551%'
              OR b.cuenta LIKE '552%' OR b.cuenta LIKE '553%'
              OR b.cuenta LIKE '16%'  OR b.cuenta LIKE '171%'
         ) AS ds
  FROM public.balance_sumas_saldos b
  INNER JOIN (
    SELECT sociedad_id, MAX(periodo) AS maxp
    FROM public.balance_sumas_saldos
    GROUP BY sociedad_id
  ) lp ON lp.sociedad_id = b.sociedad_id AND b.periodo = lp.maxp
  GROUP BY b.sociedad_id
) sub
WHERE k.id_ref = sub.sociedad_id;
