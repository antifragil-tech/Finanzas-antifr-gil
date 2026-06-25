-- ============================================================
-- Módulo Presupuestos
-- Presupuestos por proyecto/sociedad, cronograma de pagos,
-- control de tesorería forward y vinculación con facturas.
-- ============================================================

-- 1. Tabla principal de presupuestos
create table if not exists public.presupuestos (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  tipo                text not null default 'capex'
                      check (tipo in ('obra','explotacion','capex','corporativo','tesoreria')),
  proyecto_nombre     text,
  sociedad_id_ref     text,
  estado              text not null default 'borrador'
                      check (estado in ('borrador','activo','cerrado')),
  fecha_inicio        date,
  fecha_fin           date,
  notas               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.presupuestos enable row level security;
create policy "Authenticated full access on presupuestos"
  on public.presupuestos for all to authenticated
  using (true) with check (true);
create index if not exists presupuestos_sociedad_idx on public.presupuestos(sociedad_id_ref);
create index if not exists presupuestos_estado_idx   on public.presupuestos(estado);

-- 2. Capítulos dentro de un presupuesto
create table if not exists public.presupuesto_capitulos (
  id                  uuid primary key default gen_random_uuid(),
  presupuesto_id      uuid not null references public.presupuestos(id) on delete cascade,
  nombre              text not null,
  orden               int  not null default 0,
  created_at          timestamptz not null default now()
);

alter table public.presupuesto_capitulos enable row level security;
create policy "Authenticated full access on presupuesto_capitulos"
  on public.presupuesto_capitulos for all to authenticated
  using (true) with check (true);
create index if not exists presupuesto_capitulos_presupuesto_idx
  on public.presupuesto_capitulos(presupuesto_id);

-- 3. Partidas dentro de un capítulo
create table if not exists public.presupuesto_partidas (
  id                      uuid primary key default gen_random_uuid(),
  presupuesto_id          uuid not null references public.presupuestos(id) on delete cascade,
  capitulo_id             uuid not null references public.presupuesto_capitulos(id) on delete cascade,
  codigo                  text,
  descripcion             text not null,
  importe_presupuestado   numeric(14,2) not null default 0,
  proveedor_esperado      text,
  notas                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.presupuesto_partidas enable row level security;
create policy "Authenticated full access on presupuesto_partidas"
  on public.presupuesto_partidas for all to authenticated
  using (true) with check (true);
create index if not exists presupuesto_partidas_presupuesto_idx
  on public.presupuesto_partidas(presupuesto_id);
create index if not exists presupuesto_partidas_capitulo_idx
  on public.presupuesto_partidas(capitulo_id);

-- 4. Cronograma de pagos (uno o varios por partida)
create table if not exists public.presupuesto_pagos (
  id                    uuid primary key default gen_random_uuid(),
  presupuesto_id        uuid not null references public.presupuestos(id) on delete cascade,
  partida_id            uuid not null references public.presupuesto_partidas(id) on delete cascade,
  descripcion           text,
  importe               numeric(14,2) not null,
  fecha_prevista        date not null,
  estado                text not null default 'pendiente'
                        check (estado in ('pendiente','pagado','cancelado')),
  tipo_flujo            text not null default 'gasto'
                        check (tipo_flujo in ('gasto','ingreso')),
  factura_recibida_id   uuid references public.facturas_recibidas(id) on delete set null,
  notas                 text,
  created_at            timestamptz not null default now()
);

alter table public.presupuesto_pagos enable row level security;
create policy "Authenticated full access on presupuesto_pagos"
  on public.presupuesto_pagos for all to authenticated
  using (true) with check (true);
create index if not exists presupuesto_pagos_presupuesto_idx
  on public.presupuesto_pagos(presupuesto_id);
create index if not exists presupuesto_pagos_partida_idx
  on public.presupuesto_pagos(partida_id);
create index if not exists presupuesto_pagos_fecha_idx
  on public.presupuesto_pagos(fecha_prevista asc);
create index if not exists presupuesto_pagos_estado_idx
  on public.presupuesto_pagos(estado);

-- 5. Vinculación inversa: facturas recibidas pueden apuntarse a un pago presupuestado
alter table public.facturas_recibidas
  add column if not exists presupuesto_pago_id uuid
    references public.presupuesto_pagos(id) on delete set null;
