-- ═══════════════════════════════════════════════════════════════════════════
-- PR B — Auditoría de transiciones de factura (2026-06-19)
--
-- `factura_aprobaciones`: log INMUTABLE de quién hizo qué y cuándo en el ciclo de
-- vida de una factura recibida. Se acompaña de una RPC atómica que cambia el
-- estado e inserta el evento en la MISMA transacción, con el actor derivado de la
-- sesión (no spoofable desde el cliente).
--
-- No cambia el flujo operativo ni toca `facturas_recibidas` (salvo lectura/estado).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Tabla de auditoría ──────────────────────────────────────────────────────
create table if not exists public.factura_aprobaciones (
  id              uuid primary key default gen_random_uuid(),
  factura_id      uuid not null references public.facturas_recibidas(id) on delete cascade,
  actor_email     text,
  actor_nombre    text,
  actor_rol       text not null default 'otro'
                  check (actor_rol in ('guille', 'javi', 'alicia', 'sistema', 'otro')),
  accion          text not null
                  check (accion in ('crea_borrador_ocr', 'valida', 'aprueba',
                                    'rechaza', 'marca_pagada', 'solicita_aclaracion', 'cambia_estado')),
  estado_anterior text,          -- null en la creación
  estado_nuevo    text not null, -- text (no FK al enum) para resiliencia futura
  comentario      text,
  motivo_rechazo  text,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists factura_aprobaciones_factura_idx
  on public.factura_aprobaciones (factura_id, created_at);

-- Garantiza un único evento de creación por factura (evita duplicar la línea OCR).
create unique index if not exists factura_aprobaciones_creacion_unica
  on public.factura_aprobaciones (factura_id) where accion = 'crea_borrador_ocr';

-- ── 2. RLS: log inmutable ──────────────────────────────────────────────────────
-- SELECT para autenticados. SIN políticas de INSERT/UPDATE/DELETE → el cliente NO
-- puede escribir directamente (anti-spoofing ni logs falsos). Las inserciones
-- legítimas pasan por la RPC security definer (acciones humanas) o por el service
-- role (Edge Function, evento de creación), que bypassean RLS.
alter table public.factura_aprobaciones enable row level security;

do $$ begin
  create policy "facturas_aprob_select" on public.factura_aprobaciones
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- ── 3. RPC atómica: estado + auditoría en una sola transacción ─────────────────
-- El actor se deriva de auth.jwt() (sesión), nunca de parámetros del cliente, y
-- se valida AUTORIZACIÓN rol→acción aquí dentro (no basta con no falsificar el
-- actor: un autenticado no puede ejecutar acciones que no le corresponden).
-- La acción 'cambia_estado' NO se permite vía esta RPC (sin cambios de estado
-- arbitrarios desde el cliente); queda reservada para el service role/admin.
create or replace function public.avanzar_estado_factura_con_auditoria(
  p_factura_id     uuid,
  p_accion         text,
  p_comentario     text default null,
  p_motivo_rechazo text default null
) returns public.facturas_recibidas
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_factura  public.facturas_recibidas;
  v_anterior text;
  v_nuevo    text;
  v_umbral   numeric;
  v_eg text; v_ej text; v_ea text;
  v_email    text;
  v_rol      text;
  v_nombre   text;
  v_test     boolean;
begin
  -- 1. leer + bloquear la fila
  select * into v_factura from public.facturas_recibidas where id = p_factura_id for update;
  if not found then
    raise exception 'Factura % no existe', p_factura_id using errcode = 'P0002';
  end if;
  v_anterior := v_factura.estado;

  -- 2. configuración (umbral + emails para derivar el rol)
  select umbral_aprobacion_javi, email_guille, email_javi, email_alicia
    into v_umbral, v_eg, v_ej, v_ea
    from public.configuracion_contabilidad where id = 'default';
  v_umbral := coalesce(v_umbral, 1000);
  -- Modo "single-operator": los 3 correos coinciden → un único operador real
  -- (mismo criterio que el "test mode" de la UI). En ese caso no se aplica la
  -- matriz rol→acción (si no, javi/alicia nunca podrían actuar).
  v_test := (v_eg is not null and v_eg = v_ej and v_ej = v_ea);

  -- 3. actor derivado de la sesión (no spoofable)
  v_email := nullif(auth.jwt() ->> 'email', '');
  v_rol := case
    when v_email is null then 'otro'
    when v_email = v_eg   then 'guille'
    when v_email = v_ej   then 'javi'
    when v_email = v_ea   then 'alicia'
    else 'otro' end;
  v_nombre := case v_rol
    when 'guille' then 'Guille' when 'javi' then 'Javi' when 'alicia' then 'Alicia' else null end;

  -- 4. AUTORIZACIÓN rol→acción (salvo modo single-operator). Mismo criterio que
  --    los permisos de la UI: valida=Guille; aprueba=Javi o Guille;
  --    marca_pagada=Alicia; rechaza=quien puede actuar en ese estado.
  if not v_test then
    if p_accion = 'valida' then
      if v_rol <> 'guille' then
        raise exception 'Solo Guille puede validar (rol actual: %)', v_rol using errcode = '42501'; end if;
    elsif p_accion = 'aprueba' then
      if v_rol not in ('guille', 'javi') then
        raise exception 'Solo Javi o Guille pueden aprobar (rol actual: %)', v_rol using errcode = '42501'; end if;
    elsif p_accion = 'marca_pagada' then
      if v_rol <> 'alicia' then
        raise exception 'Solo Alicia puede marcar como pagada (rol actual: %)', v_rol using errcode = '42501'; end if;
    elsif p_accion = 'rechaza' then
      if (v_anterior = 'borrador_ocr'  and v_rol <> 'guille')
      or (v_anterior = 'revision_javi'  and v_rol not in ('guille', 'javi'))
      or (v_anterior = 'pendiente_pago' and v_rol <> 'alicia') then
        raise exception 'Sin permiso para rechazar en el estado % (rol actual: %)', v_anterior, v_rol using errcode = '42501'; end if;
    end if;
  end if;

  -- 5. validar transición + calcular estado nuevo
  if p_accion = 'valida' then
    if v_anterior <> 'borrador_ocr' then
      raise exception 'No se puede validar desde el estado %', v_anterior; end if;
    v_nuevo := case when v_factura.total > v_umbral then 'revision_javi' else 'pendiente_pago' end;
  elsif p_accion = 'aprueba' then
    if v_anterior <> 'revision_javi' then
      raise exception 'No se puede aprobar desde el estado %', v_anterior; end if;
    v_nuevo := 'pendiente_pago';
  elsif p_accion = 'marca_pagada' then
    if v_anterior <> 'pendiente_pago' then
      raise exception 'No se puede marcar pagada desde el estado %', v_anterior; end if;
    v_nuevo := 'pagada';
  elsif p_accion = 'rechaza' then
    if v_anterior in ('pagada', 'rechazada') then
      raise exception 'No se puede rechazar desde el estado %', v_anterior; end if;
    v_nuevo := 'rechazada';
  else
    -- 'cambia_estado' y 'solicita_aclaracion' NO se permiten vía RPC.
    raise exception 'Acción no soportada por la RPC: %', p_accion using errcode = '22023';
  end if;

  -- 5. actualizar estado (y motivo si es rechazo)
  update public.facturas_recibidas
     set estado         = v_nuevo,
         motivo_rechazo = case when p_accion = 'rechaza' then p_motivo_rechazo else motivo_rechazo end,
         updated_at     = now()
   where id = p_factura_id
   returning * into v_factura;

  -- 6. log de auditoría (misma transacción → atómico con el cambio de estado)
  insert into public.factura_aprobaciones
    (factura_id, actor_email, actor_nombre, actor_rol, accion,
     estado_anterior, estado_nuevo, comentario, motivo_rechazo)
  values
    (p_factura_id, v_email, v_nombre, v_rol, p_accion,
     v_anterior, v_nuevo, p_comentario, p_motivo_rechazo);

  return v_factura;
end;
$$;

grant execute on function
  public.avanzar_estado_factura_con_auditoria(uuid, text, text, text)
  to authenticated;
