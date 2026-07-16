-- ═══════════════════════════════════════════════════════════════════════════
-- CHECKS DE PARIDAD — reflejo 2026-07-16 vs base viva antifragil-os
-- ═══════════════════════════════════════════════════════════════════════════
-- Solo lecturas. Ejecutar contra la base real; si algún "esperado" no cuadra,
-- el esquema vivo cambió después del reflejo → regenerar el reflejo.

-- 1) Conteos por tipo de objeto (esperado según el reflejo 2026-07-16)
select 'tablas' as objeto, count(*)::int as real, 58 as esperado
from pg_tables where schemaname = 'public'
union all
select 'vistas', count(*)::int, 12 from pg_views where schemaname = 'public'
union all
select 'enums', count(distinct t.typname)::int, 21
from pg_type t join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public'
union all
select 'funciones propias', count(*)::int, 12
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
union all
select 'triggers', count(*)::int, 36
from pg_trigger t join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not t.tgisinternal
union all
select 'policies', count(*)::int, 74 from pg_policies where schemaname = 'public'
union all
select 'constraints', count(*)::int, 256
from pg_constraint where connamespace = 'public'::regnamespace;

-- 2) RLS: ninguna tabla de public sin row security (esperado: 0 filas)
select tablename as tabla_sin_rls
from pg_tables where schemaname = 'public' and not rowsecurity;

-- 3) Buckets: los dos privados (esperado: 0 filas)
select name as bucket_publico from storage.buckets where public;

-- 4) Tablas clave del vertical operativo presentes (esperado: 8 filas)
select tablename from pg_tables
where schemaname = 'public'
  and tablename in ('gastos_operativos','ingresos_devengados','cobros',
                    'cuentas_por_cobrar','facturas_emitidas_operativas',
                    'liquidaciones_mensuales','lineas_liquidacion','clinica_citas')
order by tablename;

-- 5) Anti-solape de agenda vigente (esperado: 1 fila)
select conname from pg_constraint
where conname = 'clinica_citas_sin_solape_profesional' and contype = 'x';
