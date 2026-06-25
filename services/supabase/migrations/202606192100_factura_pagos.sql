-- ═══════════════════════════════════════════════════════════════════════════
-- PR C — Pagos parciales + justificantes + comparación de importes (2026-06-19)
--
-- Libro de pagos REALES de tesorería de una factura (distinto de `presupuesto_pagos`,
-- que es seguimiento presupuestario con importe = base_imponible). Aquí la referencia
-- es `total_a_pagar` (= total − retención; la retención no se paga al proveedor).
--
-- Principios: tablas SELECT-only (sin INSERT/UPDATE/DELETE directos del cliente);
-- toda escritura por RPC security-definer con actor derivado de auth.jwt() (no
-- spoofing); libro append-only (correcciones vía `regularizacion`, único tipo que
-- admite importe negativo). Justificantes en el bucket privado `facturas`
-- (signed URLs, nunca público). Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. factura_pagos (libro append-only) ──────────────────────────────────────
create table if not exists public.factura_pagos (
  id                          uuid primary key default gen_random_uuid(),
  factura_id                  uuid not null references public.facturas_recibidas(id) on delete cascade,
  importe                     numeric(14,2) not null,
  fecha_pago                  date not null default current_date,
  metodo_pago                 text not null
                              check (metodo_pago in ('transferencia','domiciliacion','tarjeta','efectivo','otro')),
  tipo_pago                   text not null
                              check (tipo_pago in ('total','parcial','anticipo','regularizacion')),
  justificante_storage_path   text,           -- ruta en bucket privado `facturas` (recibidas/<fid>/pagos/<pid>/<file>)
  justificante_nombre_archivo text,
  justificante_mime_type      text,
  justificante_size           bigint,
  comentario                  text,
  registrado_por_email        text,           -- derivado de auth.jwt() en la RPC
  registrado_por_rol          text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint factura_pagos_importe_no_cero            check (importe <> 0),
  constraint factura_pagos_negativo_solo_regularizacion check (importe > 0 or tipo_pago = 'regularizacion')
);

create index if not exists factura_pagos_factura_idx
  on public.factura_pagos (factura_id, fecha_pago);

alter table public.factura_pagos enable row level security;
do $$ begin
  create policy "factura_pagos_select" on public.factura_pagos
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- ── 2. factura_incidencias (descuadres; ciclo resuelta) ────────────────────────
create table if not exists public.factura_incidencias (
  id                  uuid primary key default gen_random_uuid(),
  factura_id          uuid not null references public.facturas_recibidas(id) on delete cascade,
  pago_id             uuid references public.factura_pagos(id) on delete set null,
  tipo                text not null
                      check (tipo in ('infrapago','sobrepago','justificante_no_coincide',
                                      'falta_justificante','pago_duplicado_posible','otro')),
  severidad           text not null default 'media' check (severidad in ('baja','media','alta')),
  descripcion         text,
  resuelta            boolean not null default false,
  resuelta_por_email  text,
  resuelta_at         timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists factura_incidencias_factura_idx
  on public.factura_incidencias (factura_id, created_at);

alter table public.factura_incidencias enable row level security;
do $$ begin
  create policy "factura_incidencias_select" on public.factura_incidencias
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- ── 3. Ampliar accion en factura_aprobaciones ──────────────────────────────────
-- +registra_pago, +crea_incidencia, +resuelve_incidencia. Se descubre el nombre
-- real del CHECK dinámicamente para no depender del autogenerado.
do $$
declare cname text;
begin
  select conname into cname
    from pg_constraint
   where conrelid = 'public.factura_aprobaciones'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%accion%';
  if cname is not null then
    execute format('alter table public.factura_aprobaciones drop constraint %I', cname);
  end if;
end $$;

alter table public.factura_aprobaciones
  add constraint factura_aprobaciones_accion_check
  check (accion in ('crea_borrador_ocr','valida','aprueba','rechaza','marca_pagada',
                    'solicita_aclaracion','cambia_estado',
                    'registra_pago','crea_incidencia','resuelve_incidencia'));

-- ── 4. Storage: INSERT acotado a justificantes (recibidas/*/pagos/*) ───────────
-- SOLO INSERT (sin UPDATE, sin upsert): cada justificante tiene ruta única por
-- pago_id; las correcciones son un pago nuevo de tipo `regularizacion`. La lectura
-- usa la policy SELECT de A2. La subida la hace el frontend (Alicia) con su JWT.
do $$ begin
  create policy "facturas_objects_insert_justificantes"
    on storage.objects for insert to authenticated
    with check (
      bucket_id = 'facturas'
      and (storage.foldername(name))[1] = 'recibidas'
      and (storage.foldername(name))[3] = 'pagos'
    );
exception when duplicate_object then null; end $$;

-- ── 5. RPC registrar_pago_factura (atómica, security definer) ──────────────────
-- Inserta el pago + evento de auditoría; crea incidencia de sobrepago/infrapago si
-- aplica; transiciona a `pagada` si se alcanza el total dentro de tolerancia y la
-- factura está en `pendiente_pago`; sincroniza el presupuesto_pago vinculado.
create or replace function public.registrar_pago_factura(
  p_pago_id                   uuid,
  p_factura_id                uuid,
  p_importe                   numeric,
  p_fecha_pago                date,
  p_metodo_pago               text,
  p_tipo_pago                 text,
  p_justificante_storage_path text default null,
  p_justificante_nombre       text default null,
  p_justificante_mime         text default null,
  p_justificante_size         bigint default null,
  p_comentario                text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_factura       public.facturas_recibidas;
  v_estado        text;
  v_total_a_pagar numeric;
  v_eg text; v_ej text; v_ea text;
  v_email   text;
  v_rol     text;
  v_nombre  text;
  v_test    boolean;
  v_pago_id uuid;
  v_pagado_nuevo numeric;
  v_pendiente    numeric;
  v_tol     numeric := 0.5;   -- TOLERANCIA_PAGO_EUR (espejo del frontend)
  v_incidencia_id uuid;
  v_transiciona boolean := false;
begin
  -- Validaciones de entrada
  if p_metodo_pago not in ('transferencia','domiciliacion','tarjeta','efectivo','otro') then
    raise exception 'metodo_pago inválido: %', p_metodo_pago using errcode = '22023'; end if;
  if p_tipo_pago not in ('total','parcial','anticipo','regularizacion') then
    raise exception 'tipo_pago inválido: %', p_tipo_pago using errcode = '22023'; end if;
  if p_importe = 0 then
    raise exception 'El importe del pago no puede ser 0' using errcode = '22023'; end if;
  if p_importe < 0 and p_tipo_pago <> 'regularizacion' then
    raise exception 'Importe negativo solo permitido en pagos de tipo regularizacion' using errcode = '22023'; end if;

  -- Bloquear factura
  select * into v_factura from public.facturas_recibidas where id = p_factura_id for update;
  if not found then raise exception 'Factura % no existe', p_factura_id using errcode = 'P0002'; end if;
  v_estado := v_factura.estado;
  v_total_a_pagar := coalesce(v_factura.total_a_pagar,
                              coalesce(v_factura.total, 0) - coalesce(v_factura.retencion_importe, 0));

  -- Config + actor (no spoofable)
  select email_guille, email_javi, email_alicia into v_eg, v_ej, v_ea
    from public.configuracion_contabilidad where id = 'default';
  v_test := (v_eg is not null and v_eg = v_ej and v_ej = v_ea);
  v_email := nullif(auth.jwt() ->> 'email', '');
  v_rol := case
    when v_email is null then 'otro'
    when v_email = v_eg then 'guille' when v_email = v_ej then 'javi' when v_email = v_ea then 'alicia'
    else 'otro' end;
  v_nombre := case v_rol when 'guille' then 'Guille' when 'javi' then 'Javi' when 'alicia' then 'Alicia' else null end;

  -- AUTORIZACIÓN: solo Alicia (o modo single-operator)
  if not v_test and v_rol <> 'alicia' then
    raise exception 'Solo Alicia puede registrar pagos (rol actual: %)', v_rol using errcode = '42501'; end if;

  -- ESTADOS permitidos
  if v_estado in ('borrador_ocr','revision_javi','rechazada') then
    raise exception 'No se pueden registrar pagos en estado %', v_estado using errcode = '42501'; end if;
  if v_estado = 'pagada' and p_tipo_pago <> 'regularizacion' then
    raise exception 'La factura ya está pagada: solo se admiten regularizaciones' using errcode = '42501'; end if;

  v_pago_id := coalesce(p_pago_id, gen_random_uuid());

  -- Insertar pago (id provisto por el cliente para casar con la ruta del justificante)
  insert into public.factura_pagos
    (id, factura_id, importe, fecha_pago, metodo_pago, tipo_pago,
     justificante_storage_path, justificante_nombre_archivo, justificante_mime_type, justificante_size,
     comentario, registrado_por_email, registrado_por_rol)
  values
    (v_pago_id, p_factura_id, p_importe, coalesce(p_fecha_pago, current_date), p_metodo_pago, p_tipo_pago,
     p_justificante_storage_path, p_justificante_nombre, p_justificante_mime, p_justificante_size,
     p_comentario, v_email, v_rol);

  -- Recalcular pagado/pendiente
  select coalesce(sum(importe), 0) into v_pagado_nuevo from public.factura_pagos where factura_id = p_factura_id;
  v_pendiente := round(v_total_a_pagar - v_pagado_nuevo, 2);

  -- Auditoría: pago registrado (sin cambio de estado → anterior = nuevo)
  insert into public.factura_aprobaciones
    (factura_id, actor_email, actor_nombre, actor_rol, accion, estado_anterior, estado_nuevo, comentario, metadata)
  values
    (p_factura_id, v_email, v_nombre, v_rol, 'registra_pago', v_estado, v_estado, p_comentario,
     jsonb_build_object('pago_id', v_pago_id, 'importe', p_importe, 'tipo_pago', p_tipo_pago,
                        'total_pagado', v_pagado_nuevo, 'pendiente', v_pendiente));

  -- Incidencia: SOBREPAGO (pagado supera el total por encima de tolerancia)
  if v_pendiente < -v_tol then
    v_incidencia_id := gen_random_uuid();
    insert into public.factura_incidencias (id, factura_id, pago_id, tipo, severidad, descripcion)
    values (v_incidencia_id, p_factura_id, v_pago_id, 'sobrepago', 'media',
            format('Sobrepago: pagado %s € sobre %s € (exceso %s €)', v_pagado_nuevo, v_total_a_pagar, -v_pendiente));
    insert into public.factura_aprobaciones
      (factura_id, actor_email, actor_nombre, actor_rol, accion, estado_anterior, estado_nuevo, comentario, metadata)
    values (p_factura_id, v_email, v_nombre, v_rol, 'crea_incidencia', v_estado, v_estado, 'Sobrepago detectado',
            jsonb_build_object('incidencia_id', v_incidencia_id, 'tipo', 'sobrepago'));
  end if;

  -- Incidencia: INFRAPAGO (se marca como `total` pero no alcanza el pendiente).
  -- Un pago `parcial` NO genera incidencia: es saldo pendiente normal.
  if p_tipo_pago = 'total' and v_pendiente > v_tol then
    v_incidencia_id := gen_random_uuid();
    insert into public.factura_incidencias (id, factura_id, pago_id, tipo, severidad, descripcion)
    values (v_incidencia_id, p_factura_id, v_pago_id, 'infrapago', 'media',
            format('Pago marcado como total pero queda pendiente %s €', v_pendiente));
    insert into public.factura_aprobaciones
      (factura_id, actor_email, actor_nombre, actor_rol, accion, estado_anterior, estado_nuevo, comentario, metadata)
    values (p_factura_id, v_email, v_nombre, v_rol, 'crea_incidencia', v_estado, v_estado, 'Infrapago detectado',
            jsonb_build_object('incidencia_id', v_incidencia_id, 'tipo', 'infrapago'));
  end if;

  -- Transición a `pagada` si se alcanza el total dentro de tolerancia y estaba en pendiente_pago
  if v_estado = 'pendiente_pago' and abs(v_pendiente) <= v_tol then
    update public.facturas_recibidas set estado = 'pagada', updated_at = now() where id = p_factura_id;
    v_transiciona := true;
    insert into public.factura_aprobaciones
      (factura_id, actor_email, actor_nombre, actor_rol, accion, estado_anterior, estado_nuevo, comentario)
    values (p_factura_id, v_email, v_nombre, v_rol, 'marca_pagada', v_estado, 'pagada',
            'Pago completo (dentro de tolerancia)');
    if v_factura.presupuesto_pago_id is not null then
      update public.presupuesto_pagos set estado = 'pagado' where id = v_factura.presupuesto_pago_id;
    end if;
  end if;

  return jsonb_build_object(
    'pago_id',        v_pago_id,
    'estado_factura', case when v_transiciona then 'pagada' else v_estado end,
    'total_pagado',   v_pagado_nuevo,
    'pendiente',      v_pendiente,
    'transiciona',    v_transiciona
  );
end;
$$;

grant execute on function
  public.registrar_pago_factura(uuid, uuid, numeric, date, text, text, text, text, text, bigint, text)
  to authenticated;

-- ── 6. RPC resolver_incidencia_factura (Guille o Alicia, o single-operator) ────
create or replace function public.resolver_incidencia_factura(
  p_incidencia_id uuid,
  p_comentario    text default null
) returns public.factura_incidencias
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inc    public.factura_incidencias;
  v_estado text;
  v_eg text; v_ej text; v_ea text;
  v_email text; v_rol text; v_nombre text; v_test boolean;
begin
  select * into v_inc from public.factura_incidencias where id = p_incidencia_id for update;
  if not found then raise exception 'Incidencia % no existe', p_incidencia_id using errcode = 'P0002'; end if;
  if v_inc.resuelta then return v_inc; end if;

  select email_guille, email_javi, email_alicia into v_eg, v_ej, v_ea
    from public.configuracion_contabilidad where id = 'default';
  v_test := (v_eg is not null and v_eg = v_ej and v_ej = v_ea);
  v_email := nullif(auth.jwt() ->> 'email', '');
  v_rol := case
    when v_email is null then 'otro'
    when v_email = v_eg then 'guille' when v_email = v_ej then 'javi' when v_email = v_ea then 'alicia'
    else 'otro' end;
  v_nombre := case v_rol when 'guille' then 'Guille' when 'javi' then 'Javi' when 'alicia' then 'Alicia' else null end;

  if not v_test and v_rol not in ('guille','alicia') then
    raise exception 'Sin permiso para resolver incidencias (rol actual: %)', v_rol using errcode = '42501'; end if;

  update public.factura_incidencias
     set resuelta = true, resuelta_por_email = v_email, resuelta_at = now()
   where id = p_incidencia_id
   returning * into v_inc;

  select estado into v_estado from public.facturas_recibidas where id = v_inc.factura_id;

  insert into public.factura_aprobaciones
    (factura_id, actor_email, actor_nombre, actor_rol, accion, estado_anterior, estado_nuevo, comentario, metadata)
  values
    (v_inc.factura_id, v_email, v_nombre, v_rol, 'resuelve_incidencia', v_estado, v_estado,
     coalesce(p_comentario, 'Incidencia resuelta'),
     jsonb_build_object('incidencia_id', p_incidencia_id, 'tipo', v_inc.tipo));

  return v_inc;
end;
$$;

grant execute on function
  public.resolver_incidencia_factura(uuid, text)
  to authenticated;
