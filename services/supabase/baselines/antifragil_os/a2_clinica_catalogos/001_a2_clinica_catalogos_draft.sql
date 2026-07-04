-- ═══════════════════════════════════════════════════════════════════════════
-- ANTIFRÁGIL OS — A2 CLÍNICA · CATÁLOGOS / DATOS MAESTROS  (BORRADOR — NO APLICAR)
-- ═══════════════════════════════════════════════════════════════════════════
-- Se aplica ENCIMA del baseline (00000000000000_baseline_antifragil_os.sql),
-- una vez aplicado y verificado. NO es una migración de services/supabase/migrations/.
-- Origen: borrador retirado del PR #2 (commit d08058d), curado para el canal DB.
--
-- Qué añade A2:
--   · usuarios de clínica (mapa auth → rol) · ubicaciones · recursos/salas
--   · profesionales · servicios · profesional↔servicio (M:N)
--   · productos/tarifas (catálogo público vs interno)
--   · clientes ADMINISTRATIVOS (contacto + condición tarifaria + RGPD)
--   · disponibilidad: horario base · excepciones · bloqueos de agenda
--   · seed mínimo: ubicación "Clínica Antifrágil Playamar" (sin más datos)
--
-- LÍNEA ROJA (compliance v1): SOLO datos administrativos. La historia clínica
-- NO vive en Antifrágil OS (ni diagnóstico, ni lesión, ni evolución, ni notas
-- clínicas): queda en el sistema clínico externo. Como mucho, en el futuro, un
-- ID/enlace externo controlado. clinica_clientes es ficha ADMINISTRATIVA.
--
-- Decisiones (ver MODEL_DECISIONS.md y docs/reservas/05-decision-esquema-datos-clinica.md):
--   · esquema public + prefijo `clinica_` (no esquema aparte) · español snake_case
--   · PK uuid · dinero numeric(14,2) · enums por CHECK · RLS en TODAS las tablas
--     (v1 permisiva interna; el acceso público irá por RPC SECURITY DEFINER en Fase 2)
--   · fisioterapia incluye lo deportivo (una sola categoría)
-- Reutiliza del baseline: touch_updated_at(), sociedades (FK a id_ref).
-- Contrato TS: packages/types/src/clinica.ts (PR #2).
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- §1. USUARIOS Y ESTRUCTURA FÍSICA
-- ═══════════════════════════════════════════════════════════════════════════

-- 1.1 clinica_usuarios — mapa auth → rol (deriva el actor para RLS y RPC)
create table if not exists public.clinica_usuarios (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid,                 -- auth.users.id (null hasta enlazar)
  email           text,
  rol             text not null default 'viewer'
                  check (rol in ('admin','profesional','recepcion','viewer','cliente')),
  profesional_id  uuid,                 -- FK diferida a clinica_profesionales (§1.4)
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists clinica_usuarios_auth_idx  on public.clinica_usuarios(auth_user_id);
create index if not exists clinica_usuarios_email_idx on public.clinica_usuarios(email);

-- 1.2 clinica_ubicaciones — sedes (multi-sede preparado, hoy 1)
create table if not exists public.clinica_ubicaciones (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  direccion       text,
  sociedad_id_ref text references public.sociedades(id_ref) on delete set null,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists clinica_ubicaciones_sociedad_nombre_uniq
  on public.clinica_ubicaciones (sociedad_id_ref, nombre);

-- 1.3 clinica_recursos — salas/consultas (el anti-solape de sala llega en Fase 2)
create table if not exists public.clinica_recursos (
  id              uuid primary key default gen_random_uuid(),
  ubicacion_id    uuid references public.clinica_ubicaciones(id) on delete set null,
  nombre          text not null,
  capacidad       int not null default 1,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists clinica_recursos_ubicacion_idx on public.clinica_recursos(ubicacion_id);

-- 1.4 clinica_profesionales — modo_agenda por profesional (override por servicio)
create table if not exists public.clinica_profesionales (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  titulo          text,                 -- "Fisioterapeuta", "Nutricionista"...
  tipo            text not null default 'fisioterapeuta'
                  check (tipo in ('fisioterapeuta','entrenador','nutricionista','otro')),
  email           text,
  telefono        text,
  color           text,                 -- acento visual en la agenda
  auth_user_id    uuid,
  modo_agenda     text not null default 'huecos_abiertos'
                  check (modo_agenda in ('huecos_abiertos','bajo_demanda')),
  prioridad       int not null default 100,  -- orden para la asignación automática
  sociedad_id_ref text references public.sociedades(id_ref) on delete set null,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- FK diferida usuarios → profesionales (ya existen ambas tablas)
do $$ begin
  alter table public.clinica_usuarios
    add constraint clinica_usuarios_profesional_fk
    foreign key (profesional_id) references public.clinica_profesionales(id) on delete set null;
exception when duplicate_object then null; end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- §2. CATÁLOGO DE SERVICIOS Y PRODUCTOS
-- ═══════════════════════════════════════════════════════════════════════════

-- 2.1 clinica_servicios — áreas de servicio. Fisioterapia incluye lo deportivo
--     (NO se separa). recurso_requerido decide si el anti-solape de sala aplica.
create table if not exists public.clinica_servicios (
  id                     uuid primary key default gen_random_uuid(),
  nombre                 text not null,
  categoria              text not null
                         check (categoria in ('fisioterapia','nutricion','entrenamiento_personal')),
  duracion_minutos       int not null default 45,
  buffer_antes_minutos   int not null default 0,
  buffer_despues_minutos int not null default 0,
  recurso_requerido      text not null default 'opcional'
                         check (recurso_requerido in ('obligatorio','opcional','ninguno')),
  modo_agenda            text                 -- override opcional del profesional
                         check (modo_agenda in ('huecos_abiertos','bajo_demanda')),
  color                  text,
  sociedad_id_ref        text references public.sociedades(id_ref) on delete set null,
  activo                 boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- 2.2 clinica_profesional_servicios — M:N (qué puede dar cada profesional)
create table if not exists public.clinica_profesional_servicios (
  profesional_id  uuid not null references public.clinica_profesionales(id) on delete cascade,
  servicio_id     uuid not null references public.clinica_servicios(id) on delete cascade,
  primary key (profesional_id, servicio_id)
);
create index if not exists clinica_prof_serv_servicio_idx
  on public.clinica_profesional_servicios(servicio_id);

-- 2.3 clinica_productos — tarifas. Catálogo público (reserva online) vs interno
--     (Founder/VIP/UG no se ofrecen online). exento_iva: default sanitario exento
--     (decisión provisional "Clínica sin IVA", ver docs de finanzas).
create table if not exists public.clinica_productos (
  id                          uuid primary key default gen_random_uuid(),
  nombre                      text not null,
  servicio_id                 uuid references public.clinica_servicios(id) on delete set null,
  tipo_producto               text not null default 'sesion_suelta'
                              check (tipo_producto in ('sesion_suelta','bono_sesiones','programa',
                                'seguimiento','valoracion','mensualidad','tarifa_especial','sesion_extra')),
  duracion_estandar_minutos   int,
  precio                      numeric(14,2) not null default 0,
  sesiones_incluidas          int,
  condicion_especial          text not null default 'estandar'
                              check (condicion_especial in ('estandar','founder','vip','ug','especial')),
  exento_iva                  boolean not null default true,
  tipo_operacion              text,
  -- Gobierno del catálogo público (reserva online)
  visible_en_reserva_publica  boolean not null default true,
  requiere_asignacion_manual  boolean not null default false,
  solo_uso_interno            boolean not null default false,
  requiere_confirmacion       boolean not null default false,
  activo                      boolean not null default true,
  notas_internas              text,
  sociedad_id_ref             text references public.sociedades(id_ref) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index if not exists clinica_productos_servicio_idx on public.clinica_productos(servicio_id);
create index if not exists clinica_productos_publico_idx
  on public.clinica_productos(visible_en_reserva_publica) where activo;


-- ═══════════════════════════════════════════════════════════════════════════
-- §3. CLIENTES (FICHA ADMINISTRATIVA — NADA CLÍNICO)
-- ═══════════════════════════════════════════════════════════════════════════

-- 3.1 clinica_clientes — contacto, condición tarifaria y consentimiento RGPD.
--     COMPLIANCE: aquí NO va contenido clínico de ningún tipo. La historia
--     clínica vive FUERA de Antifrágil OS (sistema clínico externo); como mucho,
--     en el futuro, un ID/enlace externo controlado (no en A2).
--     auth_user_id enlaza el portal "Mis citas" (null = invitado).
create table if not exists public.clinica_clientes (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  apellidos             text,
  telefono              text,
  email                 text,
  dni_nie               text,
  fecha_nacimiento      date,
  direccion             text,
  procedencia           text,           -- canal de captación (derivador, web, boca-oreja)
  condicion             text not null default 'estandar'
                        check (condicion in ('estandar','founder','vip','ug','especial_manual')),
  consentimiento_rgpd   boolean not null default false,
  consentimiento_fecha  timestamptz,
  notas_admin           text,           -- notas ADMINISTRATIVAS (nunca clínicas)
  auth_user_id          uuid,           -- cliente registrado (portal); null si invitado
  sociedad_id_ref       text references public.sociedades(id_ref) on delete set null,
  activo                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists clinica_clientes_email_idx on public.clinica_clientes(email);
create index if not exists clinica_clientes_auth_idx  on public.clinica_clientes(auth_user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- §4. DISPONIBILIDAD
-- ═══════════════════════════════════════════════════════════════════════════

-- 4.1 clinica_horarios_profesional — horario base recurrente
create table if not exists public.clinica_horarios_profesional (
  id              uuid primary key default gen_random_uuid(),
  profesional_id  uuid not null references public.clinica_profesionales(id) on delete cascade,
  dia_semana      int not null check (dia_semana between 0 and 6),  -- 0=domingo … 6=sábado
  hora_inicio     time not null,
  hora_fin        time not null,
  recurrencia     text not null default 'semanal',
  valido_desde    date,
  valido_hasta    date,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (hora_fin > hora_inicio)
);
create index if not exists clinica_horarios_prof_idx
  on public.clinica_horarios_profesional(profesional_id, dia_semana);

-- 4.2 clinica_disponibilidad_excepcional — abre/cierra un día concreto
create table if not exists public.clinica_disponibilidad_excepcional (
  id              uuid primary key default gen_random_uuid(),
  profesional_id  uuid not null references public.clinica_profesionales(id) on delete cascade,
  fecha           date not null,
  hora_inicio     time not null,
  hora_fin        time not null,
  tipo            text not null check (tipo in ('abre','cierra')),
  motivo          text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (hora_fin > hora_inicio)
);
create index if not exists clinica_disp_excep_idx
  on public.clinica_disponibilidad_excepcional(profesional_id, fecha);

-- 4.3 clinica_bloqueos_agenda — vacaciones, reuniones, comida, formación, baja…
create table if not exists public.clinica_bloqueos_agenda (
  id              uuid primary key default gen_random_uuid(),
  profesional_id  uuid references public.clinica_profesionales(id) on delete cascade, -- null = global
  inicio          timestamptz not null,
  fin             timestamptz not null,
  tipo            text not null default 'otro'
                  check (tipo in ('vacaciones','reunion','comida','formacion','baja','otro')),
  motivo          text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (fin > inicio)
);
create index if not exists clinica_bloqueos_prof_idx
  on public.clinica_bloqueos_agenda(profesional_id, inicio);


-- ═══════════════════════════════════════════════════════════════════════════
-- §5. TRIGGERS updated_at  (reutiliza touch_updated_at() del baseline)
-- ═══════════════════════════════════════════════════════════════════════════
-- clinica_profesional_servicios no lleva updated_at (tabla puente sin estado).
drop trigger if exists touch_clinica_usuarios on public.clinica_usuarios;
create trigger touch_clinica_usuarios before update on public.clinica_usuarios
  for each row execute function public.touch_updated_at();
drop trigger if exists touch_clinica_ubicaciones on public.clinica_ubicaciones;
create trigger touch_clinica_ubicaciones before update on public.clinica_ubicaciones
  for each row execute function public.touch_updated_at();
drop trigger if exists touch_clinica_recursos on public.clinica_recursos;
create trigger touch_clinica_recursos before update on public.clinica_recursos
  for each row execute function public.touch_updated_at();
drop trigger if exists touch_clinica_profesionales on public.clinica_profesionales;
create trigger touch_clinica_profesionales before update on public.clinica_profesionales
  for each row execute function public.touch_updated_at();
drop trigger if exists touch_clinica_servicios on public.clinica_servicios;
create trigger touch_clinica_servicios before update on public.clinica_servicios
  for each row execute function public.touch_updated_at();
drop trigger if exists touch_clinica_productos on public.clinica_productos;
create trigger touch_clinica_productos before update on public.clinica_productos
  for each row execute function public.touch_updated_at();
drop trigger if exists touch_clinica_clientes on public.clinica_clientes;
create trigger touch_clinica_clientes before update on public.clinica_clientes
  for each row execute function public.touch_updated_at();
drop trigger if exists touch_clinica_horarios on public.clinica_horarios_profesional;
create trigger touch_clinica_horarios before update on public.clinica_horarios_profesional
  for each row execute function public.touch_updated_at();
drop trigger if exists touch_clinica_disp_excep on public.clinica_disponibilidad_excepcional;
create trigger touch_clinica_disp_excep before update on public.clinica_disponibilidad_excepcional
  for each row execute function public.touch_updated_at();
drop trigger if exists touch_clinica_bloqueos on public.clinica_bloqueos_agenda;
create trigger touch_clinica_bloqueos before update on public.clinica_bloqueos_agenda
  for each row execute function public.touch_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- §6. RLS  (anon sin acceso; v1 permisiva interna para authenticated)
-- ═══════════════════════════════════════════════════════════════════════════
-- El acceso del rol 'cliente' y el flujo público de reserva llegan en Fase 2
-- vía RPC SECURITY DEFINER; entonces se endurecerán estas políticas por rol.
alter table public.clinica_usuarios enable row level security;
drop policy if exists clinica_usuarios_auth_all on public.clinica_usuarios;
create policy clinica_usuarios_auth_all on public.clinica_usuarios
  for all to authenticated using (true) with check (true);

alter table public.clinica_ubicaciones enable row level security;
drop policy if exists clinica_ubicaciones_auth_all on public.clinica_ubicaciones;
create policy clinica_ubicaciones_auth_all on public.clinica_ubicaciones
  for all to authenticated using (true) with check (true);

alter table public.clinica_recursos enable row level security;
drop policy if exists clinica_recursos_auth_all on public.clinica_recursos;
create policy clinica_recursos_auth_all on public.clinica_recursos
  for all to authenticated using (true) with check (true);

alter table public.clinica_profesionales enable row level security;
drop policy if exists clinica_profesionales_auth_all on public.clinica_profesionales;
create policy clinica_profesionales_auth_all on public.clinica_profesionales
  for all to authenticated using (true) with check (true);

alter table public.clinica_servicios enable row level security;
drop policy if exists clinica_servicios_auth_all on public.clinica_servicios;
create policy clinica_servicios_auth_all on public.clinica_servicios
  for all to authenticated using (true) with check (true);

alter table public.clinica_profesional_servicios enable row level security;
drop policy if exists clinica_prof_serv_auth_all on public.clinica_profesional_servicios;
create policy clinica_prof_serv_auth_all on public.clinica_profesional_servicios
  for all to authenticated using (true) with check (true);

alter table public.clinica_productos enable row level security;
drop policy if exists clinica_productos_auth_all on public.clinica_productos;
create policy clinica_productos_auth_all on public.clinica_productos
  for all to authenticated using (true) with check (true);

alter table public.clinica_clientes enable row level security;
drop policy if exists clinica_clientes_auth_all on public.clinica_clientes;
create policy clinica_clientes_auth_all on public.clinica_clientes
  for all to authenticated using (true) with check (true);

alter table public.clinica_horarios_profesional enable row level security;
drop policy if exists clinica_horarios_auth_all on public.clinica_horarios_profesional;
create policy clinica_horarios_auth_all on public.clinica_horarios_profesional
  for all to authenticated using (true) with check (true);

alter table public.clinica_disponibilidad_excepcional enable row level security;
drop policy if exists clinica_disp_excep_auth_all on public.clinica_disponibilidad_excepcional;
create policy clinica_disp_excep_auth_all on public.clinica_disponibilidad_excepcional
  for all to authenticated using (true) with check (true);

alter table public.clinica_bloqueos_agenda enable row level security;
drop policy if exists clinica_bloqueos_auth_all on public.clinica_bloqueos_agenda;
create policy clinica_bloqueos_auth_all on public.clinica_bloqueos_agenda
  for all to authenticated using (true) with check (true);


-- ═══════════════════════════════════════════════════════════════════════════
-- §7. SEED MÍNIMO — Ubicación "Clínica Antifrágil Playamar" (sin más datos)
-- ═══════════════════════════════════════════════════════════════════════════
insert into public.clinica_ubicaciones (nombre, direccion, sociedad_id_ref, activo)
values ('Clínica Antifrágil Playamar', null, 'ANT', true)
on conflict (sociedad_id_ref, nombre) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN A2 — revisar antes de aplicar. Ver README.md y APPLY_A2_RUNBOOK.md
-- FASE 2 (fuera de A2): clinica_citas + snapshots + estados, auditoría de
-- cambios, pagos operativos de cita (enlazarán con tesorería/caja de A1),
-- bonos (cliente_productos), anti-solape (EXCLUDE/btree_gist) y RPC
-- SECURITY DEFINER (crear/reprogramar/cancelar/completar + reserva pública).
-- ═══════════════════════════════════════════════════════════════════════════
