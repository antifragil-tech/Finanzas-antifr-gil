-- Migración: workflow de aprobación de facturas + OCR + configuración
-- Extiende la tabla facturas_recibidas y añade tablas de soporte.

-- ── 1. Actualizar estados de facturas_recibidas ───────────────────────────────

alter table public.facturas_recibidas
  drop constraint if exists facturas_recibidas_estado_check;

alter table public.facturas_recibidas
  add constraint facturas_recibidas_estado_check
  check (estado in (
    'borrador_ocr',
    'revision_javi',
    'pendiente_pago',
    'pagada',
    'rechazada'
  ));

-- Migrar datos existentes a los nuevos estados
update public.facturas_recibidas set estado = 'borrador_ocr'    where estado = 'recibida';
update public.facturas_recibidas set estado = 'pendiente_pago'  where estado = 'vencida';
update public.facturas_recibidas set estado = 'rechazada'       where estado = 'anulada';

-- ── 2. Nueva columna ocr_confianza ────────────────────────────────────────────

alter table public.facturas_recibidas
  add column if not exists ocr_confianza jsonb;

-- ── 3. Tabla configuracion_contabilidad (single-row settings) ─────────────────

create table if not exists public.configuracion_contabilidad (
  id                     text primary key default 'default',
  umbral_aprobacion_javi numeric(12,2) not null default 1000,
  email_guille           text not null default 'guille.vila.marcos@gmail.com',
  email_javi             text not null default 'guille.vila.marcos@gmail.com',
  email_alicia           text not null default 'guille.vila.marcos@gmail.com',
  updated_at             timestamptz not null default now()
);

alter table public.configuracion_contabilidad enable row level security;

create policy "Authenticated full access on configuracion_contabilidad"
  on public.configuracion_contabilidad for all to authenticated
  using (true) with check (true);

-- Insertar configuración por defecto (todos al mismo correo para testing)
insert into public.configuracion_contabilidad
  (id, umbral_aprobacion_javi, email_guille, email_javi, email_alicia)
values
  ('default', 1000,
   'guille.vila.marcos@gmail.com',
   'guille.vila.marcos@gmail.com',
   'guille.vila.marcos@gmail.com')
on conflict (id) do nothing;

-- ── 4. Tabla ocr_accuracy_stats (aprendizaje por campo) ──────────────────────

create table if not exists public.ocr_accuracy_stats (
  id                    uuid primary key default gen_random_uuid(),
  campo                 text not null unique,
  total_extracciones    int  not null default 0,
  extracciones_correctas int not null default 0,
  updated_at            timestamptz not null default now()
);

alter table public.ocr_accuracy_stats enable row level security;

create policy "Authenticated full access on ocr_accuracy_stats"
  on public.ocr_accuracy_stats for all to authenticated
  using (true) with check (true);

-- ── 5. RPC: registrar_correccion_ocr ─────────────────────────────────────────
-- Llamada desde el frontend cada vez que el usuario aprueba una factura
-- con o sin correcciones sobre los valores OCR.

create or replace function public.registrar_correccion_ocr(
  p_campo    text,
  p_correcta boolean
) returns void
language plpgsql security definer as $$
begin
  insert into public.ocr_accuracy_stats
    (campo, total_extracciones, extracciones_correctas)
  values
    (p_campo, 1, case when p_correcta then 1 else 0 end)
  on conflict (campo) do update set
    total_extracciones     = ocr_accuracy_stats.total_extracciones + 1,
    extracciones_correctas = ocr_accuracy_stats.extracciones_correctas
                             + case when p_correcta then 1 else 0 end,
    updated_at             = now();
end;
$$;
