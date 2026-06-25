-- ═══════════════════════════════════════════════════════════════════════════
-- PR F — Importación de extractos bancarios (2026-06-23)
--
-- Añade la entidad "extracto" (statement) con estado + deduplicación por DOBLE
-- hash (fichero y fila) sobre la tabla ya existente `movimientos_bancarios`, y una
-- RPC ATÓMICA de importación. SOLO importa y normaliza: NO concilia, NO toca
-- facturas/pagos/Drive/OCR. Aditiva e idempotente; `movimientos_bancarios` está
-- vacía → sin backfill.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Entidad extracto ──────────────────────────────────────────────────────
create table if not exists public.extractos_bancarios (
  id                 uuid primary key default gen_random_uuid(),
  sociedad_id_ref    text not null references public.sociedades(id_ref) on delete cascade,
  cuenta_bancaria_id uuid references public.cuentas_bancarias_sociedad(id) on delete set null,
  banco              text,
  iban               text,
  anio               int not null,
  mes                int not null check (mes between 1 and 12),
  nombre_archivo     text,
  formato            text check (formato in ('csv','xlsx')),
  archivo_hash       text not null,                      -- sha256 del contenido del fichero
  n_movimientos      int not null default 0,
  n_importados       int not null default 0,
  n_duplicados       int not null default 0,
  rango_fecha_min    date,
  rango_fecha_max    date,
  estado             text not null default 'importado'
                     check (estado in ('importado','pendiente_revision','listo_conciliacion','deshecho')),
  importado_por_email text,
  notas              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Un mismo fichero NO se reimporta mientras el extracto no esté `deshecho`.
create unique index if not exists extractos_bancarios_archivo_uniq
  on public.extractos_bancarios (sociedad_id_ref, archivo_hash)
  where estado <> 'deshecho';
create index if not exists extractos_bancarios_sociedad_idx
  on public.extractos_bancarios (sociedad_id_ref, anio, mes);

alter table public.extractos_bancarios enable row level security;
do $$ begin
  create policy "extractos_bancarios_all" on public.extractos_bancarios
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

drop trigger if exists extractos_bancarios_updated_at on public.extractos_bancarios;
create trigger extractos_bancarios_updated_at
  before update on public.extractos_bancarios
  for each row execute function public.touch_updated_at();

-- ── 2. Columnas aditivas en movimientos_bancarios ────────────────────────────
alter table public.movimientos_bancarios
  add column if not exists extracto_id        uuid references public.extractos_bancarios(id) on delete set null;
alter table public.movimientos_bancarios
  add column if not exists hash               text;
alter table public.movimientos_bancarios
  add column if not exists referencia         text;
alter table public.movimientos_bancarios
  add column if not exists tipo_movimiento    text;
alter table public.movimientos_bancarios
  add column if not exists cuenta_bancaria_id uuid references public.cuentas_bancarias_sociedad(id) on delete set null;

-- Dedup a nivel fila: una sociedad no tiene dos movimientos con el mismo hash.
create unique index if not exists movimientos_bancarios_hash_uniq
  on public.movimientos_bancarios (sociedad_id_ref, hash)
  where hash is not null;
create index if not exists movimientos_bancarios_extracto_idx
  on public.movimientos_bancarios (extracto_id);

comment on column public.movimientos_bancarios.hash is
  'PR F: sha256(sociedad|iban|fecha|importe_centimos|concepto_normalizado|saldo|referencia) para deduplicar.';

-- ── 3. RPC importar_extracto_bancario (ATÓMICA, security definer) ─────────────
-- Crea el extracto + inserta los movimientos NO duplicados (on conflict por hash)
-- + actualiza métricas. El hash de cada fila lo calcula el cliente (lógica pura
-- testeada); aquí solo se deduplica e inserta. Evita importaciones parciales.
create or replace function public.importar_extracto_bancario(
  p_extracto    jsonb,
  p_movimientos jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
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

  -- Fichero ya importado (no deshecho) → no se duplica.
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
$$;
grant execute on function public.importar_extracto_bancario(jsonb, jsonb) to authenticated;

-- ── 4. RPC deshacer_importacion_extracto (ATÓMICA) ───────────────────────────
-- Borra explícitamente los movimientos del extracto y lo marca `deshecho`
-- (soft-state, conserva la traza). No hay CASCADE automático.
create or replace function public.deshacer_importacion_extracto(p_extracto_id uuid)
returns public.extractos_bancarios
language plpgsql security definer set search_path = public, pg_temp as $$
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
$$;
grant execute on function public.deshacer_importacion_extracto(uuid) to authenticated;
