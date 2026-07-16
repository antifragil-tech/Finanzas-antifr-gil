-- ═══════════════════════════════════════════════════════════════════════════
-- ANTIFRÁGIL OS — REFLEJO DEL ESQUEMA REAL (generado 2026-07-16)
-- ═══════════════════════════════════════════════════════════════════════════
-- Generado por scripts/db/reflejar-esquema.py (solo lecturas de catálogo).
-- ES LA FOTO del esquema aplicado en la base real; NO aplicar sobre ella.
-- Contenido: 58 tablas · 21 enums · 12 funciones · 12 vistas · 36 triggers · 74 políticas RLS
-- ═══════════════════════════════════════════════════════════════════════════

-- Extensiones presentes en la base (informativo):
--   · btree_gist 1.7
--   · pg_stat_statements 1.11
--   · pgcrypto 1.3
--   · plpgsql 1.0
--   · supabase_vault 0.3.1
--   · uuid-ossp 1.1

-- ═══════════════════════════════════════════════════════════════════════════
-- §1. ENUMS (21)
-- ═══════════════════════════════════════════════════════════════════════════
create type public.capa_coste as enum ('directo', 'fijo', 'compartido', 'general', 'amortizable');
create type public.categoria_gasto as enum ('coste_profesional_variable', 'nominas_laboral', 'gasto_clinica', 'amortizable');
create type public.estado_cita as enum ('reservada', 'confirmada', 'realizada', 'validada', 'liquidada', 'cancelada_a_tiempo', 'cancelada_tarde', 'no_show');
create type public.estado_factura_emitida as enum ('borrador', 'emitida_operativa', 'cobrada', 'pendiente_documento_oficial', 'vinculada_factura_externa');
create type public.estado_factura_recibida as enum ('pendiente_recibir', 'recibida', 'validada', 'pendiente_pago', 'pagada', 'bloqueada');
create type public.estado_liquidacion as enum ('pendiente_calculo', 'calculada', 'pendiente_documento', 'validada', 'pendiente_pago', 'pagada', 'revisada', 'bloqueada_por_incidencia');
create type public.estado_venta_bono as enum ('borrador', 'vendido', 'activo', 'parcialmente_consumido', 'consumido', 'caducado', 'devuelto_parcial', 'devuelto_total', 'cancelado', 'bloqueado_por_incidencia');
create type public.origen_devengo as enum ('prestacion', 'ingreso_por_caducidad');
create type public.origen_factura_emitida as enum ('sesion', 'bono', 'programa', 'partner');
create type public.origen_ingreso as enum ('suelta', 'bono', 'programa', 'plan', 'partner');
create type public.rol_operativo as enum ('direccion', 'coordinacion', 'recepcion', 'profesional');
create type public.tipo_acuerdo_centro as enum ('propio', 'cesion', 'porcentaje', 'renta', 'pendiente_confirmar');
create type public.tipo_canal as enum ('organico', 'referido', 'pagado', 'partner_b2b', 'walk_in');
create type public.tipo_documento_gasto as enum ('nomina', 'factura_recibida', 'ticket', 'no_requerido');
create type public.tipo_evidencia_liquidacion as enum ('nomina', 'factura_autonomo');
create type public.tipo_gasto as enum ('coste_por_sesion', 'coste_por_cliente_plan', 'formacion_profesional', 'nomina_fija', 'seguridad_social', 'irpf_retenciones', 'coste_coordinacion', 'coste_compartido', 'alquiler', 'suministros', 'software', 'gestoria', 'material', 'tpv_comisiones', 'marketing', 'mantenimiento', 'gasto_extra', 'equipamiento', 'reformas', 'herramientas', 'concepto_provisional');
create type public.tipo_regla_liquidacion as enum ('nomina_fija', 'nomina_compartida', 'por_sesion', 'mensual_por_plan', 'pendiente_regularizar', 'ajuste_manual');
create type public.tipo_relacion as enum ('nomina', 'nomina_compartida', 'autonomo', 'colaborador', 'pendiente_regularizar');
create type public.tipo_sesion_bono as enum ('reservada', 'consumida', 'no_show_cobrado', 'no_show_no_cobrado', 'cancelada_a_tiempo', 'cortesia', 'pendiente_regularizar');
create type public.tipo_venta as enum ('suelta', 'bono', 'programa', 'plan');
create type public.unidad_regla as enum ('eur_mes', 'eur_sesion', 'eur_mes_cliente');

-- ═══════════════════════════════════════════════════════════════════════════
-- §2. FUNCIONES PROPIAS (12)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.categoria_de_gasto(p_tipo tipo_gasto)
 RETURNS categoria_gasto
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case p_tipo
    when 'coste_por_sesion'       then 'coste_profesional_variable'
    when 'coste_por_cliente_plan' then 'coste_profesional_variable'
    when 'formacion_profesional'  then 'coste_profesional_variable'
    when 'nomina_fija'            then 'nominas_laboral'
    when 'seguridad_social'       then 'nominas_laboral'
    when 'irpf_retenciones'       then 'nominas_laboral'
    when 'coste_coordinacion'     then 'nominas_laboral'
    when 'coste_compartido'       then 'nominas_laboral'
    when 'equipamiento'           then 'amortizable'
    when 'reformas'               then 'amortizable'
    when 'herramientas'           then 'amortizable'
    else 'gasto_clinica'          -- resto de C) + concepto_provisional
  end::public.categoria_gasto;
$function$;

CREATE OR REPLACE FUNCTION public.cerrar_arqueo_caja(p_arqueo_id uuid, p_materializar_ajuste boolean DEFAULT false, p_comentario text DEFAULT NULL::text)
 RETURNS arqueo_caja
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_arqueo public.arqueo_caja;
  v_email  text;
  v_mov_id uuid;
begin
  select * into v_arqueo from public.arqueo_caja where id = p_arqueo_id for update;
  if not found then raise exception 'Arqueo % no existe', p_arqueo_id using errcode = 'P0002'; end if;
  if v_arqueo.estado <> 'borrador' then
    raise exception 'Solo se puede cerrar un arqueo en estado borrador (actual: %)', v_arqueo.estado using errcode = '42501'; end if;

  v_email := nullif(auth.jwt() ->> 'email', '');

  -- Opcional: materializar el descuadre como movimiento de ajuste (append-only)
  if p_materializar_ajuste and v_arqueo.diferencia <> 0 then
    v_mov_id := gen_random_uuid();
    insert into public.movimiento_caja
      (id, cuenta_tesoreria_id, fecha, importe, concepto, medio_pago, origen_tipo, origen_id,
       registrado_por_email, notas)
    values
      (v_mov_id, v_arqueo.cuenta_tesoreria_id, v_arqueo.fecha, v_arqueo.diferencia,
       'Ajuste de arqueo de caja', 'efectivo', 'arqueo_ajuste', v_arqueo.id, v_email,
       coalesce(p_comentario, 'Materialización de descuadre de arqueo'));
  end if;

  update public.arqueo_caja
     set estado = 'cerrado',
         ajuste_movimiento_id = coalesce(v_mov_id, ajuste_movimiento_id),
         observaciones = coalesce(observaciones, '') ||
                         case when p_comentario is not null then E'\n[cierre] ' || p_comentario else '' end,
         updated_at = now()
   where id = p_arqueo_id
   returning * into v_arqueo;

  return v_arqueo;
end;
$function$;

CREATE OR REPLACE FUNCTION public.deshacer_importacion_extracto(p_extracto_id uuid)
 RETURNS extractos_bancarios
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_ex public.extractos_bancarios;
begin
  delete from public.movimientos_bancarios where extracto_id = p_extracto_id;
  update public.extractos_bancarios
    set estado = 'deshecho', n_importados = 0, updated_at = now()
   where id = p_extracto_id
   returning * into v_ex;
  if not found then raise exception 'Extracto % no existe', p_extracto_id using errcode = 'P0002'; end if;
  return v_ex;
end;
$function$;

CREATE OR REPLACE FUNCTION public.es_direccion()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.rol_operativo_actual() = 'direccion';
$function$;

CREATE OR REPLACE FUNCTION public.importar_extracto_bancario(p_extracto jsonb, p_movimientos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_email        text;
  v_soc          text := p_extracto->>'sociedad_id_ref';
  v_archivo_hash text := p_extracto->>'archivo_hash';
  v_existente    uuid;
  v_extracto_id  uuid;
  v_total        int := coalesce(jsonb_array_length(p_movimientos), 0);
  v_importados   int := 0;
  v_min date; v_max date;
begin
  if v_soc is null or v_archivo_hash is null then
    raise exception 'Faltan sociedad_id_ref o archivo_hash' using errcode = '22023';
  end if;
  v_email := nullif(auth.jwt() ->> 'email', '');

  select id into v_existente from public.extractos_bancarios
   where sociedad_id_ref = v_soc and archivo_hash = v_archivo_hash and estado <> 'deshecho'
   limit 1;
  if v_existente is not null then
    return jsonb_build_object('ya_importado', true, 'extracto_id', v_existente,
      'total', v_total, 'importados', 0, 'duplicados', v_total, 'errores', 0);
  end if;

  select min((m->>'fecha')::date), max((m->>'fecha')::date) into v_min, v_max
    from jsonb_array_elements(p_movimientos) m;

  insert into public.extractos_bancarios
    (sociedad_id_ref, cuenta_bancaria_id, banco, iban, anio, mes, nombre_archivo, formato,
     archivo_hash, n_movimientos, rango_fecha_min, rango_fecha_max, importado_por_email)
  values
    (v_soc, nullif(p_extracto->>'cuenta_bancaria_id','')::uuid, p_extracto->>'banco', p_extracto->>'iban',
     (p_extracto->>'anio')::int, (p_extracto->>'mes')::int, p_extracto->>'nombre_archivo', p_extracto->>'formato',
     v_archivo_hash, v_total, v_min, v_max, v_email)
  returning id into v_extracto_id;

  with ins as (
    insert into public.movimientos_bancarios
      (sociedad_id_ref, cuenta_bancaria_id, extracto_id, iban, banco, fecha, fecha_valor,
       concepto, concepto_normalizado, importe, saldo, categoria, subcategoria, es_intragrupo,
       entidad_contraparte, referencia, tipo_movimiento, hash, revisado, fuente)
    select
      v_soc, nullif(p_extracto->>'cuenta_bancaria_id','')::uuid, v_extracto_id,
      m->>'iban', m->>'banco', (m->>'fecha')::date, nullif(m->>'fecha_valor','')::date,
      m->>'concepto', m->>'concepto_normalizado', (m->>'importe')::numeric, nullif(m->>'saldo','')::numeric,
      nullif(m->>'categoria',''), nullif(m->>'subcategoria',''), coalesce((m->>'es_intragrupo')::boolean, false),
      nullif(m->>'entidad_contraparte',''), nullif(m->>'referencia',''), nullif(m->>'tipo_movimiento',''),
      m->>'hash', coalesce((m->>'revisado')::boolean, false), coalesce(m->>'fuente','extracto')
    from jsonb_array_elements(p_movimientos) m
    on conflict (sociedad_id_ref, hash) where hash is not null do nothing
    returning 1
  )
  select count(*) into v_importados from ins;

  update public.extractos_bancarios
    set n_importados = v_importados, n_duplicados = v_total - v_importados, updated_at = now()
   where id = v_extracto_id;

  return jsonb_build_object('ya_importado', false, 'extracto_id', v_extracto_id,
    'total', v_total, 'importados', v_importados, 'duplicados', v_total - v_importados, 'errores', 0);
end;
$function$;

CREATE OR REPLACE FUNCTION public.profesional_actual()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select profesional_id from public.perfiles_operativos
   where auth_user_id = auth.uid() and activo
   limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_arqueo_caja(p_cuenta_tesoreria_id uuid, p_saldo_contado numeric, p_fecha date DEFAULT CURRENT_DATE, p_observaciones text DEFAULT NULL::text)
 RETURNS arqueo_caja
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_cuenta   public.cuenta_tesoreria;
  v_teorico  numeric;
  v_email    text;
  v_arqueo   public.arqueo_caja;
begin
  select * into v_cuenta from public.cuenta_tesoreria where id = p_cuenta_tesoreria_id;
  if not found then raise exception 'Cuenta de tesorería % no existe', p_cuenta_tesoreria_id using errcode = 'P0002'; end if;
  if v_cuenta.tipo <> 'caja' then
    raise exception 'El arqueo solo aplica a cuentas tipo caja' using errcode = '22023'; end if;
  if p_saldo_contado is null then
    raise exception 'saldo_contado es obligatorio' using errcode = '22023'; end if;

  -- Saldo teórico = suma de movimientos de la caja hasta la fecha del arqueo
  select round(coalesce(sum(importe), 0), 2) into v_teorico
    from public.movimiento_caja
   where cuenta_tesoreria_id = p_cuenta_tesoreria_id
     and fecha <= coalesce(p_fecha, current_date);

  v_email := nullif(auth.jwt() ->> 'email', '');

  insert into public.arqueo_caja
    (cuenta_tesoreria_id, fecha, saldo_teorico, saldo_contado, diferencia, observaciones,
     registrado_por_email, estado)
  values
    (p_cuenta_tesoreria_id, coalesce(p_fecha, current_date), v_teorico, p_saldo_contado,
     round(p_saldo_contado - v_teorico, 2), p_observaciones, v_email, 'borrador')
  returning * into v_arqueo;

  return v_arqueo;
end;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_movimiento_caja(p_cuenta_tesoreria_id uuid, p_importe numeric, p_concepto text, p_fecha date DEFAULT CURRENT_DATE, p_medio_pago text DEFAULT 'efectivo'::text, p_origen_tipo text DEFAULT 'manual'::text, p_origen_id uuid DEFAULT NULL::uuid, p_proyecto_id_ref text DEFAULT NULL::text, p_notas text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_cuenta public.cuenta_tesoreria;
  v_email  text;
  v_mov_id uuid;
  v_saldo  numeric;
begin
  if p_importe is null or p_importe = 0 then
    raise exception 'El importe del movimiento no puede ser 0/NULL' using errcode = '22023'; end if;
  if p_medio_pago not in ('efectivo','tarjeta','transferencia','bizum','domiciliacion','otro') then
    raise exception 'medio_pago inválido: %', p_medio_pago using errcode = '22023'; end if;

  select * into v_cuenta from public.cuenta_tesoreria where id = p_cuenta_tesoreria_id;
  if not found then raise exception 'Cuenta de tesorería % no existe', p_cuenta_tesoreria_id using errcode = 'P0002'; end if;
  if v_cuenta.tipo <> 'caja' then
    raise exception 'registrar_movimiento_caja solo admite cuentas tipo caja (cuenta % es %)', p_cuenta_tesoreria_id, v_cuenta.tipo using errcode = '22023'; end if;
  if not v_cuenta.activa then
    raise exception 'La caja % no está activa', p_cuenta_tesoreria_id using errcode = '42501'; end if;

  v_email := nullif(auth.jwt() ->> 'email', '');
  v_mov_id := gen_random_uuid();

  insert into public.movimiento_caja
    (id, cuenta_tesoreria_id, fecha, importe, concepto, medio_pago, origen_tipo, origen_id,
     proyecto_id_ref, sociedad_id_ref, registrado_por_email, notas)
  values
    (v_mov_id, p_cuenta_tesoreria_id, coalesce(p_fecha, current_date), p_importe, p_concepto, p_medio_pago,
     p_origen_tipo, p_origen_id,
     coalesce(p_proyecto_id_ref, v_cuenta.proyecto_id_ref), v_cuenta.sociedad_id_ref, v_email, p_notas);

  select round(coalesce(sum(importe), 0), 2) into v_saldo
    from public.movimiento_caja where cuenta_tesoreria_id = p_cuenta_tesoreria_id;

  return jsonb_build_object('movimiento_id', v_mov_id, 'saldo_caja', v_saldo);
end;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_pago_factura(p_pago_id uuid, p_factura_id uuid, p_importe numeric, p_fecha_pago date, p_metodo_pago text, p_tipo_pago text, p_justificante_storage_path text DEFAULT NULL::text, p_justificante_nombre text DEFAULT NULL::text, p_justificante_mime text DEFAULT NULL::text, p_justificante_size bigint DEFAULT NULL::bigint, p_comentario text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  v_tol     numeric := 0.5;
  v_incidencia_id uuid;
  v_transiciona boolean := false;
begin
  if p_metodo_pago not in ('transferencia','domiciliacion','tarjeta','efectivo','otro') then
    raise exception 'metodo_pago inválido: %', p_metodo_pago using errcode = '22023'; end if;
  if p_tipo_pago not in ('total','parcial','anticipo','regularizacion') then
    raise exception 'tipo_pago inválido: %', p_tipo_pago using errcode = '22023'; end if;
  if p_importe = 0 then
    raise exception 'El importe del pago no puede ser 0' using errcode = '22023'; end if;
  if p_importe < 0 and p_tipo_pago <> 'regularizacion' then
    raise exception 'Importe negativo solo permitido en pagos de tipo regularizacion' using errcode = '22023'; end if;

  select * into v_factura from public.facturas_recibidas where id = p_factura_id for update;
  if not found then raise exception 'Factura % no existe', p_factura_id using errcode = 'P0002'; end if;
  v_estado := v_factura.estado;
  v_total_a_pagar := coalesce(v_factura.total_a_pagar,
                              coalesce(v_factura.total, 0) - coalesce(v_factura.retencion_importe, 0));

  select email_guille, email_javi, email_alicia into v_eg, v_ej, v_ea
    from public.configuracion_contabilidad where id = 'default';
  v_test := (v_eg is not null and v_eg = v_ej and v_ej = v_ea);
  v_email := nullif(auth.jwt() ->> 'email', '');
  v_rol := case
    when v_email is null then 'otro'
    when v_email = v_eg then 'guille' when v_email = v_ej then 'javi' when v_email = v_ea then 'alicia'
    else 'otro' end;
  v_nombre := case v_rol when 'guille' then 'Guille' when 'javi' then 'Javi' when 'alicia' then 'Alicia' else null end;

  if not v_test and v_rol <> 'alicia' then
    raise exception 'Solo Alicia puede registrar pagos (rol actual: %)', v_rol using errcode = '42501'; end if;

  if v_estado in ('borrador_ocr','revision_javi','rechazada') then
    raise exception 'No se pueden registrar pagos en estado %', v_estado using errcode = '42501'; end if;
  if v_estado = 'pagada' and p_tipo_pago <> 'regularizacion' then
    raise exception 'La factura ya está pagada: solo se admiten regularizaciones' using errcode = '42501'; end if;

  v_pago_id := coalesce(p_pago_id, gen_random_uuid());

  insert into public.factura_pagos
    (id, factura_id, importe, fecha_pago, metodo_pago, tipo_pago,
     justificante_storage_path, justificante_nombre_archivo, justificante_mime_type, justificante_size,
     comentario, registrado_por_email, registrado_por_rol)
  values
    (v_pago_id, p_factura_id, p_importe, coalesce(p_fecha_pago, current_date), p_metodo_pago, p_tipo_pago,
     p_justificante_storage_path, p_justificante_nombre, p_justificante_mime, p_justificante_size,
     p_comentario, v_email, v_rol);

  select coalesce(sum(importe), 0) into v_pagado_nuevo from public.factura_pagos where factura_id = p_factura_id;
  v_pendiente := round(v_total_a_pagar - v_pagado_nuevo, 2);

  insert into public.factura_aprobaciones
    (factura_id, actor_email, actor_nombre, actor_rol, accion, estado_anterior, estado_nuevo, comentario, metadata)
  values
    (p_factura_id, v_email, v_nombre, v_rol, 'registra_pago', v_estado, v_estado, p_comentario,
     jsonb_build_object('pago_id', v_pago_id, 'importe', p_importe, 'tipo_pago', p_tipo_pago,
                        'total_pagado', v_pagado_nuevo, 'pendiente', v_pendiente));

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
    'pago_id', v_pago_id,
    'estado_factura', case when v_transiciona then 'pagada' else v_estado end,
    'total_pagado', v_pagado_nuevo,
    'pendiente', v_pendiente,
    'transiciona', v_transiciona
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.resolver_incidencia_factura(p_incidencia_id uuid, p_comentario text DEFAULT NULL::text)
 RETURNS factura_incidencias
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.rol_operativo_actual()
 RETURNS rol_operativo
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select rol from public.perfiles_operativos
   where auth_user_id = auth.uid() and activo
   limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §3. TABLAS (58) — columnas; constraints en §4
-- ═══════════════════════════════════════════════════════════════════════════
create table public.ajustes_liquidacion (
  id                               uuid not null default gen_random_uuid(),
  liquidacion_id                   uuid not null,
  importe                          numeric(14,2) not null,
  motivo                           text not null,
  autor_email                      text not null,
  fecha                            date not null default CURRENT_DATE,
  created_at                       timestamptz not null default now()
);

create table public.arqueo_caja (
  id                               uuid not null default gen_random_uuid(),
  cuenta_tesoreria_id              uuid not null,
  fecha                            date not null default CURRENT_DATE,
  saldo_teorico                    numeric(14,2) not null,
  saldo_contado                    numeric(14,2) not null,
  diferencia                       numeric(14,2) not null,
  observaciones                    text,
  registrado_por_email             text,
  ajuste_movimiento_id             uuid,
  estado                           text not null default 'borrador'::text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.asientos_borrador (
  id                               uuid not null default gen_random_uuid(),
  sociedad_id_ref                  text not null,
  fecha                            date not null,
  numero                           text,
  concepto                         text not null,
  lineas                           jsonb not null default '[]'::jsonb,
  total_debe                       numeric(14,2) not null default 0,
  total_haber                      numeric(14,2) not null default 0,
  estado                           text not null default 'borrador'::text,
  movimiento_id                    uuid,
  factura_recibida_id              uuid,
  factura_emitida_id               uuid,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.asientos_oficiales (
  id                               uuid not null default gen_random_uuid(),
  sociedad_id_ref                  text not null,
  fecha                            date not null,
  numero_oficial                   text,
  concepto                         text not null,
  lineas                           jsonb not null default '[]'::jsonb,
  total_debe                       numeric(14,2) not null default 0,
  total_haber                      numeric(14,2) not null default 0,
  fuente                           text not null default 'csv'::text,
  asiento_borrador_id              uuid,
  estado_reconciliacion            text not null default 'pendiente'::text,
  created_at                       timestamptz not null default now()
);

create table public.balance_sumas_saldos (
  id                               uuid not null default gen_random_uuid(),
  sociedad_id                      text not null,
  periodo                          date not null,
  cuenta                           text not null,
  descripcion                      text,
  debe                             numeric(14,2) not null default 0,
  haber                            numeric(14,2) not null default 0,
  saldo_deudor                     numeric(14,2) not null default 0,
  saldo_acreedor                   numeric(14,2) not null default 0,
  created_at                       timestamptz not null default now()
);

create table public.caducidades_bono (
  id                               uuid not null default gen_random_uuid(),
  venta_bono_id                    uuid not null,
  unidades_caducadas               integer not null,
  importe                          numeric(14,2) not null,
  fecha                            date not null,
  pendiente_criterio_fiscal        boolean not null default true,
  registrado_por_email             text,
  created_at                       timestamptz not null default now()
);

create table public.canales (
  id                               uuid not null default gen_random_uuid(),
  nombre                           text not null,
  tipo                             public.tipo_canal not null,
  activo                           boolean not null default true,
  notas                            text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.clinica_bloqueos_agenda (
  id                               uuid not null default gen_random_uuid(),
  profesional_id                   uuid,
  inicio                           timestamptz not null,
  fin                              timestamptz not null,
  tipo                             text not null default 'otro'::text,
  motivo                           text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.clinica_citas (
  id                               uuid not null default gen_random_uuid(),
  cliente_id                       uuid not null,
  profesional_id                   uuid not null,
  servicio_id                      uuid not null,
  centro_id                        uuid,
  canal_id                         uuid,
  inicio                           timestamptz not null,
  fin                              timestamptz not null,
  estado                           public.estado_cita not null default 'reservada'::estado_cita,
  tipo_venta                       public.tipo_venta not null default 'suelta'::tipo_venta,
  precio_snapshot                  numeric(14,2),
  notas_admin                      text,
  registrado_por_email             text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now(),
  liquidacion_id                   uuid
);

create table public.clinica_clientes (
  id                               uuid not null default gen_random_uuid(),
  nombre                           text not null,
  apellidos                        text,
  telefono                         text,
  email                            text,
  dni_nie                          text,
  fecha_nacimiento                 date,
  direccion                        text,
  procedencia                      text,
  condicion                        text not null default 'estandar'::text,
  consentimiento_rgpd              boolean not null default false,
  consentimiento_fecha             timestamptz,
  notas_admin                      text,
  auth_user_id                     uuid,
  sociedad_id_ref                  text,
  activo                           boolean not null default true,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now(),
  external_clinical_record_id      text
);

create table public.clinica_disponibilidad_excepcional (
  id                               uuid not null default gen_random_uuid(),
  profesional_id                   uuid not null,
  fecha                            date not null,
  hora_inicio                      time not null,
  hora_fin                         time not null,
  tipo                             text not null,
  motivo                           text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.clinica_horarios_profesional (
  id                               uuid not null default gen_random_uuid(),
  profesional_id                   uuid not null,
  dia_semana                       integer not null,
  hora_inicio                      time not null,
  hora_fin                         time not null,
  recurrencia                      text not null default 'semanal'::text,
  valido_desde                     date,
  valido_hasta                     date,
  activo                           boolean not null default true,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.clinica_productos (
  id                               uuid not null default gen_random_uuid(),
  nombre                           text not null,
  servicio_id                      uuid,
  tipo_producto                    text not null default 'sesion_suelta'::text,
  duracion_estandar_minutos        integer,
  precio                           numeric(14,2) not null default 0,
  sesiones_incluidas               integer,
  condicion_especial               text not null default 'estandar'::text,
  exento_iva                       boolean not null default true,
  tipo_operacion                   text,
  visible_en_reserva_publica       boolean not null default true,
  requiere_asignacion_manual       boolean not null default false,
  solo_uso_interno                 boolean not null default false,
  requiere_confirmacion            boolean not null default false,
  activo                           boolean not null default true,
  notas_internas                   text,
  sociedad_id_ref                  text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now(),
  caducidad_meses                  integer
);

create table public.clinica_profesional_servicios (
  profesional_id                   uuid not null,
  servicio_id                      uuid not null
);

create table public.clinica_profesionales (
  id                               uuid not null default gen_random_uuid(),
  nombre                           text not null,
  titulo                           text,
  tipo                             text not null default 'fisioterapeuta'::text,
  email                            text,
  telefono                         text,
  color                            text,
  auth_user_id                     uuid,
  modo_agenda                      text not null default 'huecos_abiertos'::text,
  prioridad                        integer not null default 100,
  sociedad_id_ref                  text,
  activo                           boolean not null default true,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now(),
  relacion                         public.tipo_relacion not null default 'pendiente_regularizar'::tipo_relacion
);

create table public.clinica_recursos (
  id                               uuid not null default gen_random_uuid(),
  ubicacion_id                     uuid,
  nombre                           text not null,
  capacidad                        integer not null default 1,
  activo                           boolean not null default true,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.clinica_servicios (
  id                               uuid not null default gen_random_uuid(),
  nombre                           text not null,
  categoria                        text not null,
  duracion_minutos                 integer not null default 45,
  buffer_antes_minutos             integer not null default 0,
  buffer_despues_minutos           integer not null default 0,
  recurso_requerido                text not null default 'opcional'::text,
  modo_agenda                      text,
  color                            text,
  sociedad_id_ref                  text,
  activo                           boolean not null default true,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.clinica_ubicaciones (
  id                               uuid not null default gen_random_uuid(),
  nombre                           text not null,
  direccion                        text,
  sociedad_id_ref                  text,
  activo                           boolean not null default true,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now(),
  tipo_acuerdo                     public.tipo_acuerdo_centro not null default 'pendiente_confirmar'::tipo_acuerdo_centro,
  proyecto_id_ref                  text
);

create table public.clinica_usuarios (
  id                               uuid not null default gen_random_uuid(),
  auth_user_id                     uuid,
  email                            text,
  rol                              text not null default 'viewer'::text,
  profesional_id                   uuid,
  activo                           boolean not null default true,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.cobros (
  id                               uuid not null default gen_random_uuid(),
  fecha                            date not null default CURRENT_DATE,
  cliente_id                       uuid,
  origen_tipo                      text not null default 'otro'::text,
  origen_id                        uuid,
  importe                          numeric(14,2) not null,
  medio_pago                       text not null default 'efectivo'::text,
  cuenta_tesoreria_id              uuid not null,
  movimiento_caja_id               uuid,
  registrado_por_email             text,
  notas                            text,
  created_at                       timestamptz not null default now()
);

create table public.configuracion_contabilidad (
  id                               text not null default 'default'::text,
  umbral_aprobacion_javi           numeric(12,2) not null default 1000,
  email_guille                     text not null default 'pendiente@antifragil.invalid'::text,
  email_javi                       text not null default 'pendiente@antifragil.invalid'::text,
  email_alicia                     text not null default 'pendiente@antifragil.invalid'::text,
  notifications_enabled            boolean not null default false,
  updated_at                       timestamptz not null default now()
);

create table public.consumos_bono (
  id                               uuid not null default gen_random_uuid(),
  venta_bono_id                    uuid not null,
  cita_id                          uuid not null,
  fecha                            date not null,
  profesional_id                   uuid not null,
  tipo                             public.tipo_sesion_bono not null,
  registrado_por_email             text,
  created_at                       timestamptz not null default now()
);

create table public.contactos (
  id                               uuid not null default gen_random_uuid(),
  nombre                           text not null,
  nif                              text,
  tipo                             text not null default 'proveedor'::text,
  email                            text,
  telefono                         text,
  direccion                        text,
  notas                            text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.cuenta_tesoreria (
  id                               uuid not null default gen_random_uuid(),
  tipo                             text not null,
  nombre                           text not null,
  alias                            text,
  sociedad_id_ref                  text not null,
  proyecto_id_ref                  text,
  cuenta_bancaria_id               uuid,
  cuenta_pgc                       text,
  moneda                           text not null default 'EUR'::text,
  activa                           boolean not null default true,
  notas                            text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.cuentas_bancarias_sociedad (
  id                               uuid not null default gen_random_uuid(),
  sociedad_id_ref                  text not null,
  alias                            text not null,
  titular                          text not null,
  banco                            text,
  iban                             text not null,
  swift                            text,
  activa                           boolean not null default true,
  created_at                       timestamptz not null default now()
);

create table public.cuentas_por_cobrar (
  id                               uuid not null,
  fecha_origen                     date not null,
  deudor                           text not null,
  concepto                         text not null,
  importe                          numeric not null,
  proyecto_id_ref                  text,
  origen_tipo                      text not null default 'otro'::text,
  origen_id                        uuid,
  estado                           text not null default 'pendiente'::text,
  cobro_id                         uuid,
  notas                            text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.devoluciones_bono (
  id                               uuid not null default gen_random_uuid(),
  venta_bono_id                    uuid not null,
  unidades                         integer not null,
  importe                          numeric(14,2) not null,
  fecha                            date not null,
  motivo                           text not null,
  registrado_por_email             text,
  created_at                       timestamptz not null default now()
);

create table public.evidencias_liquidacion (
  id                               uuid not null default gen_random_uuid(),
  liquidacion_id                   uuid not null,
  tipo                             public.tipo_evidencia_liquidacion not null,
  recibida                         boolean not null default false,
  referencia                       text,
  factura_recibida_id              uuid,
  storage_path                     text,
  nombre_archivo                   text,
  mime_type                        text,
  size_bytes                       bigint,
  recibida_at                      timestamptz,
  registrado_por_email             text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.extractos_bancarios (
  id                               uuid not null default gen_random_uuid(),
  sociedad_id_ref                  text not null,
  cuenta_bancaria_id               uuid,
  banco                            text,
  iban                             text,
  anio                             integer not null,
  mes                              integer not null,
  nombre_archivo                   text,
  formato                          text,
  archivo_hash                     text not null,
  n_movimientos                    integer not null default 0,
  n_importados                     integer not null default 0,
  n_duplicados                     integer not null default 0,
  rango_fecha_min                  date,
  rango_fecha_max                  date,
  estado                           text not null default 'importado'::text,
  importado_por_email              text,
  notas                            text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.factura_aprobaciones (
  id                               uuid not null default gen_random_uuid(),
  factura_id                       uuid not null,
  actor_email                      text,
  actor_nombre                     text,
  actor_rol                        text not null default 'otro'::text,
  accion                           text not null,
  estado_anterior                  text,
  estado_nuevo                     text not null,
  comentario                       text,
  motivo_rechazo                   text,
  metadata                         jsonb,
  created_at                       timestamptz not null default now()
);

create table public.factura_incidencias (
  id                               uuid not null default gen_random_uuid(),
  factura_id                       uuid not null,
  pago_id                          uuid,
  tipo                             text not null,
  severidad                        text not null default 'media'::text,
  descripcion                      text,
  resuelta                         boolean not null default false,
  resuelta_por_email               text,
  resuelta_at                      timestamptz,
  created_at                       timestamptz not null default now()
);

create table public.factura_pagos (
  id                               uuid not null default gen_random_uuid(),
  factura_id                       uuid not null,
  importe                          numeric(14,2) not null,
  fecha_pago                       date not null default CURRENT_DATE,
  metodo_pago                      text not null,
  tipo_pago                        text not null,
  justificante_storage_path        text,
  justificante_nombre_archivo      text,
  justificante_mime_type           text,
  justificante_size                bigint,
  comentario                       text,
  registrado_por_email             text,
  registrado_por_rol               text,
  drive_file_id                    text,
  drive_estado                     text not null default 'no_archivado'::text,
  drive_error                      text,
  drive_web_link                   text,
  drive_synced_at                  timestamptz,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.facturas_emitidas (
  id                               uuid not null default gen_random_uuid(),
  sociedad_id_ref                  text not null,
  numero_factura                   text not null,
  serie                            text not null default 'A'::text,
  cliente_nombre                   text not null,
  cliente_nif                      text,
  cliente_direccion                text,
  fecha_factura                    date not null,
  fecha_vencimiento                date,
  lineas                           jsonb not null default '[]'::jsonb,
  base_imponible                   numeric(14,2) not null default 0,
  tipo_iva                         numeric(5,2) not null default 21,
  cuota_iva                        numeric(14,2) not null default 0,
  retencion_pct                    numeric(5,2) not null default 0,
  retencion_importe                numeric(14,2) not null default 0,
  total                            numeric(14,2) not null default 0,
  total_a_cobrar                   numeric(14,2) not null default 0,
  estado                           text not null default 'borrador'::text,
  metodo_pago                      text,
  cuenta_bancaria_iban             text,
  cuenta_bancaria_alias            text,
  cuenta_bancaria_titular          text,
  movimiento_id                    uuid,
  notas                            text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.facturas_emitidas_operativas (
  id                               uuid not null default gen_random_uuid(),
  serie                            text not null default 'OPS'::text,
  numero                           integer not null,
  origen_tipo                      public.origen_factura_emitida not null,
  origen_id                        uuid,
  contraparte                      text not null,
  cliente_id                       uuid,
  contacto_id                      uuid,
  proyecto_id_ref                  text,
  fecha                            date not null,
  importe                          numeric(14,2) not null,
  estado                           public.estado_factura_emitida not null default 'borrador'::estado_factura_emitida,
  ref_factura_externa              text,
  notas                            text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.facturas_recibidas (
  id                               uuid not null default gen_random_uuid(),
  sociedad_id_ref                  text,
  numero_factura                   text,
  proveedor_nombre                 text not null,
  proveedor_nif                    text,
  fecha_factura                    date not null,
  fecha_vencimiento                date,
  base_imponible                   numeric(14,2) not null default 0,
  tipo_iva                         numeric(5,2) not null default 21,
  cuota_iva                        numeric(14,2) not null default 0,
  retencion_pct                    numeric(5,2) not null default 0,
  retencion_importe                numeric(14,2) not null default 0,
  total                            numeric(14,2) not null default 0,
  total_a_pagar                    numeric(14,2) not null default 0,
  concepto                         text,
  categoria                        text,
  subcategoria                     text,
  proyecto_id_ref                  text,
  cuenta_gasto                     text,
  tipo_operacion                   text default 'normal'::text,
  receptor_nombre_ocr              text,
  receptor_nif_ocr                 text,
  contacto_id                      uuid,
  sociedad_validada                boolean not null default true,
  estado                           text not null default 'borrador_ocr'::text,
  motivo_rechazo                   text,
  paso_rechazo                     text,
  ocr_raw                          jsonb,
  ocr_confianza                    jsonb,
  storage_path                     text,
  archivo_url                      text,
  drive_file_id                    text,
  drive_folder_id                  text,
  drive_estado                     text not null default 'no_archivado'::text,
  drive_error                      text,
  drive_web_link                   text,
  drive_synced_at                  timestamptz,
  es_domiciliada                   boolean not null default false,
  regla_aplicada_id                uuid,
  presupuesto_pago_id              uuid,
  movimiento_id                    uuid,
  notas                            text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now(),
  gasto_operativo_id               uuid,
  liquidacion_id                   uuid
);

create table public.flujos_caja_proyectos (
  id                               uuid not null default gen_random_uuid(),
  proyecto_id                      text not null,
  fecha                            date not null,
  importe                          numeric(14,2) not null,
  tipo_flujo                       text not null,
  concepto                         text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.gastos_operativos (
  id                               uuid not null default gen_random_uuid(),
  fecha                            date not null,
  tipo                             public.tipo_gasto not null,
  concepto                         text not null,
  importe                          numeric(14,2) not null,
  capa                             public.capa_coste not null,
  documento_tipo                   public.tipo_documento_gasto not null default 'factura_recibida'::tipo_documento_gasto,
  documento_recibido               boolean not null default false,
  documento_referencia             text,
  factura_recibida_id              uuid,
  centro_id                        uuid,
  profesional_id                   uuid,
  proyecto_id_ref                  text,
  pendiente_confirmacion           boolean not null default false,
  nota                             text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.ingresos_devengados (
  id                               uuid not null default gen_random_uuid(),
  fecha_devengo                    date not null,
  origen                           public.origen_ingreso not null,
  origen_devengo                   public.origen_devengo not null default 'prestacion'::origen_devengo,
  concepto                         text not null,
  cliente_id                       uuid,
  venta_bono_id                    uuid,
  cita_id                          uuid,
  centro_id                        uuid,
  canal_id                         uuid,
  importe_devengado                numeric(14,2) not null,
  factura_emitida_operativa_id     uuid,
  pendiente_confirmacion           boolean not null default false,
  registrado_por_email             text,
  created_at                       timestamptz not null default now()
);

create table public.kpis_sociedades (
  id_ref                           text not null,
  nombre                           text,
  tipo                             text,
  caja_disponible                  numeric(15,2),
  deuda_bancaria_cp                numeric(15,2),
  deuda_bancaria_lp                numeric(15,2),
  deuda_bancaria                   numeric(15,2),
  deuda_socios                     numeric(15,2),
  deuda_financiera_neta            numeric(15,2),
  activo_corriente                 numeric(15,2),
  activo_no_corriente              numeric(15,2),
  activo_total                     numeric(15,2),
  pasivo_corriente                 numeric(15,2),
  pasivo_no_corriente              numeric(15,2),
  pasivo_total                     numeric(15,2),
  fondo_maniobra                   numeric(15,2),
  patrimonio_neto                  numeric(15,2),
  fecha_actualizacion              date,
  updated_at                       timestamptz not null default now()
);

create table public.lineas_liquidacion (
  id                               uuid not null default gen_random_uuid(),
  liquidacion_id                   uuid not null,
  regla                            public.tipo_regla_liquidacion not null,
  detalle                          text not null,
  cantidad                         numeric(10,2) not null default 1,
  importe                          numeric(14,2) not null,
  created_at                       timestamptz not null default now()
);

create table public.liquidaciones_mensuales (
  id                               uuid not null default gen_random_uuid(),
  profesional_id                   uuid not null,
  mes                              text not null,
  importe_calculado                numeric(14,2) not null default 0,
  estado                           public.estado_liquidacion not null default 'pendiente_calculo'::estado_liquidacion,
  motivo_bloqueo                   text,
  requiere_revision_ceo            boolean not null default false,
  revisada_por_ceo_email           text,
  notas                            text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.movimiento_caja (
  id                               uuid not null default gen_random_uuid(),
  cuenta_tesoreria_id              uuid not null,
  fecha                            date not null default CURRENT_DATE,
  importe                          numeric(14,2) not null,
  concepto                         text not null,
  medio_pago                       text not null default 'efectivo'::text,
  origen_tipo                      text not null default 'manual'::text,
  origen_id                        uuid,
  proyecto_id_ref                  text,
  sociedad_id_ref                  text,
  registrado_por_email             text,
  notas                            text,
  created_at                       timestamptz not null default now()
);

create table public.movimientos_bancarios (
  id                               uuid not null default gen_random_uuid(),
  sociedad_id_ref                  text not null,
  iban                             text not null,
  banco                            text not null,
  fecha                            date not null,
  fecha_valor                      date,
  concepto                         text not null,
  concepto_normalizado             text,
  importe                          numeric(14,2) not null,
  saldo                            numeric(14,2),
  categoria                        text,
  subcategoria                     text,
  es_intragrupo                    boolean not null default false,
  entidad_contraparte              text,
  proyecto_id_ref                  text,
  factura_recibida_id              uuid,
  asiento_borrador_id              uuid,
  extracto_id                      uuid,
  cuenta_bancaria_id               uuid,
  hash                             text,
  referencia                       text,
  tipo_movimiento                  text,
  revisado                         boolean not null default false,
  notas                            text,
  fuente                           text not null,
  importado_at                     timestamptz not null default now(),
  created_at                       timestamptz not null default now()
);

create table public.pagos_liquidacion (
  id                               uuid not null default gen_random_uuid(),
  liquidacion_id                   uuid not null,
  fecha                            date not null default CURRENT_DATE,
  importe                          numeric(14,2) not null,
  medio                            text not null,
  cuenta_tesoreria_id              uuid not null,
  movimiento_caja_id               uuid,
  registrado_por_email             text,
  notas                            text,
  created_at                       timestamptz not null default now()
);

create table public.perfiles_operativos (
  id                               uuid not null default gen_random_uuid(),
  auth_user_id                     uuid not null,
  email                            text not null,
  rol                              public.rol_operativo not null,
  profesional_id                   uuid,
  activo                           boolean not null default true,
  notas                            text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.plan_cuentas (
  id                               uuid not null default gen_random_uuid(),
  sociedad_id_ref                  text not null,
  codigo                           text not null,
  descripcion                      text not null,
  tipo                             text not null,
  padre_codigo                     text,
  nivel                            integer not null default 1,
  activa                           boolean not null default true,
  created_at                       timestamptz not null default now()
);

create table public.presupuesto_capitulos (
  id                               uuid not null default gen_random_uuid(),
  presupuesto_id                   uuid not null,
  nombre                           text not null,
  orden                            integer not null default 0,
  created_at                       timestamptz not null default now()
);

create table public.presupuesto_pagos (
  id                               uuid not null default gen_random_uuid(),
  presupuesto_id                   uuid not null,
  partida_id                       uuid not null,
  descripcion                      text,
  importe                          numeric(14,2) not null,
  tipo_iva                         numeric(4,1) not null default 0,
  fecha_prevista                   date not null,
  fecha_real_pago                  date,
  estado                           text not null default 'pendiente'::text,
  tipo_flujo                       text not null default 'gasto'::text,
  contingente                      boolean not null default false,
  notas_condicion                  text,
  factura_recibida_id              uuid,
  factura_emitida_id               uuid,
  notas                            text,
  created_at                       timestamptz not null default now()
);

create table public.presupuesto_partidas (
  id                               uuid not null default gen_random_uuid(),
  presupuesto_id                   uuid not null,
  capitulo_id                      uuid not null,
  codigo                           text,
  descripcion                      text not null,
  importe_presupuestado            numeric(14,2) not null default 0,
  tipo_iva                         numeric(4,1) not null default 0,
  proveedor_esperado               text,
  recurrencia                      text,
  fecha_inicio_recurrencia         date,
  fecha_fin_recurrencia            date,
  notas                            text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.presupuestos (
  id                               uuid not null default gen_random_uuid(),
  nombre                           text not null,
  tipo                             text not null default 'capex'::text,
  categoria                        text not null default 'gasto'::text,
  proyecto_nombre                  text,
  proyecto_id_ref                  text,
  sociedad_id_ref                  text,
  estado                           text not null default 'borrador'::text,
  fecha_inicio                     date,
  fecha_fin                        date,
  notas                            text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.proveedores_reglas (
  id                               uuid not null default gen_random_uuid(),
  contacto_id                      uuid not null,
  nif_normalizado                  text,
  sociedad_id_ref                  text,
  cuenta_contable_default          text,
  proyecto_id_ref                  text,
  presupuesto_id                   uuid,
  partida_id                       uuid,
  metodo_pago_default              text,
  es_domiciliada                   boolean not null default false,
  requiere_pago_manual             boolean not null default false,
  requiere_aprobacion_javi         boolean not null default false,
  requiere_factura                 boolean not null default true,
  requiere_justificante_pago       boolean not null default true,
  tipo_operacion_default           text,
  iva_default                      numeric(5,2),
  retencion_pct_default            numeric(5,2),
  importe_habitual                 numeric(14,2),
  tolerancia_importe_pct           numeric(6,2),
  concepto_recurrente              text,
  auto_validar                     boolean not null default false,
  activa                           boolean not null default true,
  notas                            text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.proyectos (
  id_ref                           text not null,
  nombre                           text not null,
  sociedad_tenedora                text,
  estado                           text,
  updated_at                       timestamptz not null default now()
);

create table public.reconciliacion_log (
  id                               uuid not null default gen_random_uuid(),
  sociedad_id_ref                  text not null,
  periodo                          text not null,
  asiento_oficial_id               uuid,
  asiento_borrador_id              uuid,
  tipo                             text not null,
  score_similitud                  numeric(5,2),
  diferencias                      jsonb,
  resuelto                         boolean not null default false,
  resolucion_notas                 text,
  created_at                       timestamptz not null default now()
);

create table public.reglas_categorizacion (
  id                               uuid not null default gen_random_uuid(),
  patron                           text not null,
  campo                            text not null default 'concepto'::text,
  es_regex                         boolean not null default false,
  categoria                        text not null,
  subcategoria                     text,
  es_intragrupo                    boolean not null default false,
  prioridad                        integer not null default 50,
  fuente                           text not null default 'sistema'::text,
  confirmaciones                   integer not null default 0,
  activa                           boolean not null default true,
  created_at                       timestamptz not null default now()
);

create table public.reglas_liquidacion_profesional (
  id                               uuid not null default gen_random_uuid(),
  profesional_id                   uuid not null,
  tipo                             public.tipo_regla_liquidacion not null,
  importe                          numeric(14,2) not null,
  unidad                           public.unidad_regla not null,
  confirmada                       boolean not null default false,
  tercero_copagador                text,
  vigente_desde                    date,
  vigente_hasta                    date,
  activa                           boolean not null default true,
  notas                            text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.sociedades (
  id_ref                           text not null,
  nombre                           text not null,
  cif                              text,
  estado                           text,
  domicilio                        text,
  localidad                        text,
  codigo_postal                    text,
  pais                             text default 'España'::text,
  email                            text,
  telefono                         text,
  logo_url                         text,
  updated_at                       timestamptz not null default now()
);

create table public.vencimientos (
  id                               uuid not null default gen_random_uuid(),
  titulo                           text not null,
  tipo                             text not null,
  descripcion                      text,
  importe                          numeric(14,2),
  fecha_vencimiento                date not null,
  sociedad_id                      text,
  notas                            text,
  estado                           text not null default 'pendiente'::text,
  recurrencia                      text,
  es_entrada                       boolean not null default false,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.ventas_bono (
  id                               uuid not null default gen_random_uuid(),
  cliente_id                       uuid not null,
  producto_id                      uuid not null,
  centro_id                        uuid,
  canal_id                         uuid,
  fecha_venta                      date not null,
  importe_cobrado                  numeric(14,2) not null,
  unidades                         integer not null,
  vencimiento                      date,
  estado                           public.estado_venta_bono not null default 'borrador'::estado_venta_bono,
  notas                            text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- §4. CONSTRAINTS (256) — pk → unique → check → exclusion → fk
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.ajustes_liquidacion add constraint ajustes_liquidacion_pkey PRIMARY KEY (id);
alter table public.arqueo_caja add constraint arqueo_caja_pkey PRIMARY KEY (id);
alter table public.asientos_borrador add constraint asientos_borrador_pkey PRIMARY KEY (id);
alter table public.asientos_oficiales add constraint asientos_oficiales_pkey PRIMARY KEY (id);
alter table public.balance_sumas_saldos add constraint balance_sumas_saldos_pkey PRIMARY KEY (id);
alter table public.caducidades_bono add constraint caducidades_bono_pkey PRIMARY KEY (id);
alter table public.canales add constraint canales_pkey PRIMARY KEY (id);
alter table public.clinica_bloqueos_agenda add constraint clinica_bloqueos_agenda_pkey PRIMARY KEY (id);
alter table public.clinica_citas add constraint clinica_citas_pkey PRIMARY KEY (id);
alter table public.clinica_clientes add constraint clinica_clientes_pkey PRIMARY KEY (id);
alter table public.clinica_disponibilidad_excepcional add constraint clinica_disponibilidad_excepcional_pkey PRIMARY KEY (id);
alter table public.clinica_horarios_profesional add constraint clinica_horarios_profesional_pkey PRIMARY KEY (id);
alter table public.clinica_productos add constraint clinica_productos_pkey PRIMARY KEY (id);
alter table public.clinica_profesional_servicios add constraint clinica_profesional_servicios_pkey PRIMARY KEY (profesional_id, servicio_id);
alter table public.clinica_profesionales add constraint clinica_profesionales_pkey PRIMARY KEY (id);
alter table public.clinica_recursos add constraint clinica_recursos_pkey PRIMARY KEY (id);
alter table public.clinica_servicios add constraint clinica_servicios_pkey PRIMARY KEY (id);
alter table public.clinica_ubicaciones add constraint clinica_ubicaciones_pkey PRIMARY KEY (id);
alter table public.clinica_usuarios add constraint clinica_usuarios_pkey PRIMARY KEY (id);
alter table public.cobros add constraint cobros_pkey PRIMARY KEY (id);
alter table public.configuracion_contabilidad add constraint configuracion_contabilidad_pkey PRIMARY KEY (id);
alter table public.consumos_bono add constraint consumos_bono_pkey PRIMARY KEY (id);
alter table public.contactos add constraint contactos_pkey PRIMARY KEY (id);
alter table public.cuenta_tesoreria add constraint cuenta_tesoreria_pkey PRIMARY KEY (id);
alter table public.cuentas_bancarias_sociedad add constraint cuentas_bancarias_sociedad_pkey PRIMARY KEY (id);
alter table public.cuentas_por_cobrar add constraint cuentas_por_cobrar_pkey PRIMARY KEY (id);
alter table public.devoluciones_bono add constraint devoluciones_bono_pkey PRIMARY KEY (id);
alter table public.evidencias_liquidacion add constraint evidencias_liquidacion_pkey PRIMARY KEY (id);
alter table public.extractos_bancarios add constraint extractos_bancarios_pkey PRIMARY KEY (id);
alter table public.factura_aprobaciones add constraint factura_aprobaciones_pkey PRIMARY KEY (id);
alter table public.factura_incidencias add constraint factura_incidencias_pkey PRIMARY KEY (id);
alter table public.factura_pagos add constraint factura_pagos_pkey PRIMARY KEY (id);
alter table public.facturas_emitidas add constraint facturas_emitidas_pkey PRIMARY KEY (id);
alter table public.facturas_emitidas_operativas add constraint facturas_emitidas_operativas_pkey PRIMARY KEY (id);
alter table public.facturas_recibidas add constraint facturas_recibidas_pkey PRIMARY KEY (id);
alter table public.flujos_caja_proyectos add constraint flujos_caja_proyectos_pkey PRIMARY KEY (id);
alter table public.gastos_operativos add constraint gastos_operativos_pkey PRIMARY KEY (id);
alter table public.ingresos_devengados add constraint ingresos_devengados_pkey PRIMARY KEY (id);
alter table public.kpis_sociedades add constraint kpis_sociedades_pkey PRIMARY KEY (id_ref);
alter table public.lineas_liquidacion add constraint lineas_liquidacion_pkey PRIMARY KEY (id);
alter table public.liquidaciones_mensuales add constraint liquidaciones_mensuales_pkey PRIMARY KEY (id);
alter table public.movimiento_caja add constraint movimiento_caja_pkey PRIMARY KEY (id);
alter table public.movimientos_bancarios add constraint movimientos_bancarios_pkey PRIMARY KEY (id);
alter table public.pagos_liquidacion add constraint pagos_liquidacion_pkey PRIMARY KEY (id);
alter table public.perfiles_operativos add constraint perfiles_operativos_pkey PRIMARY KEY (id);
alter table public.plan_cuentas add constraint plan_cuentas_pkey PRIMARY KEY (id);
alter table public.presupuesto_capitulos add constraint presupuesto_capitulos_pkey PRIMARY KEY (id);
alter table public.presupuesto_pagos add constraint presupuesto_pagos_pkey PRIMARY KEY (id);
alter table public.presupuesto_partidas add constraint presupuesto_partidas_pkey PRIMARY KEY (id);
alter table public.presupuestos add constraint presupuestos_pkey PRIMARY KEY (id);
alter table public.proveedores_reglas add constraint proveedores_reglas_pkey PRIMARY KEY (id);
alter table public.proyectos add constraint proyectos_pkey PRIMARY KEY (id_ref);
alter table public.reconciliacion_log add constraint reconciliacion_log_pkey PRIMARY KEY (id);
alter table public.reglas_categorizacion add constraint reglas_categorizacion_pkey PRIMARY KEY (id);
alter table public.reglas_liquidacion_profesional add constraint reglas_liquidacion_profesional_pkey PRIMARY KEY (id);
alter table public.sociedades add constraint sociedades_pkey PRIMARY KEY (id_ref);
alter table public.vencimientos add constraint vencimientos_pkey PRIMARY KEY (id);
alter table public.ventas_bono add constraint ventas_bono_pkey PRIMARY KEY (id);
alter table public.balance_sumas_saldos add constraint uq_balance UNIQUE (sociedad_id, periodo, cuenta);
alter table public.canales add constraint canales_nombre_key UNIQUE (nombre);
alter table public.consumos_bono add constraint consumos_bono_venta_cita_uniq UNIQUE (venta_bono_id, cita_id);
alter table public.evidencias_liquidacion add constraint evidencias_liquidacion_liquidacion_id_key UNIQUE (liquidacion_id);
alter table public.facturas_emitidas_operativas add constraint facturas_emitidas_operativas_serie_numero_uniq UNIQUE (serie, numero);
alter table public.liquidaciones_mensuales add constraint liquidaciones_persona_mes_uniq UNIQUE (profesional_id, mes);
alter table public.perfiles_operativos add constraint perfiles_operativos_auth_user_id_key UNIQUE (auth_user_id);
alter table public.plan_cuentas add constraint plan_cuentas_sociedad_id_ref_codigo_key UNIQUE (sociedad_id_ref, codigo);
alter table public.ajustes_liquidacion add constraint ajustes_liquidacion_importe_check CHECK ((importe <> (0)::numeric));
alter table public.arqueo_caja add constraint arqueo_caja_estado_check CHECK ((estado = ANY (ARRAY['borrador'::text, 'cerrado'::text, 'revisado'::text])));
alter table public.asientos_borrador add constraint asientos_borrador_estado_check CHECK ((estado = ANY (ARRAY['borrador'::text, 'confirmado'::text, 'rechazado'::text])));
alter table public.asientos_oficiales add constraint asientos_oficiales_estado_reconciliacion_check CHECK ((estado_reconciliacion = ANY (ARRAY['pendiente'::text, 'coincide'::text, 'diferencia'::text, 'sin_borrador'::text])));
alter table public.asientos_oficiales add constraint asientos_oficiales_fuente_check CHECK ((fuente = ANY (ARRAY['a3'::text, 'sage'::text, 'holded'::text, 'contasol'::text, 'csv'::text, 'manual'::text])));
alter table public.caducidades_bono add constraint caducidades_bono_importe_check CHECK ((importe >= (0)::numeric));
alter table public.caducidades_bono add constraint caducidades_bono_pendiente_criterio_fiscal_check CHECK (pendiente_criterio_fiscal);
alter table public.caducidades_bono add constraint caducidades_bono_unidades_caducadas_check CHECK ((unidades_caducadas > 0));
alter table public.clinica_bloqueos_agenda add constraint clinica_bloqueos_agenda_check CHECK ((fin > inicio));
alter table public.clinica_bloqueos_agenda add constraint clinica_bloqueos_agenda_tipo_check CHECK ((tipo = ANY (ARRAY['vacaciones'::text, 'reunion'::text, 'comida'::text, 'formacion'::text, 'baja'::text, 'otro'::text])));
alter table public.clinica_citas add constraint clinica_citas_rango_valido CHECK ((fin > inicio));
alter table public.clinica_clientes add constraint clinica_clientes_condicion_check CHECK ((condicion = ANY (ARRAY['estandar'::text, 'founder'::text, 'vip'::text, 'ug'::text, 'especial_manual'::text])));
alter table public.clinica_disponibilidad_excepcional add constraint clinica_disponibilidad_excepcional_check CHECK ((hora_fin > hora_inicio));
alter table public.clinica_disponibilidad_excepcional add constraint clinica_disponibilidad_excepcional_tipo_check CHECK ((tipo = ANY (ARRAY['abre'::text, 'cierra'::text])));
alter table public.clinica_horarios_profesional add constraint clinica_horarios_profesional_check CHECK ((hora_fin > hora_inicio));
alter table public.clinica_horarios_profesional add constraint clinica_horarios_profesional_dia_semana_check CHECK (((dia_semana >= 0) AND (dia_semana <= 6)));
alter table public.clinica_productos add constraint clinica_productos_caducidad_meses_check CHECK (((caducidad_meses IS NULL) OR (caducidad_meses > 0)));
alter table public.clinica_productos add constraint clinica_productos_condicion_especial_check CHECK ((condicion_especial = ANY (ARRAY['estandar'::text, 'founder'::text, 'vip'::text, 'ug'::text, 'especial'::text])));
alter table public.clinica_productos add constraint clinica_productos_tipo_producto_check CHECK ((tipo_producto = ANY (ARRAY['sesion_suelta'::text, 'bono_sesiones'::text, 'programa'::text, 'seguimiento'::text, 'valoracion'::text, 'mensualidad'::text, 'tarifa_especial'::text, 'sesion_extra'::text])));
alter table public.clinica_profesionales add constraint clinica_profesionales_modo_agenda_check CHECK ((modo_agenda = ANY (ARRAY['huecos_abiertos'::text, 'bajo_demanda'::text])));
alter table public.clinica_profesionales add constraint clinica_profesionales_tipo_check CHECK ((tipo = ANY (ARRAY['fisioterapeuta'::text, 'entrenador'::text, 'nutricionista'::text, 'otro'::text])));
alter table public.clinica_servicios add constraint clinica_servicios_categoria_check CHECK ((categoria = ANY (ARRAY['fisioterapia'::text, 'nutricion'::text, 'entrenamiento_personal'::text])));
alter table public.clinica_servicios add constraint clinica_servicios_modo_agenda_check CHECK ((modo_agenda = ANY (ARRAY['huecos_abiertos'::text, 'bajo_demanda'::text])));
alter table public.clinica_servicios add constraint clinica_servicios_recurso_requerido_check CHECK ((recurso_requerido = ANY (ARRAY['obligatorio'::text, 'opcional'::text, 'ninguno'::text])));
alter table public.clinica_usuarios add constraint clinica_usuarios_rol_check CHECK ((rol = ANY (ARRAY['admin'::text, 'profesional'::text, 'recepcion'::text, 'viewer'::text, 'cliente'::text])));
alter table public.cobros add constraint cobros_importe_check CHECK ((importe <> (0)::numeric));
alter table public.cobros add constraint cobros_medio_pago_check CHECK ((medio_pago = ANY (ARRAY['efectivo'::text, 'tarjeta'::text, 'transferencia'::text, 'bizum'::text, 'domiciliacion'::text, 'otro'::text])));
alter table public.cobros add constraint cobros_origen_tipo_check CHECK ((origen_tipo = ANY (ARRAY['cita'::text, 'venta_bono'::text, 'factura_emitida'::text, 'partner'::text, 'otro'::text])));
alter table public.contactos add constraint contactos_tipo_check CHECK ((tipo = ANY (ARRAY['proveedor'::text, 'cliente'::text, 'ambos'::text])));
alter table public.cuenta_tesoreria add constraint cuenta_tesoreria_caja_sin_iban CHECK (((tipo = 'banco'::text) OR (cuenta_bancaria_id IS NULL)));
alter table public.cuenta_tesoreria add constraint cuenta_tesoreria_tipo_check CHECK ((tipo = ANY (ARRAY['caja'::text, 'banco'::text])));
alter table public.cuentas_por_cobrar add constraint cuentas_por_cobrar_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'cobrada'::text, 'cancelada'::text])));
alter table public.cuentas_por_cobrar add constraint cuentas_por_cobrar_importe_check CHECK ((importe > (0)::numeric));
alter table public.devoluciones_bono add constraint devoluciones_bono_importe_check CHECK ((importe >= (0)::numeric));
alter table public.devoluciones_bono add constraint devoluciones_bono_unidades_check CHECK ((unidades > 0));
alter table public.extractos_bancarios add constraint extractos_bancarios_estado_check CHECK ((estado = ANY (ARRAY['importado'::text, 'pendiente_revision'::text, 'listo_conciliacion'::text, 'deshecho'::text])));
alter table public.extractos_bancarios add constraint extractos_bancarios_formato_check CHECK ((formato = ANY (ARRAY['csv'::text, 'xlsx'::text])));
alter table public.extractos_bancarios add constraint extractos_bancarios_mes_check CHECK (((mes >= 1) AND (mes <= 12)));
alter table public.factura_aprobaciones add constraint factura_aprobaciones_accion_check CHECK ((accion = ANY (ARRAY['crea_borrador_ocr'::text, 'valida'::text, 'aprueba'::text, 'rechaza'::text, 'marca_pagada'::text, 'registra_pago'::text, 'crea_incidencia'::text, 'resuelve_incidencia'::text, 'cambia_sociedad'::text, 'solicita_aclaracion'::text, 'cambia_estado'::text])));
alter table public.factura_aprobaciones add constraint factura_aprobaciones_actor_rol_check CHECK ((actor_rol = ANY (ARRAY['guille'::text, 'javi'::text, 'alicia'::text, 'sistema'::text, 'otro'::text])));
alter table public.factura_incidencias add constraint factura_incidencias_severidad_check CHECK ((severidad = ANY (ARRAY['baja'::text, 'media'::text, 'alta'::text])));
alter table public.factura_incidencias add constraint factura_incidencias_tipo_check CHECK ((tipo = ANY (ARRAY['infrapago'::text, 'sobrepago'::text, 'justificante_no_coincide'::text, 'falta_justificante'::text, 'pago_duplicado_posible'::text, 'otro'::text])));
alter table public.factura_pagos add constraint factura_pagos_drive_estado_check CHECK ((drive_estado = ANY (ARRAY['no_archivado'::text, 'sincronizado'::text, 'error'::text])));
alter table public.factura_pagos add constraint factura_pagos_importe_no_cero CHECK ((importe <> (0)::numeric));
alter table public.factura_pagos add constraint factura_pagos_metodo_pago_check CHECK ((metodo_pago = ANY (ARRAY['transferencia'::text, 'domiciliacion'::text, 'tarjeta'::text, 'efectivo'::text, 'otro'::text])));
alter table public.factura_pagos add constraint factura_pagos_negativo_solo_regularizacion CHECK (((importe > (0)::numeric) OR (tipo_pago = 'regularizacion'::text)));
alter table public.factura_pagos add constraint factura_pagos_tipo_pago_check CHECK ((tipo_pago = ANY (ARRAY['total'::text, 'parcial'::text, 'anticipo'::text, 'regularizacion'::text])));
alter table public.facturas_emitidas add constraint facturas_emitidas_estado_check CHECK ((estado = ANY (ARRAY['borrador'::text, 'emitida'::text, 'cobrada'::text, 'vencida'::text, 'anulada'::text])));
alter table public.facturas_emitidas_operativas add constraint facturas_emitidas_operativas_vinculo_coherente CHECK (((estado <> 'vinculada_factura_externa'::estado_factura_emitida) OR (ref_factura_externa IS NOT NULL)));
alter table public.facturas_recibidas add constraint facturas_recibidas_drive_estado_check CHECK ((drive_estado = ANY (ARRAY['no_archivado'::text, 'sincronizado'::text, 'error'::text])));
alter table public.facturas_recibidas add constraint facturas_recibidas_estado_check CHECK ((estado = ANY (ARRAY['borrador_ocr'::text, 'revision_javi'::text, 'pendiente_pago'::text, 'pagada'::text, 'rechazada'::text])));
alter table public.facturas_recibidas add constraint facturas_recibidas_tipo_operacion_check CHECK ((tipo_operacion = ANY (ARRAY['normal'::text, 'exenta'::text, 'no_sujeta'::text, 'inversion_sujeto_pasivo'::text, 'suplido'::text])));
alter table public.flujos_caja_proyectos add constraint flujos_caja_proyectos_tipo_flujo_check CHECK ((tipo_flujo = ANY (ARRAY['inversion'::text, 'recapex'::text, 'venta'::text, 'dividendo'::text, 'ingreso_operativo'::text, 'gasto_operativo'::text, 'otro'::text])));
alter table public.gastos_operativos add constraint gastos_operativos_importe_check CHECK ((importe <> (0)::numeric));
alter table public.ingresos_devengados add constraint ingresos_devengados_caducidad_coherente CHECK (((origen_devengo <> 'ingreso_por_caducidad'::origen_devengo) OR (venta_bono_id IS NOT NULL)));
alter table public.ingresos_devengados add constraint ingresos_devengados_importe_devengado_check CHECK ((importe_devengado <> (0)::numeric));
alter table public.liquidaciones_mensuales add constraint liquidaciones_bloqueo_coherente CHECK (((estado <> 'bloqueada_por_incidencia'::estado_liquidacion) OR (motivo_bloqueo IS NOT NULL)));
alter table public.liquidaciones_mensuales add constraint liquidaciones_mensuales_mes_check CHECK ((mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::text));
alter table public.movimiento_caja add constraint movimiento_caja_importe_check CHECK ((importe <> (0)::numeric));
alter table public.movimiento_caja add constraint movimiento_caja_medio_pago_check CHECK ((medio_pago = ANY (ARRAY['efectivo'::text, 'tarjeta'::text, 'transferencia'::text, 'bizum'::text, 'domiciliacion'::text, 'otro'::text])));
alter table public.movimiento_caja add constraint movimiento_caja_origen_tipo_check CHECK ((origen_tipo = ANY (ARRAY['manual'::text, 'cobro'::text, 'pago'::text, 'factura_pago'::text, 'arqueo_ajuste'::text, 'traspaso'::text])));
alter table public.movimientos_bancarios add constraint movimientos_bancarios_banco_check CHECK ((banco = ANY (ARRAY['santander'::text, 'bbva'::text, 'caixabank'::text, 'caja_rural'::text, 'otro'::text])));
alter table public.pagos_liquidacion add constraint pagos_liquidacion_importe_check CHECK ((importe <> (0)::numeric));
alter table public.pagos_liquidacion add constraint pagos_liquidacion_medio_check CHECK ((medio = ANY (ARRAY['transferencia'::text, 'efectivo'::text, 'bizum'::text])));
alter table public.perfiles_operativos add constraint perfiles_operativos_prof_coherente CHECK (((rol <> 'profesional'::rol_operativo) OR (profesional_id IS NOT NULL)));
alter table public.plan_cuentas add constraint plan_cuentas_tipo_check CHECK ((tipo = ANY (ARRAY['activo'::text, 'pasivo'::text, 'patrimonio'::text, 'ingreso'::text, 'gasto'::text, 'resultado'::text])));
alter table public.presupuesto_pagos add constraint presupuesto_pagos_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'pagado'::text, 'cancelado'::text, 'estimado'::text, 'confirmado'::text, 'facturado'::text])));
alter table public.presupuesto_pagos add constraint presupuesto_pagos_tipo_flujo_check CHECK ((tipo_flujo = ANY (ARRAY['gasto'::text, 'ingreso'::text])));
alter table public.presupuesto_pagos add constraint presupuesto_pagos_tipo_iva_check CHECK ((tipo_iva = ANY (ARRAY[(0)::numeric, (4)::numeric, (10)::numeric, (21)::numeric])));
alter table public.presupuesto_partidas add constraint presupuesto_partidas_recurrencia_check CHECK ((recurrencia = ANY (ARRAY['mensual'::text, 'trimestral'::text, 'semestral'::text, 'anual'::text])));
alter table public.presupuesto_partidas add constraint presupuesto_partidas_tipo_iva_check CHECK ((tipo_iva = ANY (ARRAY[(0)::numeric, (4)::numeric, (10)::numeric, (21)::numeric])));
alter table public.presupuestos add constraint presupuestos_categoria_check CHECK ((categoria = ANY (ARRAY['gasto'::text, 'ingreso'::text])));
alter table public.presupuestos add constraint presupuestos_estado_check CHECK ((estado = ANY (ARRAY['borrador'::text, 'activo'::text, 'cerrado'::text])));
alter table public.presupuestos add constraint presupuestos_tipo_check CHECK ((tipo = ANY (ARRAY['obra'::text, 'explotacion'::text, 'capex'::text, 'corporativo'::text, 'tesoreria'::text])));
alter table public.proveedores_reglas add constraint proveedores_reglas_metodo_pago_default_check CHECK ((metodo_pago_default = ANY (ARRAY['transferencia'::text, 'domiciliacion'::text, 'tarjeta'::text, 'efectivo'::text, 'otro'::text])));
alter table public.proveedores_reglas add constraint proveedores_reglas_tipo_operacion_default_check CHECK ((tipo_operacion_default = ANY (ARRAY['normal'::text, 'exenta'::text, 'no_sujeta'::text, 'inversion_sujeto_pasivo'::text, 'suplido'::text])));
alter table public.reconciliacion_log add constraint reconciliacion_log_tipo_check CHECK ((tipo = ANY (ARRAY['coincide'::text, 'diferencia_importe'::text, 'diferencia_cuenta'::text, 'diferencia_fecha'::text, 'sin_borrador'::text, 'sin_oficial'::text])));
alter table public.reglas_categorizacion add constraint reglas_categorizacion_campo_check CHECK ((campo = ANY (ARRAY['concepto'::text, 'contraparte'::text, 'banco'::text])));
alter table public.reglas_categorizacion add constraint reglas_categorizacion_fuente_check CHECK ((fuente = ANY (ARRAY['sistema'::text, 'usuario'::text, 'aprendizaje'::text])));
alter table public.reglas_liquidacion_profesional add constraint reglas_liq_copagador_coherente CHECK (((tipo <> 'nomina_compartida'::tipo_regla_liquidacion) OR (tercero_copagador IS NOT NULL)));
alter table public.reglas_liquidacion_profesional add constraint reglas_liq_vigencia_valida CHECK (((vigente_hasta IS NULL) OR (vigente_desde IS NULL) OR (vigente_hasta >= vigente_desde)));
alter table public.vencimientos add constraint vencimientos_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'gestionado'::text, 'vencido'::text])));
alter table public.vencimientos add constraint vencimientos_recurrencia_check CHECK ((recurrencia = ANY (ARRAY['anual'::text, 'semestral'::text, 'trimestral'::text, 'mensual'::text])));
alter table public.vencimientos add constraint vencimientos_tipo_check CHECK ((tipo = ANY (ARRAY['seguro'::text, 'deuda'::text, 'contrato'::text, 'impuesto'::text, 'compromiso'::text, 'otro'::text])));
alter table public.ventas_bono add constraint ventas_bono_importe_cobrado_check CHECK ((importe_cobrado >= (0)::numeric));
alter table public.ventas_bono add constraint ventas_bono_unidades_check CHECK ((unidades > 0));
alter table public.clinica_citas add constraint clinica_citas_sin_solape_profesional EXCLUDE USING gist (profesional_id WITH =, tstzrange(inicio, fin) WITH &&) WHERE ((estado <> ALL (ARRAY['cancelada_a_tiempo'::estado_cita, 'cancelada_tarde'::estado_cita, 'no_show'::estado_cita])));
alter table public.ajustes_liquidacion add constraint ajustes_liquidacion_liquidacion_id_fkey FOREIGN KEY (liquidacion_id) REFERENCES liquidaciones_mensuales(id) ON DELETE RESTRICT;
alter table public.arqueo_caja add constraint arqueo_caja_ajuste_movimiento_id_fkey FOREIGN KEY (ajuste_movimiento_id) REFERENCES movimiento_caja(id) ON DELETE SET NULL;
alter table public.arqueo_caja add constraint arqueo_caja_cuenta_tesoreria_id_fkey FOREIGN KEY (cuenta_tesoreria_id) REFERENCES cuenta_tesoreria(id) ON DELETE RESTRICT;
alter table public.asientos_borrador add constraint asientos_borrador_factura_emitida_id_fkey FOREIGN KEY (factura_emitida_id) REFERENCES facturas_emitidas(id) ON DELETE SET NULL;
alter table public.asientos_borrador add constraint asientos_borrador_factura_recibida_id_fkey FOREIGN KEY (factura_recibida_id) REFERENCES facturas_recibidas(id) ON DELETE SET NULL;
alter table public.asientos_borrador add constraint asientos_borrador_movimiento_id_fkey FOREIGN KEY (movimiento_id) REFERENCES movimientos_bancarios(id) ON DELETE SET NULL;
alter table public.asientos_oficiales add constraint asientos_oficiales_asiento_borrador_id_fkey FOREIGN KEY (asiento_borrador_id) REFERENCES asientos_borrador(id) ON DELETE SET NULL;
alter table public.caducidades_bono add constraint caducidades_bono_venta_bono_id_fkey FOREIGN KEY (venta_bono_id) REFERENCES ventas_bono(id) ON DELETE RESTRICT;
alter table public.clinica_bloqueos_agenda add constraint clinica_bloqueos_agenda_profesional_id_fkey FOREIGN KEY (profesional_id) REFERENCES clinica_profesionales(id) ON DELETE CASCADE;
alter table public.clinica_citas add constraint clinica_citas_canal_id_fkey FOREIGN KEY (canal_id) REFERENCES canales(id) ON DELETE SET NULL;
alter table public.clinica_citas add constraint clinica_citas_centro_id_fkey FOREIGN KEY (centro_id) REFERENCES clinica_ubicaciones(id) ON DELETE SET NULL;
alter table public.clinica_citas add constraint clinica_citas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clinica_clientes(id) ON DELETE RESTRICT;
alter table public.clinica_citas add constraint clinica_citas_liquidacion_id_fkey FOREIGN KEY (liquidacion_id) REFERENCES liquidaciones_mensuales(id) ON DELETE SET NULL;
alter table public.clinica_citas add constraint clinica_citas_profesional_id_fkey FOREIGN KEY (profesional_id) REFERENCES clinica_profesionales(id) ON DELETE RESTRICT;
alter table public.clinica_citas add constraint clinica_citas_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES clinica_servicios(id) ON DELETE RESTRICT;
alter table public.clinica_clientes add constraint clinica_clientes_sociedad_id_ref_fkey FOREIGN KEY (sociedad_id_ref) REFERENCES sociedades(id_ref) ON DELETE SET NULL;
alter table public.clinica_disponibilidad_excepcional add constraint clinica_disponibilidad_excepcional_profesional_id_fkey FOREIGN KEY (profesional_id) REFERENCES clinica_profesionales(id) ON DELETE CASCADE;
alter table public.clinica_horarios_profesional add constraint clinica_horarios_profesional_profesional_id_fkey FOREIGN KEY (profesional_id) REFERENCES clinica_profesionales(id) ON DELETE CASCADE;
alter table public.clinica_productos add constraint clinica_productos_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES clinica_servicios(id) ON DELETE SET NULL;
alter table public.clinica_productos add constraint clinica_productos_sociedad_id_ref_fkey FOREIGN KEY (sociedad_id_ref) REFERENCES sociedades(id_ref) ON DELETE SET NULL;
alter table public.clinica_profesional_servicios add constraint clinica_profesional_servicios_profesional_id_fkey FOREIGN KEY (profesional_id) REFERENCES clinica_profesionales(id) ON DELETE CASCADE;
alter table public.clinica_profesional_servicios add constraint clinica_profesional_servicios_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES clinica_servicios(id) ON DELETE CASCADE;
alter table public.clinica_profesionales add constraint clinica_profesionales_sociedad_id_ref_fkey FOREIGN KEY (sociedad_id_ref) REFERENCES sociedades(id_ref) ON DELETE SET NULL;
alter table public.clinica_recursos add constraint clinica_recursos_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES clinica_ubicaciones(id) ON DELETE SET NULL;
alter table public.clinica_servicios add constraint clinica_servicios_sociedad_id_ref_fkey FOREIGN KEY (sociedad_id_ref) REFERENCES sociedades(id_ref) ON DELETE SET NULL;
alter table public.clinica_ubicaciones add constraint clinica_ubicaciones_proyecto_id_ref_fkey FOREIGN KEY (proyecto_id_ref) REFERENCES proyectos(id_ref) ON DELETE SET NULL;
alter table public.clinica_ubicaciones add constraint clinica_ubicaciones_sociedad_id_ref_fkey FOREIGN KEY (sociedad_id_ref) REFERENCES sociedades(id_ref) ON DELETE SET NULL;
alter table public.clinica_usuarios add constraint clinica_usuarios_profesional_fk FOREIGN KEY (profesional_id) REFERENCES clinica_profesionales(id) ON DELETE SET NULL;
alter table public.cobros add constraint cobros_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clinica_clientes(id) ON DELETE RESTRICT;
alter table public.cobros add constraint cobros_cuenta_tesoreria_id_fkey FOREIGN KEY (cuenta_tesoreria_id) REFERENCES cuenta_tesoreria(id) ON DELETE RESTRICT;
alter table public.cobros add constraint cobros_movimiento_caja_id_fkey FOREIGN KEY (movimiento_caja_id) REFERENCES movimiento_caja(id) ON DELETE SET NULL;
alter table public.consumos_bono add constraint consumos_bono_cita_id_fkey FOREIGN KEY (cita_id) REFERENCES clinica_citas(id) ON DELETE RESTRICT;
alter table public.consumos_bono add constraint consumos_bono_profesional_id_fkey FOREIGN KEY (profesional_id) REFERENCES clinica_profesionales(id) ON DELETE RESTRICT;
alter table public.consumos_bono add constraint consumos_bono_venta_bono_id_fkey FOREIGN KEY (venta_bono_id) REFERENCES ventas_bono(id) ON DELETE RESTRICT;
alter table public.cuenta_tesoreria add constraint cuenta_tesoreria_cuenta_bancaria_id_fkey FOREIGN KEY (cuenta_bancaria_id) REFERENCES cuentas_bancarias_sociedad(id) ON DELETE SET NULL;
alter table public.cuenta_tesoreria add constraint cuenta_tesoreria_proyecto_id_ref_fkey FOREIGN KEY (proyecto_id_ref) REFERENCES proyectos(id_ref) ON DELETE SET NULL;
alter table public.cuenta_tesoreria add constraint cuenta_tesoreria_sociedad_id_ref_fkey FOREIGN KEY (sociedad_id_ref) REFERENCES sociedades(id_ref) ON DELETE RESTRICT;
alter table public.cuentas_bancarias_sociedad add constraint cuentas_bancarias_sociedad_sociedad_id_ref_fkey FOREIGN KEY (sociedad_id_ref) REFERENCES sociedades(id_ref) ON DELETE CASCADE;
alter table public.cuentas_por_cobrar add constraint cuentas_por_cobrar_cobro_id_fkey FOREIGN KEY (cobro_id) REFERENCES cobros(id) ON DELETE SET NULL;
alter table public.cuentas_por_cobrar add constraint cuentas_por_cobrar_proyecto_id_ref_fkey FOREIGN KEY (proyecto_id_ref) REFERENCES proyectos(id_ref) ON DELETE SET NULL;
alter table public.devoluciones_bono add constraint devoluciones_bono_venta_bono_id_fkey FOREIGN KEY (venta_bono_id) REFERENCES ventas_bono(id) ON DELETE RESTRICT;
alter table public.evidencias_liquidacion add constraint evidencias_liquidacion_factura_recibida_id_fkey FOREIGN KEY (factura_recibida_id) REFERENCES facturas_recibidas(id) ON DELETE SET NULL;
alter table public.evidencias_liquidacion add constraint evidencias_liquidacion_liquidacion_id_fkey FOREIGN KEY (liquidacion_id) REFERENCES liquidaciones_mensuales(id) ON DELETE CASCADE;
alter table public.extractos_bancarios add constraint extractos_bancarios_cuenta_bancaria_id_fkey FOREIGN KEY (cuenta_bancaria_id) REFERENCES cuentas_bancarias_sociedad(id) ON DELETE SET NULL;
alter table public.extractos_bancarios add constraint extractos_bancarios_sociedad_id_ref_fkey FOREIGN KEY (sociedad_id_ref) REFERENCES sociedades(id_ref) ON DELETE CASCADE;
alter table public.factura_aprobaciones add constraint factura_aprobaciones_factura_id_fkey FOREIGN KEY (factura_id) REFERENCES facturas_recibidas(id) ON DELETE CASCADE;
alter table public.factura_incidencias add constraint factura_incidencias_factura_id_fkey FOREIGN KEY (factura_id) REFERENCES facturas_recibidas(id) ON DELETE CASCADE;
alter table public.factura_incidencias add constraint factura_incidencias_pago_id_fkey FOREIGN KEY (pago_id) REFERENCES factura_pagos(id) ON DELETE SET NULL;
alter table public.factura_pagos add constraint factura_pagos_factura_id_fkey FOREIGN KEY (factura_id) REFERENCES facturas_recibidas(id) ON DELETE CASCADE;
alter table public.facturas_emitidas add constraint facturas_emitidas_movimiento_id_fkey FOREIGN KEY (movimiento_id) REFERENCES movimientos_bancarios(id) ON DELETE SET NULL;
alter table public.facturas_emitidas_operativas add constraint facturas_emitidas_operativas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clinica_clientes(id) ON DELETE SET NULL;
alter table public.facturas_emitidas_operativas add constraint facturas_emitidas_operativas_contacto_id_fkey FOREIGN KEY (contacto_id) REFERENCES contactos(id) ON DELETE SET NULL;
alter table public.facturas_emitidas_operativas add constraint facturas_emitidas_operativas_proyecto_id_ref_fkey FOREIGN KEY (proyecto_id_ref) REFERENCES proyectos(id_ref) ON DELETE SET NULL;
alter table public.facturas_recibidas add constraint facturas_recibidas_contacto_id_fkey FOREIGN KEY (contacto_id) REFERENCES contactos(id);
alter table public.facturas_recibidas add constraint facturas_recibidas_gasto_operativo_id_fkey FOREIGN KEY (gasto_operativo_id) REFERENCES gastos_operativos(id) ON DELETE SET NULL;
alter table public.facturas_recibidas add constraint facturas_recibidas_liquidacion_id_fkey FOREIGN KEY (liquidacion_id) REFERENCES liquidaciones_mensuales(id) ON DELETE SET NULL;
alter table public.facturas_recibidas add constraint facturas_recibidas_movimiento_id_fkey FOREIGN KEY (movimiento_id) REFERENCES movimientos_bancarios(id) ON DELETE SET NULL;
alter table public.facturas_recibidas add constraint facturas_recibidas_presupuesto_pago_fk FOREIGN KEY (presupuesto_pago_id) REFERENCES presupuesto_pagos(id) ON DELETE SET NULL;
alter table public.facturas_recibidas add constraint facturas_recibidas_proyecto_id_ref_fkey FOREIGN KEY (proyecto_id_ref) REFERENCES proyectos(id_ref) ON DELETE SET NULL;
alter table public.facturas_recibidas add constraint facturas_recibidas_regla_aplicada_id_fkey FOREIGN KEY (regla_aplicada_id) REFERENCES proveedores_reglas(id) ON DELETE SET NULL;
alter table public.flujos_caja_proyectos add constraint flujos_caja_proyectos_proyecto_id_fkey FOREIGN KEY (proyecto_id) REFERENCES proyectos(id_ref) ON DELETE CASCADE;
alter table public.gastos_operativos add constraint gastos_operativos_centro_id_fkey FOREIGN KEY (centro_id) REFERENCES clinica_ubicaciones(id) ON DELETE SET NULL;
alter table public.gastos_operativos add constraint gastos_operativos_factura_recibida_id_fkey FOREIGN KEY (factura_recibida_id) REFERENCES facturas_recibidas(id) ON DELETE SET NULL;
alter table public.gastos_operativos add constraint gastos_operativos_profesional_id_fkey FOREIGN KEY (profesional_id) REFERENCES clinica_profesionales(id) ON DELETE SET NULL;
alter table public.gastos_operativos add constraint gastos_operativos_proyecto_id_ref_fkey FOREIGN KEY (proyecto_id_ref) REFERENCES proyectos(id_ref) ON DELETE SET NULL;
alter table public.ingresos_devengados add constraint ingresos_devengados_canal_id_fkey FOREIGN KEY (canal_id) REFERENCES canales(id) ON DELETE SET NULL;
alter table public.ingresos_devengados add constraint ingresos_devengados_centro_id_fkey FOREIGN KEY (centro_id) REFERENCES clinica_ubicaciones(id) ON DELETE SET NULL;
alter table public.ingresos_devengados add constraint ingresos_devengados_cita_id_fkey FOREIGN KEY (cita_id) REFERENCES clinica_citas(id) ON DELETE RESTRICT;
alter table public.ingresos_devengados add constraint ingresos_devengados_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clinica_clientes(id) ON DELETE RESTRICT;
alter table public.ingresos_devengados add constraint ingresos_devengados_factura_emitida_operativa_id_fkey FOREIGN KEY (factura_emitida_operativa_id) REFERENCES facturas_emitidas_operativas(id) ON DELETE SET NULL;
alter table public.ingresos_devengados add constraint ingresos_devengados_venta_bono_id_fkey FOREIGN KEY (venta_bono_id) REFERENCES ventas_bono(id) ON DELETE RESTRICT;
alter table public.lineas_liquidacion add constraint lineas_liquidacion_liquidacion_id_fkey FOREIGN KEY (liquidacion_id) REFERENCES liquidaciones_mensuales(id) ON DELETE CASCADE;
alter table public.liquidaciones_mensuales add constraint liquidaciones_mensuales_profesional_id_fkey FOREIGN KEY (profesional_id) REFERENCES clinica_profesionales(id) ON DELETE RESTRICT;
alter table public.movimiento_caja add constraint movimiento_caja_cuenta_tesoreria_id_fkey FOREIGN KEY (cuenta_tesoreria_id) REFERENCES cuenta_tesoreria(id) ON DELETE RESTRICT;
alter table public.movimiento_caja add constraint movimiento_caja_proyecto_id_ref_fkey FOREIGN KEY (proyecto_id_ref) REFERENCES proyectos(id_ref) ON DELETE SET NULL;
alter table public.movimiento_caja add constraint movimiento_caja_sociedad_id_ref_fkey FOREIGN KEY (sociedad_id_ref) REFERENCES sociedades(id_ref) ON DELETE SET NULL;
alter table public.movimientos_bancarios add constraint movimientos_bancarios_cuenta_bancaria_id_fkey FOREIGN KEY (cuenta_bancaria_id) REFERENCES cuentas_bancarias_sociedad(id) ON DELETE SET NULL;
alter table public.movimientos_bancarios add constraint movimientos_bancarios_extracto_id_fkey FOREIGN KEY (extracto_id) REFERENCES extractos_bancarios(id) ON DELETE SET NULL;
alter table public.pagos_liquidacion add constraint pagos_liquidacion_cuenta_tesoreria_id_fkey FOREIGN KEY (cuenta_tesoreria_id) REFERENCES cuenta_tesoreria(id) ON DELETE RESTRICT;
alter table public.pagos_liquidacion add constraint pagos_liquidacion_liquidacion_id_fkey FOREIGN KEY (liquidacion_id) REFERENCES liquidaciones_mensuales(id) ON DELETE RESTRICT;
alter table public.pagos_liquidacion add constraint pagos_liquidacion_movimiento_caja_id_fkey FOREIGN KEY (movimiento_caja_id) REFERENCES movimiento_caja(id) ON DELETE SET NULL;
alter table public.perfiles_operativos add constraint perfiles_operativos_profesional_id_fkey FOREIGN KEY (profesional_id) REFERENCES clinica_profesionales(id) ON DELETE SET NULL;
alter table public.presupuesto_capitulos add constraint presupuesto_capitulos_presupuesto_id_fkey FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id) ON DELETE CASCADE;
alter table public.presupuesto_pagos add constraint presupuesto_pagos_factura_emitida_id_fkey FOREIGN KEY (factura_emitida_id) REFERENCES facturas_emitidas(id) ON DELETE SET NULL;
alter table public.presupuesto_pagos add constraint presupuesto_pagos_factura_recibida_id_fkey FOREIGN KEY (factura_recibida_id) REFERENCES facturas_recibidas(id) ON DELETE SET NULL;
alter table public.presupuesto_pagos add constraint presupuesto_pagos_partida_id_fkey FOREIGN KEY (partida_id) REFERENCES presupuesto_partidas(id) ON DELETE CASCADE;
alter table public.presupuesto_pagos add constraint presupuesto_pagos_presupuesto_id_fkey FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id) ON DELETE CASCADE;
alter table public.presupuesto_partidas add constraint presupuesto_partidas_capitulo_id_fkey FOREIGN KEY (capitulo_id) REFERENCES presupuesto_capitulos(id) ON DELETE CASCADE;
alter table public.presupuesto_partidas add constraint presupuesto_partidas_presupuesto_id_fkey FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id) ON DELETE CASCADE;
alter table public.presupuestos add constraint presupuestos_proyecto_id_ref_fkey FOREIGN KEY (proyecto_id_ref) REFERENCES proyectos(id_ref) ON DELETE SET NULL;
alter table public.proveedores_reglas add constraint proveedores_reglas_contacto_id_fkey FOREIGN KEY (contacto_id) REFERENCES contactos(id) ON DELETE CASCADE;
alter table public.proveedores_reglas add constraint proveedores_reglas_partida_id_fkey FOREIGN KEY (partida_id) REFERENCES presupuesto_partidas(id) ON DELETE SET NULL;
alter table public.proveedores_reglas add constraint proveedores_reglas_presupuesto_id_fkey FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id) ON DELETE SET NULL;
alter table public.proveedores_reglas add constraint proveedores_reglas_sociedad_id_ref_fkey FOREIGN KEY (sociedad_id_ref) REFERENCES sociedades(id_ref) ON DELETE CASCADE;
alter table public.proyectos add constraint proyectos_sociedad_tenedora_fkey FOREIGN KEY (sociedad_tenedora) REFERENCES sociedades(id_ref);
alter table public.reconciliacion_log add constraint reconciliacion_log_asiento_borrador_id_fkey FOREIGN KEY (asiento_borrador_id) REFERENCES asientos_borrador(id) ON DELETE SET NULL;
alter table public.reconciliacion_log add constraint reconciliacion_log_asiento_oficial_id_fkey FOREIGN KEY (asiento_oficial_id) REFERENCES asientos_oficiales(id) ON DELETE CASCADE;
alter table public.reglas_liquidacion_profesional add constraint reglas_liquidacion_profesional_profesional_id_fkey FOREIGN KEY (profesional_id) REFERENCES clinica_profesionales(id) ON DELETE CASCADE;
alter table public.vencimientos add constraint vencimientos_sociedad_id_fkey FOREIGN KEY (sociedad_id) REFERENCES sociedades(id_ref) ON DELETE SET NULL;
alter table public.ventas_bono add constraint ventas_bono_canal_id_fkey FOREIGN KEY (canal_id) REFERENCES canales(id) ON DELETE SET NULL;
alter table public.ventas_bono add constraint ventas_bono_centro_id_fkey FOREIGN KEY (centro_id) REFERENCES clinica_ubicaciones(id) ON DELETE SET NULL;
alter table public.ventas_bono add constraint ventas_bono_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clinica_clientes(id) ON DELETE RESTRICT;
alter table public.ventas_bono add constraint ventas_bono_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES clinica_productos(id) ON DELETE RESTRICT;

-- ═══════════════════════════════════════════════════════════════════════════
-- §5. ÍNDICES (116 no asociados a constraints)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX ajustes_liq_liquidacion_idx ON public.ajustes_liquidacion USING btree (liquidacion_id);
CREATE INDEX arqueo_caja_cuenta_fecha_idx ON public.arqueo_caja USING btree (cuenta_tesoreria_id, fecha DESC);
CREATE INDEX arqueo_caja_estado_idx ON public.arqueo_caja USING btree (estado);
CREATE INDEX asientos_borrador_fecha_idx ON public.asientos_borrador USING btree (fecha DESC);
CREATE INDEX asientos_borrador_sociedad_idx ON public.asientos_borrador USING btree (sociedad_id_ref);
CREATE INDEX asientos_oficiales_fecha_idx ON public.asientos_oficiales USING btree (fecha DESC);
CREATE INDEX asientos_oficiales_sociedad_idx ON public.asientos_oficiales USING btree (sociedad_id_ref);
CREATE INDEX idx_balance_soc_periodo ON public.balance_sumas_saldos USING btree (sociedad_id, periodo);
CREATE INDEX caducidades_bono_venta_idx ON public.caducidades_bono USING btree (venta_bono_id, fecha);
CREATE INDEX canales_tipo_idx ON public.canales USING btree (tipo) WHERE activo;
CREATE INDEX clinica_bloqueos_prof_idx ON public.clinica_bloqueos_agenda USING btree (profesional_id, inicio);
CREATE INDEX clinica_citas_cliente_inicio_idx ON public.clinica_citas USING btree (cliente_id, inicio DESC);
CREATE INDEX clinica_citas_estado_idx ON public.clinica_citas USING btree (estado);
CREATE INDEX clinica_citas_inicio_idx ON public.clinica_citas USING btree (inicio DESC);
CREATE INDEX clinica_citas_liquidacion_idx ON public.clinica_citas USING btree (liquidacion_id);
CREATE INDEX clinica_citas_profesional_inicio_idx ON public.clinica_citas USING btree (profesional_id, inicio);
CREATE INDEX clinica_clientes_auth_idx ON public.clinica_clientes USING btree (auth_user_id);
CREATE INDEX clinica_clientes_email_idx ON public.clinica_clientes USING btree (email);
CREATE UNIQUE INDEX clinica_clientes_external_record_uniq ON public.clinica_clientes USING btree (external_clinical_record_id) WHERE ((external_clinical_record_id IS NOT NULL) AND (external_clinical_record_id <> ''::text));
CREATE INDEX clinica_disp_excep_idx ON public.clinica_disponibilidad_excepcional USING btree (profesional_id, fecha);
CREATE INDEX clinica_horarios_prof_idx ON public.clinica_horarios_profesional USING btree (profesional_id, dia_semana);
CREATE INDEX clinica_productos_publico_idx ON public.clinica_productos USING btree (visible_en_reserva_publica) WHERE activo;
CREATE INDEX clinica_productos_servicio_idx ON public.clinica_productos USING btree (servicio_id);
CREATE INDEX clinica_prof_serv_servicio_idx ON public.clinica_profesional_servicios USING btree (servicio_id);
CREATE INDEX clinica_recursos_ubicacion_idx ON public.clinica_recursos USING btree (ubicacion_id);
CREATE INDEX clinica_ubicaciones_proyecto_idx ON public.clinica_ubicaciones USING btree (proyecto_id_ref);
CREATE UNIQUE INDEX clinica_ubicaciones_sociedad_nombre_uniq ON public.clinica_ubicaciones USING btree (sociedad_id_ref, nombre);
CREATE INDEX clinica_usuarios_auth_idx ON public.clinica_usuarios USING btree (auth_user_id);
CREATE INDEX clinica_usuarios_email_idx ON public.clinica_usuarios USING btree (email);
CREATE INDEX cobros_cliente_idx ON public.cobros USING btree (cliente_id, fecha DESC);
CREATE INDEX cobros_cuenta_idx ON public.cobros USING btree (cuenta_tesoreria_id, fecha);
CREATE INDEX cobros_fecha_idx ON public.cobros USING btree (fecha DESC);
CREATE INDEX cobros_origen_idx ON public.cobros USING btree (origen_tipo, origen_id);
CREATE INDEX consumos_bono_prof_idx ON public.consumos_bono USING btree (profesional_id, fecha);
CREATE INDEX consumos_bono_tipo_idx ON public.consumos_bono USING btree (tipo);
CREATE INDEX consumos_bono_venta_idx ON public.consumos_bono USING btree (venta_bono_id, fecha);
CREATE UNIQUE INDEX contactos_nif_unique ON public.contactos USING btree (nif) WHERE ((nif IS NOT NULL) AND (nif <> ''::text));
CREATE UNIQUE INDEX cuenta_tesoreria_cuenta_bancaria_uniq ON public.cuenta_tesoreria USING btree (cuenta_bancaria_id) WHERE (cuenta_bancaria_id IS NOT NULL);
CREATE INDEX cuenta_tesoreria_sociedad_idx ON public.cuenta_tesoreria USING btree (sociedad_id_ref);
CREATE UNIQUE INDEX cuenta_tesoreria_sociedad_nombre_uniq ON public.cuenta_tesoreria USING btree (sociedad_id_ref, nombre);
CREATE INDEX cuenta_tesoreria_tipo_idx ON public.cuenta_tesoreria USING btree (tipo);
CREATE INDEX idx_cuentas_bancarias_sociedad_ref ON public.cuentas_bancarias_sociedad USING btree (sociedad_id_ref);
CREATE INDEX devoluciones_bono_venta_idx ON public.devoluciones_bono USING btree (venta_bono_id, fecha);
CREATE UNIQUE INDEX extractos_bancarios_archivo_uniq ON public.extractos_bancarios USING btree (sociedad_id_ref, archivo_hash) WHERE (estado <> 'deshecho'::text);
CREATE INDEX extractos_bancarios_sociedad_idx ON public.extractos_bancarios USING btree (sociedad_id_ref, anio, mes);
CREATE UNIQUE INDEX factura_aprobaciones_creacion_unica ON public.factura_aprobaciones USING btree (factura_id) WHERE (accion = 'crea_borrador_ocr'::text);
CREATE INDEX factura_aprobaciones_factura_idx ON public.factura_aprobaciones USING btree (factura_id, created_at);
CREATE INDEX factura_incidencias_factura_idx ON public.factura_incidencias USING btree (factura_id, created_at);
CREATE INDEX factura_pagos_factura_idx ON public.factura_pagos USING btree (factura_id, fecha_pago);
CREATE INDEX facturas_emitidas_estado_idx ON public.facturas_emitidas USING btree (estado);
CREATE INDEX facturas_emitidas_fecha_idx ON public.facturas_emitidas USING btree (fecha_factura DESC);
CREATE INDEX facturas_emitidas_sociedad_idx ON public.facturas_emitidas USING btree (sociedad_id_ref);
CREATE INDEX fe_operativas_cliente_idx ON public.facturas_emitidas_operativas USING btree (cliente_id);
CREATE INDEX fe_operativas_estado_idx ON public.facturas_emitidas_operativas USING btree (estado);
CREATE INDEX fe_operativas_fecha_idx ON public.facturas_emitidas_operativas USING btree (fecha DESC);
CREATE INDEX fe_operativas_origen_idx ON public.facturas_emitidas_operativas USING btree (origen_tipo, origen_id);
CREATE INDEX facturas_recibidas_estado_idx ON public.facturas_recibidas USING btree (estado);
CREATE INDEX facturas_recibidas_fecha_idx ON public.facturas_recibidas USING btree (fecha_factura DESC);
CREATE INDEX facturas_recibidas_gasto_idx ON public.facturas_recibidas USING btree (gasto_operativo_id);
CREATE INDEX facturas_recibidas_liquidacion_idx ON public.facturas_recibidas USING btree (liquidacion_id);
CREATE INDEX facturas_recibidas_presupuesto_pago_idx ON public.facturas_recibidas USING btree (presupuesto_pago_id) WHERE (presupuesto_pago_id IS NOT NULL);
CREATE INDEX facturas_recibidas_sociedad_idx ON public.facturas_recibidas USING btree (sociedad_id_ref);
CREATE INDEX idx_facturas_recibidas_proyecto ON public.facturas_recibidas USING btree (proyecto_id_ref);
CREATE INDEX idx_flujos_proyecto_fecha ON public.flujos_caja_proyectos USING btree (proyecto_id, fecha);
CREATE INDEX gastos_operativos_capa_idx ON public.gastos_operativos USING btree (capa);
CREATE INDEX gastos_operativos_centro_idx ON public.gastos_operativos USING btree (centro_id);
CREATE INDEX gastos_operativos_fecha_idx ON public.gastos_operativos USING btree (fecha DESC);
CREATE INDEX gastos_operativos_pendiente_idx ON public.gastos_operativos USING btree (pendiente_confirmacion) WHERE pendiente_confirmacion;
CREATE INDEX gastos_operativos_prof_idx ON public.gastos_operativos USING btree (profesional_id);
CREATE INDEX gastos_operativos_tipo_idx ON public.gastos_operativos USING btree (tipo);
CREATE INDEX ingresos_devengados_centro_canal_idx ON public.ingresos_devengados USING btree (centro_id, canal_id);
CREATE INDEX ingresos_devengados_cita_idx ON public.ingresos_devengados USING btree (cita_id);
CREATE INDEX ingresos_devengados_fecha_idx ON public.ingresos_devengados USING btree (fecha_devengo DESC);
CREATE INDEX ingresos_devengados_origen_idx ON public.ingresos_devengados USING btree (origen);
CREATE INDEX ingresos_devengados_venta_idx ON public.ingresos_devengados USING btree (venta_bono_id);
CREATE INDEX lineas_liq_liquidacion_idx ON public.lineas_liquidacion USING btree (liquidacion_id);
CREATE INDEX liquidaciones_estado_idx ON public.liquidaciones_mensuales USING btree (estado);
CREATE INDEX liquidaciones_mes_idx ON public.liquidaciones_mensuales USING btree (mes);
CREATE INDEX liquidaciones_prof_idx ON public.liquidaciones_mensuales USING btree (profesional_id, mes DESC);
CREATE INDEX movimiento_caja_cuenta_idx ON public.movimiento_caja USING btree (cuenta_tesoreria_id, fecha);
CREATE INDEX movimiento_caja_fecha_idx ON public.movimiento_caja USING btree (fecha DESC);
CREATE INDEX movimiento_caja_origen_idx ON public.movimiento_caja USING btree (origen_tipo, origen_id);
CREATE INDEX movimientos_bancarios_categoria_idx ON public.movimientos_bancarios USING btree (categoria);
CREATE INDEX movimientos_bancarios_extracto_idx ON public.movimientos_bancarios USING btree (extracto_id);
CREATE INDEX movimientos_bancarios_fecha_idx ON public.movimientos_bancarios USING btree (fecha DESC);
CREATE UNIQUE INDEX movimientos_bancarios_hash_uniq ON public.movimientos_bancarios USING btree (sociedad_id_ref, hash) WHERE (hash IS NOT NULL);
CREATE INDEX movimientos_bancarios_iban_idx ON public.movimientos_bancarios USING btree (iban);
CREATE INDEX movimientos_bancarios_sociedad_idx ON public.movimientos_bancarios USING btree (sociedad_id_ref);
CREATE INDEX pagos_liq_fecha_idx ON public.pagos_liquidacion USING btree (fecha DESC);
CREATE INDEX pagos_liq_liquidacion_idx ON public.pagos_liquidacion USING btree (liquidacion_id);
CREATE INDEX perfiles_operativos_rol_idx ON public.perfiles_operativos USING btree (rol) WHERE activo;
CREATE INDEX plan_cuentas_sociedad_idx ON public.plan_cuentas USING btree (sociedad_id_ref, codigo);
CREATE INDEX presupuesto_capitulos_presupuesto_idx ON public.presupuesto_capitulos USING btree (presupuesto_id);
CREATE INDEX presupuesto_pagos_estado_idx ON public.presupuesto_pagos USING btree (estado);
CREATE INDEX presupuesto_pagos_fecha_idx ON public.presupuesto_pagos USING btree (fecha_prevista);
CREATE INDEX presupuesto_pagos_partida_idx ON public.presupuesto_pagos USING btree (partida_id);
CREATE INDEX presupuesto_pagos_presupuesto_idx ON public.presupuesto_pagos USING btree (presupuesto_id);
CREATE INDEX presupuesto_partidas_capitulo_idx ON public.presupuesto_partidas USING btree (capitulo_id);
CREATE INDEX presupuesto_partidas_presupuesto_idx ON public.presupuesto_partidas USING btree (presupuesto_id);
CREATE INDEX presupuestos_categoria_idx ON public.presupuestos USING btree (categoria);
CREATE INDEX presupuestos_estado_idx ON public.presupuestos USING btree (estado);
CREATE INDEX presupuestos_proyecto_idx ON public.presupuestos USING btree (proyecto_id_ref);
CREATE INDEX presupuestos_sociedad_idx ON public.presupuestos USING btree (sociedad_id_ref);
CREATE UNIQUE INDEX proveedores_reglas_contacto_global_uniq ON public.proveedores_reglas USING btree (contacto_id) WHERE (activa AND (sociedad_id_ref IS NULL));
CREATE INDEX proveedores_reglas_contacto_idx ON public.proveedores_reglas USING btree (contacto_id);
CREATE UNIQUE INDEX proveedores_reglas_contacto_sociedad_uniq ON public.proveedores_reglas USING btree (contacto_id, sociedad_id_ref) WHERE (activa AND (sociedad_id_ref IS NOT NULL));
CREATE INDEX idx_proyectos_tenedora ON public.proyectos USING btree (sociedad_tenedora);
CREATE INDEX reconciliacion_log_sociedad_periodo_idx ON public.reconciliacion_log USING btree (sociedad_id_ref, periodo);
CREATE INDEX reglas_categorizacion_prioridad_idx ON public.reglas_categorizacion USING btree (prioridad DESC);
CREATE INDEX reglas_liq_prof_idx ON public.reglas_liquidacion_profesional USING btree (profesional_id) WHERE activa;
CREATE INDEX idx_vencimientos_estado ON public.vencimientos USING btree (estado);
CREATE INDEX idx_vencimientos_fecha ON public.vencimientos USING btree (fecha_vencimiento);
CREATE INDEX idx_vencimientos_sociedad ON public.vencimientos USING btree (sociedad_id);
CREATE INDEX ventas_bono_cliente_idx ON public.ventas_bono USING btree (cliente_id, fecha_venta DESC);
CREATE INDEX ventas_bono_estado_idx ON public.ventas_bono USING btree (estado);
CREATE INDEX ventas_bono_venc_idx ON public.ventas_bono USING btree (vencimiento) WHERE (vencimiento IS NOT NULL);

-- ═══════════════════════════════════════════════════════════════════════════
-- §6. VISTAS (12) — orden por dependencias
-- ═══════════════════════════════════════════════════════════════════════════
create or replace view public.compromisos_tesoreria as
 SELECT COALESCE(pr.sociedad_id_ref, proy.sociedad_tenedora) AS sociedad_id_ref,
    pp.fecha_prevista AS fecha,
        CASE
            WHEN pp.tipo_flujo = 'ingreso'::text THEN pp.importe
            ELSE - pp.importe
        END AS importe,
    pp.tipo_flujo,
    COALESCE(pp.descripcion, pa.descripcion) AS concepto,
    'presupuesto'::text AS origen,
    'presupuesto'::text AS fuente,
    pp.contingente,
    pr.proyecto_nombre,
    pp.id AS origen_id,
    pp.estado,
    pp.tipo_flujo = 'ingreso'::text AS es_entrada,
    pr.id AS presupuesto_id,
    pp.partida_id,
    pp.factura_recibida_id AS factura_id,
    NULL::uuid AS vencimiento_id
   FROM presupuesto_pagos pp
     JOIN presupuestos pr ON pr.id = pp.presupuesto_id
     JOIN presupuesto_partidas pa ON pa.id = pp.partida_id
     LEFT JOIN proyectos proy ON proy.id_ref = pr.proyecto_id_ref
  WHERE pp.estado = 'pendiente'::text
UNION ALL
 SELECT v.sociedad_id AS sociedad_id_ref,
    v.fecha_vencimiento AS fecha,
        CASE
            WHEN v.es_entrada THEN v.importe
            ELSE - v.importe
        END AS importe,
        CASE
            WHEN v.es_entrada THEN 'ingreso'::text
            ELSE 'gasto'::text
        END AS tipo_flujo,
    v.titulo AS concepto,
    'vencimiento'::text AS origen,
    'vencimiento'::text AS fuente,
    false AS contingente,
    NULL::text AS proyecto_nombre,
    v.id AS origen_id,
    v.estado,
    v.es_entrada,
    NULL::uuid AS presupuesto_id,
    NULL::uuid AS partida_id,
    NULL::uuid AS factura_id,
    v.id AS vencimiento_id
   FROM vencimientos v
  WHERE v.estado = 'pendiente'::text AND v.importe IS NOT NULL
UNION ALL
 SELECT f.sociedad_id_ref,
    COALESCE(f.fecha_vencimiento, (f.created_at::date + '30 days'::interval)::date) AS fecha,
    - f.total_a_pagar AS importe,
    'gasto'::text AS tipo_flujo,
    COALESCE(f.proveedor_nombre, 'Factura pendiente'::text) AS concepto,
    'factura'::text AS origen,
    'factura'::text AS fuente,
    false AS contingente,
    NULL::text AS proyecto_nombre,
    f.id AS origen_id,
    f.estado,
    false AS es_entrada,
    NULL::uuid AS presupuesto_id,
    NULL::uuid AS partida_id,
    f.id AS factura_id,
    NULL::uuid AS vencimiento_id
   FROM facturas_recibidas f
  WHERE f.estado = 'pendiente_pago'::text AND f.presupuesto_pago_id IS NULL;

create or replace view public.flujos_proyecto_consolidados as
 SELECT f.proyecto_id AS proyecto_id_ref,
    f.fecha,
    f.importe,
    f.tipo_flujo,
    f.concepto,
    'flujo_manual'::text AS fuente,
    NULL::text AS sociedad_id_ref,
    NULL::uuid AS factura_id,
    NULL::uuid AS presupuesto_pago_id,
    NULL::text AS estado,
    true AS es_real,
    false AS es_previsto
   FROM flujos_caja_proyectos f
UNION ALL
 SELECT pr.proyecto_id_ref,
    COALESCE(pp.fecha_real_pago, pp.fecha_prevista) AS fecha,
        CASE pp.tipo_flujo
            WHEN 'gasto'::text THEN - abs(pp.importe)
            ELSE abs(pp.importe)
        END AS importe,
    pp.tipo_flujo,
    pp.descripcion AS concepto,
    'presupuesto_pago'::text AS fuente,
    COALESCE(pr.sociedad_id_ref, proy.sociedad_tenedora) AS sociedad_id_ref,
    pp.factura_recibida_id AS factura_id,
    pp.id AS presupuesto_pago_id,
    pp.estado,
    pp.estado = 'pagado'::text AS es_real,
    pp.estado = ANY (ARRAY['pendiente'::text, 'estimado'::text, 'confirmado'::text, 'facturado'::text]) AS es_previsto
   FROM presupuesto_pagos pp
     JOIN presupuestos pr ON pr.id = pp.presupuesto_id
     LEFT JOIN proyectos proy ON proy.id_ref = pr.proyecto_id_ref
  WHERE pr.proyecto_id_ref IS NOT NULL AND (pp.fecha_prevista IS NOT NULL OR pp.fecha_real_pago IS NOT NULL)
UNION ALL
 SELECT fr.proyecto_id_ref,
    COALESCE(fr.fecha_vencimiento, fr.fecha_factura) AS fecha,
    - abs(fr.total) AS importe,
    'gasto'::text AS tipo_flujo,
    COALESCE(fr.concepto, fr.proveedor_nombre) AS concepto,
    'factura_recibida'::text AS fuente,
    fr.sociedad_id_ref,
    fr.id AS factura_id,
    fr.presupuesto_pago_id,
    fr.estado,
    fr.estado = 'pagada'::text AS es_real,
    fr.estado = ANY (ARRAY['pendiente_pago'::text, 'revision_javi'::text]) AS es_previsto
   FROM facturas_recibidas fr
  WHERE fr.proyecto_id_ref IS NOT NULL AND fr.presupuesto_pago_id IS NULL;

create or replace view public.movimiento_tesoreria as
 SELECT mb.id,
    'banco'::text AS origen,
    ct.id AS cuenta_tesoreria_id,
    'banco'::text AS tipo_cuenta,
    NULL::text AS medio_pago,
    mb.sociedad_id_ref,
    mb.proyecto_id_ref,
    mb.fecha,
    mb.importe,
    mb.concepto,
    mb.referencia,
        CASE
            WHEN mb.revisado THEN 'revisado'::text
            ELSE 'pendiente_revision'::text
        END AS estado,
    COALESCE(mb.fuente, 'extracto'::text) AS origen_detalle
   FROM movimientos_bancarios mb
     LEFT JOIN cuenta_tesoreria ct ON ct.tipo = 'banco'::text AND ct.cuenta_bancaria_id = mb.cuenta_bancaria_id
UNION ALL
 SELECT mc.id,
    'caja'::text AS origen,
    mc.cuenta_tesoreria_id,
    'caja'::text AS tipo_cuenta,
    mc.medio_pago,
    COALESCE(mc.sociedad_id_ref, ct.sociedad_id_ref) AS sociedad_id_ref,
    COALESCE(mc.proyecto_id_ref, ct.proyecto_id_ref) AS proyecto_id_ref,
    mc.fecha,
    mc.importe,
    mc.concepto,
    NULLIF(mc.origen_id::text, ''::text) AS referencia,
    'registrado'::text AS estado,
    mc.origen_tipo AS origen_detalle
   FROM movimiento_caja mc
     JOIN cuenta_tesoreria ct ON ct.id = mc.cuenta_tesoreria_id;

create or replace view public.saldo_bancario_por_sociedad as
 SELECT sociedad_id_ref,
    COALESCE(sum(importe), 0::numeric) AS saldo_actual,
    count(*) AS num_movimientos,
    max(fecha) AS ultimo_movimiento
   FROM movimientos_bancarios
  GROUP BY sociedad_id_ref;

create or replace view public.saldo_tesoreria as
 SELECT mt.sociedad_id_ref,
    mt.proyecto_id_ref,
    mt.cuenta_tesoreria_id,
    mt.tipo_cuenta,
    COALESCE(ct.moneda, 'EUR'::text) AS moneda,
    round(sum(mt.importe), 2) AS saldo,
    count(*) AS num_movimientos,
    max(mt.fecha) AS ultimo_movimiento,
    CURRENT_DATE AS fecha_calculo
   FROM movimiento_tesoreria mt
     LEFT JOIN cuenta_tesoreria ct ON ct.id = mt.cuenta_tesoreria_id
  GROUP BY mt.sociedad_id_ref, mt.proyecto_id_ref, mt.cuenta_tesoreria_id, mt.tipo_cuenta, ct.moneda;

create or replace view public.tesoreria as
 WITH banco AS (
         SELECT movimiento_tesoreria.sociedad_id_ref,
            round(sum(movimiento_tesoreria.importe), 2) AS banco_operativo
           FROM movimiento_tesoreria
          WHERE movimiento_tesoreria.tipo_cuenta = 'banco'::text
          GROUP BY movimiento_tesoreria.sociedad_id_ref
        ), caja AS (
         SELECT movimiento_tesoreria.sociedad_id_ref,
            round(sum(movimiento_tesoreria.importe), 2) AS caja_efectivo
           FROM movimiento_tesoreria
          WHERE movimiento_tesoreria.tipo_cuenta = 'caja'::text
          GROUP BY movimiento_tesoreria.sociedad_id_ref
        ), compromisos AS (
         SELECT compromisos_tesoreria.sociedad_id_ref,
            round(sum(
                CASE
                    WHEN compromisos_tesoreria.es_entrada THEN compromisos_tesoreria.importe
                    ELSE 0::numeric
                END), 2) AS cobros_pendientes,
            round(sum(
                CASE
                    WHEN NOT compromisos_tesoreria.es_entrada THEN compromisos_tesoreria.importe
                    ELSE 0::numeric
                END), 2) AS pagos_proximos
           FROM compromisos_tesoreria
          GROUP BY compromisos_tesoreria.sociedad_id_ref
        ), socs AS (
         SELECT banco.sociedad_id_ref
           FROM banco
        UNION
         SELECT caja.sociedad_id_ref
           FROM caja
        UNION
         SELECT compromisos.sociedad_id_ref
           FROM compromisos
        )
 SELECT s.sociedad_id_ref,
    COALESCE(b.banco_operativo, 0::numeric) AS banco_operativo,
    COALESCE(c.caja_efectivo, 0::numeric) AS caja_efectivo,
    COALESCE(b.banco_operativo, 0::numeric) + COALESCE(c.caja_efectivo, 0::numeric) AS saldo_operativo_total,
    COALESCE(k.cobros_pendientes, 0::numeric) AS cobros_pendientes,
    COALESCE(k.pagos_proximos, 0::numeric) AS pagos_proximos,
    CURRENT_DATE AS fecha_calculo
   FROM socs s
     LEFT JOIN banco b ON b.sociedad_id_ref = s.sociedad_id_ref
     LEFT JOIN caja c ON c.sociedad_id_ref = s.sociedad_id_ref
     LEFT JOIN compromisos k ON k.sociedad_id_ref = s.sociedad_id_ref;

create or replace view public.v_balance_periodos as
 SELECT sociedad_id,
    periodo,
    count(*) AS lineas,
    max(created_at) AS importado_en
   FROM balance_sumas_saldos
  GROUP BY sociedad_id, periodo
  ORDER BY sociedad_id, periodo DESC;

create or replace view public.v_facturas_recibidas_operativas as
 SELECT id,
    proveedor_nombre AS contraparte,
    fecha_factura AS fecha,
    total AS importe,
        CASE estado
            WHEN 'borrador_ocr'::text THEN 'recibida'::text
            WHEN 'revision_javi'::text THEN 'recibida'::text
            WHEN 'pendiente_pago'::text THEN 'pendiente_pago'::text
            WHEN 'pagada'::text THEN 'pagada'::text
            WHEN 'rechazada'::text THEN 'bloqueada'::text
            ELSE NULL::text
        END::estado_factura_recibida AS estado_operativo,
    estado AS estado_fisico,
    gasto_operativo_id,
    liquidacion_id
   FROM facturas_recibidas fr;

create or replace view public.v_liquidaciones_seguimiento as
 SELECT l.id,
    l.profesional_id,
    l.mes,
    l.estado,
    l.requiere_revision_ceo,
    e.id IS NOT NULL AND e.recibida AS evidencia_recibida
   FROM liquidaciones_mensuales l
     LEFT JOIN evidencias_liquidacion e ON e.liquidacion_id = l.id
  WHERE rol_operativo_actual() = ANY (ARRAY['direccion'::rol_operativo, 'coordinacion'::rol_operativo]);

create or replace view public.v_liquidaciones_totales as
 SELECT l.id,
    l.profesional_id,
    l.mes,
    l.estado,
    l.requiere_revision_ceo,
    l.importe_calculado,
    round(COALESCE(a.total_ajustes, 0::numeric), 2) AS total_ajustes,
    round(l.importe_calculado + COALESCE(a.total_ajustes, 0::numeric), 2) AS importe_final,
    round(COALESCE(p.total_pagado, 0::numeric), 2) AS total_pagado,
    round(l.importe_calculado + COALESCE(a.total_ajustes, 0::numeric) - COALESCE(p.total_pagado, 0::numeric), 2) AS pendiente_pago,
    e.id IS NOT NULL AND e.recibida AS evidencia_recibida
   FROM liquidaciones_mensuales l
     LEFT JOIN ( SELECT ajustes_liquidacion.liquidacion_id,
            sum(ajustes_liquidacion.importe) AS total_ajustes
           FROM ajustes_liquidacion
          GROUP BY ajustes_liquidacion.liquidacion_id) a ON a.liquidacion_id = l.id
     LEFT JOIN ( SELECT pagos_liquidacion.liquidacion_id,
            sum(pagos_liquidacion.importe) AS total_pagado
           FROM pagos_liquidacion
          GROUP BY pagos_liquidacion.liquidacion_id) p ON p.liquidacion_id = l.id
     LEFT JOIN evidencias_liquidacion e ON e.liquidacion_id = l.id;

create or replace view public.v_resumen_ventas_bono as
 WITH base AS (
         SELECT vb.id AS venta_bono_id,
            vb.cliente_id,
            vb.estado,
            vb.importe_cobrado,
            vb.unidades,
            round(vb.importe_cobrado / vb.unidades::numeric, 2) AS devengo_unitario,
            COALESCE(c.unidades_consumidas, 0::bigint) AS unidades_consumidas,
            vb.unidades - COALESCE(c.unidades_consumidas, 0::bigint) - COALESCE(d.unidades_devueltas, 0::bigint) - COALESCE(x.unidades_caducadas, 0::bigint) AS saldo_unidades,
            round(COALESCE(c.eventos_devengan, 0::bigint)::numeric * round(vb.importe_cobrado / vb.unidades::numeric, 2), 2) AS devengado,
            COALESCE(d.importe_devuelto, 0::numeric) AS devuelto,
            COALESCE(x.importe_caducado, 0::numeric) AS tratado_por_caducidad,
            round(vb.importe_cobrado - COALESCE(c.eventos_devengan, 0::bigint)::numeric * round(vb.importe_cobrado / vb.unidades::numeric, 2) - COALESCE(d.importe_devuelto, 0::numeric) - COALESCE(x.importe_caducado, 0::numeric), 2) AS pendiente_de_devengar
           FROM ventas_bono vb
             LEFT JOIN LATERAL ( SELECT count(*) FILTER (WHERE cb.tipo = ANY (ARRAY['consumida'::tipo_sesion_bono, 'no_show_cobrado'::tipo_sesion_bono])) AS unidades_consumidas,
                    count(*) FILTER (WHERE cb.tipo = ANY (ARRAY['consumida'::tipo_sesion_bono, 'no_show_cobrado'::tipo_sesion_bono])) AS eventos_devengan
                   FROM consumos_bono cb
                  WHERE cb.venta_bono_id = vb.id) c ON true
             LEFT JOIN LATERAL ( SELECT COALESCE(sum(db.unidades), 0::bigint) AS unidades_devueltas,
                    round(COALESCE(sum(db.importe), 0::numeric), 2) AS importe_devuelto
                   FROM devoluciones_bono db
                  WHERE db.venta_bono_id = vb.id) d ON true
             LEFT JOIN LATERAL ( SELECT COALESCE(sum(xb.unidades_caducadas), 0::bigint) AS unidades_caducadas,
                    round(COALESCE(sum(xb.importe), 0::numeric), 2) AS importe_caducado
                   FROM caducidades_bono xb
                  WHERE xb.venta_bono_id = vb.id) x ON true
        )
 SELECT venta_bono_id,
    cliente_id,
    estado,
    importe_cobrado,
    unidades,
    devengo_unitario,
    unidades_consumidas,
    saldo_unidades,
    devengado,
    devuelto,
    tratado_por_caducidad,
    pendiente_de_devengar,
    saldo_unidades >= 0 AND pendiente_de_devengar >= 0::numeric AS cuadra
   FROM base;

create or replace view public.cashflow_consolidado as
 SELECT flujos_proyecto_consolidados.proyecto_id_ref,
    flujos_proyecto_consolidados.sociedad_id_ref,
    flujos_proyecto_consolidados.fecha,
    flujos_proyecto_consolidados.importe,
    flujos_proyecto_consolidados.tipo_flujo,
    flujos_proyecto_consolidados.concepto,
    flujos_proyecto_consolidados.fuente,
    flujos_proyecto_consolidados.estado,
    flujos_proyecto_consolidados.es_real,
    flujos_proyecto_consolidados.es_previsto
   FROM flujos_proyecto_consolidados
UNION ALL
 SELECT NULL::text AS proyecto_id_ref,
    v.sociedad_id AS sociedad_id_ref,
    v.fecha_vencimiento AS fecha,
    round(v.importe *
        CASE
            WHEN v.es_entrada THEN 1
            ELSE '-1'::integer
        END::numeric, 2) AS importe,
        CASE
            WHEN v.es_entrada THEN 'ingreso'::text
            ELSE 'gasto'::text
        END AS tipo_flujo,
    v.titulo AS concepto,
    'vencimiento'::text AS fuente,
    v.estado,
    v.estado = 'gestionado'::text AS es_real,
    v.estado <> 'gestionado'::text AS es_previsto
   FROM vencimientos v
  WHERE v.importe IS NOT NULL AND v.importe > 0::numeric;

-- ═══════════════════════════════════════════════════════════════════════════
-- §7. TRIGGERS (36)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TRIGGER arqueo_caja_touch BEFORE UPDATE ON public.arqueo_caja FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER asientos_borrador_touch BEFORE UPDATE ON public.asientos_borrador FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER canales_touch BEFORE UPDATE ON public.canales FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_clinica_bloqueos BEFORE UPDATE ON public.clinica_bloqueos_agenda FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER clinica_citas_touch BEFORE UPDATE ON public.clinica_citas FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_clinica_clientes BEFORE UPDATE ON public.clinica_clientes FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_clinica_disp_excep BEFORE UPDATE ON public.clinica_disponibilidad_excepcional FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_clinica_horarios BEFORE UPDATE ON public.clinica_horarios_profesional FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_clinica_productos BEFORE UPDATE ON public.clinica_productos FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_clinica_profesionales BEFORE UPDATE ON public.clinica_profesionales FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_clinica_recursos BEFORE UPDATE ON public.clinica_recursos FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_clinica_servicios BEFORE UPDATE ON public.clinica_servicios FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_clinica_ubicaciones BEFORE UPDATE ON public.clinica_ubicaciones FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_clinica_usuarios BEFORE UPDATE ON public.clinica_usuarios FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER configuracion_contabilidad_touch BEFORE UPDATE ON public.configuracion_contabilidad FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER contactos_touch BEFORE UPDATE ON public.contactos FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER cuenta_tesoreria_touch BEFORE UPDATE ON public.cuenta_tesoreria FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER evidencias_liq_touch BEFORE UPDATE ON public.evidencias_liquidacion FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER extractos_bancarios_touch BEFORE UPDATE ON public.extractos_bancarios FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER factura_pagos_touch BEFORE UPDATE ON public.factura_pagos FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER facturas_emitidas_touch BEFORE UPDATE ON public.facturas_emitidas FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER fe_operativas_touch BEFORE UPDATE ON public.facturas_emitidas_operativas FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER facturas_recibidas_touch BEFORE UPDATE ON public.facturas_recibidas FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER flujos_caja_proyectos_touch BEFORE UPDATE ON public.flujos_caja_proyectos FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER gastos_operativos_touch BEFORE UPDATE ON public.gastos_operativos FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER kpis_sociedades_touch BEFORE UPDATE ON public.kpis_sociedades FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER liquidaciones_touch BEFORE UPDATE ON public.liquidaciones_mensuales FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER perfiles_operativos_touch BEFORE UPDATE ON public.perfiles_operativos FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER presupuesto_partidas_touch BEFORE UPDATE ON public.presupuesto_partidas FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER presupuestos_touch BEFORE UPDATE ON public.presupuestos FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER proveedores_reglas_touch BEFORE UPDATE ON public.proveedores_reglas FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER proyectos_touch BEFORE UPDATE ON public.proyectos FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER reglas_liq_touch BEFORE UPDATE ON public.reglas_liquidacion_profesional FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER sociedades_touch BEFORE UPDATE ON public.sociedades FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER vencimientos_touch BEFORE UPDATE ON public.vencimientos FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER ventas_bono_touch BEFORE UPDATE ON public.ventas_bono FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- §8. ROW LEVEL SECURITY (58 tablas · 74 políticas)
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.ajustes_liquidacion enable row level security;
alter table public.arqueo_caja enable row level security;
alter table public.asientos_borrador enable row level security;
alter table public.asientos_oficiales enable row level security;
alter table public.balance_sumas_saldos enable row level security;
alter table public.caducidades_bono enable row level security;
alter table public.canales enable row level security;
alter table public.clinica_bloqueos_agenda enable row level security;
alter table public.clinica_citas enable row level security;
alter table public.clinica_clientes enable row level security;
alter table public.clinica_disponibilidad_excepcional enable row level security;
alter table public.clinica_horarios_profesional enable row level security;
alter table public.clinica_productos enable row level security;
alter table public.clinica_profesional_servicios enable row level security;
alter table public.clinica_profesionales enable row level security;
alter table public.clinica_recursos enable row level security;
alter table public.clinica_servicios enable row level security;
alter table public.clinica_ubicaciones enable row level security;
alter table public.clinica_usuarios enable row level security;
alter table public.cobros enable row level security;
alter table public.configuracion_contabilidad enable row level security;
alter table public.consumos_bono enable row level security;
alter table public.contactos enable row level security;
alter table public.cuenta_tesoreria enable row level security;
alter table public.cuentas_bancarias_sociedad enable row level security;
alter table public.cuentas_por_cobrar enable row level security;
alter table public.devoluciones_bono enable row level security;
alter table public.evidencias_liquidacion enable row level security;
alter table public.extractos_bancarios enable row level security;
alter table public.factura_aprobaciones enable row level security;
alter table public.factura_incidencias enable row level security;
alter table public.factura_pagos enable row level security;
alter table public.facturas_emitidas enable row level security;
alter table public.facturas_emitidas_operativas enable row level security;
alter table public.facturas_recibidas enable row level security;
alter table public.flujos_caja_proyectos enable row level security;
alter table public.gastos_operativos enable row level security;
alter table public.ingresos_devengados enable row level security;
alter table public.kpis_sociedades enable row level security;
alter table public.lineas_liquidacion enable row level security;
alter table public.liquidaciones_mensuales enable row level security;
alter table public.movimiento_caja enable row level security;
alter table public.movimientos_bancarios enable row level security;
alter table public.pagos_liquidacion enable row level security;
alter table public.perfiles_operativos enable row level security;
alter table public.plan_cuentas enable row level security;
alter table public.presupuesto_capitulos enable row level security;
alter table public.presupuesto_pagos enable row level security;
alter table public.presupuesto_partidas enable row level security;
alter table public.presupuestos enable row level security;
alter table public.proveedores_reglas enable row level security;
alter table public.proyectos enable row level security;
alter table public.reconciliacion_log enable row level security;
alter table public.reglas_categorizacion enable row level security;
alter table public.reglas_liquidacion_profesional enable row level security;
alter table public.sociedades enable row level security;
alter table public.vencimientos enable row level security;
alter table public.ventas_bono enable row level security;

create policy "ajustes_liq_select" on public.ajustes_liquidacion
  for select
  to authenticated
  using ((EXISTS ( SELECT 1
   FROM liquidaciones_mensuales l
  WHERE ((l.id = ajustes_liquidacion.liquidacion_id) AND (es_direccion() OR ((rol_operativo_actual() = 'profesional'::rol_operativo) AND (l.profesional_id = profesional_actual())))))));

create policy "arqueo_caja_select" on public.arqueo_caja
  for select
  to authenticated
  using (true);

create policy "asientos_borrador_auth_all" on public.asientos_borrador
  for all
  to authenticated
  using (true)
  with check (true);

create policy "asientos_oficiales_auth_all" on public.asientos_oficiales
  for all
  to authenticated
  using (true)
  with check (true);

create policy "balance_sumas_saldos_auth_all" on public.balance_sumas_saldos
  for all
  to authenticated
  using (true)
  with check (true);

create policy "caducidades_bono_select" on public.caducidades_bono
  for select
  to authenticated
  using ((rol_operativo_actual() = ANY (ARRAY['direccion'::rol_operativo, 'coordinacion'::rol_operativo])));

create policy "canales_admin" on public.canales
  for all
  to authenticated
  using (es_direccion())
  with check (es_direccion());

create policy "canales_select" on public.canales
  for select
  to authenticated
  using ((rol_operativo_actual() IS NOT NULL));

create policy "clinica_bloqueos_auth_all" on public.clinica_bloqueos_agenda
  for all
  to authenticated
  using (true)
  with check (true);

create policy "clinica_citas_insert" on public.clinica_citas
  for insert
  to authenticated
  with check ((rol_operativo_actual() = ANY (ARRAY['direccion'::rol_operativo, 'coordinacion'::rol_operativo, 'recepcion'::rol_operativo])));

create policy "clinica_citas_select" on public.clinica_citas
  for select
  to authenticated
  using (((rol_operativo_actual() = ANY (ARRAY['direccion'::rol_operativo, 'coordinacion'::rol_operativo, 'recepcion'::rol_operativo])) OR ((rol_operativo_actual() = 'profesional'::rol_operativo) AND (profesional_id = profesional_actual()))));

create policy "clinica_citas_update" on public.clinica_citas
  for update
  to authenticated
  using ((rol_operativo_actual() = ANY (ARRAY['direccion'::rol_operativo, 'coordinacion'::rol_operativo, 'recepcion'::rol_operativo])))
  with check ((rol_operativo_actual() = ANY (ARRAY['direccion'::rol_operativo, 'coordinacion'::rol_operativo, 'recepcion'::rol_operativo])));

create policy "clinica_clientes_auth_all" on public.clinica_clientes
  for all
  to authenticated
  using (true)
  with check (true);

create policy "clinica_disp_excep_auth_all" on public.clinica_disponibilidad_excepcional
  for all
  to authenticated
  using (true)
  with check (true);

create policy "clinica_horarios_auth_all" on public.clinica_horarios_profesional
  for all
  to authenticated
  using (true)
  with check (true);

create policy "clinica_productos_auth_all" on public.clinica_productos
  for all
  to authenticated
  using (true)
  with check (true);

create policy "clinica_prof_serv_auth_all" on public.clinica_profesional_servicios
  for all
  to authenticated
  using (true)
  with check (true);

create policy "clinica_profesionales_auth_all" on public.clinica_profesionales
  for all
  to authenticated
  using (true)
  with check (true);

create policy "clinica_recursos_auth_all" on public.clinica_recursos
  for all
  to authenticated
  using (true)
  with check (true);

create policy "clinica_servicios_auth_all" on public.clinica_servicios
  for all
  to authenticated
  using (true)
  with check (true);

create policy "clinica_ubicaciones_auth_all" on public.clinica_ubicaciones
  for all
  to authenticated
  using (true)
  with check (true);

create policy "clinica_usuarios_auth_all" on public.clinica_usuarios
  for all
  to authenticated
  using (true)
  with check (true);

create policy "cobros_select" on public.cobros
  for select
  to authenticated
  using ((rol_operativo_actual() = ANY (ARRAY['direccion'::rol_operativo, 'coordinacion'::rol_operativo, 'recepcion'::rol_operativo])));

create policy "configuracion_contabilidad_auth_all" on public.configuracion_contabilidad
  for all
  to authenticated
  using (true)
  with check (true);

create policy "consumos_bono_select" on public.consumos_bono
  for select
  to authenticated
  using (((rol_operativo_actual() = ANY (ARRAY['direccion'::rol_operativo, 'coordinacion'::rol_operativo, 'recepcion'::rol_operativo])) OR ((rol_operativo_actual() = 'profesional'::rol_operativo) AND (profesional_id = profesional_actual()))));

create policy "contactos_auth_all" on public.contactos
  for all
  to authenticated
  using (true)
  with check (true);

create policy "cuenta_tesoreria_auth_all" on public.cuenta_tesoreria
  for all
  to authenticated
  using (true)
  with check (true);

create policy "cuentas_bancarias_sociedad_auth_all" on public.cuentas_bancarias_sociedad
  for all
  to authenticated
  using (true)
  with check (true);

create policy "cuentas_por_cobrar_insert" on public.cuentas_por_cobrar
  for insert
  to authenticated
  with check (true);

create policy "cuentas_por_cobrar_select" on public.cuentas_por_cobrar
  for select
  to authenticated
  using (true);

create policy "cuentas_por_cobrar_update" on public.cuentas_por_cobrar
  for update
  to authenticated
  using (true);

create policy "devoluciones_bono_select" on public.devoluciones_bono
  for select
  to authenticated
  using ((rol_operativo_actual() = ANY (ARRAY['direccion'::rol_operativo, 'coordinacion'::rol_operativo, 'recepcion'::rol_operativo])));

create policy "evidencias_liq_admin" on public.evidencias_liquidacion
  for all
  to authenticated
  using (es_direccion())
  with check (es_direccion());

create policy "evidencias_liq_select" on public.evidencias_liquidacion
  for select
  to authenticated
  using ((EXISTS ( SELECT 1
   FROM liquidaciones_mensuales l
  WHERE ((l.id = evidencias_liquidacion.liquidacion_id) AND (es_direccion() OR ((rol_operativo_actual() = 'profesional'::rol_operativo) AND (l.profesional_id = profesional_actual())))))));

create policy "extractos_bancarios_auth_all" on public.extractos_bancarios
  for all
  to authenticated
  using (true)
  with check (true);

create policy "factura_aprobaciones_select" on public.factura_aprobaciones
  for select
  to authenticated
  using (true);

create policy "factura_incidencias_select" on public.factura_incidencias
  for select
  to authenticated
  using (true);

create policy "factura_pagos_select" on public.factura_pagos
  for select
  to authenticated
  using (true);

create policy "facturas_emitidas_auth_all" on public.facturas_emitidas
  for all
  to authenticated
  using (true)
  with check (true);

create policy "fe_operativas_insert" on public.facturas_emitidas_operativas
  for insert
  to authenticated
  with check ((rol_operativo_actual() = ANY (ARRAY['direccion'::rol_operativo, 'coordinacion'::rol_operativo, 'recepcion'::rol_operativo])));

create policy "fe_operativas_select" on public.facturas_emitidas_operativas
  for select
  to authenticated
  using ((rol_operativo_actual() = ANY (ARRAY['direccion'::rol_operativo, 'coordinacion'::rol_operativo, 'recepcion'::rol_operativo])));

create policy "fe_operativas_update" on public.facturas_emitidas_operativas
  for update
  to authenticated
  using ((rol_operativo_actual() = ANY (ARRAY['direccion'::rol_operativo, 'coordinacion'::rol_operativo])))
  with check ((rol_operativo_actual() = ANY (ARRAY['direccion'::rol_operativo, 'coordinacion'::rol_operativo])));

create policy "facturas_recibidas_auth_all" on public.facturas_recibidas
  for all
  to authenticated
  using (true)
  with check (true);

create policy "flujos_caja_proyectos_auth_all" on public.flujos_caja_proyectos
  for all
  to authenticated
  using (true)
  with check (true);

create policy "gastos_operativos_insert" on public.gastos_operativos
  for insert
  to authenticated
  with check ((es_direccion() OR ((rol_operativo_actual() = 'coordinacion'::rol_operativo) AND (categoria_de_gasto(tipo) <> 'nominas_laboral'::categoria_gasto))));

create policy "gastos_operativos_select" on public.gastos_operativos
  for select
  to authenticated
  using ((es_direccion() OR ((rol_operativo_actual() = 'coordinacion'::rol_operativo) AND (categoria_de_gasto(tipo) <> 'nominas_laboral'::categoria_gasto))));

create policy "gastos_operativos_update" on public.gastos_operativos
  for update
  to authenticated
  using ((es_direccion() OR ((rol_operativo_actual() = 'coordinacion'::rol_operativo) AND (categoria_de_gasto(tipo) <> 'nominas_laboral'::categoria_gasto))))
  with check ((es_direccion() OR ((rol_operativo_actual() = 'coordinacion'::rol_operativo) AND (categoria_de_gasto(tipo) <> 'nominas_laboral'::categoria_gasto))));

create policy "ingresos_devengados_select" on public.ingresos_devengados
  for select
  to authenticated
  using ((rol_operativo_actual() = ANY (ARRAY['direccion'::rol_operativo, 'coordinacion'::rol_operativo])));

create policy "kpis_sociedades_auth_all" on public.kpis_sociedades
  for all
  to authenticated
  using (true)
  with check (true);

create policy "lineas_liq_admin" on public.lineas_liquidacion
  for all
  to authenticated
  using (es_direccion())
  with check (es_direccion());

create policy "lineas_liq_select" on public.lineas_liquidacion
  for select
  to authenticated
  using ((EXISTS ( SELECT 1
   FROM liquidaciones_mensuales l
  WHERE ((l.id = lineas_liquidacion.liquidacion_id) AND (es_direccion() OR ((rol_operativo_actual() = 'profesional'::rol_operativo) AND (l.profesional_id = profesional_actual())))))));

create policy "liquidaciones_admin" on public.liquidaciones_mensuales
  for all
  to authenticated
  using (es_direccion())
  with check (es_direccion());

create policy "liquidaciones_select" on public.liquidaciones_mensuales
  for select
  to authenticated
  using ((es_direccion() OR ((rol_operativo_actual() = 'profesional'::rol_operativo) AND (profesional_id = profesional_actual()))));

create policy "movimiento_caja_select" on public.movimiento_caja
  for select
  to authenticated
  using (true);

create policy "movimientos_bancarios_auth_all" on public.movimientos_bancarios
  for all
  to authenticated
  using (true)
  with check (true);

create policy "pagos_liq_select" on public.pagos_liquidacion
  for select
  to authenticated
  using ((EXISTS ( SELECT 1
   FROM liquidaciones_mensuales l
  WHERE ((l.id = pagos_liquidacion.liquidacion_id) AND (es_direccion() OR ((rol_operativo_actual() = 'profesional'::rol_operativo) AND (l.profesional_id = profesional_actual())))))));

create policy "perfiles_operativos_admin" on public.perfiles_operativos
  for all
  to authenticated
  using (es_direccion())
  with check (es_direccion());

create policy "perfiles_operativos_select" on public.perfiles_operativos
  for select
  to authenticated
  using ((es_direccion() OR (auth_user_id = auth.uid())));

create policy "plan_cuentas_auth_all" on public.plan_cuentas
  for all
  to authenticated
  using (true)
  with check (true);

create policy "presupuesto_capitulos_auth_all" on public.presupuesto_capitulos
  for all
  to authenticated
  using (true)
  with check (true);

create policy "presupuesto_pagos_auth_all" on public.presupuesto_pagos
  for all
  to authenticated
  using (true)
  with check (true);

create policy "presupuesto_partidas_auth_all" on public.presupuesto_partidas
  for all
  to authenticated
  using (true)
  with check (true);

create policy "presupuestos_auth_all" on public.presupuestos
  for all
  to authenticated
  using (true)
  with check (true);

create policy "proveedores_reglas_auth_all" on public.proveedores_reglas
  for all
  to authenticated
  using (true)
  with check (true);

create policy "proyectos_auth_all" on public.proyectos
  for all
  to authenticated
  using (true)
  with check (true);

create policy "reconciliacion_log_auth_all" on public.reconciliacion_log
  for all
  to authenticated
  using (true)
  with check (true);

create policy "reglas_categorizacion_auth_all" on public.reglas_categorizacion
  for all
  to authenticated
  using (true)
  with check (true);

create policy "reglas_liq_admin" on public.reglas_liquidacion_profesional
  for all
  to authenticated
  using (es_direccion())
  with check (es_direccion());

create policy "reglas_liq_select" on public.reglas_liquidacion_profesional
  for select
  to authenticated
  using ((es_direccion() OR ((rol_operativo_actual() = 'profesional'::rol_operativo) AND (profesional_id = profesional_actual()))));

create policy "sociedades_auth_all" on public.sociedades
  for all
  to authenticated
  using (true)
  with check (true);

create policy "vencimientos_auth_all" on public.vencimientos
  for all
  to authenticated
  using (true)
  with check (true);

create policy "ventas_bono_select" on public.ventas_bono
  for select
  to authenticated
  using ((rol_operativo_actual() = ANY (ARRAY['direccion'::rol_operativo, 'coordinacion'::rol_operativo, 'recepcion'::rol_operativo])));

create policy "ventas_bono_update" on public.ventas_bono
  for update
  to authenticated
  using ((rol_operativo_actual() = ANY (ARRAY['direccion'::rol_operativo, 'coordinacion'::rol_operativo, 'recepcion'::rol_operativo])))
  with check ((rol_operativo_actual() = ANY (ARRAY['direccion'::rol_operativo, 'coordinacion'::rol_operativo, 'recepcion'::rol_operativo])));

create policy "ventas_bono_write" on public.ventas_bono
  for insert
  to authenticated
  with check ((rol_operativo_actual() = ANY (ARRAY['direccion'::rol_operativo, 'coordinacion'::rol_operativo, 'recepcion'::rol_operativo])));

-- ═══════════════════════════════════════════════════════════════════════════
-- §9. COMENTARIOS (17 de tabla · 7 de columna)
-- ═══════════════════════════════════════════════════════════════════════════
comment on table public.ajustes_liquidacion is 'Ajuste manual APPEND-ONLY: nunca edita el cálculo, se SUMA con motivo y autor obligatorios (doc 08 §4.6). Deshacer un ajuste = ajuste nuevo de signo contrario.';
comment on table public.caducidades_bono is 'Al vencer una venta con saldo, el remanente se reconoce como ingreso_por_caducidad, SIEMPRE pendiente_criterio_fiscal = true (B3-P1). El CHECK impide marcarlo resuelto: cuando gestoría fije criterio, se modelará como hecho nuevo, no editando este.';
comment on table public.canales is 'Canales de captación (doc 09). Sustituye el texto libre clinica_clientes.procedencia como dimensión analítica; procedencia se conserva como nota histórica. FK desde citas, ventas_bono e ingresos_devengados. Dimensión clave del margen por canal.';
comment on table public.clinica_citas is 'Cita ADMINISTRATIVA (agenda + facturable), cero contenido clínico. Ciclo liquidable literal del TS: realizada→validada→liquidada (doc 08 §3.4); solo las validadas cuentan para liquidar. Cancelar/no-show es un ESTADO, nunca un DELETE (sin política de borrado). El vínculo con un bono NO vive aquí: lo registra consumos_bono (venta×cita). R3: liquidacion_id (§13) — una sesión pertenece a UNA única liquidación.';
comment on table public.cobros is 'Libro APPEND-ONLY de cobros operativos (cliente: solo SELECT; escritura por RPC security definer). ANTI-DOBLE-CONTEO (doc 15 §7): el dinero de un bono entra UNA vez, por la venta; la sesión de bono devenga pero NO vuelve a cobrar. Cobrado ≠ devengado: este libro es CAJA. No existe columna de saldo ni de pendiente: derivados (vistas de tesorería A1 y CxC doc 11).';
comment on table public.consumos_bono is 'Libro APPEND-ONLY de eventos de sesión de bono. Efecto económico por tipo (tabla doc 10 §5, espejo de efectoSesion()): consumida → consume unidad + devenga + coste profesional; no_show_cobrado → consume + devenga, SIN coste profesional (B3-P2/B3-P6); cortesia → solo coste profesional; reservada/no_show_no_cobrado/cancelada_a_tiempo/pendiente_regularizar → neutras. Correcciones = eventos nuevos, nunca UPDATE/DELETE.';
comment on table public.devoluciones_bono is 'Devolución de unidades NO consumidas, a devengo unitario (doc 10 §6.7). Nunca toca devengos ya registrados. La salida de dinero se registra en tesorería (A1), no como cobro negativo.';
comment on table public.evidencias_liquidacion is 'Documento justificante exigido por liquidación: nómina (relacion nomina/nomina_compartida) o factura de autónomo (doc 08 §3.5-3.6). R2: SIN DOCUMENTO NO SE VALIDA — recibida=false impide el paso a validada (lo exige la RPC de avance, nunca un flag manual en la cabecera). La coherencia tipo↔relacion del profesional se valida en la RPC.';
comment on table public.facturas_emitidas_operativas is 'Registro PRECONTABLE de facturación emitida (doc 02, mundo NO fiscal): la emisión OFICIAL está delegada (D1) y se referencia con ref_factura_externa. Factura emitida ≠ cobro: solo suma a caja en estado cobrada, y el dinero real vive en el libro cobros. SUSTITUYE para el MVP a facturas_emitidas del baseline (reservada a la fase oficial/VeriFactu) — ver §4.6. Sin IVA desglosado a propósito: decisión D2 "Clínica sin IVA provisional" (catálogo exento).';
comment on table public.gastos_operativos is 'Gasto operativo con tipo (20 valores, taxonomía A–D) y capa de imputación al margen (doc 09 §4.2). REGLA DURA: sin documento requerido y recibido, un gasto está CALCULADO pero NUNCA validado para pago. Columnas que NO existen A PROPÓSITO: estado_validacion (derivado del documento: no_requerido→validado; recibido→validado; resto→bloqueado_sin_documento — espejo de estadoValidacion() del TS) y categoria (derivada: categoria_de_gasto(tipo)). pendiente_confirmacion no rompe cálculos: marca el resultado como provisional.';
comment on table public.ingresos_devengados is 'Libro APPEND-ONLY de devengo (DevengoRegistrado + IngresoOperativo del TS). El devengo lo dispara la sesión consumida, NUNCA la venta (doc 10 §6.1), y se calcula sobre lo COBRADO. origen_devengo separa prestación de ingreso_por_caducidad (doc 10 §6.6). Columna que NO existe A PROPÓSITO: importe_cobrado — la caja vive en el libro cobros; devengo y caja jamás se suman (doc 09 §4.4). El pendiente de cobro es DERIVADO (CxC, doc 11), nunca almacenado.';
comment on table public.lineas_liquidacion is 'Desglose del importe_calculado por regla aplicada (LineaLiquidacion del TS). Se regenera entero al recalcular mientras el estado lo permite; una vez validada, es inmutable.';
comment on table public.liquidaciones_mensuales is 'Liquidación persona × mes (doc 08). Ciclo: pendiente_calculo→calculada→pendiente_documento→validada→pendiente_pago→pagada→revisada; bloqueada_por_incidencia es transversal y no avanza. R2: sin evidencia recibida NO pasa a validada. Solo cuentan sesiones en estado validada. Columna que NO existe A PROPÓSITO: importe_final = importe_calculado + Σ ajustes (DERIVADO, vista v_liquidaciones_totales); pagada exige Σ pagos ≥ importe final. Entre validada y pagada la liquidación ES la CxP viva (doc 11 §5) — tampoco se almacena: se deriva.';
comment on table public.pagos_liquidacion is 'Pagos APPEND-ONLY de una liquidación. Solo dinero real aplicado produce pagada (doc 11 §7): la RPC marca pagada cuando Σ pagos ≥ importe final derivado. Pagos parciales = varias filas.';
comment on table public.perfiles_operativos is 'Mapa auth→rol operativo (direccion/coordinacion/recepcion/profesional). Fuente única para RLS. Sin fila activa aquí, un usuario autenticado NO ve nada: el primer perfil direccion se inserta con service role tras el APPLY (nunca datos reales en seeds).';
comment on table public.reglas_liquidacion_profesional is 'Reglas de liquidación por profesional (doc 08 §4): nomina_fija, nomina_compartida, por_sesion, mensual_por_plan, pendiente_regularizar, ajuste_manual (esta última nunca como regla base: los ajustes entran por ajustes_liquidacion). bonus_descuento queda reservado, fuera de B1. Una regla sin confirmar deja la liquidación en requiere_revision_ceo (R4).';
comment on table public.ventas_bono is 'Venta de bono/programa (doc 10 §4, 10 estados). Invariante V1: devengado + pendiente + devuelto + caducado = importe_cobrado. Columnas que NO existen A PROPÓSITO: saldo_unidades, unidades_consumidas, devengado, pendiente_de_devengar, devengo_unitario — todas DERIVADAS de los libros de hechos (vista v_resumen_ventas_bono, §14). El devengo lo dispara la SESIÓN consumida, nunca la venta (doc 10 §6.1). "vencido" se deriva de la fecha, jamás es un flag.';
comment on column public.clinica_citas.liquidacion_id is 'R3: la cita (sesión) queda anclada a UNA única liquidación al incluirse en el cálculo. NULL = aún no liquidada. La RPC de cálculo la asigna; nunca se reasigna sin deshacer antes.';
comment on column public.clinica_clientes.external_clinical_record_id is 'ÚNICO puente permitido con el sistema clínico externo: un identificador opaco de referencia. LÍNEA ROJA (D-op-5): en ninguna tabla, columna, nota ni JSON de Antifrágil OS entran diagnósticos, lesiones, evolución, medicación, antecedentes ni informes. La historia clínica vive FUERA. notas_admin es administrativa; si aparece algo clínico, es fuera de alcance.';
comment on column public.clinica_productos.caducidad_meses is 'Meses de vigencia por defecto de un bono/programa desde la venta (ProductoCatalogo.caducidadMeses). NULL = sin caducidad. El vencimiento efectivo se congela en ventas_bono.vencimiento.';
comment on column public.clinica_profesionales.relacion is 'Relación con Antifrágil (doc 08 §3.2). pendiente_regularizar NO esconde: la liquidación se calcula igual (la deuda aflora) pero queda bloqueada_por_incidencia (R4, doc 08 §4.5). Determina la evidencia exigible: nómina (nomina/nomina_compartida) o factura de autónomo.';
comment on column public.clinica_ubicaciones.tipo_acuerdo is 'Acuerdo económico del centro (propio/cesion/porcentaje/renta). pendiente_confirmar marca el margen M3 del centro como INCOMPLETO (B2-P3): bloquea la lectura fiable, no el cálculo.';
comment on column public.facturas_recibidas.gasto_operativo_id is 'Gasto operativo al que esta factura da soporte documental (FacturaRecibida.gastoId del TS). La factura recibida NO es el gasto: nóminas, SS y tickets no son facturas.';
comment on column public.facturas_recibidas.liquidacion_id is 'Liquidación de autónomo a la que esta factura da soporte (FacturaRecibida.liquidacionRef).';
