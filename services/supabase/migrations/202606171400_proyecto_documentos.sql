-- ═══════════════════════════════════════════════════════════════════════════
-- Documentos justificativos por proyecto (2026-06-17)
--
-- Permite adjuntar a un proyecto los archivos con los que se calcularon ciertos
-- datos: estudios de mercado (valor actual, renta), tasaciones oficiales, etc.
-- Así, si en el futuro surge la duda de dónde salió una cifra, queda trazable.
--
-- Storage: bucket público 'proyecto-documentos' (acceso controlado por auth en
-- la app, mismo patrón que el bucket 'facturas').
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.proyecto_documentos (
  id            uuid primary key default gen_random_uuid(),
  proyecto_id_ref text not null references public.proyectos(id_ref) on delete cascade,
  nombre        text not null,                       -- nombre original del archivo
  categoria     text not null default 'otro',        -- estudio_mercado | tasacion | renta | contrato | otro
  descripcion   text,                                -- qué dato justifica (opcional)
  archivo_url   text not null,                       -- URL pública en Storage
  storage_path  text not null,                       -- ruta en el bucket (para borrar)
  tamano_bytes  bigint,
  mime_type     text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_proyecto_documentos_proyecto
  on public.proyecto_documentos (proyecto_id_ref);

alter table public.proyecto_documentos enable row level security;

do $$ begin
  create policy "anon and authenticated"
    on public.proyecto_documentos for all
    to anon, authenticated
    using (true) with check (true);
exception when duplicate_object then null;
end $$;

-- Bucket de Storage
insert into storage.buckets (id, name, public)
values ('proyecto-documentos', 'proyecto-documentos', true)
on conflict (id) do nothing;

do $$ begin
  create policy "read proyecto-documentos"
    on storage.objects for select
    using (bucket_id = 'proyecto-documentos');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "upload proyecto-documentos"
    on storage.objects for insert
    with check (bucket_id = 'proyecto-documentos');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "delete proyecto-documentos"
    on storage.objects for delete
    using (bucket_id = 'proyecto-documentos');
exception when duplicate_object then null;
end $$;
