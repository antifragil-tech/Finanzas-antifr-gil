-- ═══════════════════════════════════════════════════════════════════════════
-- PR A2-bis — privatizar el bucket `proyecto-documentos` (2026-06-22)
--
-- ⚠️ ORDEN OBLIGATORIO (decisión D1/D5): esta migración se aplica SOLO post-merge
-- y DESPUÉS de verificar que el visor firmado (signed URLs desde `storage_path`)
-- ya está vivo en producción. El flip a privado rompe las URLs públicas legadas
-- (`archivo_url`), así que es el ÚLTIMO paso.
--
-- Estado previo (verificado): bucket público con 2 objetos; tabla con 2 filas, las
-- 2 con `storage_path` poblado → sin backfill. Políticas de Storage y RLS de la
-- tabla abiertas a {public}/anon. Solo lo usa `@alsari/presupuestos`.
--
-- Cambios: políticas Storage {public}→authenticated; RLS de la tabla
-- anon→authenticated; bucket → privado. NO toca columnas (`archivo_url` y
-- `storage_path` se conservan). Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Políticas de storage.objects: {public} → authenticated ──────────────────
drop policy if exists "read proyecto-documentos"   on storage.objects;
drop policy if exists "upload proyecto-documentos" on storage.objects;
drop policy if exists "delete proyecto-documentos" on storage.objects;

do $$ begin
  create policy "proyecto_docs_select_auth" on storage.objects
    for select to authenticated using (bucket_id = 'proyecto-documentos');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "proyecto_docs_insert_auth" on storage.objects
    for insert to authenticated with check (bucket_id = 'proyecto-documentos');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "proyecto_docs_delete_auth" on storage.objects
    for delete to authenticated using (bucket_id = 'proyecto-documentos');
exception when duplicate_object then null; end $$;

-- ── 2. RLS de la tabla proyecto_documentos: anon+authenticated → authenticated ──
drop policy if exists "anon and authenticated" on public.proyecto_documentos;

do $$ begin
  create policy "proyecto_documentos_auth_all" on public.proyecto_documentos
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- ── 3. Flip del bucket a PRIVADO (último paso; rompe las URLs públicas legadas) ─
update storage.buckets set public = false where id = 'proyecto-documentos';
