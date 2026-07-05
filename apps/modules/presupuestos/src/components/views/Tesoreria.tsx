import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
  Landmark,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Clock,
  Building2,
} from 'lucide-react';
import type { SaldoBancario, CompromisoTesoreria, SociedadRow } from '../../lib/proyectosApi';
import { getSaldosBancarios, getCompromisosTesoreria, getSociedades } from '../../lib/proyectosApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, priv: boolean) {
  if (priv) return '•••• €';
  const abs = Math.abs(n);
  const s = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(abs);
  return n < 0 ? `−${s}` : s;
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function fmtMonth(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

function weekLabel(d: string) {
  const date = new Date(d + 'T00:00:00');
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay() + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString('es-ES', opts)} – ${end.toLocaleDateString('es-ES', opts)}`;
}

function getWeekKey(d: string) {
  const date = new Date(d + 'T00:00:00');
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function getMonthKey(d: string) {
  return d.slice(0, 7);
}

function addDays(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

const ORIGEN_META: Record<CompromisoTesoreria['origen'], { label: string; color: string }> = {
  presupuesto: { label: 'Presupuesto', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  vencimiento: {
    label: 'Vencimiento',
    color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  },
  factura: { label: 'Factura', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
};

// ── Horizonte temporal ────────────────────────────────────────────────────────

type Horizonte = 7 | 15 | 30 | 60 | 90 | 180 | 365 | 0;

const HORIZONTES: { value: Horizonte; label: string }[] = [
  { value: 7, label: '7d' },
  { value: 15, label: '15d' },
  { value: 30, label: '30d' },
  { value: 60, label: '60d' },
  { value: 90, label: '90d' },
  { value: 180, label: '6m' },
  { value: 365, label: '12m' },
  { value: 0, label: 'Todo' },
];

// ── Timeline grouping ─────────────────────────────────────────────────────────

type GroupedItem = {
  key: string;
  label: string;
  isWeek: boolean;
  items: CompromisoTesoreria[];
  total: number;
  runningBalance: number;
};

function buildTimeline(
  compromisos: CompromisoTesoreria[],
  saldoActual: number,
  horizonte: Horizonte,
): GroupedItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30d = addDays(30);
  const cutoff = horizonte > 0 ? addDays(horizonte) : null;

  const future = compromisos.filter((c) => {
    const d = new Date(c.fecha + 'T00:00:00');
    if (d < today) return false;
    if (cutoff && d > cutoff) return false;
    return true;
  });

  const map = new Map<string, { label: string; isWeek: boolean; items: CompromisoTesoreria[] }>();
  for (const c of future) {
    const date = new Date(c.fecha + 'T00:00:00');
    const isWeek = date <= in30d;
    const key = isWeek ? getWeekKey(c.fecha) : getMonthKey(c.fecha);
    if (!map.has(key)) {
      map.set(key, { label: isWeek ? weekLabel(c.fecha) : fmtMonth(c.fecha), isWeek, items: [] });
    }
    map.get(key)!.items.push(c);
  }

  const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  let running = saldoActual;
  return sorted.map(([key, { label, isWeek, items }]) => {
    const total = items.filter((i) => !i.contingente).reduce((s, i) => s + Number(i.importe), 0);
    running += total;
    return { key, label, isWeek, items, total, runningBalance: running };
  });
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: typeof BarChart3;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon size={13} className={color} />
        <span className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
          {label}
        </span>
      </div>
      <p className={`text-xl font-semibold ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-600">{sub}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = { isPrivateMode: boolean };

export function Tesoreria({ isPrivateMode }: Props) {
  const [saldos, setSaldos] = useState<SaldoBancario[]>([]);
  const [compromisos, setCompromisos] = useState<CompromisoTesoreria[]>([]);
  const [sociedades, setSociedades] = useState<SociedadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);

  // Multi-sociedad: array vacío = todas
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [horizonte, setHorizonte] = useState<Horizonte>(30);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showContingente, setShowContingente] = useState(false);
  const [showSociedadPanel, setShowSociedadPanel] = useState(false);

  // Carga inicial
  useEffect(() => {
    Promise.all([getSaldosBancarios(), getCompromisosTesoreria(), getSociedades()])
      .then(([s, c, soc]) => {
        setSaldos(s);
        setCompromisos(c);
        setSociedades(soc);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Re-fetch compromisos al cambiar selección de sociedades
  useEffect(() => {
    if (loading) return;
    setRefetching(true);
    getCompromisosTesoreria(selectedIds.length > 0 ? selectedIds : undefined)
      .then(setCompromisos)
      .catch(() => {})
      .finally(() => setRefetching(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  const allSelected = selectedIds.length === 0;

  function toggleSociedad(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        return next; // si queda vacío → todas
      }
      return [...prev, id];
    });
  }

  function selectAll() {
    setSelectedIds([]);
  }

  const sociedadName = (id: string | null) =>
    id ? (sociedades.find((s) => s.id_ref === id)?.nombre ?? id) : '—';

  // Saldo actual (según selección)
  const saldoActual = useMemo(() => {
    if (allSelected) return saldos.reduce((s, b) => s + Number(b.saldo_actual), 0);
    return saldos
      .filter((b) => selectedIds.includes(b.sociedad_id_ref))
      .reduce((s, b) => s + Number(b.saldo_actual), 0);
  }, [saldos, selectedIds, allSelected]);

  const lastUpdate = useMemo(() => {
    const dates = saldos
      .filter((b) => b.ultimo_movimiento)
      .map((b) => b.ultimo_movimiento as string);
    return dates.length ? dates.sort().at(-1)! : null;
  }, [saldos]);

  const filteredCompromisos = useMemo(
    () => (showContingente ? compromisos : compromisos.filter((c) => !c.contingente)),
    [compromisos, showContingente],
  );

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Vencidos: items cuya fecha es pasada y no están pagados/cancelados
  const vencidos = useMemo(
    () =>
      filteredCompromisos.filter((c) => {
        const d = new Date(c.fecha + 'T00:00:00');
        return d < today && !c.es_entrada;
      }),
    [filteredCompromisos, today],
  );

  // Ítems sin sociedad asignada (dato incompleto)
  const sinSociedad = useMemo(
    () => filteredCompromisos.filter((c) => !c.sociedad_id_ref),
    [filteredCompromisos],
  );

  const timeline = useMemo(
    () => buildTimeline(filteredCompromisos, saldoActual, horizonte),
    [filteredCompromisos, saldoActual, horizonte],
  );

  // KPIs dentro del horizonte
  const { salidas, entradas } = useMemo(() => {
    const cutoff = horizonte > 0 ? addDays(horizonte) : null;
    const inRange = filteredCompromisos.filter((c) => {
      if (!c.contingente) {
        const d = new Date(c.fecha + 'T00:00:00');
        if (d < today) return false;
        if (cutoff && d > cutoff) return false;
        return true;
      }
      return false;
    });
    const salidas = inRange
      .filter((c) => !c.es_entrada)
      .reduce((s, c) => s + Math.abs(Number(c.importe)), 0);
    const entradas = inRange.filter((c) => c.es_entrada).reduce((s, c) => s + Number(c.importe), 0);
    return { salidas, entradas };
  }, [filteredCompromisos, today, horizonte]);

  const neto = saldoActual + entradas - salidas;

  const alertWeek = useMemo(() => timeline.find((g) => g.runningBalance < 0), [timeline]);

  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Desglose por sociedad dentro del horizonte
  const desgloseSociedad = useMemo(() => {
    const cutoff = horizonte > 0 ? addDays(horizonte) : null;
    const map = new Map<string, { nombre: string; salidas: number; entradas: number }>();
    for (const c of filteredCompromisos) {
      if (c.contingente) continue;
      const d = new Date(c.fecha + 'T00:00:00');
      if (d < today) continue;
      if (cutoff && d > cutoff) continue;
      const id = c.sociedad_id_ref ?? '__sin_sociedad__';
      if (!map.has(id))
        map.set(id, {
          nombre: c.sociedad_id_ref
            ? (sociedades.find((s) => s.id_ref === c.sociedad_id_ref)?.nombre ?? c.sociedad_id_ref)
            : 'Sin sociedad',
          salidas: 0,
          entradas: 0,
        });
      const entry = map.get(id)!;
      if (c.es_entrada) entry.entradas += Number(c.importe);
      else entry.salidas += Math.abs(Number(c.importe));
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v, neto: v.entradas - v.salidas }))
      .sort((a, b) => a.salidas - b.salidas);
  }, [filteredCompromisos, today, horizonte, sociedades]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-zinc-600">
        Cargando tesorería...
      </div>
    );
  }

  const horizonteLabel = HORIZONTES.find((h) => h.value === horizonte)?.label ?? '30d';

  return (
    <div className="animate-fade-in space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Tesorería forward</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            Posición neta proyectada ·{' '}
            {lastUpdate ? `Último mov.: ${fmtDate(lastUpdate)}` : 'Sin movimientos importados'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Contingente toggle */}
          <button
            onClick={() => setShowContingente((v) => !v)}
            className={`text-2xs flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-medium uppercase tracking-wider transition-all ${
              showContingente
                ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                : 'border-zinc-700/30 text-zinc-600 hover:text-zinc-400'
            }`}
          >
            <Info size={10} /> Contingentes
          </button>
        </div>
      </div>

      {/* ── Selector multi-sociedad ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={13} className="text-zinc-500" />
            <span className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
              Sociedades
            </span>
          </div>
          <button
            onClick={() => setShowSociedadPanel((v) => !v)}
            className="text-2xs flex items-center gap-1 text-zinc-500 transition-colors hover:text-zinc-300"
          >
            {showSociedadPanel ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {allSelected ? 'Consolidado' : `${selectedIds.length} seleccionadas`}
          </button>
        </div>
        {/* Pills siempre visibles */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={selectAll}
            className={`text-2xs rounded-full border px-3 py-1 font-semibold uppercase tracking-widest transition-all ${
              allSelected
                ? 'border-white/20 bg-white/10 text-white'
                : 'border-zinc-700/30 text-zinc-600 hover:text-zinc-400'
            }`}
          >
            Todas
          </button>
          {sociedades.map((s) => {
            const active = selectedIds.includes(s.id_ref);
            return (
              <button
                key={s.id_ref}
                onClick={() => toggleSociedad(s.id_ref)}
                className={`text-2xs rounded-full border px-3 py-1 font-semibold uppercase tracking-widest transition-all ${
                  active
                    ? 'border-blue-500/30 bg-blue-500/15 text-blue-300'
                    : 'border-zinc-700/30 text-zinc-600 hover:border-zinc-600/30 hover:text-zinc-400'
                }`}
              >
                {s.nombre}
              </button>
            );
          })}
          {refetching && (
            <span className="text-2xs self-center text-zinc-600">Actualizando...</span>
          )}
        </div>
      </div>

      {/* ── Selector de horizonte temporal ──────────────────────────────────── */}
      <div className="flex w-fit items-center gap-1 rounded-xl border border-white/[0.06] bg-zinc-900/40 p-1">
        {HORIZONTES.map((h) => (
          <button
            key={h.value}
            onClick={() => setHorizonte(h.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              horizonte === h.value ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {h.label}
          </button>
        ))}
      </div>

      {/* ── Alertas ─────────────────────────────────────────────────────────── */}
      {vencidos.length > 0 && (
        <div className="bg-rose-500/8 space-y-2 rounded-xl border border-rose-500/20 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-rose-300">
                {vencidos.length} vencimiento{vencidos.length > 1 ? 's' : ''} sin pagar
              </p>
              <div className="mt-2 space-y-1">
                {vencidos.slice(0, 5).map((v, i) => (
                  <div
                    key={`${v.origen_id}-${i}`}
                    className="flex items-center justify-between gap-3 text-xs text-rose-400/80"
                  >
                    <span className="truncate">{v.concepto}</span>
                    <span className="shrink-0 font-medium">
                      {fmt(Math.abs(Number(v.importe)), isPrivateMode)}
                    </span>
                  </div>
                ))}
                {vencidos.length > 5 && (
                  <p className="text-xs text-rose-500/60">+{vencidos.length - 5} más</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {alertWeek && (
        <div className="bg-rose-500/8 flex items-start gap-3 rounded-xl border border-rose-500/20 p-4">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-400" />
          <div>
            <p className="text-sm font-medium text-rose-300">
              Posición negativa prevista en la semana del {alertWeek.label}
            </p>
            <p className="mt-0.5 text-xs text-rose-500/80">
              Saldo proyectado: {fmt(alertWeek.runningBalance, isPrivateMode)} — revisar
              financiación o aplazar compromisos
            </p>
          </div>
        </div>
      )}

      {sinSociedad.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/15 bg-amber-500/5 px-4 py-3">
          <AlertTriangle size={13} className="shrink-0 text-amber-600" />
          <p className="text-xs text-amber-600">
            {sinSociedad.length} ítem{sinSociedad.length > 1 ? 's' : ''} sin sociedad asignada — no
            se incluyen en filtros por sociedad
          </p>
        </div>
      )}

      {/* ── KPIs ──────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Caja disponible"
          value={fmt(saldoActual, isPrivateMode)}
          {...(saldos.length > 1 && allSelected ? { sub: `${saldos.length} cuentas` } : {})}
          color="text-white"
          icon={Landmark}
        />
        <KpiCard
          label={`Salidas ${horizonteLabel}`}
          value={fmt(-salidas, isPrivateMode)}
          sub="Confirmadas"
          color={salidas > 0 ? 'text-rose-400' : 'text-zinc-400'}
          icon={TrendingDown}
        />
        <KpiCard
          label={`Entradas ${horizonteLabel}`}
          value={fmt(entradas, isPrivateMode)}
          sub="Previstas"
          color={entradas > 0 ? 'text-emerald-400' : 'text-zinc-400'}
          icon={TrendingUp}
        />
        <KpiCard
          label={`Posición neta ${horizonteLabel}`}
          value={fmt(neto, isPrivateMode)}
          sub={neto < 0 ? 'DÉFICIT' : 'Superávit'}
          color={neto < 0 ? 'text-rose-400' : 'text-emerald-400'}
          icon={BarChart3}
        />
      </div>

      {/* ── Saldo por sociedad (modo consolidado) ───────────────────────────── */}
      {allSelected && saldos.length > 1 && (
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4">
          <p className="text-2xs mb-3 font-semibold uppercase tracking-widest text-zinc-500">
            Caja por sociedad
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {saldos.map((b) => (
              <div key={b.sociedad_id_ref} className="rounded-lg bg-zinc-800/40 p-3">
                <p className="text-2xs truncate font-semibold text-zinc-500">
                  {sociedadName(b.sociedad_id_ref)}
                </p>
                <p
                  className={`mt-1 text-sm font-semibold ${Number(b.saldo_actual) < 0 ? 'text-rose-400' : 'text-white'}`}
                >
                  {fmt(Number(b.saldo_actual), isPrivateMode)}
                </p>
                {b.ultimo_movimiento && (
                  <p className="text-2xs mt-0.5 text-zinc-600">{fmtDate(b.ultimo_movimiento)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Desglose por sociedad dentro del horizonte ──────────────────────── */}
      {desgloseSociedad.length > 1 && (
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4">
          <p className="text-2xs mb-3 font-semibold uppercase tracking-widest text-zinc-500">
            Necesidad por sociedad — próximos {horizonteLabel}
          </p>
          <div className="space-y-2">
            {desgloseSociedad.map((row) => (
              <div key={row.id} className="flex items-center gap-3">
                <span className="w-40 truncate text-xs text-zinc-400">{row.nombre}</span>
                <div className="flex flex-1 items-center gap-3">
                  {row.salidas > 0 && (
                    <span className="flex items-center gap-1 text-xs text-rose-400">
                      <ArrowDown size={10} />
                      {fmt(-row.salidas, isPrivateMode)}
                    </span>
                  )}
                  {row.entradas > 0 && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <ArrowUp size={10} />
                      {fmt(row.entradas, isPrivateMode)}
                    </span>
                  )}
                </div>
                <span
                  className={`text-xs font-medium ${row.neto < 0 ? 'text-rose-400' : 'text-emerald-400'}`}
                >
                  {fmt(row.neto, isPrivateMode)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Desglose por fuente ──────────────────────────────────────────────── */}
      {filteredCompromisos.length > 0 &&
        (() => {
          const cutoff = horizonte > 0 ? addDays(horizonte) : null;
          const inRange = filteredCompromisos.filter((c) => {
            if (c.contingente) return false;
            const d = new Date(c.fecha + 'T00:00:00');
            if (d < today) return false;
            return !(cutoff && d > cutoff);
          });
          const byFuente = { presupuesto: 0, vencimiento: 0, factura: 0 };
          for (const c of inRange) {
            if (!c.es_entrada) byFuente[c.origen] += Math.abs(Number(c.importe));
          }
          const total = byFuente.presupuesto + byFuente.vencimiento + byFuente.factura;
          if (total === 0) return null;
          return (
            <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4">
              <p className="text-2xs mb-3 font-semibold uppercase tracking-widest text-zinc-500">
                Salidas por fuente — próximos {horizonteLabel}
              </p>
              <div className="flex flex-wrap gap-4">
                {(Object.entries(byFuente) as [CompromisoTesoreria['origen'], number][])
                  .filter(([, v]) => v > 0)
                  .map(([fuente, val]) => {
                    const meta = ORIGEN_META[fuente];
                    const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                    return (
                      <div key={fuente} className={`rounded-xl border px-4 py-3 ${meta.color}`}>
                        <p className="text-2xs mb-1 font-semibold uppercase tracking-widest">
                          {meta.label}
                        </p>
                        <p className="text-sm font-semibold">{fmt(-val, isPrivateMode)}</p>
                        <p className="text-2xs opacity-60">{pct}% del total</p>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })()}

      {/* ── Timeline ────────────────────────────────────────────────────────── */}
      <div>
        <p className="text-2xs mb-3 font-semibold uppercase tracking-widest text-zinc-500">
          Compromisos — próximos {horizonteLabel}
        </p>

        {timeline.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-white/[0.04] bg-zinc-900/30 text-zinc-600">
            <Clock size={28} className="mb-2" />
            <p className="text-sm font-semibold">Sin compromisos en este horizonte</p>
            <p className="mt-1 text-xs">Crea presupuestos, vencimientos o aprueba facturas</p>
          </div>
        ) : (
          <div className="space-y-2">
            {timeline.map((group) => {
              const isOpen = !collapsed.has(group.key);
              return (
                <div
                  key={group.key}
                  className="overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-900/50"
                >
                  <button
                    onClick={() => toggleCollapse(group.key)}
                    className="flex w-full items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.02]"
                  >
                    {isOpen ? (
                      <ChevronDown size={12} className="shrink-0 text-zinc-600" />
                    ) : (
                      <ChevronRight size={12} className="shrink-0 text-zinc-600" />
                    )}
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span
                        className={`text-2xs rounded border px-1.5 py-0.5 font-semibold uppercase tracking-wider ${
                          group.isWeek
                            ? 'bg-blue-500/8 border-blue-500/20 text-blue-400'
                            : 'border-zinc-700/30 bg-zinc-800/20 text-zinc-500'
                        }`}
                      >
                        {group.isWeek ? 'Semana' : 'Mes'}
                      </span>
                      <span className="text-xs font-medium text-zinc-300">{group.label}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <span
                        className={`text-sm font-semibold ${group.total < 0 ? 'text-rose-400' : 'text-emerald-400'}`}
                      >
                        {fmt(group.total, isPrivateMode)}
                      </span>
                      <div className="text-right">
                        <span className="text-2xs block text-zinc-600">Saldo</span>
                        <span
                          className={`text-xs font-semibold ${group.runningBalance < 0 ? 'text-rose-400' : 'text-zinc-300'}`}
                        >
                          {fmt(group.runningBalance, isPrivateMode)}
                        </span>
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="divide-y divide-white/[0.03]">
                      {group.items.map((item, idx) => {
                        const ometa = ORIGEN_META[item.origen];
                        return (
                          <div
                            key={`${item.origen_id}-${idx}`}
                            className="flex items-center gap-3 px-5 py-2.5"
                          >
                            <span className="text-2xs w-24 shrink-0 font-medium text-zinc-500">
                              {fmtDate(item.fecha)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-zinc-200">
                                {item.concepto}
                              </p>
                              {item.proyecto_nombre && (
                                <p className="text-2xs truncate text-zinc-600">
                                  {item.proyecto_nombre}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {(allSelected || selectedIds.length > 1) && item.sociedad_id_ref && (
                                <span className="text-2xs font-medium text-zinc-600">
                                  {sociedadName(item.sociedad_id_ref)}
                                </span>
                              )}
                              <span
                                className={`text-2xs rounded border px-1.5 py-0.5 font-semibold uppercase tracking-wider ${ometa.color}`}
                              >
                                {ometa.label}
                              </span>
                              {item.contingente && (
                                <span className="text-2xs rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-amber-400">
                                  Contingente
                                </span>
                              )}
                              {item.es_entrada && (
                                <ArrowUp size={10} className="text-emerald-500" />
                              )}
                            </div>
                            <span
                              className={`w-24 shrink-0 text-right text-sm font-semibold ${Number(item.importe) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}
                            >
                              {fmt(Number(item.importe), isPrivateMode)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
