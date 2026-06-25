-- ═══════════════════════════════════════════════════════════════════════════
-- PR E — Proveedores recurrentes / reglas de facturación (2026-06-23)
--
-- Reglas por (proveedor=contacto, sociedad) para SUGERIR sociedad receptora,
-- cuenta contable, proyecto/presupuesto/partida, método de pago, régimen IVA,
-- retención y concepto, y para marcar facturas domiciliadas.
--
-- v1 = SOLO sugerencias y preparación operativa. NADA se auto-valida, auto-aprueba,
-- auto-paga ni envía emails. `auto_validar` existe pero queda INERTE (reservado v2).
-- `requiere_aprobacion_javi` es solo AVISO en v1 (no toca el routing de la RPC).
-- Aditiva e idempotente. No toca pagos, Drive, OCR ni estados principales.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Tabla de reglas ─────────────────────────────────────────────────────────
create table if not exists public.proveedores_reglas (
  id                         uuid primary key default gen_random_uuid(),
  contacto_id                uuid not null references public.contactos(id) on delete cascade,
  nif_normalizado            text,                              -- denormalizado, para depurar/matchear
  sociedad_id_ref            text references public.sociedades(id_ref) on delete cascade,  -- null = regla GLOBAL del proveedor
  cuenta_contable_default    text,                              -- código PGC (soft-ref a plan_cuentas)
  proyecto_id_ref            text,
  presupuesto_id             uuid references public.presupuestos(id) on delete set null,
  partida_id                 uuid references public.presupuesto_partidas(id) on delete set null,
  metodo_pago_default        text check (metodo_pago_default in ('transferencia','domiciliacion','tarjeta','efectivo','otro')),
  es_domiciliada             boolean not null default false,
  requiere_pago_manual       boolean not null default false,
  requiere_aprobacion_javi   boolean not null default false,   -- v1: solo aviso visual (no fuerza routing)
  requiere_factura           boolean not null default true,    -- info operativa (futura conciliación/gestoría)
  requiere_justificante_pago boolean not null default true,    -- info operativa (futura conciliación/gestoría)
  tipo_operacion_default     text check (tipo_operacion_default in ('normal','exenta','no_sujeta','inversion_sujeto_pasivo','suplido')),
  iva_default                numeric(5,2),
  retencion_pct_default      numeric(5,2),
  importe_habitual           numeric(14,2),                     -- base para la alerta de tolerancia
  tolerancia_importe_pct     numeric(6,2),                      -- % de desviación que dispara el aviso
  concepto_recurrente        text,
  auto_validar               boolean not null default false,   -- ⚠️ INERTE en v1 (reservado v2)
  activa                     boolean not null default true,
  notas                      text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

comment on table public.proveedores_reglas is
  'PR E: reglas por proveedor (contacto) y sociedad para sugerir campos de factura y marcar domiciliadas. Solo sugerencias en v1.';
comment on column public.proveedores_reglas.sociedad_id_ref is
  'Sociedad a la que aplica la regla. NULL = regla global del proveedor (fallback cuando no hay regla específica).';
comment on column public.proveedores_reglas.auto_validar is
  'Reservado v2. En v1 es INERTE: ninguna factura avanza de estado automáticamente.';

-- ── 2. Unicidad: una regla activa por (contacto, sociedad concreta) y una GLOBAL ──
-- (NULL != NULL en índices únicos → se separan en dos índices parciales).
create unique index if not exists proveedores_reglas_contacto_sociedad_uniq
  on public.proveedores_reglas (contacto_id, sociedad_id_ref)
  where activa and sociedad_id_ref is not null;
create unique index if not exists proveedores_reglas_contacto_global_uniq
  on public.proveedores_reglas (contacto_id)
  where activa and sociedad_id_ref is null;
create index if not exists proveedores_reglas_contacto_idx
  on public.proveedores_reglas (contacto_id);

-- ── 3. RLS: CRUD para autenticados (config operativa, no movimiento de dinero) ────
alter table public.proveedores_reglas enable row level security;
do $$ begin
  create policy "proveedores_reglas_all" on public.proveedores_reglas
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- ── 4. updated_at automático (misma función que el resto de tablas) ──────────────
drop trigger if exists proveedores_reglas_updated_at on public.proveedores_reglas;
create trigger proveedores_reglas_updated_at
  before update on public.proveedores_reglas
  for each row execute function public.touch_updated_at();

-- ── 5. Columnas aditivas en facturas_recibidas ───────────────────────────────────
alter table public.facturas_recibidas
  add column if not exists es_domiciliada boolean not null default false;
alter table public.facturas_recibidas
  add column if not exists regla_aplicada_id uuid references public.proveedores_reglas(id) on delete set null;

comment on column public.facturas_recibidas.es_domiciliada is
  'PR E: la factura se cargará por domiciliación bancaria (no requiere transferencia manual). Sembrada de la regla; editable. El sub-estado operativo (pendiente_cargo/cargada_sin_justificante/pagada) es DERIVADO.';
comment on column public.facturas_recibidas.regla_aplicada_id is
  'PR E: traza de qué regla de proveedor se usó para sugerir/aplicar valores. NO implica validación automática.';
