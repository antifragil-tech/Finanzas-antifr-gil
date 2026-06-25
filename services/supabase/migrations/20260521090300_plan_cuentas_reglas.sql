-- plan_cuentas: Plan General Contable por sociedad
-- Cargado inicialmente con cuentas estándar PGC. Personalizable por sociedad.

create table if not exists public.plan_cuentas (
  id              uuid primary key default gen_random_uuid(),
  sociedad_id_ref text not null,
  codigo          text not null,          -- '4300', '572000', '62000'
  descripcion     text not null,
  tipo            text not null
                  check (tipo in ('activo','pasivo','patrimonio','ingreso','gasto','resultado')),
  padre_codigo    text,
  nivel           int not null default 1,  -- 1=grupo, 2=subgrupo, 3=cuenta, 4=subcuenta
  activa          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (sociedad_id_ref, codigo)
);

alter table public.plan_cuentas enable row level security;
create policy "Authenticated full access on plan_cuentas"
  on public.plan_cuentas for all to authenticated
  using (true) with check (true);
create index if not exists plan_cuentas_sociedad_idx on public.plan_cuentas(sociedad_id_ref, codigo);

-- reglas_categorizacion: motor de categorización automática de movimientos
-- Las reglas del sistema tienen prioridad alta. Las aprendidas de correcciones del usuario
-- tienen prioridad aún mayor. Se aplican en orden descendente de prioridad.

create table if not exists public.reglas_categorizacion (
  id              uuid primary key default gen_random_uuid(),
  patron          text not null,           -- keyword o regex en concepto
  campo           text not null default 'concepto'
                  check (campo in ('concepto','contraparte','banco')),
  es_regex        boolean not null default false,
  categoria       text not null,
  subcategoria    text,
  es_intragrupo   boolean not null default false,
  prioridad       int not null default 50,  -- mayor = se aplica antes
  fuente          text not null default 'sistema'
                  check (fuente in ('sistema','usuario','aprendizaje')),
  confirmaciones  int not null default 0,   -- veces que acertó (para learning)
  activa          boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table public.reglas_categorizacion enable row level security;
create policy "Authenticated full access on reglas_categorizacion"
  on public.reglas_categorizacion for all to authenticated
  using (true) with check (true);
create index if not exists reglas_categorizacion_prioridad_idx on public.reglas_categorizacion(prioridad desc);

-- Seed: reglas base del sistema para el contexto de Alsari
insert into public.reglas_categorizacion (patron, campo, es_regex, categoria, subcategoria, es_intragrupo, prioridad, fuente) values
-- Intragrupo (prioridad máxima)
('alsari',         'concepto', false, 'intragrupo_salida',   'ampliacion_capital', true, 100, 'sistema'),
('alsari',         'concepto', false, 'intragrupo_entrada',  null,                 true, 100, 'sistema'),
('pavier',         'concepto', false, 'intragrupo_salida',   null,                 true,  99, 'sistema'),
('armia',          'concepto', false, 'intragrupo_salida',   null,                 true,  99, 'sistema'),
('rialsa',         'concepto', false, 'intragrupo_entrada',  null,                 true,  99, 'sistema'),
('ampliaci[oó]n de capital', 'concepto', true, 'intragrupo_salida', 'ampliacion_capital', true, 98, 'sistema'),
('pr[eé]stamo intragrupo',   'concepto', true, 'intragrupo_salida', 'prestamo_concedido', true, 98, 'sistema'),
-- Fiscal
('retenci[oó]n',   'concepto', true,  'fiscal', 'retenciones_irpf', false, 90, 'sistema'),
('impuesto',       'concepto', false, 'fiscal', 'otros',            false, 85, 'sistema'),
('hacienda',       'concepto', false, 'fiscal', 'otros',            false, 85, 'sistema'),
('aeat',           'concepto', false, 'fiscal', 'otros',            false, 85, 'sistema'),
('junta de andaluc', 'concepto', false, 'fiscal', 'itp_ajd',        false, 88, 'sistema'),
('junta de',       'concepto', false, 'fiscal', 'otros',            false, 84, 'sistema'),
('ibi',            'concepto', false, 'fiscal', 'ibi',              false, 87, 'sistema'),
-- Notaría / legal
('notari',         'concepto', false, 'notaria_legal', 'honorarios',       false, 80, 'sistema'),
('protocolo',      'concepto', false, 'notaria_legal', 'provision_fondos', false, 80, 'sistema'),
('inscripci[oó]n', 'concepto', true,  'notaria_legal', 'provision_fondos', false, 80, 'sistema'),
('compraventa',    'concepto', false, 'notaria_legal', 'provision_fondos', false, 79, 'sistema'),
-- Inmobiliario / rentas
('fianza',         'concepto', false, 'rentas_cobradas', 'fianza_recibida',   false, 75, 'sistema'),
('alquiler',       'concepto', false, 'rentas_cobradas', 'alquiler_residencial', false, 75, 'sistema'),
('c\.p\.',         'concepto', true,  'gastos_inmobiliarios', 'comunidad',    false, 70, 'sistema'),
('comunidad',      'concepto', false, 'gastos_inmobiliarios', 'comunidad',    false, 70, 'sistema'),
('suministro',     'concepto', false, 'gastos_inmobiliarios', 'suministros',  false, 68, 'sistema'),
('mantenimiento',  'concepto', false, 'gastos_inmobiliarios', 'mantenimiento',false, 68, 'sistema'),
-- Bancarios
('custodia',       'concepto', false, 'bancarios', 'custodia',       false, 65, 'sistema'),
('derechos',       'concepto', false, 'bancarios', 'comision',       false, 60, 'sistema'),
('comisi[oó]n',    'concepto', true,  'bancarios', 'comision',       false, 65, 'sistema'),
-- Retrocesiones
('retrocesi[oó]n', 'concepto', true,  'devoluciones', 'retrocesion', false, 72, 'sistema'),
('devoluci[oó]n',  'concepto', true,  'devoluciones', 'devolucion',  false, 72, 'sistema')
on conflict do nothing;
