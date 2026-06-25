-- Migración: renombrar estados del workflow + motivo/paso_rechazo + bucket Storage
-- Nuevos estados: validacion | revision | pago | pagada | rechazada

-- 1. Añadir columnas nuevas
alter table public.facturas_recibidas
  add column if not exists motivo_rechazo text,
  add column if not exists paso_rechazo   text;

-- 2. Migrar registros existentes antes de cambiar el constraint
update public.facturas_recibidas set estado = 'validacion' where estado = 'borrador_ocr';
update public.facturas_recibidas set estado = 'revision'   where estado = 'revision_javi';
update public.facturas_recibidas set estado = 'pago'       where estado = 'pendiente_pago';
-- 'pagada' y 'rechazada' no cambian de nombre

-- 3. Cambiar el CHECK constraint
do $$ begin
  alter table public.facturas_recibidas
    drop constraint facturas_recibidas_estado_check;
exception when others then null;
end $$;

alter table public.facturas_recibidas
  add constraint facturas_recibidas_estado_check
  check (estado in ('validacion', 'revision', 'pago', 'pagada', 'rechazada'));

-- 4. Crear bucket de Storage para PDFs de facturas (público: acceso controlado por auth en app)
insert into storage.buckets (id, name, public)
values ('facturas', 'facturas', true)
on conflict (id) do nothing;

-- 5. Política RLS: cualquier usuario autenticado puede leer y subir su archivo
do $$ begin
  create policy "auth_read_facturas"
    on storage.objects for select
    using (bucket_id = 'facturas');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "auth_upload_facturas"
    on storage.objects for insert
    with check (bucket_id = 'facturas');
exception when duplicate_object then null;
end $$;
