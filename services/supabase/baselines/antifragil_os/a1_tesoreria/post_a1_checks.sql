-- ═══════════════════════════════════════════════════════════════════════════
-- ANTIFRÁGIL OS — Verificación POST-A1 Tesorería/Caja (SOLO LECTURA)
-- ═══════════════════════════════════════════════════════════════════════════
-- Ejecutar en el SQL Editor DESPUÉS de aplicar 001_a1_tesoreria_caja_draft.sql
-- (que a su vez va DESPUÉS del baseline). Todo es SELECT. Nada escribe.
-- PARTE 1 = RESUMEN PASS/FAIL · PARTE 2 = DETALLE de diagnóstico.
-- ═══════════════════════════════════════════════════════════════════════════

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 1 — RESUMEN (ejecutar el bloque entero; devuelve una sola tabla)     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
with checks as (

  select 1 as n, 'tablas A1 (3)' as comprobacion,
    (select count(*) from information_schema.tables
      where table_schema='public' and table_type='BASE TABLE'
        and table_name in ('cuenta_tesoreria','movimiento_caja','arqueo_caja')) = 3 as ok

  union all select 2, 'vistas A1 (3)',
    (select count(*) from information_schema.views
      where table_schema='public'
        and table_name in ('movimiento_tesoreria','saldo_tesoreria','tesoreria')) = 3

  union all select 3, 'rpc A1 (3)',
    (select count(*) from information_schema.routines
      where routine_schema='public'
        and routine_name in ('registrar_movimiento_caja','registrar_arqueo_caja','cerrar_arqueo_caja')) = 3

  union all select 4, 'caja "Caja Clínica Playamar" sembrada',
    exists(select 1 from public.cuenta_tesoreria
            where tipo='caja' and nombre='Caja Clínica Playamar'
              and sociedad_id_ref='ANT' and proyecto_id_ref='CLI-PLY'
              and moneda='EUR' and activa and cuenta_bancaria_id is null)

  union all select 5, 'caja NO duplicada (exactamente 1)',
    (select count(*) from public.cuenta_tesoreria where nombre='Caja Clínica Playamar') = 1

  union all select 6, 'sin movimientos de caja reales',
    (select count(*) from public.movimiento_caja) = 0

  union all select 7, 'sin arqueos reales',
    (select count(*) from public.arqueo_caja) = 0

  union all select 8, 'rls activado en tablas A1',
    (select count(*) from pg_tables
      where schemaname='public' and rowsecurity=true
        and tablename in ('cuenta_tesoreria','movimiento_caja','arqueo_caja')) = 3

  union all select 9, 'anon sin acceso a tablas A1',
    not exists(select 1 from pg_policies
               where schemaname='public'
                 and tablename in ('cuenta_tesoreria','movimiento_caja','arqueo_caja')
                 and 'anon' = any(roles))

  union all select 10, 'caja/arqueo append-only (cliente solo SELECT)',
    not exists(select 1 from pg_policies
               where schemaname='public'
                 and tablename in ('movimiento_caja','arqueo_caja')
                 and cmd <> 'SELECT')

  union all select 11, 'medio_pago NO incluye banco',
    not exists(select 1 from information_schema.check_constraints
               where check_clause ilike '%medio_pago%' and check_clause ilike '%banco%')

  union all select 12, 'movimiento_tesoreria NO duplica banco',
    (select count(*) from public.movimiento_tesoreria where tipo_cuenta='banco')
      = (select count(*) from public.movimientos_bancarios)

  union all select 13, 'sin rastro legacy en schema (pavier/armia/rialsa/alsari)',
    not exists(select 1 from information_schema.columns
               where table_schema='public'
                 and (lower(table_name)  ~ 'pavier|armia|rialsa|alsari'
                   or lower(column_name) ~ 'pavier|armia|rialsa|alsari'))

  union all select 14, 'índice único cuenta_bancaria (anti-duplicación banco)',
    exists(select 1 from pg_indexes
            where schemaname='public' and tablename='cuenta_tesoreria'
              and indexname='cuenta_tesoreria_cuenta_bancaria_uniq')

  union all select 15, 'sin rastro clínico en schema (compliance v1)',
    not exists(select 1 from information_schema.columns
               where table_schema='public'
                 and (lower(table_name)  ~ 'paciente|diagnostico|lesion|historia_clinica|anamnesis|patologia|medicacion|antecedente|nota_clinica|evolucion_clinica'
                   or lower(column_name) ~ 'paciente|diagnostico|lesion|historia_clinica|anamnesis|patologia|medicacion|antecedente|nota_clinica|evolucion_clinica'))
)
select 0 as n, 'RESULTADO GLOBAL' as comprobacion,
       case when (select bool_and(ok) from checks) then 'PASS ✅ (A1 correcto)'
            else 'FAIL ❌ (revisar filas FAIL + PARTE 2)' end as estado
union all
select n, comprobacion, case when ok then 'PASS' else 'FAIL' end
from checks
order by n;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 2 — DETALLE (ejecutar solo lo que necesites si algo dio FAIL)        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- D1. Objetos A1 presentes
select table_name, table_type from information_schema.tables
where table_schema='public'
  and table_name in ('cuenta_tesoreria','movimiento_caja','arqueo_caja',
                     'movimiento_tesoreria','saldo_tesoreria','tesoreria')
order by table_type, table_name;

-- D2. RPC A1 presentes
select routine_name from information_schema.routines
where routine_schema='public'
  and routine_name in ('registrar_movimiento_caja','registrar_arqueo_caja','cerrar_arqueo_caja')
order by routine_name;

-- D3. Seed de caja (esperado: 1 fila Caja Clínica Playamar, moneda EUR, sin cuenta bancaria)
select id, tipo, nombre, sociedad_id_ref, proyecto_id_ref, cuenta_bancaria_id, cuenta_pgc, moneda, activa
from public.cuenta_tesoreria order by nombre;

-- D4. Las 3 vistas resuelven sin error (esperado: 0 o el seed; sin fallo)
select count(*) as movimiento_tesoreria from public.movimiento_tesoreria;
select count(*) as saldo_tesoreria      from public.saldo_tesoreria;
select count(*) as tesoreria            from public.tesoreria;

-- D5. medio_pago: ver la cláusula del CHECK (no debe contener 'banco')
select tc.table_name, cc.check_clause
from information_schema.check_constraints cc
join information_schema.constraint_column_usage tc on tc.constraint_name = cc.constraint_name
where tc.table_schema='public' and tc.table_name='movimiento_caja' and tc.column_name='medio_pago';

-- D6. Conteos (todo 0 salvo la cuenta sembrada)
select
  (select count(*) from public.cuenta_tesoreria) as cuentas_tesoreria,  -- 1 (la caja)
  (select count(*) from public.movimiento_caja)  as movimientos_caja,   -- 0
  (select count(*) from public.arqueo_caja)      as arqueos;            -- 0

-- D7. Rastro legacy (esperado: 0 filas)
select table_name, column_name from information_schema.columns
where table_schema='public'
  and (lower(table_name) ~ 'pavier|armia|rialsa|alsari'
    or lower(column_name) ~ 'pavier|armia|rialsa|alsari');

-- D8. Rastro clínico en nombres de tabla/columna (esperado: 0 filas — compliance v1)
select table_name, column_name from information_schema.columns
where table_schema='public'
  and (lower(table_name)  ~ 'paciente|diagnostico|lesion|historia_clinica|anamnesis|patologia|medicacion|antecedente|nota_clinica|evolucion_clinica'
    or lower(column_name) ~ 'paciente|diagnostico|lesion|historia_clinica|anamnesis|patologia|medicacion|antecedente|nota_clinica|evolucion_clinica');
