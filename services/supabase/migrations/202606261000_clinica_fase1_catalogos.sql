-- ═══════════════════════════════════════════════════════════════════════════
-- CLÍNICA · FASE 1 — Catálogos / datos maestros (2026-06-26)
--
-- Cimientos de datos del módulo Reservas/Clínica. Tablas maestras sobre las que
-- se apoyará la cita (Fase 2). Sigue las convenciones del repo:
--   · esquema public con prefijo de módulo `clinica_` (no esquema aparte: encaja
--     con el sbHeaders/req existente, igual que presupuesto_*/factura_*).
--   · español snake_case · PK uuid · dinero numeric(14,2) · enums por CHECK
--     (no CREATE TYPE) · created_at/updated_at timestamptz · RLS en TODAS las
--     tablas (v1 permisiva interna; el acceso público irá por RPC SECURITY DEFINER).
--   · multi-sociedad/proyecto vía *_id_ref TEXT (acople laxo con lo canónico).
--
-- DECISIONES aplicadas (resuelven D1 del doc 00 y la notación clinica.X de 02/03):
--   D1 → español. Esquema → public + prefijo clinica_. Fisioterapia y "fisio
--   deportiva" = el MISMO servicio (no se separan en categorías).
--   Justificación del esquema: ver docs/reservas/05-decision-esquema-datos-clinica.md
--
-- Aplicar a mano en el panel de Supabase (panel SQL), como el resto del repo.
-- NO aplicar todavía (Supabase nuevo de Antifrágil aún por crear, D3 doc 00).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0. Trigger universal de updated_at (idempotente) ───────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- ── 1. Usuarios de la clínica (mapa auth → rol) ────────────────────────────────
-- Deriva el rol del actor (auth.uid()/email) para RLS y las RPC. Un profesional
-- queda ligado a su `profesional_id` para ver/gestionar solo lo suyo.
create table if not exists public.clinica_usuarios (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid,                 -- auth.users.id (null hasta enlazar)
  email           text,
  rol             text not null default 'viewer'
                  check (rol in ('admin','profesional','recepcion','viewer','cliente')),
  profesional_id  uuid,                 -- FK a clinica_profesionales (rol profesional)
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.clinica_usuarios enable row level security;
create policy "Authenticated full access on clinica_usuarios"
  on public.clinica_usuarios for all to authenticated using (true) with check (true);
create index if not exists clinica_usuarios_auth_idx  on public.clinica_usuarios(auth_user_id);
create index if not exists clinica_usuarios_email_idx on public.clinica_usuarios(email);
drop trigger if exists touch_clinica_usuarios on public.clinica_usuarios;
create trigger touch_clinica_usuarios before update on public.clinica_usuarios
  for each row execute function public.touch_updated_at();

-- ── 2. Ubicaciones (sedes) — multi-sede preparado, hoy 1 ──────────────────────
create table if not exists public.clinica_ubicaciones (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  direccion       text,
  sociedad_id_ref text,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.clinica_ubicaciones enable row level security;
create policy "Authenticated full access on clinica_ubicaciones"
  on public.clinica_ubicaciones for all to authenticated using (true) with check (true);
drop trigger if exists touch_clinica_ubicaciones on public.clinica_ubicaciones;
create trigger touch_clinica_ubicaciones before update on public.clinica_ubicaciones
  for each row execute function public.touch_updated_at();

-- ── 3. Recursos / salas (consultas) ───────────────────────────────────────────
create table if not exists public.clinica_recursos (
  id              uuid primary key default gen_random_uuid(),
  ubicacion_id    uuid references public.clinica_ubicaciones(id) on delete set null,
  nombre          text not null,
  capacidad       int not null default 1,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.clinica_recursos enable row level security;
create policy "Authenticated full access on clinica_recursos"
  on public.clinica_recursos for all to authenticated using (true) with check (true);
create index if not exists clinica_recursos_ubicacion_idx on public.clinica_recursos(ubicacion_id);
drop trigger if exists touch_clinica_recursos on public.clinica_recursos;
create trigger touch_clinica_recursos before update on public.clinica_recursos
  for each row execute function public.touch_updated_at();

-- ── 4. Profesionales ──────────────────────────────────────────────────────────
-- modo_agenda por profesional (puede sobreescribirse por servicio). El entrenador
-- es 'bajo_demanda' por defecto pero puede abrir huecos cuando quiera.
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
  sociedad_id_ref text,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.clinica_profesionales enable row level security;
create policy "Authenticated full access on clinica_profesionales"
  on public.clinica_profesionales for all to authenticated using (true) with check (true);
drop trigger if exists touch_clinica_profesionales on public.clinica_profesionales;
create trigger touch_clinica_profesionales before update on public.clinica_profesionales
  for each row execute function public.touch_updated_at();

-- FK diferida de usuarios → profesionales (ya existen ambas tablas)
do $$ begin
  alter table public.clinica_usuarios
    add constraint clinica_usuarios_profesional_fk
    foreign key (profesional_id) references public.clinica_profesionales(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ── 5. Servicios (áreas clínicas) ─────────────────────────────────────────────
-- categoria: fisioterapia incluye lo deportivo (NO se separa). recurso_requerido
-- decide si el anti-solape de sala aplica.
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
  sociedad_id_ref        text,
  activo                 boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
alter table public.clinica_servicios enable row level security;
create policy "Authenticated full access on clinica_servicios"
  on public.clinica_servicios for all to authenticated using (true) with check (true);
drop trigger if exists touch_clinica_servicios on public.clinica_servicios;
create trigger touch_clinica_servicios before update on public.clinica_servicios
  for each row execute function public.touch_updated_at();

-- ── 6. Profesional ↔ servicio (M:N: qué puede dar cada profesional) ───────────
create table if not exists public.clinica_profesional_servicios (
  profesional_id  uuid not null references public.clinica_profesionales(id) on delete cascade,
  servicio_id     uuid not null references public.clinica_servicios(id) on delete cascade,
  primary key (profesional_id, servicio_id)
);
alter table public.clinica_profesional_servicios enable row level security;
create policy "Authenticated full access on clinica_profesional_servicios"
  on public.clinica_profesional_servicios for all to authenticated using (true) with check (true);
create index if not exists clinica_prof_serv_servicio_idx
  on public.clinica_profesional_servicios(servicio_id);

-- ── 7. Productos / tarifas (catálogo editable desde la web) ───────────────────
-- Distingue catálogo público vs interno (Founder/VIP/UG no se ofrecen online).
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
  sociedad_id_ref             text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
alter table public.clinica_productos enable row level security;
create policy "Authenticated full access on clinica_productos"
  on public.clinica_productos for all to authenticated using (true) with check (true);
create index if not exists clinica_productos_servicio_idx on public.clinica_productos(servicio_id);
create index if not exists clinica_productos_publico_idx
  on public.clinica_productos(visible_en_reserva_publica) where activo;
drop trigger if exists touch_clinica_productos on public.clinica_productos;
create trigger touch_clinica_productos before update on public.clinica_productos
  for each row execute function public.touch_updated_at();

-- ── 8. Clientes / pacientes ───────────────────────────────────────────────────
-- Capa administrativa/contacto. La historia clínica sensible irá en tabla aparte
-- (fuera del MVP). auth_user_id enlaza el portal "Mis citas" (null = invitado).
create table if not exists public.clinica_clientes (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  apellidos             text,
  telefono              text,
  email                 text,
  dni_nie               text,
  fecha_nacimiento      date,
  direccion             text,
  procedencia           text,           -- canal de captación
  condicion             text not null default 'estandar'
                        check (condicion in ('estandar','founder','vip','ug','especial_manual')),
  consentimiento_rgpd   boolean not null default false,
  consentimiento_fecha  timestamptz,
  notas_admin           text,
  auth_user_id          uuid,           -- cliente registrado (portal); null si invitado
  sociedad_id_ref       text,
  activo                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
alter table public.clinica_clientes enable row level security;
create policy "Authenticated full access on clinica_clientes"
  on public.clinica_clientes for all to authenticated using (true) with check (true);
create index if not exists clinica_clientes_email_idx on public.clinica_clientes(email);
create index if not exists clinica_clientes_auth_idx  on public.clinica_clientes(auth_user_id);
drop trigger if exists touch_clinica_clientes on public.clinica_clientes;
create trigger touch_clinica_clientes before update on public.clinica_clientes
  for each row execute function public.touch_updated_at();

-- ── 9. Disponibilidad: horario base recurrente por profesional ────────────────
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
alter table public.clinica_horarios_profesional enable row level security;
create policy "Authenticated full access on clinica_horarios_profesional"
  on public.clinica_horarios_profesional for all to authenticated using (true) with check (true);
create index if not exists clinica_horarios_prof_idx
  on public.clinica_horarios_profesional(profesional_id, dia_semana);
drop trigger if exists touch_clinica_horarios on public.clinica_horarios_profesional;
create trigger touch_clinica_horarios before update on public.clinica_horarios_profesional
  for each row execute function public.touch_updated_at();

-- ── 10. Disponibilidad: excepciones puntuales (abre/cierra un día concreto) ────
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
alter table public.clinica_disponibilidad_excepcional enable row level security;
create policy "Authenticated full access on clinica_disponibilidad_excepcional"
  on public.clinica_disponibilidad_excepcional for all to authenticated using (true) with check (true);
create index if not exists clinica_disp_excep_idx
  on public.clinica_disponibilidad_excepcional(profesional_id, fecha);
drop trigger if exists touch_clinica_disp_excep on public.clinica_disponibilidad_excepcional;
create trigger touch_clinica_disp_excep before update on public.clinica_disponibilidad_excepcional
  for each row execute function public.touch_updated_at();

-- ── 11. Disponibilidad: bloqueos (vacaciones, reuniones, comida, baja…) ────────
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
alter table public.clinica_bloqueos_agenda enable row level security;
create policy "Authenticated full access on clinica_bloqueos_agenda"
  on public.clinica_bloqueos_agenda for all to authenticated using (true) with check (true);
create index if not exists clinica_bloqueos_prof_idx
  on public.clinica_bloqueos_agenda(profesional_id, inicio);
drop trigger if exists touch_clinica_bloqueos on public.clinica_bloqueos_agenda;
create trigger touch_clinica_bloqueos before update on public.clinica_bloqueos_agenda
  for each row execute function public.touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- Siguiente: Fase 2 — la cita (clinica_citas + snapshots + estados),
-- clinica_cambios_cita (auditoría), clinica_pagos_cita (pagos operativos),
-- bonos (clinica_cliente_productos), constraints anti-solape (EXCLUDE/btree_gist)
-- y las RPC SECURITY DEFINER (crear/reprogramar/cancelar/completar/registrar_pago
-- + las públicas de reserva). Ver docs/reservas/00,02,03.
-- ═══════════════════════════════════════════════════════════════════════════
