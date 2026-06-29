-- ═══════════════════════════════════════════════════════════════════════════
-- ANTIFRÁGIL OS — BASELINE CONSOLIDADO CURADO
-- ═══════════════════════════════════════════════════════════════════════════
-- BORRADOR REVISABLE. NO aplicar todavía. NO es una migración de
-- services/supabase/migrations/ (ahí viven las ~70 migraciones heredadas/legacy,
-- que NO deben aplicarse a este Supabase nuevo). Ver README.md de esta carpeta.
--
-- Esquema núcleo financiero de Antifrágil OS para un Supabase NUEVO Y LIMPIO,
-- reconstruido como forma FINAL (todos los ALTER mergeados) a partir de las
-- migraciones heredadas, CURADO para EXCLUIR la carcasa de la base anterior:
--   · multi-holding (reparto por porcentajes entre sociedades tenedoras)
--   · patrimonio personal de socios
--   · lente de inversión (TIR/VAN/escenarios/valor terminal)
--   · seeds de datos reales heredados
--   · fuente externa legacy de KPIs (hoja de cálculo vía worker)
-- (lista explícita de exclusiones en excluded_legacy.md)
--
-- Modelo: SOCIEDAD ÚNICA (Antifrágil S.C.) con varios proyectos.
-- Convención: snake_case español · NUMERIC(14,2) dinero · enums TEXT CHECK ·
--   PK uuid default gen_random_uuid() · updated_at vía trigger touch_updated_at().
-- FUERA de este baseline (fases posteriores): A1 tesorería/caja, Clínica, Reservas,
--   facturación emitida avanzada / VeriFactu, recableado de frontend, datos reales.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── §0. Extensión ────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ── §1. Función trigger universal de updated_at ──────────────────────────────
-- fuente: 20260521140000_contactos_tipo_operacion.sql (verbatim)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §2. MAESTRO
-- ═══════════════════════════════════════════════════════════════════════════

-- fuente: 20260518120000_holding_structure.sql + 20260522120000_sociedades_ficha_bancaria.sql
-- CURADO: omitidas columnas legacy de reparto multi-holding y holding_principal.
create table if not exists public.sociedades (
  id_ref         text primary key,
  nombre         text not null,
  cif            text,
  estado         text,
  domicilio      text,
  localidad      text,
  codigo_postal  text,
  pais           text default 'España',
  email          text,
  telefono       text,
  logo_url       text,
  updated_at     timestamptz not null default now()
);

-- fuente: 20260518120000_holding_structure.sql
create table if not exists public.proyectos (
  id_ref            text primary key,
  nombre            text not null,
  sociedad_tenedora text references public.sociedades(id_ref),
  estado            text,
  updated_at        timestamptz not null default now()
);
create index if not exists idx_proyectos_tenedora on public.proyectos(sociedad_tenedora);

-- fuente: 20260522120000_sociedades_ficha_bancaria.sql
create table if not exists public.cuentas_bancarias_sociedad (
  id              uuid primary key default gen_random_uuid(),
  sociedad_id_ref text not null references public.sociedades(id_ref) on delete cascade,
  alias           text not null,
  titular         text not null,
  banco           text,
  iban            text not null,
  swift           text,
  activa          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists idx_cuentas_bancarias_sociedad_ref
  on public.cuentas_bancarias_sociedad(sociedad_id_ref);

-- ═══════════════════════════════════════════════════════════════════════════
-- §3. CONFIG + CONTABILIDAD BASE
-- ═══════════════════════════════════════════════════════════════════════════

-- fuente: 20260521100000_facturas_workflow_ocr.sql + 202606191000_facturas_pra_saneamiento.sql
-- ⚠️ EMAILS = PLACEHOLDER. Rellenar con los operadores REALES de Antifrágil antes de
--    producción (sin dominios heredados, no emails personales sin confirmación). Mientras los 3
--    correos sean iguales, el sistema corre en modo SINGLE-OPERATOR (las RPC no exigen rol).
create table if not exists public.configuracion_contabilidad (
  id                     text primary key default 'default',
  umbral_aprobacion_javi numeric(12,2) not null default 1000,
  email_guille           text not null default 'pendiente@antifragil.invalid',
  email_javi             text not null default 'pendiente@antifragil.invalid',
  email_alicia           text not null default 'pendiente@antifragil.invalid',
  notifications_enabled  boolean not null default false,
  updated_at             timestamptz not null default now()
);

-- fuente: 20260521090300_plan_cuentas_reglas.sql (tabla 1 de 2)
create table if not exists public.plan_cuentas (
  id              uuid primary key default gen_random_uuid(),
  sociedad_id_ref text not null,
  codigo          text not null,
  descripcion     text not null,
  tipo            text not null check (tipo in ('activo','pasivo','patrimonio','ingreso','gasto','resultado')),
  padre_codigo    text,
  nivel           int  not null default 1,
  activa          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (sociedad_id_ref, codigo)
);
create index if not exists plan_cuentas_sociedad_idx on public.plan_cuentas(sociedad_id_ref, codigo);

-- fuente: 20260521090300_plan_cuentas_reglas.sql (tabla 2 de 2)
-- CURADO: OMITIDO el seed legacy de reglas (entidades heredadas + lógica intragrupo holding).
create table if not exists public.reglas_categorizacion (
  id             uuid primary key default gen_random_uuid(),
  patron         text not null,
  campo          text not null default 'concepto' check (campo in ('concepto','contraparte','banco')),
  es_regex       boolean not null default false,
  categoria      text not null,
  subcategoria   text,
  es_intragrupo  boolean not null default false,
  prioridad      int  not null default 50,
  fuente         text not null default 'sistema' check (fuente in ('sistema','usuario','aprendizaje')),
  confirmaciones int  not null default 0,
  activa         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists reglas_categorizacion_prioridad_idx on public.reglas_categorizacion(prioridad desc);

-- fuente: 20260521140000_contactos_tipo_operacion.sql
create table if not exists public.contactos (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  nif        text,
  tipo       text not null default 'proveedor' check (tipo in ('proveedor','cliente','ambos')),
  email      text,
  telefono   text,
  direccion  text,
  notas      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists contactos_nif_unique
  on public.contactos(nif) where nif is not null and nif <> '';

-- ═══════════════════════════════════════════════════════════════════════════
-- §4. BANCO
-- ═══════════════════════════════════════════════════════════════════════════

-- fuente: 202606231000_extractos_bancarios.sql
create table if not exists public.extractos_bancarios (
  id                  uuid primary key default gen_random_uuid(),
  sociedad_id_ref     text not null references public.sociedades(id_ref) on delete cascade,
  cuenta_bancaria_id  uuid references public.cuentas_bancarias_sociedad(id) on delete set null,
  banco               text,
  iban                text,
  anio                int not null,
  mes                 int not null check (mes between 1 and 12),
  nombre_archivo      text,
  formato             text check (formato in ('csv','xlsx')),
  archivo_hash        text not null,
  n_movimientos       int not null default 0,
  n_importados        int not null default 0,
  n_duplicados        int not null default 0,
  rango_fecha_min     date,
  rango_fecha_max     date,
  estado              text not null default 'importado'
                      check (estado in ('importado','pendiente_revision','listo_conciliacion','deshecho')),
  importado_por_email text,
  notas               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index if not exists extractos_bancarios_archivo_uniq
  on public.extractos_bancarios (sociedad_id_ref, archivo_hash) where estado <> 'deshecho';
create index if not exists extractos_bancarios_sociedad_idx
  on public.extractos_bancarios (sociedad_id_ref, anio, mes);

-- fuente: 20260521090000_movimientos_bancarios.sql + 202606231000_extractos_bancarios.sql (cols aditivas)
create table if not exists public.movimientos_bancarios (
  id                   uuid primary key default gen_random_uuid(),
  sociedad_id_ref      text not null,
  iban                 text not null,
  banco                text not null check (banco in ('santander','bbva','caixabank','caja_rural','otro')),
  fecha                date not null,
  fecha_valor          date,
  concepto             text not null,
  concepto_normalizado text,
  importe              numeric(14,2) not null,
  saldo                numeric(14,2),
  categoria            text,
  subcategoria         text,
  es_intragrupo        boolean not null default false,
  entidad_contraparte  text,
  proyecto_id_ref      text,
  factura_recibida_id  uuid,
  asiento_borrador_id  uuid,
  extracto_id          uuid references public.extractos_bancarios(id) on delete set null,
  cuenta_bancaria_id   uuid references public.cuentas_bancarias_sociedad(id) on delete set null,
  hash                 text,
  referencia           text,
  tipo_movimiento      text,
  revisado             boolean not null default false,
  notas                text,
  fuente               text not null,
  importado_at         timestamptz not null default now(),
  created_at           timestamptz not null default now()
);
create index if not exists movimientos_bancarios_sociedad_idx  on public.movimientos_bancarios(sociedad_id_ref);
create index if not exists movimientos_bancarios_fecha_idx     on public.movimientos_bancarios(fecha desc);
create index if not exists movimientos_bancarios_iban_idx      on public.movimientos_bancarios(iban);
create index if not exists movimientos_bancarios_categoria_idx on public.movimientos_bancarios(categoria);
create index if not exists movimientos_bancarios_extracto_idx  on public.movimientos_bancarios(extracto_id);
create unique index if not exists movimientos_bancarios_hash_uniq
  on public.movimientos_bancarios (sociedad_id_ref, hash) where hash is not null;

-- ═══════════════════════════════════════════════════════════════════════════
-- §5. PRESUPUESTOS (núcleo; el detalle de cashflow depende de aquí)
-- ═══════════════════════════════════════════════════════════════════════════

-- fuente: 20260525090000_presupuestos.sql + 20260605000004_presupuesto_ingresos.sql (categoria)
create table if not exists public.presupuestos (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  tipo            text not null default 'capex' check (tipo in ('obra','explotacion','capex','corporativo','tesoreria')),
  categoria       text not null default 'gasto' check (categoria in ('gasto','ingreso')),
  proyecto_nombre text,
  proyecto_id_ref text references public.proyectos(id_ref) on delete set null,
  sociedad_id_ref text,
  estado          text not null default 'borrador' check (estado in ('borrador','activo','cerrado')),
  fecha_inicio    date,
  fecha_fin       date,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists presupuestos_sociedad_idx  on public.presupuestos(sociedad_id_ref);
create index if not exists presupuestos_estado_idx    on public.presupuestos(estado);
create index if not exists presupuestos_proyecto_idx  on public.presupuestos(proyecto_id_ref);
create index if not exists presupuestos_categoria_idx on public.presupuestos(categoria);

-- fuente: 20260525090000_presupuestos.sql
create table if not exists public.presupuesto_capitulos (
  id             uuid primary key default gen_random_uuid(),
  presupuesto_id uuid not null references public.presupuestos(id) on delete cascade,
  nombre         text not null,
  orden          int  not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists presupuesto_capitulos_presupuesto_idx on public.presupuesto_capitulos(presupuesto_id);

-- fuente: 20260525090000 + 20260525170000_partida_tipo_iva.sql + 20260604090000_partidas_recurrencia_sociedad.sql
create table if not exists public.presupuesto_partidas (
  id                       uuid primary key default gen_random_uuid(),
  presupuesto_id           uuid not null references public.presupuestos(id) on delete cascade,
  capitulo_id              uuid not null references public.presupuesto_capitulos(id) on delete cascade,
  codigo                   text,
  descripcion              text not null,
  importe_presupuestado    numeric(14,2) not null default 0,
  tipo_iva                 numeric(4,1) not null default 0 check (tipo_iva in (0,4,10,21)),
  proveedor_esperado       text,
  recurrencia              text check (recurrencia in ('mensual','trimestral','semestral','anual')),
  fecha_inicio_recurrencia date,
  fecha_fin_recurrencia    date,
  notas                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists presupuesto_partidas_presupuesto_idx on public.presupuesto_partidas(presupuesto_id);
create index if not exists presupuesto_partidas_capitulo_idx    on public.presupuesto_partidas(capitulo_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- §6. PROVEEDORES (reglas de sugerencia)
-- ═══════════════════════════════════════════════════════════════════════════

-- fuente: 202606230900_proveedores_reglas.sql
create table if not exists public.proveedores_reglas (
  id                         uuid primary key default gen_random_uuid(),
  contacto_id                uuid not null references public.contactos(id) on delete cascade,
  nif_normalizado            text,
  sociedad_id_ref            text references public.sociedades(id_ref) on delete cascade,
  cuenta_contable_default    text,
  proyecto_id_ref            text,
  presupuesto_id             uuid references public.presupuestos(id) on delete set null,
  partida_id                 uuid references public.presupuesto_partidas(id) on delete set null,
  metodo_pago_default        text check (metodo_pago_default in ('transferencia','domiciliacion','tarjeta','efectivo','otro')),
  es_domiciliada             boolean not null default false,
  requiere_pago_manual       boolean not null default false,
  requiere_aprobacion_javi   boolean not null default false,
  requiere_factura           boolean not null default true,
  requiere_justificante_pago boolean not null default true,
  tipo_operacion_default     text check (tipo_operacion_default in ('normal','exenta','no_sujeta','inversion_sujeto_pasivo','suplido')),
  iva_default                numeric(5,2),
  retencion_pct_default      numeric(5,2),
  importe_habitual           numeric(14,2),
  tolerancia_importe_pct     numeric(6,2),
  concepto_recurrente        text,
  auto_validar               boolean not null default false,
  activa                     boolean not null default true,
  notas                      text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
create unique index if not exists proveedores_reglas_contacto_sociedad_uniq
  on public.proveedores_reglas (contacto_id, sociedad_id_ref) where activa and sociedad_id_ref is not null;
create unique index if not exists proveedores_reglas_contacto_global_uniq
  on public.proveedores_reglas (contacto_id) where activa and sociedad_id_ref is null;
create index if not exists proveedores_reglas_contacto_idx on public.proveedores_reglas (contacto_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- §7. FACTURAS
-- ═══════════════════════════════════════════════════════════════════════════

-- fuente: 20260521090100_facturas.sql + workflow_ocr + cuenta_gasto + estados_v2(neutralizado)
--   + fix_default + pra_saneamiento(CHECK/default FINAL) + fix_motivo_rechazo
--   + sociedad_receptora + factura_drive + contactos_tipo_operacion + storage_privado
--   + proveedores_reglas + presupuestos(presupuesto_pago_id) + metricas(FK proyecto)
-- NOTA: la FK presupuesto_pago_id -> presupuesto_pagos se añade DIFERIDA en §8 (ciclo).
create table if not exists public.facturas_recibidas (
  id                  uuid primary key default gen_random_uuid(),
  sociedad_id_ref     text,                       -- nullable: factura sin sociedad validada
  numero_factura      text,
  proveedor_nombre    text not null,
  proveedor_nif       text,
  fecha_factura       date not null,
  fecha_vencimiento   date,
  base_imponible      numeric(14,2) not null default 0,
  tipo_iva            numeric(5,2)  not null default 21,
  cuota_iva           numeric(14,2) not null default 0,
  retencion_pct       numeric(5,2)  not null default 0,
  retencion_importe   numeric(14,2) not null default 0,
  total               numeric(14,2) not null default 0,
  total_a_pagar       numeric(14,2) not null default 0,
  concepto            text,
  categoria           text,
  subcategoria        text,
  proyecto_id_ref     text references public.proyectos(id_ref) on delete set null,
  cuenta_gasto        text,
  tipo_operacion      text default 'normal'
                      check (tipo_operacion in ('normal','exenta','no_sujeta','inversion_sujeto_pasivo','suplido')),
  receptor_nombre_ocr text,
  receptor_nif_ocr    text,
  contacto_id         uuid references public.contactos(id),
  sociedad_validada   boolean not null default true,
  estado              text not null default 'borrador_ocr'
                      check (estado in ('borrador_ocr','revision_javi','pendiente_pago','pagada','rechazada')),
  motivo_rechazo      text,
  paso_rechazo        text,
  ocr_raw             jsonb,
  ocr_confianza       jsonb,
  storage_path        text,
  archivo_url         text,
  drive_file_id       text,
  drive_folder_id     text,
  drive_estado        text not null default 'no_archivado' check (drive_estado in ('no_archivado','sincronizado','error')),
  drive_error         text,
  drive_web_link      text,
  drive_synced_at     timestamptz,
  es_domiciliada      boolean not null default false,
  regla_aplicada_id   uuid references public.proveedores_reglas(id) on delete set null,
  presupuesto_pago_id uuid,                       -- FK diferida (ver §8)
  movimiento_id       uuid references public.movimientos_bancarios(id) on delete set null,
  notas               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists facturas_recibidas_sociedad_idx on public.facturas_recibidas(sociedad_id_ref);
create index if not exists facturas_recibidas_fecha_idx    on public.facturas_recibidas(fecha_factura desc);
create index if not exists facturas_recibidas_estado_idx   on public.facturas_recibidas(estado);
create index if not exists idx_facturas_recibidas_proyecto on public.facturas_recibidas(proyecto_id_ref);

-- fuente: 20260521090100_facturas.sql + 20260522120000_sociedades_ficha_bancaria.sql
create table if not exists public.facturas_emitidas (
  id                      uuid primary key default gen_random_uuid(),
  sociedad_id_ref         text not null,
  numero_factura          text not null,
  serie                   text not null default 'A',
  cliente_nombre          text not null,
  cliente_nif             text,
  cliente_direccion       text,
  fecha_factura           date not null,
  fecha_vencimiento       date,
  lineas                  jsonb not null default '[]',
  base_imponible          numeric(14,2) not null default 0,
  tipo_iva                numeric(5,2)  not null default 21,
  cuota_iva               numeric(14,2) not null default 0,
  retencion_pct           numeric(5,2)  not null default 0,
  retencion_importe       numeric(14,2) not null default 0,
  total                   numeric(14,2) not null default 0,
  total_a_cobrar          numeric(14,2) not null default 0,
  estado                  text not null default 'borrador' check (estado in ('borrador','emitida','cobrada','vencida','anulada')),
  metodo_pago             text,
  cuenta_bancaria_iban    text,
  cuenta_bancaria_alias   text,
  cuenta_bancaria_titular text,
  movimiento_id           uuid references public.movimientos_bancarios(id) on delete set null,
  notas                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists facturas_emitidas_sociedad_idx on public.facturas_emitidas(sociedad_id_ref);
create index if not exists facturas_emitidas_fecha_idx    on public.facturas_emitidas(fecha_factura desc);
create index if not exists facturas_emitidas_estado_idx   on public.facturas_emitidas(estado);

-- ═══════════════════════════════════════════════════════════════════════════
-- §8. PRESUPUESTO_PAGOS + FK diferida del ciclo facturas↔pagos
-- ═══════════════════════════════════════════════════════════════════════════

-- fuente: 20260525090000 + proyectos_module(fecha_real_pago) + pago_tipo_iva
--   + tesoreria_y_tareas(contingente,notas_condicion) + presupuesto_ingresos(factura_emitida_id)
-- CURADO: CHECK de estado AMPLIADO a los estados de necesidades de tesorería que la vista
--   flujos_proyecto_consolidados ya asume (estimado/confirmado/facturado) — salda deuda conocida.
create table if not exists public.presupuesto_pagos (
  id                  uuid primary key default gen_random_uuid(),
  presupuesto_id      uuid not null references public.presupuestos(id) on delete cascade,
  partida_id          uuid not null references public.presupuesto_partidas(id) on delete cascade,
  descripcion         text,
  importe             numeric(14,2) not null,
  tipo_iva            numeric(4,1) not null default 0 check (tipo_iva in (0,4,10,21)),
  fecha_prevista      date not null,
  fecha_real_pago     date,
  estado              text not null default 'pendiente'
                      check (estado in ('pendiente','pagado','cancelado','estimado','confirmado','facturado')),
  tipo_flujo          text not null default 'gasto' check (tipo_flujo in ('gasto','ingreso')),
  contingente         boolean not null default false,
  notas_condicion     text,
  factura_recibida_id uuid references public.facturas_recibidas(id) on delete set null,
  factura_emitida_id  uuid references public.facturas_emitidas(id)  on delete set null,
  notas               text,
  created_at          timestamptz not null default now()
);
create index if not exists presupuesto_pagos_presupuesto_idx on public.presupuesto_pagos(presupuesto_id);
create index if not exists presupuesto_pagos_partida_idx     on public.presupuesto_pagos(partida_id);
create index if not exists presupuesto_pagos_fecha_idx       on public.presupuesto_pagos(fecha_prevista asc);
create index if not exists presupuesto_pagos_estado_idx      on public.presupuesto_pagos(estado);

-- FK diferida: cierra el ciclo facturas_recibidas (§7) ↔ presupuesto_pagos (§8)
alter table public.facturas_recibidas
  drop constraint if exists facturas_recibidas_presupuesto_pago_fk;
alter table public.facturas_recibidas
  add constraint facturas_recibidas_presupuesto_pago_fk
  foreign key (presupuesto_pago_id) references public.presupuesto_pagos(id) on delete set null;
create index if not exists facturas_recibidas_presupuesto_pago_idx
  on public.facturas_recibidas(presupuesto_pago_id) where presupuesto_pago_id is not null;

-- ═══════════════════════════════════════════════════════════════════════════
-- §9. PAGOS (libros APPEND-ONLY — cliente solo SELECT; escritura por RPC)
-- ═══════════════════════════════════════════════════════════════════════════

-- fuente: 202606192100_factura_pagos.sql + 202606192400_factura_drive.sql
create table if not exists public.factura_pagos (
  id                          uuid primary key default gen_random_uuid(),
  factura_id                  uuid not null references public.facturas_recibidas(id) on delete cascade,
  importe                     numeric(14,2) not null,
  fecha_pago                  date not null default current_date,
  metodo_pago                 text not null check (metodo_pago in ('transferencia','domiciliacion','tarjeta','efectivo','otro')),
  tipo_pago                   text not null check (tipo_pago in ('total','parcial','anticipo','regularizacion')),
  justificante_storage_path   text,
  justificante_nombre_archivo text,
  justificante_mime_type      text,
  justificante_size           bigint,
  comentario                  text,
  registrado_por_email        text,
  registrado_por_rol          text,
  drive_file_id               text,
  drive_estado                text not null default 'no_archivado' check (drive_estado in ('no_archivado','sincronizado','error')),
  drive_error                 text,
  drive_web_link              text,
  drive_synced_at             timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint factura_pagos_importe_no_cero              check (importe <> 0),
  constraint factura_pagos_negativo_solo_regularizacion check (importe > 0 or tipo_pago = 'regularizacion')
);
create index if not exists factura_pagos_factura_idx on public.factura_pagos (factura_id, fecha_pago);

-- fuente: 202606192100_factura_pagos.sql
create table if not exists public.factura_incidencias (
  id                 uuid primary key default gen_random_uuid(),
  factura_id         uuid not null references public.facturas_recibidas(id) on delete cascade,
  pago_id            uuid references public.factura_pagos(id) on delete set null,
  tipo               text not null check (tipo in ('infrapago','sobrepago','justificante_no_coincide','falta_justificante','pago_duplicado_posible','otro')),
  severidad          text not null default 'media' check (severidad in ('baja','media','alta')),
  descripcion        text,
  resuelta           boolean not null default false,
  resuelta_por_email text,
  resuelta_at        timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists factura_incidencias_factura_idx on public.factura_incidencias (factura_id, created_at);

-- fuente: 202606191100_factura_aprobaciones.sql + factura_pagos + sociedad_receptora (CHECK accion FINAL)
create table if not exists public.factura_aprobaciones (
  id              uuid primary key default gen_random_uuid(),
  factura_id      uuid not null references public.facturas_recibidas(id) on delete cascade,
  actor_email     text,
  actor_nombre    text,
  actor_rol       text not null default 'otro' check (actor_rol in ('guille','javi','alicia','sistema','otro')),
  accion          text not null check (accion in ('crea_borrador_ocr','valida','aprueba','rechaza','marca_pagada','registra_pago','crea_incidencia','resuelve_incidencia','cambia_sociedad','solicita_aclaracion','cambia_estado')),
  estado_anterior text,
  estado_nuevo    text not null,
  comentario      text,
  motivo_rechazo  text,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists factura_aprobaciones_factura_idx on public.factura_aprobaciones (factura_id, created_at);
create unique index if not exists factura_aprobaciones_creacion_unica
  on public.factura_aprobaciones (factura_id) where accion = 'crea_borrador_ocr';

-- ═══════════════════════════════════════════════════════════════════════════
-- §10. ASIENTOS + RECONCILIACIÓN
-- ═══════════════════════════════════════════════════════════════════════════

-- fuente: 20260521090200_asientos.sql
create table if not exists public.asientos_borrador (
  id                  uuid primary key default gen_random_uuid(),
  sociedad_id_ref     text not null,
  fecha               date not null,
  numero              text,
  concepto            text not null,
  lineas              jsonb not null default '[]',
  total_debe          numeric(14,2) not null default 0,
  total_haber         numeric(14,2) not null default 0,
  estado              text not null default 'borrador' check (estado in ('borrador','confirmado','rechazado')),
  movimiento_id       uuid references public.movimientos_bancarios(id) on delete set null,
  factura_recibida_id uuid references public.facturas_recibidas(id) on delete set null,
  factura_emitida_id  uuid references public.facturas_emitidas(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists asientos_borrador_sociedad_idx on public.asientos_borrador(sociedad_id_ref);
create index if not exists asientos_borrador_fecha_idx    on public.asientos_borrador(fecha desc);

-- fuente: 20260521090200_asientos.sql
create table if not exists public.asientos_oficiales (
  id                    uuid primary key default gen_random_uuid(),
  sociedad_id_ref       text not null,
  fecha                 date not null,
  numero_oficial        text,
  concepto              text not null,
  lineas                jsonb not null default '[]',
  total_debe            numeric(14,2) not null default 0,
  total_haber           numeric(14,2) not null default 0,
  fuente                text not null default 'csv' check (fuente in ('a3','sage','holded','contasol','csv','manual')),
  asiento_borrador_id   uuid references public.asientos_borrador(id) on delete set null,
  estado_reconciliacion text not null default 'pendiente' check (estado_reconciliacion in ('pendiente','coincide','diferencia','sin_borrador')),
  created_at            timestamptz not null default now()
);
create index if not exists asientos_oficiales_sociedad_idx on public.asientos_oficiales(sociedad_id_ref);
create index if not exists asientos_oficiales_fecha_idx    on public.asientos_oficiales(fecha desc);

-- fuente: 20260521090400_reconciliacion.sql
create table if not exists public.reconciliacion_log (
  id                  uuid primary key default gen_random_uuid(),
  sociedad_id_ref     text not null,
  periodo             text not null,
  asiento_oficial_id  uuid references public.asientos_oficiales(id) on delete cascade,
  asiento_borrador_id uuid references public.asientos_borrador(id) on delete set null,
  tipo                text not null check (tipo in ('coincide','diferencia_importe','diferencia_cuenta','diferencia_fecha','sin_borrador','sin_oficial')),
  score_similitud     numeric(5,2),
  diferencias         jsonb,
  resuelto            boolean not null default false,
  resolucion_notas    text,
  created_at          timestamptz not null default now()
);
create index if not exists reconciliacion_log_sociedad_periodo_idx on public.reconciliacion_log(sociedad_id_ref, periodo);

-- ═══════════════════════════════════════════════════════════════════════════
-- §11. FLUJOS MANUALES + TESORERÍA (vencimientos)
-- ═══════════════════════════════════════════════════════════════════════════

-- fuente: 20260519120000_proyecto_detail_v2.sql
create table if not exists public.flujos_caja_proyectos (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id text not null references public.proyectos(id_ref) on delete cascade,
  fecha       date not null,
  importe     numeric(14,2) not null,
  tipo_flujo  text not null check (tipo_flujo in ('inversion','recapex','venta','dividendo','ingreso_operativo','gasto_operativo','otro')),
  concepto    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_flujos_proyecto_fecha on public.flujos_caja_proyectos (proyecto_id, fecha);

-- fuente: 20260520100000_vencimientos.sql + 20260602090000_vencimientos_es_entrada.sql
-- CURADO: excluidos tipos 'pignorado'/'prestamo' (lente inversión) y la columna duplicada sociedad_id_ref.
create table if not exists public.vencimientos (
  id                uuid primary key default gen_random_uuid(),
  titulo            text not null,
  tipo              text not null check (tipo in ('seguro','deuda','contrato','impuesto','compromiso','otro')),
  descripcion       text,
  importe           numeric(14,2),
  fecha_vencimiento date not null,
  sociedad_id       text references public.sociedades(id_ref) on delete set null,
  notas             text,
  estado            text not null default 'pendiente' check (estado in ('pendiente','gestionado','vencido')),
  recurrencia       text check (recurrencia in ('anual','semestral','trimestral','mensual')),
  es_entrada        boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_vencimientos_fecha    on public.vencimientos(fecha_vencimiento);
create index if not exists idx_vencimientos_sociedad on public.vencimientos(sociedad_id);
create index if not exists idx_vencimientos_estado   on public.vencimientos(estado);

-- ═══════════════════════════════════════════════════════════════════════════
-- §12. BALANCE / KPI (motor PGC)
-- ═══════════════════════════════════════════════════════════════════════════

-- fuente: 20260520130000_balance_sumas_saldos.sql
create table if not exists public.balance_sumas_saldos (
  id             uuid primary key default gen_random_uuid(),
  sociedad_id    text not null,
  periodo        date not null,
  cuenta         text not null,
  descripcion    text,
  debe           numeric(14,2) not null default 0,
  haber          numeric(14,2) not null default 0,
  saldo_deudor   numeric(14,2) not null default 0,
  saldo_acreedor numeric(14,2) not null default 0,
  created_at     timestamptz not null default now(),
  constraint uq_balance unique (sociedad_id, periodo, cuenta)
);
create index if not exists idx_balance_soc_periodo on public.balance_sumas_saldos (sociedad_id, periodo);

-- fuente: 20260518120000_holding_structure.sql (almacén de KPIs por sociedad; SIN feed CF Worker)
create table if not exists public.kpis_sociedades (
  id_ref                text primary key,
  nombre                text,
  tipo                  text,
  caja_disponible       numeric(15,2),
  deuda_bancaria_cp     numeric(15,2),
  deuda_bancaria_lp     numeric(15,2),
  deuda_bancaria        numeric(15,2),
  deuda_socios          numeric(15,2),
  deuda_financiera_neta numeric(15,2),
  activo_corriente      numeric(15,2),
  activo_no_corriente   numeric(15,2),
  activo_total          numeric(15,2),
  pasivo_corriente      numeric(15,2),
  pasivo_no_corriente   numeric(15,2),
  pasivo_total          numeric(15,2),
  fondo_maniobra        numeric(15,2),
  patrimonio_neto       numeric(15,2),
  fecha_actualizacion   date,
  updated_at            timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- §13. TRIGGERS updated_at
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array[
    'sociedades','proyectos','kpis_sociedades','extractos_bancarios','facturas_recibidas',
    'facturas_emitidas','factura_pagos','configuracion_contabilidad','contactos',
    'proveedores_reglas','asientos_borrador','presupuestos','presupuesto_partidas',
    'vencimientos','flujos_caja_proyectos'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t||'_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t||'_touch', t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §14. RPC (verbatim de las migraciones fuente — contrato intacto)
-- ═══════════════════════════════════════════════════════════════════════════

-- fuente: 202606192100_factura_pagos.sql
create or replace function public.registrar_pago_factura(
  p_pago_id                   uuid,
  p_factura_id                uuid,
  p_importe                   numeric,
  p_fecha_pago                date,
  p_metodo_pago               text,
  p_tipo_pago                 text,
  p_justificante_storage_path text default null,
  p_justificante_nombre       text default null,
  p_justificante_mime         text default null,
  p_justificante_size         bigint default null,
  p_comentario                text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_factura       public.facturas_recibidas;
  v_estado        text;
  v_total_a_pagar numeric;
  v_eg text; v_ej text; v_ea text;
  v_email   text;
  v_rol     text;
  v_nombre  text;
  v_test    boolean;
  v_pago_id uuid;
  v_pagado_nuevo numeric;
  v_pendiente    numeric;
  v_tol     numeric := 0.5;
  v_incidencia_id uuid;
  v_transiciona boolean := false;
begin
  if p_metodo_pago not in ('transferencia','domiciliacion','tarjeta','efectivo','otro') then
    raise exception 'metodo_pago inválido: %', p_metodo_pago using errcode = '22023'; end if;
  if p_tipo_pago not in ('total','parcial','anticipo','regularizacion') then
    raise exception 'tipo_pago inválido: %', p_tipo_pago using errcode = '22023'; end if;
  if p_importe = 0 then
    raise exception 'El importe del pago no puede ser 0' using errcode = '22023'; end if;
  if p_importe < 0 and p_tipo_pago <> 'regularizacion' then
    raise exception 'Importe negativo solo permitido en pagos de tipo regularizacion' using errcode = '22023'; end if;

  select * into v_factura from public.facturas_recibidas where id = p_factura_id for update;
  if not found then raise exception 'Factura % no existe', p_factura_id using errcode = 'P0002'; end if;
  v_estado := v_factura.estado;
  v_total_a_pagar := coalesce(v_factura.total_a_pagar,
                              coalesce(v_factura.total, 0) - coalesce(v_factura.retencion_importe, 0));

  select email_guille, email_javi, email_alicia into v_eg, v_ej, v_ea
    from public.configuracion_contabilidad where id = 'default';
  v_test := (v_eg is not null and v_eg = v_ej and v_ej = v_ea);
  v_email := nullif(auth.jwt() ->> 'email', '');
  v_rol := case
    when v_email is null then 'otro'
    when v_email = v_eg then 'guille' when v_email = v_ej then 'javi' when v_email = v_ea then 'alicia'
    else 'otro' end;
  v_nombre := case v_rol when 'guille' then 'Guille' when 'javi' then 'Javi' when 'alicia' then 'Alicia' else null end;

  if not v_test and v_rol <> 'alicia' then
    raise exception 'Solo Alicia puede registrar pagos (rol actual: %)', v_rol using errcode = '42501'; end if;

  if v_estado in ('borrador_ocr','revision_javi','rechazada') then
    raise exception 'No se pueden registrar pagos en estado %', v_estado using errcode = '42501'; end if;
  if v_estado = 'pagada' and p_tipo_pago <> 'regularizacion' then
    raise exception 'La factura ya está pagada: solo se admiten regularizaciones' using errcode = '42501'; end if;

  v_pago_id := coalesce(p_pago_id, gen_random_uuid());

  insert into public.factura_pagos
    (id, factura_id, importe, fecha_pago, metodo_pago, tipo_pago,
     justificante_storage_path, justificante_nombre_archivo, justificante_mime_type, justificante_size,
     comentario, registrado_por_email, registrado_por_rol)
  values
    (v_pago_id, p_factura_id, p_importe, coalesce(p_fecha_pago, current_date), p_metodo_pago, p_tipo_pago,
     p_justificante_storage_path, p_justificante_nombre, p_justificante_mime, p_justificante_size,
     p_comentario, v_email, v_rol);

  select coalesce(sum(importe), 0) into v_pagado_nuevo from public.factura_pagos where factura_id = p_factura_id;
  v_pendiente := round(v_total_a_pagar - v_pagado_nuevo, 2);

  insert into public.factura_aprobaciones
    (factura_id, actor_email, actor_nombre, actor_rol, accion, estado_anterior, estado_nuevo, comentario, metadata)
  values
    (p_factura_id, v_email, v_nombre, v_rol, 'registra_pago', v_estado, v_estado, p_comentario,
     jsonb_build_object('pago_id', v_pago_id, 'importe', p_importe, 'tipo_pago', p_tipo_pago,
                        'total_pagado', v_pagado_nuevo, 'pendiente', v_pendiente));

  if v_pendiente < -v_tol then
    v_incidencia_id := gen_random_uuid();
    insert into public.factura_incidencias (id, factura_id, pago_id, tipo, severidad, descripcion)
    values (v_incidencia_id, p_factura_id, v_pago_id, 'sobrepago', 'media',
            format('Sobrepago: pagado %s € sobre %s € (exceso %s €)', v_pagado_nuevo, v_total_a_pagar, -v_pendiente));
    insert into public.factura_aprobaciones
      (factura_id, actor_email, actor_nombre, actor_rol, accion, estado_anterior, estado_nuevo, comentario, metadata)
    values (p_factura_id, v_email, v_nombre, v_rol, 'crea_incidencia', v_estado, v_estado, 'Sobrepago detectado',
            jsonb_build_object('incidencia_id', v_incidencia_id, 'tipo', 'sobrepago'));
  end if;

  if p_tipo_pago = 'total' and v_pendiente > v_tol then
    v_incidencia_id := gen_random_uuid();
    insert into public.factura_incidencias (id, factura_id, pago_id, tipo, severidad, descripcion)
    values (v_incidencia_id, p_factura_id, v_pago_id, 'infrapago', 'media',
            format('Pago marcado como total pero queda pendiente %s €', v_pendiente));
    insert into public.factura_aprobaciones
      (factura_id, actor_email, actor_nombre, actor_rol, accion, estado_anterior, estado_nuevo, comentario, metadata)
    values (p_factura_id, v_email, v_nombre, v_rol, 'crea_incidencia', v_estado, v_estado, 'Infrapago detectado',
            jsonb_build_object('incidencia_id', v_incidencia_id, 'tipo', 'infrapago'));
  end if;

  if v_estado = 'pendiente_pago' and abs(v_pendiente) <= v_tol then
    update public.facturas_recibidas set estado = 'pagada', updated_at = now() where id = p_factura_id;
    v_transiciona := true;
    insert into public.factura_aprobaciones
      (factura_id, actor_email, actor_nombre, actor_rol, accion, estado_anterior, estado_nuevo, comentario)
    values (p_factura_id, v_email, v_nombre, v_rol, 'marca_pagada', v_estado, 'pagada',
            'Pago completo (dentro de tolerancia)');
    if v_factura.presupuesto_pago_id is not null then
      update public.presupuesto_pagos set estado = 'pagado' where id = v_factura.presupuesto_pago_id;
    end if;
  end if;

  return jsonb_build_object(
    'pago_id', v_pago_id,
    'estado_factura', case when v_transiciona then 'pagada' else v_estado end,
    'total_pagado', v_pagado_nuevo,
    'pendiente', v_pendiente,
    'transiciona', v_transiciona
  );
end;
$$;
grant execute on function
  public.registrar_pago_factura(uuid, uuid, numeric, date, text, text, text, text, text, bigint, text)
  to authenticated;

-- fuente: 202606192100_factura_pagos.sql
create or replace function public.resolver_incidencia_factura(
  p_incidencia_id uuid,
  p_comentario    text default null
) returns public.factura_incidencias
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_inc    public.factura_incidencias;
  v_estado text;
  v_eg text; v_ej text; v_ea text;
  v_email text; v_rol text; v_nombre text; v_test boolean;
begin
  select * into v_inc from public.factura_incidencias where id = p_incidencia_id for update;
  if not found then raise exception 'Incidencia % no existe', p_incidencia_id using errcode = 'P0002'; end if;
  if v_inc.resuelta then return v_inc; end if;

  select email_guille, email_javi, email_alicia into v_eg, v_ej, v_ea
    from public.configuracion_contabilidad where id = 'default';
  v_test := (v_eg is not null and v_eg = v_ej and v_ej = v_ea);
  v_email := nullif(auth.jwt() ->> 'email', '');
  v_rol := case
    when v_email is null then 'otro'
    when v_email = v_eg then 'guille' when v_email = v_ej then 'javi' when v_email = v_ea then 'alicia'
    else 'otro' end;
  v_nombre := case v_rol when 'guille' then 'Guille' when 'javi' then 'Javi' when 'alicia' then 'Alicia' else null end;

  if not v_test and v_rol not in ('guille','alicia') then
    raise exception 'Sin permiso para resolver incidencias (rol actual: %)', v_rol using errcode = '42501'; end if;

  update public.factura_incidencias
     set resuelta = true, resuelta_por_email = v_email, resuelta_at = now()
   where id = p_incidencia_id
   returning * into v_inc;

  select estado into v_estado from public.facturas_recibidas where id = v_inc.factura_id;

  insert into public.factura_aprobaciones
    (factura_id, actor_email, actor_nombre, actor_rol, accion, estado_anterior, estado_nuevo, comentario, metadata)
  values
    (v_inc.factura_id, v_email, v_nombre, v_rol, 'resuelve_incidencia', v_estado, v_estado,
     coalesce(p_comentario, 'Incidencia resuelta'),
     jsonb_build_object('incidencia_id', p_incidencia_id, 'tipo', v_inc.tipo));

  return v_inc;
end;
$$;
grant execute on function public.resolver_incidencia_factura(uuid, text) to authenticated;

-- fuente: 202606231000_extractos_bancarios.sql
create or replace function public.importar_extracto_bancario(
  p_extracto    jsonb,
  p_movimientos jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_email        text;
  v_soc          text := p_extracto->>'sociedad_id_ref';
  v_archivo_hash text := p_extracto->>'archivo_hash';
  v_existente    uuid;
  v_extracto_id  uuid;
  v_total        int := coalesce(jsonb_array_length(p_movimientos), 0);
  v_importados   int := 0;
  v_min date; v_max date;
begin
  if v_soc is null or v_archivo_hash is null then
    raise exception 'Faltan sociedad_id_ref o archivo_hash' using errcode = '22023';
  end if;
  v_email := nullif(auth.jwt() ->> 'email', '');

  select id into v_existente from public.extractos_bancarios
   where sociedad_id_ref = v_soc and archivo_hash = v_archivo_hash and estado <> 'deshecho'
   limit 1;
  if v_existente is not null then
    return jsonb_build_object('ya_importado', true, 'extracto_id', v_existente,
      'total', v_total, 'importados', 0, 'duplicados', v_total, 'errores', 0);
  end if;

  select min((m->>'fecha')::date), max((m->>'fecha')::date) into v_min, v_max
    from jsonb_array_elements(p_movimientos) m;

  insert into public.extractos_bancarios
    (sociedad_id_ref, cuenta_bancaria_id, banco, iban, anio, mes, nombre_archivo, formato,
     archivo_hash, n_movimientos, rango_fecha_min, rango_fecha_max, importado_por_email)
  values
    (v_soc, nullif(p_extracto->>'cuenta_bancaria_id','')::uuid, p_extracto->>'banco', p_extracto->>'iban',
     (p_extracto->>'anio')::int, (p_extracto->>'mes')::int, p_extracto->>'nombre_archivo', p_extracto->>'formato',
     v_archivo_hash, v_total, v_min, v_max, v_email)
  returning id into v_extracto_id;

  with ins as (
    insert into public.movimientos_bancarios
      (sociedad_id_ref, cuenta_bancaria_id, extracto_id, iban, banco, fecha, fecha_valor,
       concepto, concepto_normalizado, importe, saldo, categoria, subcategoria, es_intragrupo,
       entidad_contraparte, referencia, tipo_movimiento, hash, revisado, fuente)
    select
      v_soc, nullif(p_extracto->>'cuenta_bancaria_id','')::uuid, v_extracto_id,
      m->>'iban', m->>'banco', (m->>'fecha')::date, nullif(m->>'fecha_valor','')::date,
      m->>'concepto', m->>'concepto_normalizado', (m->>'importe')::numeric, nullif(m->>'saldo','')::numeric,
      nullif(m->>'categoria',''), nullif(m->>'subcategoria',''), coalesce((m->>'es_intragrupo')::boolean, false),
      nullif(m->>'entidad_contraparte',''), nullif(m->>'referencia',''), nullif(m->>'tipo_movimiento',''),
      m->>'hash', coalesce((m->>'revisado')::boolean, false), coalesce(m->>'fuente','extracto')
    from jsonb_array_elements(p_movimientos) m
    on conflict (sociedad_id_ref, hash) where hash is not null do nothing
    returning 1
  )
  select count(*) into v_importados from ins;

  update public.extractos_bancarios
    set n_importados = v_importados, n_duplicados = v_total - v_importados, updated_at = now()
   where id = v_extracto_id;

  return jsonb_build_object('ya_importado', false, 'extracto_id', v_extracto_id,
    'total', v_total, 'importados', v_importados, 'duplicados', v_total - v_importados, 'errores', 0);
end;
$$;
grant execute on function public.importar_extracto_bancario(jsonb, jsonb) to authenticated;

-- fuente: 202606231000_extractos_bancarios.sql
create or replace function public.deshacer_importacion_extracto(p_extracto_id uuid)
returns public.extractos_bancarios
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ex public.extractos_bancarios;
begin
  delete from public.movimientos_bancarios where extracto_id = p_extracto_id;
  update public.extractos_bancarios
    set estado = 'deshecho', n_importados = 0, updated_at = now()
   where id = p_extracto_id
   returning * into v_ex;
  if not found then raise exception 'Extracto % no existe', p_extracto_id using errcode = 'P0002'; end if;
  return v_ex;
end;
$$;
grant execute on function public.deshacer_importacion_extracto(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- §15. VISTAS (cashflow / tesorería — modelo SOCIEDAD ÚNICA)
-- ═══════════════════════════════════════════════════════════════════════════

-- fuente: 20260520130000_balance_sumas_saldos.sql
create or replace view public.v_balance_periodos as
select sociedad_id, periodo, count(*) as lineas, max(created_at) as importado_en
from public.balance_sumas_saldos
group by sociedad_id, periodo
order by sociedad_id, periodo desc;

-- fuente: 20260525150000_tesoreria_y_tareas.sql
create or replace view public.saldo_bancario_por_sociedad as
select sociedad_id_ref,
       coalesce(sum(importe), 0) as saldo_actual,
       count(*)                  as num_movimientos,
       max(fecha)                as ultimo_movimiento
from public.movimientos_bancarios
group by sociedad_id_ref;

-- fuente: 20260604120000_tesoreria_multi_sociedad.sql
create or replace view public.compromisos_tesoreria as
select
  coalesce(pr.sociedad_id_ref, proy.sociedad_tenedora) as sociedad_id_ref,
  pp.fecha_prevista as fecha,
  case when pp.tipo_flujo = 'ingreso' then pp.importe else -pp.importe end as importe,
  pp.tipo_flujo,
  coalesce(pp.descripcion, pa.descripcion) as concepto,
  'presupuesto'::text as origen, 'presupuesto'::text as fuente,
  pp.contingente, pr.proyecto_nombre as proyecto_nombre, pp.id as origen_id,
  pp.estado as estado, (pp.tipo_flujo = 'ingreso') as es_entrada,
  pr.id as presupuesto_id, pp.partida_id as partida_id,
  pp.factura_recibida_id as factura_id, null::uuid as vencimiento_id
from public.presupuesto_pagos pp
join public.presupuestos pr         on pr.id      = pp.presupuesto_id
join public.presupuesto_partidas pa on pa.id      = pp.partida_id
left join public.proyectos proy     on proy.id_ref = pr.proyecto_id_ref
where pp.estado = 'pendiente'
union all
select
  v.sociedad_id as sociedad_id_ref, v.fecha_vencimiento as fecha,
  case when v.es_entrada then v.importe else -v.importe end as importe,
  case when v.es_entrada then 'ingreso' else 'gasto' end   as tipo_flujo,
  v.titulo as concepto, 'vencimiento'::text as origen, 'vencimiento'::text as fuente,
  false as contingente, null::text as proyecto_nombre, v.id as origen_id,
  v.estado as estado, v.es_entrada as es_entrada,
  null::uuid as presupuesto_id, null::uuid as partida_id,
  null::uuid as factura_id, v.id as vencimiento_id
from public.vencimientos v
where v.estado = 'pendiente' and v.importe is not null
union all
select
  f.sociedad_id_ref as sociedad_id_ref,
  coalesce(f.fecha_vencimiento, (f.created_at::date + interval '30 days')::date) as fecha,
  -f.total_a_pagar as importe, 'gasto'::text as tipo_flujo,
  coalesce(f.proveedor_nombre, 'Factura pendiente') as concepto,
  'factura'::text as origen, 'factura'::text as fuente,
  false as contingente, null::text as proyecto_nombre, f.id as origen_id,
  f.estado as estado, false as es_entrada,
  null::uuid as presupuesto_id, null::uuid as partida_id,
  f.id as factura_id, null::uuid as vencimiento_id
from public.facturas_recibidas f
where f.estado = 'pendiente_pago' and f.presupuesto_pago_id is null;

-- fuente: 20260605000003_flujos_presupuesto_sociedad.sql
create or replace view public.flujos_proyecto_consolidados as
select
  f.proyecto_id as proyecto_id_ref, f.fecha, f.importe, f.tipo_flujo, f.concepto,
  'flujo_manual'::text as fuente, null::text as sociedad_id_ref,
  null::uuid as factura_id, null::uuid as presupuesto_pago_id, null::text as estado,
  true as es_real, false as es_previsto
from public.flujos_caja_proyectos f
union all
select
  pr.proyecto_id_ref,
  coalesce(pp.fecha_real_pago, pp.fecha_prevista) as fecha,
  case pp.tipo_flujo when 'gasto' then -abs(pp.importe) else abs(pp.importe) end as importe,
  pp.tipo_flujo, pp.descripcion as concepto, 'presupuesto_pago'::text as fuente,
  coalesce(pr.sociedad_id_ref, proy.sociedad_tenedora) as sociedad_id_ref,
  pp.factura_recibida_id::uuid as factura_id, pp.id as presupuesto_pago_id, pp.estado,
  (pp.estado = 'pagado') as es_real,
  (pp.estado in ('pendiente','estimado','confirmado','facturado')) as es_previsto
from public.presupuesto_pagos pp
join public.presupuestos pr     on pr.id      = pp.presupuesto_id
left join public.proyectos proy on proy.id_ref = pr.proyecto_id_ref
where pr.proyecto_id_ref is not null
  and (pp.fecha_prevista is not null or pp.fecha_real_pago is not null)
union all
select
  fr.proyecto_id_ref,
  coalesce(fr.fecha_vencimiento, fr.fecha_factura) as fecha,
  -abs(fr.total) as importe, 'gasto'::text as tipo_flujo,
  coalesce(fr.concepto, fr.proveedor_nombre) as concepto, 'factura_recibida'::text as fuente,
  fr.sociedad_id_ref, fr.id as factura_id, fr.presupuesto_pago_id, fr.estado,
  (fr.estado = 'pagada') as es_real,
  (fr.estado in ('pendiente_pago','revision_javi')) as es_previsto
from public.facturas_recibidas fr
where fr.proyecto_id_ref is not null and fr.presupuesto_pago_id is null;

-- fuente: 20260605000002_cashflow_consolidado.sql
-- CURADO: rama de vencimientos SIN reparto multi-holding por porcentajes (sociedad única).
create or replace view public.cashflow_consolidado as
select proyecto_id_ref, sociedad_id_ref, fecha, importe, tipo_flujo,
       concepto, fuente::text, estado, es_real, es_previsto
from public.flujos_proyecto_consolidados
union all
select
  null as proyecto_id_ref, v.sociedad_id as sociedad_id_ref,
  v.fecha_vencimiento as fecha,
  round(v.importe * case when v.es_entrada then 1 else -1 end, 2) as importe,
  case when v.es_entrada then 'ingreso' else 'gasto' end as tipo_flujo,
  v.titulo as concepto, 'vencimiento' as fuente, v.estado::text as estado,
  (v.estado = 'gestionado') as es_real, (v.estado != 'gestionado') as es_previsto
from public.vencimientos v
where v.importe is not null and v.importe > 0;

-- ═══════════════════════════════════════════════════════════════════════════
-- §16. RLS
-- ═══════════════════════════════════════════════════════════════════════════
-- Convención repo: RLS ON en TODAS las tablas. anon SIN acceso (no se crea policy).
-- Tablas de gestión: authenticated FOR ALL. Libros append-only: authenticated SOLO SELECT.
do $$
declare t text;
begin
  foreach t in array array[
    'sociedades','proyectos','cuentas_bancarias_sociedad','configuracion_contabilidad',
    'plan_cuentas','reglas_categorizacion','contactos','proveedores_reglas',
    'extractos_bancarios','movimientos_bancarios','presupuestos','presupuesto_capitulos',
    'presupuesto_partidas','presupuesto_pagos','facturas_recibidas','facturas_emitidas',
    'asientos_borrador','asientos_oficiales','reconciliacion_log','flujos_caja_proyectos',
    'vencimientos','balance_sumas_saldos','kpis_sociedades'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_auth_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', t||'_auth_all', t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['factura_pagos','factura_incidencias','factura_aprobaciones'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t||'_select', t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §17. STORAGE — bucket privado `facturas`
-- fuente: 202606192000_facturas_storage_privado.sql + 202606192100_factura_pagos.sql
-- ═══════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('facturas', 'facturas', false)
on conflict (id) do nothing;

do $$ begin
  create policy "facturas_objects_select_auth"
    on storage.objects for select to authenticated
    using (bucket_id = 'facturas');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "facturas_objects_insert_justificantes"
    on storage.objects for insert to authenticated
    with check (
      bucket_id = 'facturas'
      and (storage.foldername(name))[1] = 'recibidas'
      and (storage.foldername(name))[3] = 'pagos'
    );
exception when duplicate_object then null; end $$;
-- Sin policy UPDATE/DELETE de cliente (mínimo privilegio). La subida de PDFs de factura
-- la hace la Edge Function con service role (bypassa RLS). Correcciones = pago 'regularizacion'.

-- ═══════════════════════════════════════════════════════════════════════════
-- §18. SEED MÍNIMO — estructura PROPIA de Antifrágil (sin datos reales)
-- ═══════════════════════════════════════════════════════════════════════════

-- Config single-operator (emails PLACEHOLDER — rellenar antes de producción)
insert into public.configuracion_contabilidad (id) values ('default')
on conflict (id) do nothing;

-- Sociedad jurídica inicial (CIF pendiente — NULL hasta aportarlo)
insert into public.sociedades (id_ref, nombre, cif, estado)
values ('ANT', 'Antifrágil S.C.', null, 'activa')
on conflict (id_ref) do nothing;

-- Proyectos: Clínica activo; resto placeholders sin datos
insert into public.proyectos (id_ref, nombre, sociedad_tenedora, estado) values
  ('CLI-PLY', 'Clínica Antifrágil Playamar', 'ANT', 'activo'),
  ('9AM',     '9 A.M.',                       'ANT', 'placeholder'),
  ('LIDO',    'Lido Pro',                     'ANT', 'placeholder'),
  ('EVT',     'Eventos',                      'ANT', 'placeholder')
on conflict (id_ref) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN DEL BASELINE — revisar antes de aplicar. Ver README.md
-- ═══════════════════════════════════════════════════════════════════════════
