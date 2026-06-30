-- ═══════════════════════════════════════════════════════════════════════════
-- ANTIFRÁGIL OS — A1 TESORERÍA / CAJA  (BORRADOR — NO APLICAR)
-- ═══════════════════════════════════════════════════════════════════════════
-- Se aplica ENCIMA del baseline (00000000000000_baseline_antifragil_os.sql),
-- una vez aplicado y verificado. NO es una migración de services/supabase/migrations/.
--
-- Qué añade A1:
--   · efectivo (ledger de caja propio)  +  banco operativo (reutiliza movimientos_bancarios)
--   · arqueo de caja (teórico vs contado)
--   · vista unificada de tesorería + saldos + resumen
--   · seed mínimo: cuenta de caja "Caja Clínica Playamar" (sin saldo, sin movimientos)
--
-- Reglas de modelo (ver MODEL_DECISIONS.md):
--   · banco / caja = TIPO de cuenta de tesorería (NO son medio de pago).
--   · medio_pago ∈ {efectivo, tarjeta, transferencia, bizum, domiciliacion, otro}  (sin 'banco').
--   · banco operativo se apoya en movimientos_bancarios; A1 NO duplica esos movimientos.
--   · libros append-only; saldos DERIVADOS (suma de movimientos); sin delete físico.
--   · puente factura_pago → movimiento de tesorería: DIFERIDO a A1b (aquí solo se prepara el modelo).
-- Convención: snake_case, NUMERIC(14,2), enums TEXT CHECK, PK uuid, updated_at por trigger.
-- Reutiliza del baseline: touch_updated_at(), sociedades, proyectos,
--   cuentas_bancarias_sociedad, movimientos_bancarios, compromisos_tesoreria.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- §1. TABLAS
-- ═══════════════════════════════════════════════════════════════════════════

-- 1.1 cuenta_tesoreria — dónde "vive" el dinero (generaliza caja + banco)
create table if not exists public.cuenta_tesoreria (
  id                 uuid primary key default gen_random_uuid(),
  tipo               text not null check (tipo in ('caja','banco')),
  nombre             text not null,
  alias              text,
  sociedad_id_ref    text not null references public.sociedades(id_ref) on delete restrict,
  proyecto_id_ref    text references public.proyectos(id_ref) on delete set null,
  -- FK opcional al sustrato bancario (solo tipo='banco'); caja NO usa cuenta bancaria
  cuenta_bancaria_id uuid references public.cuentas_bancarias_sociedad(id) on delete set null,
  cuenta_pgc         text,            -- mapeo contable: 570/571 caja · 572-576 banco
  moneda             text not null default 'EUR',
  activa             boolean not null default true,
  notas              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Invariante: una caja física NO tiene cuenta bancaria asociada
  constraint cuenta_tesoreria_caja_sin_iban
    check (tipo = 'banco' or cuenta_bancaria_id is null)
);
create unique index if not exists cuenta_tesoreria_sociedad_nombre_uniq
  on public.cuenta_tesoreria (sociedad_id_ref, nombre);
create index if not exists cuenta_tesoreria_tipo_idx     on public.cuenta_tesoreria (tipo);
create index if not exists cuenta_tesoreria_sociedad_idx on public.cuenta_tesoreria (sociedad_id_ref);

-- 1.2 movimiento_caja — ledger APPEND-ONLY de efectivo (cliente: solo SELECT; escritura por RPC)
create table if not exists public.movimiento_caja (
  id                  uuid primary key default gen_random_uuid(),
  cuenta_tesoreria_id uuid not null references public.cuenta_tesoreria(id) on delete restrict,
  fecha               date not null default current_date,
  importe             numeric(14,2) not null check (importe <> 0),   -- signo: + entrada, - salida
  concepto            text not null,
  medio_pago          text not null default 'efectivo'
                      check (medio_pago in ('efectivo','tarjeta','transferencia','bizum','domiciliacion','otro')),
  origen_tipo         text not null default 'manual'
                      check (origen_tipo in ('manual','cobro','pago','factura_pago','arqueo_ajuste','traspaso')),
  origen_id           uuid,                    -- id de la entidad origen (p.ej. factura_pago en A1b, arqueo en ajuste)
  proyecto_id_ref     text references public.proyectos(id_ref) on delete set null,
  sociedad_id_ref     text references public.sociedades(id_ref) on delete set null,
  registrado_por_email text,                   -- derivado de auth.jwt() en la RPC
  notas               text,
  created_at          timestamptz not null default now()
);
create index if not exists movimiento_caja_cuenta_idx on public.movimiento_caja (cuenta_tesoreria_id, fecha);
create index if not exists movimiento_caja_fecha_idx  on public.movimiento_caja (fecha desc);
create index if not exists movimiento_caja_origen_idx on public.movimiento_caja (origen_tipo, origen_id);
-- NOTA: cuenta_tesoreria_id debe ser de tipo='caja'. Se valida en la RPC (no por CHECK cross-tabla).

-- 1.3 arqueo_caja — control de cuadre (NO es un movimiento); cliente: solo SELECT; escritura por RPC
create table if not exists public.arqueo_caja (
  id                   uuid primary key default gen_random_uuid(),
  cuenta_tesoreria_id  uuid not null references public.cuenta_tesoreria(id) on delete restrict,
  fecha                date not null default current_date,
  saldo_teorico        numeric(14,2) not null,   -- DERIVADO al crear (suma de movimiento_caja ≤ fecha)
  saldo_contado        numeric(14,2) not null,   -- recuento físico (manual)
  diferencia           numeric(14,2) not null,   -- contado - teorico (lo calcula la RPC)
  observaciones        text,
  registrado_por_email text,
  ajuste_movimiento_id uuid references public.movimiento_caja(id) on delete set null, -- si se materializa el descuadre
  estado               text not null default 'borrador' check (estado in ('borrador','cerrado','revisado')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists arqueo_caja_cuenta_fecha_idx on public.arqueo_caja (cuenta_tesoreria_id, fecha desc);
create index if not exists arqueo_caja_estado_idx       on public.arqueo_caja (estado);


-- ═══════════════════════════════════════════════════════════════════════════
-- §2. VISTAS
-- ═══════════════════════════════════════════════════════════════════════════

-- 2.1 movimiento_tesoreria — UNIÓN banco (movimientos_bancarios) + caja (movimiento_caja).
--     Banco se LEE de movimientos_bancarios: NO se duplica el movimiento.
--     Columnas: fecha · sociedad · proyecto · cuenta_tesoreria · tipo_cuenta · medio_pago ·
--               importe · concepto · origen · referencia · estado.
create or replace view public.movimiento_tesoreria as
-- Lado BANCO (reutiliza el ledger existente; medio_pago null = el extracto no lo trae)
select
  mb.id                                        as id,
  'banco'::text                                as origen,
  ct.id                                        as cuenta_tesoreria_id,
  'banco'::text                                as tipo_cuenta,
  null::text                                   as medio_pago,
  mb.sociedad_id_ref                           as sociedad_id_ref,
  mb.proyecto_id_ref                           as proyecto_id_ref,
  mb.fecha                                     as fecha,
  mb.importe                                   as importe,
  mb.concepto                                  as concepto,
  mb.referencia                                as referencia,
  case when mb.revisado then 'revisado' else 'pendiente_revision' end as estado,
  coalesce(mb.fuente, 'extracto')              as origen_detalle
from public.movimientos_bancarios mb
left join public.cuenta_tesoreria ct
  on ct.tipo = 'banco' and ct.cuenta_bancaria_id = mb.cuenta_bancaria_id
union all
-- Lado CAJA (ledger propio de efectivo)
select
  mc.id                                        as id,
  'caja'::text                                 as origen,
  mc.cuenta_tesoreria_id                       as cuenta_tesoreria_id,
  'caja'::text                                 as tipo_cuenta,
  mc.medio_pago                                as medio_pago,
  coalesce(mc.sociedad_id_ref, ct.sociedad_id_ref) as sociedad_id_ref,
  coalesce(mc.proyecto_id_ref, ct.proyecto_id_ref) as proyecto_id_ref,
  mc.fecha                                     as fecha,
  mc.importe                                   as importe,
  mc.concepto                                  as concepto,
  nullif(mc.origen_id::text, '')               as referencia,
  'registrado'::text                           as estado,
  mc.origen_tipo                               as origen_detalle
from public.movimiento_caja mc
join public.cuenta_tesoreria ct on ct.id = mc.cuenta_tesoreria_id;

-- 2.2 saldo_tesoreria — saldo DERIVADO por cuenta (sociedad · proyecto · cuenta · tipo · moneda · fecha)
create or replace view public.saldo_tesoreria as
select
  mt.sociedad_id_ref                           as sociedad_id_ref,
  mt.proyecto_id_ref                           as proyecto_id_ref,
  mt.cuenta_tesoreria_id                       as cuenta_tesoreria_id,
  mt.tipo_cuenta                               as tipo_cuenta,
  coalesce(ct.moneda, 'EUR')                   as moneda,
  round(sum(mt.importe), 2)                    as saldo,
  count(*)                                     as num_movimientos,
  max(mt.fecha)                                as ultimo_movimiento,
  current_date                                 as fecha_calculo
from public.movimiento_tesoreria mt
left join public.cuenta_tesoreria ct on ct.id = mt.cuenta_tesoreria_id
group by mt.sociedad_id_ref, mt.proyecto_id_ref, mt.cuenta_tesoreria_id, mt.tipo_cuenta, ct.moneda;

-- 2.3 tesoreria — RESUMEN operativo por sociedad (banco / caja / total / cobros / pagos)
--     Cobros y pagos previstos salen de compromisos_tesoreria (baseline).
--     Detalle por proyecto: usar saldo_tesoreria (tiene proyecto_id_ref).
create or replace view public.tesoreria as
with banco as (
  select sociedad_id_ref, round(sum(importe), 2) as banco_operativo
  from public.movimiento_tesoreria where tipo_cuenta = 'banco'
  group by sociedad_id_ref
),
caja as (
  select sociedad_id_ref, round(sum(importe), 2) as caja_efectivo
  from public.movimiento_tesoreria where tipo_cuenta = 'caja'
  group by sociedad_id_ref
),
compromisos as (
  select sociedad_id_ref,
         round(sum(case when es_entrada then importe else 0 end), 2) as cobros_pendientes,
         round(sum(case when not es_entrada then importe else 0 end), 2) as pagos_proximos
  from public.compromisos_tesoreria
  group by sociedad_id_ref
),
socs as (
  select sociedad_id_ref from banco
  union select sociedad_id_ref from caja
  union select sociedad_id_ref from compromisos
)
select
  s.sociedad_id_ref                                                    as sociedad_id_ref,
  coalesce(b.banco_operativo, 0)                                       as banco_operativo,
  coalesce(c.caja_efectivo, 0)                                         as caja_efectivo,
  coalesce(b.banco_operativo, 0) + coalesce(c.caja_efectivo, 0)        as saldo_operativo_total,
  coalesce(k.cobros_pendientes, 0)                                     as cobros_pendientes,  -- + entran
  coalesce(k.pagos_proximos, 0)                                        as pagos_proximos,     -- - salen
  current_date                                                         as fecha_calculo
from socs s
left join banco       b on b.sociedad_id_ref = s.sociedad_id_ref
left join caja        c on c.sociedad_id_ref = s.sociedad_id_ref
left join compromisos k on k.sociedad_id_ref = s.sociedad_id_ref;


-- ═══════════════════════════════════════════════════════════════════════════
-- §3. RPC (security definer; actor por auth.jwt(); patrón append-only del baseline)
-- ═══════════════════════════════════════════════════════════════════════════

-- 3.1 registrar_movimiento_caja — inserta un movimiento de efectivo (entrada/salida)
create or replace function public.registrar_movimiento_caja(
  p_cuenta_tesoreria_id uuid,
  p_importe             numeric,
  p_concepto            text,
  p_fecha               date    default current_date,
  p_medio_pago          text    default 'efectivo',
  p_origen_tipo         text    default 'manual',
  p_origen_id           uuid    default null,
  p_proyecto_id_ref     text    default null,
  p_notas               text    default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
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
$$;
grant execute on function
  public.registrar_movimiento_caja(uuid, numeric, text, date, text, text, uuid, text, text)
  to authenticated;

-- 3.2 registrar_arqueo_caja — crea un arqueo en 'borrador' con saldo teórico derivado
create or replace function public.registrar_arqueo_caja(
  p_cuenta_tesoreria_id uuid,
  p_saldo_contado       numeric,
  p_fecha               date default current_date,
  p_observaciones       text default null
) returns public.arqueo_caja
language plpgsql security definer set search_path = public, pg_temp
as $$
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
$$;
grant execute on function
  public.registrar_arqueo_caja(uuid, numeric, date, text)
  to authenticated;

-- 3.3 cerrar_arqueo_caja — cierra el arqueo (borrador→cerrado); opcional: materializa el descuadre
--     como movimiento de caja de ajuste (append-only, sin borrar historia).
create or replace function public.cerrar_arqueo_caja(
  p_arqueo_id           uuid,
  p_materializar_ajuste boolean default false,
  p_comentario          text    default null
) returns public.arqueo_caja
language plpgsql security definer set search_path = public, pg_temp
as $$
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
$$;
grant execute on function
  public.cerrar_arqueo_caja(uuid, boolean, text)
  to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- §4. TRIGGERS updated_at  (reutiliza touch_updated_at() del baseline)
-- ═══════════════════════════════════════════════════════════════════════════
drop trigger if exists cuenta_tesoreria_touch on public.cuenta_tesoreria;
create trigger cuenta_tesoreria_touch before update on public.cuenta_tesoreria
  for each row execute function public.touch_updated_at();
drop trigger if exists arqueo_caja_touch on public.arqueo_caja;
create trigger arqueo_caja_touch before update on public.arqueo_caja
  for each row execute function public.touch_updated_at();
-- movimiento_caja NO tiene updated_at (append-only, sin updates).


-- ═══════════════════════════════════════════════════════════════════════════
-- §5. RLS  (anon sin acceso; caja/arqueo append-only = cliente solo SELECT)
-- ═══════════════════════════════════════════════════════════════════════════
-- cuenta_tesoreria: datos maestros → authenticated FOR ALL
alter table public.cuenta_tesoreria enable row level security;
drop policy if exists cuenta_tesoreria_auth_all on public.cuenta_tesoreria;
create policy cuenta_tesoreria_auth_all on public.cuenta_tesoreria
  for all to authenticated using (true) with check (true);

-- movimiento_caja y arqueo_caja: libros → cliente SOLO SELECT; escritura por RPC security-definer
alter table public.movimiento_caja enable row level security;
drop policy if exists movimiento_caja_select on public.movimiento_caja;
create policy movimiento_caja_select on public.movimiento_caja
  for select to authenticated using (true);

alter table public.arqueo_caja enable row level security;
drop policy if exists arqueo_caja_select on public.arqueo_caja;
create policy arqueo_caja_select on public.arqueo_caja
  for select to authenticated using (true);


-- ═══════════════════════════════════════════════════════════════════════════
-- §6. SEED MÍNIMO — Caja Clínica Playamar (sin saldo, sin movimientos, sin arqueos)
-- ═══════════════════════════════════════════════════════════════════════════
insert into public.cuenta_tesoreria
  (tipo, nombre, sociedad_id_ref, proyecto_id_ref, cuenta_bancaria_id, cuenta_pgc, moneda, activa)
values
  ('caja', 'Caja Clínica Playamar', 'ANT', 'CLI-PLY', null, '570', 'EUR', true)
on conflict (sociedad_id_ref, nombre) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN A1 — revisar antes de aplicar. Ver README.md y APPLY_A1_RUNBOOK.md
-- DIFERIDO a A1b: puente factura_pago → movimiento de tesorería (no implementado aquí).
-- ═══════════════════════════════════════════════════════════════════════════
