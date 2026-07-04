-- ═══════════════════════════════════════════════════════════════════════════
-- ANTIFRÁGIL OS — Verificación POST-BOOTSTRAP (SOLO LECTURA)
-- ═══════════════════════════════════════════════════════════════════════════
-- Ejecutar en el SQL Editor del Supabase NUEVO, DESPUÉS de aplicar el baseline.
-- Todo es SELECT. Nada escribe.
--
-- CÓMO LEERLO:
--   · PARTE 1 (RESUMEN) devuelve UNA tabla con una fila por comprobación y una
--     columna `estado` = PASS / FAIL, más una fila 'RESULTADO GLOBAL' arriba.
--   · Si TODO es PASS → baseline correcto.
--   · Si algo es FAIL → usa las consultas de la PARTE 2 (DETALLE) para ver qué falta.
-- ═══════════════════════════════════════════════════════════════════════════


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 1 — RESUMEN (ejecutar este bloque entero; devuelve una sola tabla)   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
with checks as (

  select 1 as n, 'tablas_nucleo (26)' as comprobacion,
    (select count(*) from information_schema.tables
      where table_schema='public' and table_type='BASE TABLE'
        and table_name in (
          'sociedades','proyectos','cuentas_bancarias_sociedad','configuracion_contabilidad',
          'plan_cuentas','reglas_categorizacion','contactos','proveedores_reglas',
          'movimientos_bancarios','extractos_bancarios','facturas_recibidas','facturas_emitidas',
          'factura_pagos','factura_incidencias','factura_aprobaciones',
          'asientos_borrador','asientos_oficiales','reconciliacion_log',
          'presupuestos','presupuesto_capitulos','presupuesto_partidas','presupuesto_pagos',
          'flujos_caja_proyectos','vencimientos','balance_sumas_saldos','kpis_sociedades'
        )) = 26 as ok

  union all select 2, 'vistas (5)',
    (select count(*) from information_schema.views
      where table_schema='public'
        and table_name in ('v_balance_periodos','saldo_bancario_por_sociedad',
                           'compromisos_tesoreria','flujos_proyecto_consolidados','cashflow_consolidado')) = 5

  union all select 3, 'rpc (4)',
    (select count(*) from information_schema.routines
      where routine_schema='public'
        and routine_name in ('registrar_pago_factura','resolver_incidencia_factura',
                             'importar_extracto_bancario','deshacer_importacion_extracto')) = 4

  union all select 4, 'funcion_trigger touch_updated_at',
    exists(select 1 from information_schema.routines
            where routine_schema='public' and routine_name='touch_updated_at')

  union all select 5, 'rls_activado_en_todas',
    (select count(*) from pg_tables where schemaname='public' and rowsecurity=false) = 0

  union all select 6, 'anon_sin_acceso',
    (select count(*) from pg_policies where schemaname='public' and 'anon' = any(roles)) = 0

  union all select 7, 'append_only_solo_select',
    not exists(select 1 from pg_policies
               where schemaname='public'
                 and tablename in ('factura_pagos','factura_incidencias','factura_aprobaciones')
                 and cmd <> 'SELECT')

  union all select 8, 'seed_sociedad_ANT',
    exists(select 1 from public.sociedades
            where id_ref='ANT' and nombre='Antifrágil S.C.' and cif is null)

  union all select 9, 'seed_proyectos (CLI-PLY activo + 3 placeholder)',
    (select count(*) from public.proyectos where id_ref in ('CLI-PLY','9AM','LIDO','EVT')) = 4
    and exists(select 1 from public.proyectos where id_ref='CLI-PLY' and estado='activo')

  union all select 10, 'seed_config (1 fila default)',
    (select count(*) from public.configuracion_contabilidad) = 1

  union all select 11, 'base_vacia_salvo_seed',
        (select count(*) from public.movimientos_bancarios)=0
    and (select count(*) from public.facturas_recibidas)=0
    and (select count(*) from public.factura_pagos)=0
    and (select count(*) from public.balance_sumas_saldos)=0
    and (select count(*) from public.vencimientos)=0
    and (select count(*) from public.cuentas_bancarias_sociedad)=0

  union all select 12, 'sin_objetos_A1',
    (select count(*) from information_schema.tables
      where table_schema='public'
        and table_name in ('cuenta_tesoreria','movimiento_caja','movimiento_tesoreria',
                           'arqueo_caja','saldo_tesoreria','tesoreria')) = 0

  union all select 13, 'sin_tablas_legacy',
    (select count(*) from information_schema.tables
      where table_schema='public'
        and table_name in ('proyecto_sociedades','vencimiento_sociedades','finanzas_sociedades',
                           'alsari_knowledge','patrimonio','activos','capex_activos',
                           'proyecto_analisis_financiero','proyecto_escenarios')) = 0

  union all select 14, 'sin_columnas_legacy (pct_pavier/pct_armia/holding_principal)',
    (select count(*) from information_schema.columns
      where table_schema='public'
        and column_name in ('pct_pavier','pct_armia','holding_principal')) = 0

  union all select 15, 'sin_nombres_legacy_en_schema (pavier/armia/rialsa/alsari)',
    not exists(select 1 from information_schema.columns
               where table_schema='public'
                 and (lower(table_name)  ~ 'pavier|armia|rialsa|alsari'
                   or lower(column_name) ~ 'pavier|armia|rialsa|alsari'))

  union all select 16, 'bucket_facturas_privado',
    exists(select 1 from storage.buckets where id='facturas' and public=false)

  union all select 17, 'sin_rastro_clinico_en_schema (compliance v1)',
    not exists(select 1 from information_schema.columns
               where table_schema='public'
                 and (lower(table_name)  ~ 'paciente|diagnostico|lesion|historia_clinica|anamnesis|patologia|medicacion|antecedente|nota_clinica|evolucion_clinica'
                   or lower(column_name) ~ 'paciente|diagnostico|lesion|historia_clinica|anamnesis|patologia|medicacion|antecedente|nota_clinica|evolucion_clinica'))
)
select 0 as n, 'RESULTADO GLOBAL' as comprobacion,
       case when (select bool_and(ok) from checks) then 'PASS ✅ (todo correcto)'
            else 'FAIL ❌ (revisar filas FAIL + PARTE 2)' end as estado
union all
select n, comprobacion, case when ok then 'PASS' else 'FAIL' end
from checks
order by n;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 2 — DETALLE (ejecutar solo lo que necesites si algo dio FAIL)        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- D1. ¿Qué tablas núcleo FALTAN? (esperado: 0 filas)
select t.nombre as tabla_faltante
from (values
  ('sociedades'),('proyectos'),('cuentas_bancarias_sociedad'),('configuracion_contabilidad'),
  ('plan_cuentas'),('reglas_categorizacion'),('contactos'),('proveedores_reglas'),
  ('movimientos_bancarios'),('extractos_bancarios'),('facturas_recibidas'),('facturas_emitidas'),
  ('factura_pagos'),('factura_incidencias'),('factura_aprobaciones'),
  ('asientos_borrador'),('asientos_oficiales'),('reconciliacion_log'),
  ('presupuestos'),('presupuesto_capitulos'),('presupuesto_partidas'),('presupuesto_pagos'),
  ('flujos_caja_proyectos'),('vencimientos'),('balance_sumas_saldos'),('kpis_sociedades')
) as t(nombre)
left join information_schema.tables i
  on i.table_schema='public' and i.table_name=t.nombre and i.table_type='BASE TABLE'
where i.table_name is null;

-- D2. ¿Qué vistas FALTAN? (esperado: 0 filas)
select v.nombre as vista_faltante
from (values
  ('v_balance_periodos'),('saldo_bancario_por_sociedad'),('compromisos_tesoreria'),
  ('flujos_proyecto_consolidados'),('cashflow_consolidado')
) as v(nombre)
left join information_schema.views i
  on i.table_schema='public' and i.table_name=v.nombre
where i.table_name is null;

-- D3. Tablas con RLS DESACTIVADO (esperado: 0 filas)
select tablename from pg_tables where schemaname='public' and rowsecurity=false order by tablename;

-- D4. Políticas que dan acceso a anon (esperado: 0 filas)
select tablename, policyname, roles from pg_policies
where schemaname='public' and 'anon' = any(roles);

-- D5. Seed actual (revisar a ojo)
select id_ref, nombre, cif, estado from public.sociedades order by id_ref;
select id_ref, nombre, sociedad_tenedora, estado from public.proyectos order by id_ref;
select email_guille, email_javi, email_alicia from public.configuracion_contabilidad;
-- Esperado: sociedad ('ANT','Antifrágil S.C.', NULL, 'activa');
--           proyectos CLI-PLY=activo, 9AM/LIDO/EVT=placeholder, todos tenedora 'ANT';
--           emails = pendiente@antifragil.invalid (placeholder).

-- D6. Objetos A1 que NO deberían existir (esperado: 0 filas)
select table_name, table_type from information_schema.tables
where table_schema='public'
  and table_name in ('cuenta_tesoreria','movimiento_caja','movimiento_tesoreria',
                     'arqueo_caja','saldo_tesoreria','tesoreria');

-- D7. Rastro legacy en nombres de tabla/columna (esperado: 0 filas)
select table_name, column_name from information_schema.columns
where table_schema='public'
  and (lower(table_name) ~ 'pavier|armia|rialsa|alsari'
    or lower(column_name) ~ 'pavier|armia|rialsa|alsari'
    or column_name in ('pct_pavier','pct_armia','holding_principal'));

-- D8. Bucket de storage (esperado: facturas, public = false)
select id, public from storage.buckets where id='facturas';

-- D9. Rastro clínico en nombres de tabla/columna (esperado: 0 filas — compliance v1)
select table_name, column_name from information_schema.columns
where table_schema='public'
  and (lower(table_name)  ~ 'paciente|diagnostico|lesion|historia_clinica|anamnesis|patologia|medicacion|antecedente|nota_clinica|evolucion_clinica'
    or lower(column_name) ~ 'paciente|diagnostico|lesion|historia_clinica|anamnesis|patologia|medicacion|antecedente|nota_clinica|evolucion_clinica');

-- D10. Conteos rápidos (todo 0 salvo seed)
select
  (select count(*) from public.sociedades)                 as sociedades,            -- 1
  (select count(*) from public.proyectos)                  as proyectos,             -- 4
  (select count(*) from public.configuracion_contabilidad) as config,                -- 1
  (select count(*) from public.movimientos_bancarios)      as movs_banc,             -- 0
  (select count(*) from public.facturas_recibidas)         as facturas_recibidas,    -- 0
  (select count(*) from public.factura_pagos)              as factura_pagos,         -- 0
  (select count(*) from public.balance_sumas_saldos)       as balance_lineas,        -- 0
  (select count(*) from public.vencimientos)               as vencimientos;          -- 0
