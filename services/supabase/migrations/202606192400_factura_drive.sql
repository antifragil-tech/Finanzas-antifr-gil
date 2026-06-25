-- ═══════════════════════════════════════════════════════════════════════════
-- PR D — Archivo documental en Google Drive (2026-06-22)
--
-- Drive es ARCHIVO SECUNDARIO. La fuente operativa segura sigue siendo Supabase
-- Storage privado. Estas columnas guardan la referencia del documento ya archivado
-- en Drive (Service Account + Shared Drive) y el estado de sincronización, para
-- idempotencia (no duplicar) y para la UI ("Archivado en Drive / Error / Reintentar").
-- NO cambia el flujo (OCR, pagos, estados, trazabilidad). Aditiva e idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── facturas_recibidas: archivo del PDF de la factura en Drive ──────────────────
alter table public.facturas_recibidas
  add column if not exists drive_file_id   text,
  add column if not exists drive_folder_id text,
  add column if not exists drive_estado    text not null default 'no_archivado',
  add column if not exists drive_error      text,
  add column if not exists drive_web_link  text,
  add column if not exists drive_synced_at timestamptz;

do $$ begin
  alter table public.facturas_recibidas
    add constraint facturas_recibidas_drive_estado_check
    check (drive_estado in ('no_archivado', 'sincronizado', 'error'));
exception when duplicate_object then null; end $$;

-- ── factura_pagos: archivo del justificante en Drive ────────────────────────────
alter table public.factura_pagos
  add column if not exists drive_file_id   text,
  add column if not exists drive_estado    text not null default 'no_archivado',
  add column if not exists drive_error      text,
  add column if not exists drive_web_link  text,
  add column if not exists drive_synced_at timestamptz;

do $$ begin
  alter table public.factura_pagos
    add constraint factura_pagos_drive_estado_check
    check (drive_estado in ('no_archivado', 'sincronizado', 'error'));
exception when duplicate_object then null; end $$;

comment on column public.facturas_recibidas.drive_file_id is
  'ID del PDF de la factura en Google Drive (Shared Drive). Presente = ya archivado (idempotencia).';
comment on column public.factura_pagos.drive_file_id is
  'ID del justificante en Google Drive (Shared Drive). Presente = ya archivado (idempotencia).';
