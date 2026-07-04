-- ═══════════════════════════════════════════════════════════════════════════
-- ANTIFRÁGIL OS — Verificación POST-A2 Clínica Catálogos (SOLO LECTURA)
-- ═══════════════════════════════════════════════════════════════════════════
-- Ejecutar en el SQL Editor DESPUÉS de aplicar 001_a2_clinica_catalogos_draft.sql
-- (que a su vez va DESPUÉS del baseline). Todo es SELECT. Nada escribe.
-- PARTE 1 = RESUMEN PASS/FAIL · PARTE 2 = DETALLE.
-- ═══════════════════════════════════════════════════════════════════════════

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 1 — RESUMEN (ejecutar el bloque entero; devuelve una sola tabla)     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
with checks as (

  select 1 as n, 'tablas A2 (11)' as comprobacion,
    (select count(*) from information_schema.tables
      where table_schema='public' and table_type='BASE TABLE'
        and table_name in ('clinica_usuarios','clinica_ubicaciones','clinica_recursos',
                           'clinica_profesionales','clinica_servicios','clinica_profesional_servicios',
                           'clinica_productos','clinica_clientes','clinica_horarios_profesional',
                           'clinica_disponibilidad_excepcional','clinica_bloqueos_agenda')) = 11 as ok

  union all select 2, 'rls activado en las 11 tablas A2',
    (select count(*) from pg_tables
      where schemaname='public' and rowsecurity=true
        and tablename like 'clinica\_%') >= 11

  union all select 3, 'anon sin acceso a tablas A2',
    not exists(select 1 from pg_policies
               where schemaname='public' and tablename like 'clinica\_%'
                 and 'anon' = any(roles))

  union all select 4, 'triggers updated_at (10; la tabla puente no lleva)',
    (select count(distinct event_object_table) from information_schema.triggers
      where trigger_schema='public' and event_object_table like 'clinica\_%'
        and action_statement ilike '%touch_updated_at%') = 10

  union all select 5, 'FKs a sociedades(id_ref) en maestros (5)',
    (select count(*) from information_schema.constraint_column_usage ccu
      join information_schema.table_constraints tc
        on tc.constraint_name = ccu.constraint_name and tc.constraint_schema='public'
      where tc.constraint_type='FOREIGN KEY'
        and ccu.table_name='sociedades'
        and tc.table_name in ('clinica_ubicaciones','clinica_profesionales',
                              'clinica_servicios','clinica_productos','clinica_clientes')) = 5

  union all select 6, 'seed: ubicación Clínica Antifrágil Playamar (exactamente 1)',
    (select count(*) from public.clinica_ubicaciones
      where nombre='Clínica Antifrágil Playamar' and sociedad_id_ref='ANT' and activo) = 1
    and (select count(*) from public.clinica_ubicaciones) = 1

  union all select 7, 'sin datos reales (todo vacío salvo el seed)',
        (select count(*) from public.clinica_usuarios)=0
    and (select count(*) from public.clinica_recursos)=0
    and (select count(*) from public.clinica_profesionales)=0
    and (select count(*) from public.clinica_servicios)=0
    and (select count(*) from public.clinica_profesional_servicios)=0
    and (select count(*) from public.clinica_productos)=0
    and (select count(*) from public.clinica_clientes)=0
    and (select count(*) from public.clinica_horarios_profesional)=0
    and (select count(*) from public.clinica_disponibilidad_excepcional)=0
    and (select count(*) from public.clinica_bloqueos_agenda)=0

  union all select 8, 'sin rastro clínico en schema (compliance v1)',
    not exists(select 1 from information_schema.columns
               where table_schema='public'
                 and (lower(table_name)  ~ 'paciente|diagnostico|lesion|historia_clinica|anamnesis|patologia|medicacion|antecedente|nota_clinica|evolucion_clinica'
                   or lower(column_name) ~ 'paciente|diagnostico|lesion|historia_clinica|anamnesis|patologia|medicacion|antecedente|nota_clinica|evolucion_clinica'))

  union all select 9, 'sin rastro legacy en schema (pavier/armia/rialsa/alsari)',
    not exists(select 1 from information_schema.columns
               where table_schema='public'
                 and (lower(table_name)  ~ 'pavier|armia|rialsa|alsari'
                   or lower(column_name) ~ 'pavier|armia|rialsa|alsari'))
)
select 0 as n, 'RESULTADO GLOBAL' as comprobacion,
       case when (select bool_and(ok) from checks) then 'PASS ✅ (A2 correcto)'
            else 'FAIL ❌ (revisar filas FAIL + PARTE 2)' end as estado
union all
select n, comprobacion, case when ok then 'PASS' else 'FAIL' end
from checks
order by n;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 2 — DETALLE (ejecutar solo lo que necesites si algo dio FAIL)        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- D1. Tablas A2 presentes (esperado: 11)
select table_name from information_schema.tables
where table_schema='public' and table_name like 'clinica\_%' order by table_name;

-- D2. RLS por tabla clinica_* (esperado: rowsecurity=true en todas)
select tablename, rowsecurity from pg_tables
where schemaname='public' and tablename like 'clinica\_%' order by tablename;

-- D3. Políticas clinica_* (esperado: solo TO authenticated; nada para anon)
select tablename, policyname, roles, cmd from pg_policies
where schemaname='public' and tablename like 'clinica\_%' order by tablename;

-- D4. Triggers touch (esperado: 10 tablas; falta solo clinica_profesional_servicios)
select event_object_table, trigger_name from information_schema.triggers
where trigger_schema='public' and event_object_table like 'clinica\_%'
order by event_object_table;

-- D5. Seed (esperado: 1 fila, Clínica Antifrágil Playamar / ANT)
select id, nombre, direccion, sociedad_id_ref, activo from public.clinica_ubicaciones;

-- D6. Conteos (esperado: todo 0 salvo ubicaciones=1)
select
  (select count(*) from public.clinica_usuarios)                   as usuarios,        -- 0
  (select count(*) from public.clinica_ubicaciones)                as ubicaciones,     -- 1
  (select count(*) from public.clinica_recursos)                   as recursos,        -- 0
  (select count(*) from public.clinica_profesionales)              as profesionales,   -- 0
  (select count(*) from public.clinica_servicios)                  as servicios,       -- 0
  (select count(*) from public.clinica_productos)                  as productos,       -- 0
  (select count(*) from public.clinica_clientes)                   as clientes,        -- 0
  (select count(*) from public.clinica_horarios_profesional)       as horarios,        -- 0
  (select count(*) from public.clinica_disponibilidad_excepcional) as excepciones,     -- 0
  (select count(*) from public.clinica_bloqueos_agenda)            as bloqueos;        -- 0

-- D7. Rastro clínico en nombres de tabla/columna (esperado: 0 filas — compliance v1)
select table_name, column_name from information_schema.columns
where table_schema='public'
  and (lower(table_name)  ~ 'paciente|diagnostico|lesion|historia_clinica|anamnesis|patologia|medicacion|antecedente|nota_clinica|evolucion_clinica'
    or lower(column_name) ~ 'paciente|diagnostico|lesion|historia_clinica|anamnesis|patologia|medicacion|antecedente|nota_clinica|evolucion_clinica');

-- D8. Rastro legacy (esperado: 0 filas)
select table_name, column_name from information_schema.columns
where table_schema='public'
  and (lower(table_name) ~ 'pavier|armia|rialsa|alsari'
    or lower(column_name) ~ 'pavier|armia|rialsa|alsari');
