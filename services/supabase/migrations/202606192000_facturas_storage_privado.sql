-- ═══════════════════════════════════════════════════════════════════════════
-- PR A2 — Storage privado de facturas + persistencia real de PDFs (2026-06-19)
--
-- Contexto (verificado en el proyecto remoto antes de implementar):
--   · El bucket `facturas` NUNCA se creó.
--   · La subida de la Edge Function `procesar-factura` fallaba en silencio
--     (try/catch) → NINGÚN PDF de factura se estaba persistiendo (0/16 con
--     archivo_url).
--   · Por tanto NO había fuga pública activa de PDFs de facturas: el riesgo era
--     latente, no real. El bucket público real (otro frente) es
--     `proyecto-documentos`, del módulo presupuestos → se trata aparte (PR A2-bis).
--
-- Esta migración deja el terreno seguro para persistir PDFs de facturas:
--   1. añade `storage_path` a facturas_recibidas (ruta del objeto en Storage);
--   2. crea el bucket `facturas` PRIVADO desde el origen (sin objetos previos →
--      no se expone nada al crearlo);
--   3. habilita lectura RLS en storage.objects para el bucket, de modo que un
--      usuario autenticado pueda FIRMAR URLs temporales del PDF.
--
-- La SUBIDA real la hace la Edge Function con service role (bypassa RLS). El visor
-- pasa a signed URLs. NO toca workflow, estados, aprobaciones ni notificaciones.
-- Idempotente: re-ejecutable sin efectos secundarios.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Columna storage_path ────────────────────────────────────────────────────
alter table public.facturas_recibidas
  add column if not exists storage_path text;

comment on column public.facturas_recibidas.storage_path is
  'Ruta del PDF dentro del bucket privado `facturas` (ej. recibidas/<id>/<archivo>). '
  'Fuente para generar signed URLs. `archivo_url` queda solo como legado/fallback.';

-- ── 2. Bucket privado `facturas` ───────────────────────────────────────────────
-- Privado de origen: como no hay objetos previos, crearlo no expone nada.
insert into storage.buckets (id, name, public)
values ('facturas', 'facturas', false)
on conflict (id) do nothing;

-- ── 3. RLS de lectura en storage.objects para el bucket `facturas` ─────────────
-- SELECT para `authenticated`: necesario para que el cliente pueda FIRMAR URLs
-- temporales (la API de firma comprueba acceso de lectura antes de firmar).
-- La SUBIDA la realiza la Edge Function con service role, que bypassa RLS → NO se
-- crea política de INSERT/UPDATE/DELETE para el cliente (mínimo privilegio).
do $$ begin
  create policy "facturas_objects_select_auth"
    on storage.objects for select to authenticated
    using (bucket_id = 'facturas');
exception when duplicate_object then null; end $$;
