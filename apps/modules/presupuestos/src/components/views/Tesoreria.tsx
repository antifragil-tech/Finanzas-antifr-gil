import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, TrendingDown, TrendingUp, Landmark, AlertTriangle, Info,
  ChevronDown, ChevronRight, ArrowUp, ArrowDown, Clock, Building2,
} from 'lucide-react';
import type { SaldoBancario, CompromisoTesoreria, SociedadRow } from '../../lib/proyectosApi';
import { getSaldosBancarios, getCompromisosTesoreria, getSociedades } from '../../lib/proyectosApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, priv: boolean) {
  if (priv) return '•••• €';
  const abs = Math.abs(n);
  const s = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(abs);
  return n < 0 ? `−${s}` : s;
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
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

function getMonthKey(d: string) { return d.slice(0, 7); }

function addDays(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

const ORIGEN_META: Record<CompromisoTesoreria['origen'], { label: string; color: string }> = {
  presupuesto: { label: 'Presupuesto', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  vencimiento: { label: 'Vencimiento', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  factura:     { label: 'Factura',     color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
};

// ── Horizonte temporal ────────────────────────────────────────────────────────

type Horizonte = 7 | 15 | 30 | 60 | 90 | 180 | 365 | 0;

const HORIZONTES: { value: Horizonte; label: string }[] = [
  { value: 7,   label: '7d' },
  { value: 15,  label: '15d' },
  { value: 30,  label: '30d' },
  { value: 60,  label: '60d' },
  { value: 90,  label: '90d' },
  { value: 180, label: '6m' },
  { value: 365, label: '12m' },
  { value: 0,   label: 'Todo' },
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

  const future = compromisos.filter(c => {
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
    const total = items.filter(i => !i.contingente).reduce((s, i) => s + Number(i.importe), 0);
    running += total;
    return { key, label, isWeek, items, total, runningBalance: running };
  });
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string;
  color: string; icon: typeof BarChart3;
}) {
  return (
    <div className="bg-zinc-900/60 border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} className={color} />
        <span className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">{label}</span>
      </div>
      <p className={`text-xl font-semibold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = { isPrivateMode: boolean };

export function Tesoreria({ isPrivateMode }: Props) {
  const [saldos, setSaldos]           = useState<SaldoBancario[]>([]);
  const [compromisos, setCompromisos] = useState<CompromisoTesoreria[]>([]);
  const [sociedades, setSociedades]   = useState<SociedadRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refetching, setRefetching]   = useState(false);

  // Multi-sociedad: array vacío = todas
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [horizonte, setHorizonte]     = useState<Horizonte>(30);
  const [collapsed, setCollapsed]     = useState<Set<string>>(new Set());
  const [showContingente, setShowContingente] = useState(false);
  const [showSociedadPanel, setShowSociedadPanel] = useState(false);

  // Carga inicial
  useEffect(() => {
    Promise.all([getSaldosBancarios(), getCompromisosTesoreria(), getSociedades()])
      .then(([s, c, soc]) => { setSaldos(s); setCompromisos(c); setSociedades(soc); })
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
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        const next = prev.filter(x => x !== id);
        return next; // si queda vacío → todas
      }
      return [...prev, id];
    });
  }

  function selectAll() { setSelectedIds([]); }

  const sociedadName = (id: string | null) =>
    id ? (sociedades.find(s => s.id_ref === id)?.nombre ?? id) : '—';

  // Saldo actual (según selección)
  const saldoActual = useMemo(() => {
    if (allSelected) return saldos.reduce((s, b) => s + Number(b.saldo_actual), 0);
    return saldos
      .filter(b => selectedIds.includes(b.sociedad_id_ref))
      .reduce((s, b) => s + Number(b.saldo_actual), 0);
  }, [saldos, selectedIds, allSelected]);

  const lastUpdate = useMemo(() => {
    const dates = saldos.filter(b => b.ultimo_movimiento).map(b => b.ultimo_movimiento as string);
    return dates.length ? dates.sort().at(-1)! : null;
  }, [saldos]);

  const filteredCompromisos = useMemo(() =>
    showContingente ? compromisos : compromisos.filter(c => !c.contingente),
    [compromisos, showContingente]
  );

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  // Vencidos: items cuya fecha es pasada y no están pagados/cancelados
  const vencidos = useMemo(() =>
    filteredCompromisos.filter(c => {
      const d = new Date(c.fecha + 'T00:00:00');
      return d < today && !c.es_entrada;
    }),
    [filteredCompromisos, today]
  );

  // Ítems sin sociedad asignada (dato incompleto)
  const sinSociedad = useMemo(() =>
    filteredCompromisos.filter(c => !c.sociedad_id_ref),
    [filteredCompromisos]
  );

  const timeline = useMemo(() =>
    buildTimeline(filteredCompromisos, saldoActual, horizonte),
    [filteredCompromisos, saldoActual, horizonte]
  );

  // KPIs dentro del horizonte
  const { salidas, entradas } = useMemo(() => {
    const cutoff = horizonte > 0 ? addDays(horizonte) : null;
    const inRange = filteredCompromisos.filter(c => {
      if (!c.contingente) {
        const d = new Date(c.fecha + 'T00:00:00');
        if (d < today) return false;
        if (cutoff && d > cutoff) return false;
        return true;
      }
      return false;
    });
    const salidas  = inRange.filter(c => !c.es_entrada).reduce((s, c) => s + Math.abs(Number(c.importe)), 0);
    const entradas = inRange.filter(c => c.es_entrada).reduce((s, c) => s + Number(c.importe), 0);
    return { salidas, entradas };
  }, [filteredCompromisos, today, horizonte]);

  const neto = saldoActual + entradas - salidas;

  const alertWeek = useMemo(() => timeline.find(g => g.runningBalance < 0), [timeline]);

  function toggleCollapse(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
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
      if (!map.has(id)) map.set(id, { nombre: c.sociedad_id_ref ? (sociedades.find(s => s.id_ref === c.sociedad_id_ref)?.nombre ?? c.sociedad_id_ref) : 'Sin sociedad', salidas: 0, entradas: 0 });
      const entry = map.get(id)!;
      if (c.es_entrada) entry.entradas += Number(c.importe);
      else entry.salidas += Math.abs(Number(c.importe));
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v, neto: v.entradas - v.salidas }))
      .sort((a, b) => a.salidas - b.salidas);
  }, [filteredCompromisos, today, horizonte, sociedades]);

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-zinc-600 text-sm">Cargando tesorería...</div>;
  }

  const horizonteLabel = HORIZONTES.find(h => h.value === horizonte)?.label ?? '30d';

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Tesorería forward</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Posición neta proyectada · {lastUpdate ? `Último mov.: ${fmtDate(lastUpdate)}` : 'Sin movimientos importados'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Contingente toggle */}
          <button
            onClick={() => setShowContingente(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs font-medium uppercase tracking-wider border transition-all ${
              showContingente
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                : 'border-zinc-700/30 text-zinc-600 hover:text-zinc-400'
            }`}
          >
            <Info size={10} /> Contingentes
          </button>
        </div>
      </div>

      {/* ── Selector multi-sociedad ─────────────────────────────────────────── */}
      <div className="bg-zinc-900/40 border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Building2 size={13} className="text-zinc-500" />
            <span className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Sociedades</span>
          </div>
          <button
            onClick={() => setShowSociedadPanel(v => !v)}
            className="text-2xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
          >
            {showSociedadPanel ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {allSelected ? 'Consolidado' : `${selectedIds.length} seleccionadas`}
          </button>
        </div>
        {/* Pills siempre visibles */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={selectAll}
            className={`px-3 py-1 rounded-full text-2xs font-semibold uppercase tracking-widest border transition-all ${
              allSelected
                ? 'bg-white/10 border-white/20 text-white'
                : 'border-zinc-700/30 text-zinc-600 hover:text-zinc-400'
            }`}
          >
            Todas
          </button>
          {sociedades.map(s => {
            const active = selectedIds.includes(s.id_ref);
            return (
              <button
                key={s.id_ref}
                onClick={() => toggleSociedad(s.id_ref)}
                className={`px-3 py-1 rounded-full text-2xs font-semibold uppercase tracking-widest border transition-all ${
                  active
                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                    : 'border-zinc-700/30 text-zinc-600 hover:text-zinc-400 hover:border-zinc-600/30'
                }`}
              >
                {s.nombre}
              </button>
            );
          })}
          {refetching && <span className="text-2xs text-zinc-600 self-center">Actualizando...</span>}
        </div>
      </div>

      {/* ── Selector de horizonte temporal ──────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-zinc-900/40 border border-white/[0.06] rounded-xl p-1 w-fit">
        {HORIZONTES.map(h => (
          <button
            key={h.value}
            onClick={() => setHorizonte(h.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              horizonte === h.value
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {h.label}
          </button>
        ))}
      </div>

      {/* ── Alertas ─────────────────────────────────────────────────────────── */}
      {vencidos.length > 0 && (
        <div className="bg-rose-500/8 border border-rose-500/20 rounded-xl p-4 space-y-2">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-rose-300">
                {vencidos.length} vencimiento{vencidos.length > 1 ? 's' : ''} sin pagar
              </p>
              <div className="mt-2 space-y-1">
                {vencidos.slice(0, 5).map((v, i) => (
                  <div key={`${v.origen_id}-${i}`} className="flex items-center justify-between gap-3 text-xs text-rose-400/80">
                    <span className="truncate">{v.concepto}</span>
                    <span className="shrink-0 font-medium">{fmt(Math.abs(Number(v.importe)), isPrivateMode)}</span>
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
        <div className="bg-rose-500/8 border border-rose-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-rose-300">
              Posición negativa prevista en la semana del {alertWeek.label}
            </p>
            <p className="text-xs text-rose-500/80 mt-0.5">
              Saldo proyectado: {fmt(alertWeek.runningBalance, isPrivateMode)} — revisar financiación o aplazar compromisos
            </p>
          </div>
        </div>
      )}

      {sinSociedad.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertTriangle size={13} className="text-amber-600 shrink-0" />
          <p className="text-xs text-amber-600">
            {sinSociedad.length} ítem{sinSociedad.length > 1 ? 's' : ''} sin sociedad asignada — no se incluyen en filtros por sociedad
          </p>
        </div>
      )}

      {/* ── KPIs ──────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div className="bg-zinc-900/40 border border-white/[0.06] rounded-xl p-4">
          <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Caja por sociedad</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {saldos.map(b => (
              <div key={b.sociedad_id_ref} className="bg-zinc-800/40 rounded-lg p-3">
                <p className="text-2xs text-zinc-500 font-semibold truncate">{sociedadName(b.sociedad_id_ref)}</p>
                <p className={`text-sm font-semibold mt-1 ${Number(b.saldo_actual) < 0 ? 'text-rose-400' : 'text-white'}`}>
                  {fmt(Number(b.saldo_actual), isPrivateMode)}
                </p>
                {b.ultimo_movimiento && (
                  <p className="text-2xs text-zinc-600 mt-0.5">{fmtDate(b.ultimo_movimiento)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Desglose por sociedad dentro del horizonte ──────────────────────── */}
      {desgloseSociedad.length > 1 && (
        <div className="bg-zinc-900/40 border border-white/[0.06] rounded-xl p-4">
          <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
            Necesidad por sociedad — próximos {horizonteLabel}
          </p>
          <div className="space-y-2">
            {desgloseSociedad.map(row => (
              <div key={row.id} className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-40 truncate">{row.nombre}</span>
                <div className="flex-1 flex items-center gap-3">
                  {row.salidas > 0 && (
                    <span className="flex items-center gap-1 text-xs text-rose-400">
                      <ArrowDown size={10} />{fmt(-row.salidas, isPrivateMode)}
                    </span>
                  )}
                  {row.entradas > 0 && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <ArrowUp size={10} />{fmt(row.entradas, isPrivateMode)}
                    </span>
                  )}
                </div>
                <span className={`text-xs font-medium ${row.neto < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {fmt(row.neto, isPrivateMode)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Desglose por fuente ──────────────────────────────────────────────── */}
      {filteredCompromisos.length > 0 && (() => {
        const cutoff = horizonte > 0 ? addDays(horizonte) : null;
        const inRange = filteredCompromisos.filter(c => {
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
          <div className="bg-zinc-900/40 border border-white/[0.06] rounded-xl p-4">
            <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
              Salidas por fuente — próximos {horizonteLabel}
            </p>
            <div className="flex flex-wrap gap-4">
              {(Object.entries(byFuente) as [CompromisoTesoreria['origen'], number][]).filter(([, v]) => v > 0).map(([fuente, val]) => {
                const meta = ORIGEN_META[fuente];
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return (
                  <div key={fuente} className={`rounded-xl border px-4 py-3 ${meta.color}`}>
                    <p className="text-2xs font-semibold uppercase tracking-widest mb-1">{meta.label}</p>
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
        <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
          Compromisos — próximos {horizonteLabel}
        </p>

        {timeline.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-zinc-600 bg-zinc-900/30 border border-white/[0.04] rounded-xl">
            <Clock size={28} className="mb-2" />
            <p className="text-sm font-semibold">Sin compromisos en este horizonte</p>
            <p className="text-xs mt-1">Crea presupuestos, vencimientos o aprueba facturas</p>
          </div>
        ) : (
          <div className="space-y-2">
            {timeline.map(group => {
              const isOpen = !collapsed.has(group.key);
              return (
                <div key={group.key} className="bg-zinc-900/50 border border-white/[0.06] rounded-2xl overflow-hidden">
                  <button
                    onClick={() => toggleCollapse(group.key)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    {isOpen
                      ? <ChevronDown size={12} className="text-zinc-600 shrink-0" />
                      : <ChevronRight size={12} className="text-zinc-600 shrink-0" />
                    }
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className={`text-2xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                        group.isWeek ? 'text-blue-400 border-blue-500/20 bg-blue-500/8' : 'text-zinc-500 border-zinc-700/30 bg-zinc-800/20'
                      }`}>
                        {group.isWeek ? 'Semana' : 'Mes'}
                      </span>
                      <span className="text-xs font-medium text-zinc-300">{group.label}</span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className={`text-sm font-semibold ${group.total < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {fmt(group.total, isPrivateMode)}
                      </span>
                      <div className="text-right">
                        <span className="text-2xs text-zinc-600 block">Saldo</span>
                        <span className={`text-xs font-semibold ${group.runningBalance < 0 ? 'text-rose-400' : 'text-zinc-300'}`}>
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
                          <div key={`${item.origen_id}-${idx}`} className="flex items-center gap-3 px-5 py-2.5">
                            <span className="text-2xs text-zinc-500 font-medium w-24 shrink-0">
                              {fmtDate(item.fecha)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-zinc-200 font-medium truncate">{item.concepto}</p>
                              {item.proyecto_nombre && (
                                <p className="text-2xs text-zinc-600 truncate">{item.proyecto_nombre}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {(allSelected || selectedIds.length > 1) && item.sociedad_id_ref && (
                                <span className="text-2xs text-zinc-600 font-medium">
                                  {sociedadName(item.sociedad_id_ref)}
                                </span>
                              )}
                              <span className={`text-2xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${ometa.color}`}>
                                {ometa.label}
                              </span>
                              {item.contingente && (
                                <span className="text-2xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
                                  Contingente
                                </span>
                              )}
                              {item.es_entrada && (
                                <ArrowUp size={10} className="text-emerald-500" />
                              )}
                            </div>
                            <span className={`text-sm font-semibold w-24 text-right shrink-0 ${Number(item.importe) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
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
