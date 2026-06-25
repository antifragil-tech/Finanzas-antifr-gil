-- movimientos_bancarios: transacciones de extractos bancarios importados
-- Fuente: CSV de BBVA, Santander, CaixaBank, Caja Rural
-- El campo importe es negativo para salidas y positivo para entradas.

create table if not exists public.movimientos_bancarios (
  id                    uuid primary key default gen_random_uuid(),
  sociedad_id_ref       text not null,
  iban                  text not null,
  banco                 text not null check (banco in ('santander','bbva','caixabank','caja_rural','otro')),
  fecha                 date not null,
  fecha_valor           date,
  concepto              text not null,
  concepto_normalizado  text,
  importe               numeric(14,2) not null,
  saldo                 numeric(14,2),

  -- Categorización
  categoria             text,
  subcategoria          text,
  es_intragrupo         boolean not null default false,
  entidad_contraparte   text,
  proyecto_id_ref       text,

  -- Referencias cruzadas (nullable, se enlazan después de importar)
  factura_recibida_id   uuid,
  asiento_borrador_id   uuid,

  -- Control
  revisado              boolean not null default false,
  notas                 text,
  fuente                text not null,
  importado_at          timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

alter table public.movimientos_bancarios enable row level security;

create policy "Authenticated full access on movimientos_bancarios"
  on public.movimientos_bancarios for all to authenticated
  using (true) with check (true);

create index if not exists movimientos_bancarios_sociedad_idx on public.movimientos_bancarios(sociedad_id_ref);
create index if not exists movimientos_bancarios_fecha_idx    on public.movimientos_bancarios(fecha desc);
create index if not exists movimientos_bancarios_iban_idx     on public.movimientos_bancarios(iban);
create index if not exists movimientos_bancarios_categoria_idx on public.movimientos_bancarios(categoria);
