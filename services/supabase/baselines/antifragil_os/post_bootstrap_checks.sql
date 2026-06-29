-- ═══════════════════════════════════════════════════════════════════════════
-- ANTIFRÁGIL OS — Verificación POST-BOOTSTRAP (SOLO LECTURA)
-- ═══════════════════════════════════════════════════════════════════════════
-- Ejecutar en el SQL Editor del Supabase NUEVO, DESPUÉS de aplicar el baseline.
-- Todo es SELECT. Nada escribe. Interpretación esperada en comentarios.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. ¿Existen las TABLAS núcleo? (esperado: 26 filas) ──────────────────────
select table_name
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
  and table_name in (
    'sociedades','proyectos','cuentas_bancarias_sociedad','configuracion_contabilidad',
    'plan_cuentas','reglas_categorizacion','contactos','proveedores_reglas',
    'movimientos_bancarios','extractos_bancarios','facturas_recibidas','facturas_emitidas',
    'factura_pagos','factura_incidencias','factura_aprobaciones',
    'asientos_borrador','asientos_oficiales','reconciliacion_log',
    'presupuestos','presupuesto_capitulos','presupuesto_partidas','presupuesto_pagos',
    'flujos_caja_proyectos','vencimientos','balance_sumas_saldos','kpis_sociedades'
  )
order by table_name;

-- ── 2. ¿Existen las VISTAS? (esperado: 5 filas) ─────────────────────────────
select table_name
from information_schema.views
where table_schema = 'public'
  and table_name in (
    'v_balance_periodos','saldo_bancario_por_sociedad','compromisos_tesoreria',
    'flujos_proyecto_consolidados','cashflow_consolidado'
  )
order by table_name;

-- ── 3. ¿Existen las FUNCIONES/RPC? (esperado: 5 filas) ──────────────────────
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'touch_updated_at','registrar_pago_factura','resolver_incidencia_factura',
    'importar_extracto_bancario','deshacer_importacion_extracto'
  )
order by routine_name;

-- ── 4. RLS activado en TODAS las tablas public (esperado: rls_disabled = 0) ──
select count(*) as rls_disabled
from pg_tables
where schemaname = 'public' and rowsecurity = false;

-- ── 4b. anon NO debe tener políticas de acceso (esperado: 0 filas) ──────────
select tablename, policyname, roles
from pg_policies
where schemaname = 'public' and 'anon' = any(roles);

-- ── 4c. Append-only: SOLO policy SELECT (esperado: cmd = 'r' en las 3) ───────
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('factura_pagos','factura_incidencias','factura_aprobaciones')
order by tablename;

-- ── 5. Base VACÍA salvo seed (esperado: ver comentarios) ────────────────────
select
  (select count(*) from public.sociedades)               as sociedades,             -- 1
  (select count(*) from public.proyectos)                as proyectos,              -- 4
  (select count(*) from public.configuracion_contabilidad) as config,               -- 1
  (select count(*) from public.cuentas_bancarias_sociedad) as cuentas_banc,          -- 0
  (select count(*) from public.movimientos_bancarios)    as movs_banc,              -- 0
  (select count(*) from public.facturas_recibidas)       as facturas_recibidas,     -- 0
  (select count(*) from public.factura_pagos)            as factura_pagos,          -- 0
  (select count(*) from public.balance_sumas_saldos)     as balance_lineas,         -- 0
  (select count(*) from public.vencimientos)             as vencimientos;           -- 0

-- ── 6. Seed correcto y SIN datos sensibles (esperado: cif NULL) ─────────────
select id_ref, nombre, cif, estado from public.sociedades order by id_ref;
select id_ref, nombre, sociedad_tenedora, estado from public.proyectos order by id_ref;
-- Esperado sociedades: ('ANT','Antifrágil S.C.', NULL, 'activa')
-- Esperado proyectos: CLI-PLY=activo; 9AM/LIDO/EVT=placeholder; todos sociedad_tenedora='ANT'

-- ── 6b. Emails de config = PLACEHOLDER (esperado: los 3 = pendiente@antifragil.invalid) ──
select email_guille, email_javi, email_alicia from public.configuracion_contabilidad where id = 'default';

-- ── 7. NO existen objetos A1 (esperado: 0 filas) ────────────────────────────
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('cuenta_tesoreria','movimiento_caja','movimiento_tesoreria',
                     'arqueo_caja','saldo_tesoreria','tesoreria');

-- ── 8. NO hay rastro de la base anterior ────────────────────────────────────
-- 8a. Tablas legacy que NO deben existir (esperado: 0 filas)
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'proyecto_sociedades','vencimiento_sociedades','patrimonio','activos','capex_activos',
    'proyecto_analisis_financiero','proyecto_escenarios','alsari_knowledge','finanzas_sociedades'
  );

-- 8b. Columnas legacy que NO deben existir en sociedades (esperado: 0 filas)
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'sociedades'
  and column_name in ('pct_pavier','pct_armia','holding_principal');

-- ── 9. Las 5 vistas resuelven sin error (esperado: cada SELECT devuelve sin fallo) ──
select count(*) from public.v_balance_periodos;
select count(*) from public.saldo_bancario_por_sociedad;
select count(*) from public.compromisos_tesoreria;
select count(*) from public.flujos_proyecto_consolidados;
select count(*) from public.cashflow_consolidado;

-- ── 10. Bucket de Storage privado (esperado: facturas, public = false) ──────
select id, public from storage.buckets where id = 'facturas';
