-- capex_activos: entradas de CAPEX por activo (reformas, renovaciones, mejoras)
-- Relación 1-N con activos_patrimonio. On delete cascade para limpiar automáticamente.

create table if not exists public.capex_activos (
  id            uuid primary key default gen_random_uuid(),
  activo_id     uuid not null references public.activos_patrimonio(id) on delete cascade,
  descripcion   text not null,
  importe       numeric(14,2) not null default 0,
  fecha         date not null,
  created_at    timestamptz not null default now()
);

alter table public.capex_activos enable row level security;

create policy "Authenticated full access on capex_activos"
  on public.capex_activos
  for all
  to authenticated
  using (true)
  with check (true);

create index if not exists capex_activos_activo_id_idx on public.capex_activos(activo_id);
