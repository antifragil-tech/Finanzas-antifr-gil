-- facturas_recibidas: facturas de proveedores (con soporte OCR)
create table if not exists public.facturas_recibidas (
  id                    uuid primary key default gen_random_uuid(),
  sociedad_id_ref       text not null,
  numero_factura        text,
  proveedor_nombre      text not null,
  proveedor_nif         text,
  fecha_factura         date not null,
  fecha_vencimiento     date,
  base_imponible        numeric(14,2) not null default 0,
  tipo_iva              numeric(5,2) not null default 21,
  cuota_iva             numeric(14,2) not null default 0,
  retencion_pct         numeric(5,2) not null default 0,
  retencion_importe     numeric(14,2) not null default 0,
  total                 numeric(14,2) not null default 0,
  total_a_pagar         numeric(14,2) not null default 0,
  concepto              text,
  categoria             text,
  subcategoria          text,
  proyecto_id_ref       text,
  estado                text not null default 'recibida'
                        check (estado in ('recibida','pendiente_pago','pagada','vencida','anulada')),
  movimiento_id         uuid references public.movimientos_bancarios(id) on delete set null,
  ocr_raw               jsonb,
  archivo_url           text,
  notas                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.facturas_recibidas enable row level security;
create policy "Authenticated full access on facturas_recibidas"
  on public.facturas_recibidas for all to authenticated
  using (true) with check (true);
create index if not exists facturas_recibidas_sociedad_idx on public.facturas_recibidas(sociedad_id_ref);
create index if not exists facturas_recibidas_fecha_idx    on public.facturas_recibidas(fecha_factura desc);
create index if not exists facturas_recibidas_estado_idx   on public.facturas_recibidas(estado);

-- facturas_emitidas: facturas que emite el grupo a terceros o entre entidades
create table if not exists public.facturas_emitidas (
  id                    uuid primary key default gen_random_uuid(),
  sociedad_id_ref       text not null,
  numero_factura        text not null,
  serie                 text not null default 'A',
  cliente_nombre        text not null,
  cliente_nif           text,
  cliente_direccion     text,
  fecha_factura         date not null,
  fecha_vencimiento     date,
  lineas                jsonb not null default '[]',
  base_imponible        numeric(14,2) not null default 0,
  tipo_iva              numeric(5,2) not null default 21,
  cuota_iva             numeric(14,2) not null default 0,
  retencion_pct         numeric(5,2) not null default 0,
  retencion_importe     numeric(14,2) not null default 0,
  total                 numeric(14,2) not null default 0,
  total_a_cobrar        numeric(14,2) not null default 0,
  estado                text not null default 'borrador'
                        check (estado in ('borrador','emitida','cobrada','vencida','anulada')),
  movimiento_id         uuid references public.movimientos_bancarios(id) on delete set null,
  notas                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.facturas_emitidas enable row level security;
create policy "Authenticated full access on facturas_emitidas"
  on public.facturas_emitidas for all to authenticated
  using (true) with check (true);
create index if not exists facturas_emitidas_sociedad_idx on public.facturas_emitidas(sociedad_id_ref);
create index if not exists facturas_emitidas_fecha_idx    on public.facturas_emitidas(fecha_factura desc);
create index if not exists facturas_emitidas_estado_idx   on public.facturas_emitidas(estado);
