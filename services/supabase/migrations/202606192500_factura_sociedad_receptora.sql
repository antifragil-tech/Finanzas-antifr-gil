-- ═══════════════════════════════════════════════════════════════════════════
-- PR D.1 — Sociedad receptora correcta (sin fallback a la primera) (2026-06-22)
--
-- Bug: el OCR detecta bien el NIF receptor (p.ej. B93626158) pero el matching
-- contra `sociedades.cif` (B-93626158) fallaba por formato y la factura caía al
-- fallback "primera sociedad de la lista" (Alrive). Fix:
--   1. `sociedad_id_ref` puede ser NULL → factura "sin sociedad validada".
--   2. `sociedad_validada` (existentes → true, no romper histórico; nuevas las marca
--      la Edge Function según el match único del NIF receptor).
--   3. `accion` += `cambia_sociedad` para auditar el cambio manual.
--   4. RPC `cambiar_sociedad_factura` (security definer, audita el cambio).
-- Aditiva e idempotente. No toca pagos, justificantes, Storage ni estados.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. sociedad_id_ref puede ser NULL (factura sin sociedad validada) ───────────
alter table public.facturas_recibidas alter column sociedad_id_ref drop not null;

-- ── 2. flag de validación de sociedad ──────────────────────────────────────────
alter table public.facturas_recibidas
  add column if not exists sociedad_validada boolean not null default true;

comment on column public.facturas_recibidas.sociedad_validada is
  'true = la sociedad receptora está confirmada (match único de NIF OCR o cambio manual auditado). '
  'false = pendiente de validar (sin receptor o sin match único). Bloquea validación y archivado en Drive.';

-- ── 3. accion: +cambia_sociedad ────────────────────────────────────────────────
do $$
declare cname text;
begin
  select conname into cname from pg_constraint
   where conrelid = 'public.factura_aprobaciones'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%accion%';
  if cname is not null then execute format('alter table public.factura_aprobaciones drop constraint %I', cname); end if;
end $$;

alter table public.factura_aprobaciones
  add constraint factura_aprobaciones_accion_check
  check (accion in ('crea_borrador_ocr','valida','aprueba','rechaza','marca_pagada',
                    'registra_pago','crea_incidencia','resuelve_incidencia','cambia_sociedad',
                    'solicita_aclaracion','cambia_estado'));

-- ── 4. RPC cambiar_sociedad_factura (security definer, auditada) ────────────────
create or replace function public.cambiar_sociedad_factura(
  p_factura_id  uuid,
  p_sociedad_id text,
  p_comentario  text default null
) returns public.facturas_recibidas
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_factura     public.facturas_recibidas;
  v_soc_ant     text;
  v_cif_ant     text;
  v_cif_nuevo   text;
  v_nombre_nuevo text;
  v_email text; v_rol text; v_nombre text;
  v_eg text; v_ej text; v_ea text;
begin
  select * into v_factura from public.facturas_recibidas where id = p_factura_id for update;
  if not found then raise exception 'Factura % no existe', p_factura_id using errcode = 'P0002'; end if;

  -- la sociedad nueva debe existir
  select cif, nombre into v_cif_nuevo, v_nombre_nuevo from public.sociedades where id_ref = p_sociedad_id;
  if v_nombre_nuevo is null then raise exception 'Sociedad % no existe', p_sociedad_id using errcode = '22023'; end if;

  v_soc_ant := v_factura.sociedad_id_ref;
  select cif into v_cif_ant from public.sociedades where id_ref = v_soc_ant;

  -- actor server-side (no spoofable)
  select email_guille, email_javi, email_alicia into v_eg, v_ej, v_ea
    from public.configuracion_contabilidad where id = 'default';
  v_email := nullif(auth.jwt() ->> 'email', '');
  v_rol := case
    when v_email is null then 'otro'
    when v_email = v_eg then 'guille' when v_email = v_ej then 'javi' when v_email = v_ea then 'alicia'
    else 'otro' end;
  v_nombre := case v_rol when 'guille' then 'Guille' when 'javi' then 'Javi' when 'alicia' then 'Alicia' else null end;

  update public.facturas_recibidas
     set sociedad_id_ref = p_sociedad_id, sociedad_validada = true, updated_at = now()
   where id = p_factura_id
   returning * into v_factura;

  insert into public.factura_aprobaciones
    (factura_id, actor_email, actor_nombre, actor_rol, accion, estado_anterior, estado_nuevo, comentario, metadata)
  values
    (p_factura_id, v_email, v_nombre, v_rol, 'cambia_sociedad', v_factura.estado, v_factura.estado, p_comentario,
     jsonb_build_object('sociedad_anterior', v_soc_ant, 'sociedad_nueva', p_sociedad_id,
                        'cif_anterior', v_cif_ant, 'cif_nuevo', v_cif_nuevo, 'comentario', p_comentario));

  return v_factura;
end;
$$;

grant execute on function public.cambiar_sociedad_factura(uuid, text, text) to authenticated;
