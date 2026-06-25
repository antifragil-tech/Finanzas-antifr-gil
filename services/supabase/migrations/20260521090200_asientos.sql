-- asientos_borrador: asientos contables generados automáticamente por el motor
-- Basados en movimientos bancarios + facturas. Pendientes de validar contra el oficial.

create table if not exists public.asientos_borrador (
  id                    uuid primary key default gen_random_uuid(),
  sociedad_id_ref       text not null,
  fecha                 date not null,
  numero                text,                 -- BORR-2026-00001
  concepto              text not null,
  lineas                jsonb not null default '[]',
  -- [{ cuenta_codigo, cuenta_descripcion, debe, haber }]
  total_debe            numeric(14,2) not null default 0,
  total_haber           numeric(14,2) not null default 0,
  estado                text not null default 'borrador'
                        check (estado in ('borrador','confirmado','rechazado')),
  -- Origen del asiento
  movimiento_id         uuid references public.movimientos_bancarios(id) on delete set null,
  factura_recibida_id   uuid references public.facturas_recibidas(id) on delete set null,
  factura_emitida_id    uuid references public.facturas_emitidas(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.asientos_borrador enable row level security;
create policy "Authenticated full access on asientos_borrador"
  on public.asientos_borrador for all to authenticated
  using (true) with check (true);
create index if not exists asientos_borrador_sociedad_idx on public.asientos_borrador(sociedad_id_ref);
create index if not exists asientos_borrador_fecha_idx    on public.asientos_borrador(fecha desc);

-- asientos_oficiales: importados desde la gestoría (A3/Sage/Holded/CSV)
create table if not exists public.asientos_oficiales (
  id                    uuid primary key default gen_random_uuid(),
  sociedad_id_ref       text not null,
  fecha                 date not null,
  numero_oficial        text,
  concepto              text not null,
  lineas                jsonb not null default '[]',
  total_debe            numeric(14,2) not null default 0,
  total_haber           numeric(14,2) not null default 0,
  fuente                text not null default 'csv'
                        check (fuente in ('a3','sage','holded','contasol','csv','manual')),
  asiento_borrador_id   uuid references public.asientos_borrador(id) on delete set null,
  estado_reconciliacion text not null default 'pendiente'
                        check (estado_reconciliacion in ('pendiente','coincide','diferencia','sin_borrador')),
  created_at            timestamptz not null default now()
);

alter table public.asientos_oficiales enable row level security;
create policy "Authenticated full access on asientos_oficiales"
  on public.asientos_oficiales for all to authenticated
  using (true) with check (true);
create index if not exists asientos_oficiales_sociedad_idx on public.asientos_oficiales(sociedad_id_ref);
create index if not exists asientos_oficiales_fecha_idx    on public.asientos_oficiales(fecha desc);
create index if not exists asientos_oficiales_reconciliacion_idx on public.asientos_oficiales(estado_reconciliacion);
