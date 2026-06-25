-- reconciliacion_log: resultado de comparar asientos borrador vs oficiales
-- Generado automáticamente al importar el diario oficial de la gestoría.

create table if not exists public.reconciliacion_log (
  id                    uuid primary key default gen_random_uuid(),
  sociedad_id_ref       text not null,
  periodo               text not null,      -- '2026-04' (YYYY-MM)
  asiento_oficial_id    uuid references public.asientos_oficiales(id) on delete cascade,
  asiento_borrador_id   uuid references public.asientos_borrador(id) on delete set null,
  tipo                  text not null
                        check (tipo in ('coincide','diferencia_importe','diferencia_cuenta','diferencia_fecha','sin_borrador','sin_oficial')),
  score_similitud       numeric(5,2),       -- 0-100, % de coincidencia calculado
  diferencias           jsonb,              -- detalle de qué difiere
  resuelto              boolean not null default false,
  resolucion_notas      text,
  created_at            timestamptz not null default now()
);

alter table public.reconciliacion_log enable row level security;
create policy "Authenticated full access on reconciliacion_log"
  on public.reconciliacion_log for all to authenticated
  using (true) with check (true);
create index if not exists reconciliacion_log_sociedad_periodo_idx on public.reconciliacion_log(sociedad_id_ref, periodo);
create index if not exists reconciliacion_log_tipo_idx on public.reconciliacion_log(tipo);
create index if not exists reconciliacion_log_resuelto_idx on public.reconciliacion_log(resuelto) where not resuelto;
