import { useState, useEffect, useMemo, useRef } from 'react';
import { formatCurrency } from '@alsari/utils';
import type { DashboardData, SocietyOption } from '@alsari/types';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Building2,
  ChevronDown,
  X,
} from 'lucide-react';
import {
  getFlujosHolding,
  getSociedadesCashflow,
  type FlujoHolding,
  type SociedadOpcion,
} from '../../lib/cashflowHoldingApi';

// ── Capas de flujo ─────────────────────────────────────────────────────────────

type Capa = 'real' | 'comprometido' | 'previsto';

function getCapa(f: FlujoHolding): Capa {
  if (f.es_real) return 'real';
  const hoy = new Date().toISOString().slice(0, 10);
  if (!f.es_previsto && f.fecha <= hoy) return 'comprometido';
  return 'previsto';
}

const CAPA_CONFIG: Record<
  Capa,
  {
    label: string;
    color: string;
    bg: string;
    Icon: React.ComponentType<{ size?: number; className?: string }>;
  }
> = {
  real: {
    label: 'Pagado',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    Icon: CheckCircle2,
  },
  comprometido: {
    label: 'Pendiente',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    Icon: Clock,
  },
  previsto: {
    label: 'Previsto',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    Icon: Calendar,
  },
};

const FUENTE_LABEL: Record<string, string> = {
  factura_recibida: 'Factura',
  presupuesto_pago: 'Presupuesto',
  flujo_manual: 'Manual',
  vencimiento: 'Vencimiento',
};

const FUENTE_COLOR: Record<string, string> = {
  factura_recibida: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  presupuesto_pago: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  flujo_manual: 'bg-zinc-800 text-zinc-500 border-white/10',
  vencimiento: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number, priv: boolean) {
  return priv ? '••••' : formatCurrency(n);
}

function fmtMonth(yyyymm: string) {
  const [y, m] = yyyymm.split('-');
  const names = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ];
  return `${names[parseInt(m ?? '1') - 1] ?? m} ${y}`;
}

// ── Componente principal ───────────────────────────────────────────────────────

type FiltroVista = 'todos' | 'real' | 'pendiente';
type Horizonte = '3m' | '6m' | '12m' | 'todo';

const HORIZONTE_LABELS: Record<Horizonte, string> = {
  '3m': '3 meses',
  '6m': '6 meses',
  '12m': '12 meses',
  todo: 'Todo',
};

function horizonDates(h: Horizonte): { desde: string; hasta: string } {
  const hoy = new Date();
  const desde = new Date(hoy);
  desde.setMonth(hoy.getMonth() - 1);
  const hasta = new Date(hoy);
  if (h === '3m') hasta.setMonth(hoy.getMonth() + 3);
  if (h === '6m') hasta.setMonth(hoy.getMonth() + 6);
  if (h === '12m') hasta.setMonth(hoy.getMonth() + 12);
  if (h === 'todo') hasta.setFullYear(hoy.getFullYear() + 10);
  return {
    desde: desde.toISOString().slice(0, 10),
    hasta: hasta.toISOString().slice(0, 10),
  };
}

type Props = {
  data: DashboardData;
  selectedSociety: SocietyOption;
  isPrivateMode: boolean;
};

export function CashflowView({ data, selectedSociety, isPrivateMode }: Props) {
  const [flujos, setFlujos] = useState<FlujoHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroVista>('todos');
  const [horizonte, setHorizonte] = useState<Horizonte>('6m');
  const [sociedades, setSociedades] = useState<SociedadOpcion[]>([]);
  const [selSocs, setSelSocs] = useState<string[]>(
    selectedSociety.idRef ? [selectedSociety.idRef] : [],
  );
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al clicar fuera
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  // Cargar lista de sociedades disponibles
  useEffect(() => {
    getSociedadesCashflow()
      .then(setSociedades)
      .catch(() => {});
  }, []);

  // Sincronizar con el selector global cuando cambia
  useEffect(() => {
    if (selectedSociety.idRef) {
      setSelSocs([selectedSociety.idRef]);
    } else {
      setSelSocs([]);
    }
  }, [selectedSociety.idRef]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { desde, hasta } = horizonDates(horizonte);
      const rows = await getFlujosHolding({
        ...(selSocs.length > 0 ? { sociedadIds: selSocs } : {}),
        ...(horizonte !== 'todo' ? { desde, hasta } : {}),
      });
      setFlujos(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando flujos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selSocs.join(','), horizonte]);

  function toggleSoc(id: string) {
    setSelSocs((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function socNombre(id: string) {
    return sociedades.find((s) => s.id_ref === id)?.nombre ?? id;
  }

  // ── KPIs de posición actual (CF Worker) ────────────────────────────────────
  const finSoc = useMemo(() => {
    if (!data.finanzas_sociedades) return null;
    const base =
      selSocs.length === 0
        ? data.finanzas_sociedades
        : data.finanzas_sociedades.filter((f) => selSocs.includes(f['ID-Ref'] as string));
    if (base.length === 0) return null;
    const caja = base.reduce((s, f) => s + (Number(f['Caja Disponible']) || 0), 0);
    const deuda = base.reduce((s, f) => s + (Number(f['Deuda Bancaria']) || 0), 0);
    return { caja, deuda };
  }, [data.finanzas_sociedades, selSocs]);

  // ── Filtro de vista ────────────────────────────────────────────────────────
  const flujosFiltrados = useMemo(() => {
    if (filtro === 'real') return flujos.filter((f) => f.es_real);
    if (filtro === 'pendiente') return flujos.filter((f) => !f.es_real);
    return flujos;
  }, [flujos, filtro]);

  // ── KPIs de flujos ─────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const reales = flujos.filter((f) => f.es_real);
    const previstos = flujos.filter((f) => !f.es_real);
    const entradasReal = reales.filter((f) => f.importe > 0).reduce((s, f) => s + f.importe, 0);
    const salidasReal = reales
      .filter((f) => f.importe < 0)
      .reduce((s, f) => s + Math.abs(f.importe), 0);
    const entradasPrev = previstos.filter((f) => f.importe > 0).reduce((s, f) => s + f.importe, 0);
    const salidasPrev = previstos
      .filter((f) => f.importe < 0)
      .reduce((s, f) => s + Math.abs(f.importe), 0);
    return {
      entradasReal,
      salidasReal,
      netoReal: entradasReal - salidasReal,
      entradasPrev,
      salidasPrev,
      netoTotal: entradasReal - salidasReal + entradasPrev - salidasPrev,
    };
  }, [flujos]);

  // ── Agrupar por mes (orden cronológico: pasado→futuro) ────────────────────
  const porMes = useMemo(() => {
    const map = new Map<string, FlujoHolding[]>();
    [...flujosFiltrados].forEach((f) => {
      const key = f.fecha.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    });
    // Ordenar cada mes: más reciente primero dentro del mes
    map.forEach((items) => items.sort((a, b) => b.fecha.localeCompare(a.fecha)));
    const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));

    // Calcular saldo acumulado mes a mes sin mutación de variable externa
    return sorted.reduce<
      { mes: string; items: (typeof sorted)[number][1]; netoMes: number; saldoAcumulado: number }[]
    >((acc, [mes, items]) => {
      const netoMes = items.reduce((s, f) => s + f.importe, 0);
      const prev = acc[acc.length - 1]?.saldoAcumulado ?? 0;
      return [...acc, { mes, items, netoMes, saldoAcumulado: prev + netoMes }];
    }, []);
  }, [flujosFiltrados]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div>
            <h2 className="flex items-center gap-3 text-xl font-semibold uppercase tracking-tight text-white">
              <TrendingUp className="text-violet-400" size={22} />
              Cashflow
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Facturas · presupuestos · vencimientos — distribuidos por sociedad
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Desplegable multi-sociedad */}
          <div className="relative" ref={dropRef}>
            <button
              onClick={() => setDropOpen((v) => !v)}
              className="flex min-w-[180px] items-center gap-2 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition-all hover:border-white/20"
            >
              <Building2 size={13} className="shrink-0 text-blue-400" />
              <span className="flex-1 truncate text-left text-xs font-semibold">
                {selSocs.length === 0
                  ? 'Todas las sociedades'
                  : selSocs.length === 1
                    ? socNombre(selSocs[0]!)
                    : `${selSocs.length} sociedades`}
              </span>
              <ChevronDown
                size={12}
                className={`text-zinc-500 transition-transform ${dropOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {dropOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-xl">
                {/* Todas */}
                <button
                  onClick={() => {
                    setSelSocs([]);
                    setDropOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/[0.04] ${
                    selSocs.length === 0 ? 'font-medium text-blue-300' : 'text-zinc-400'
                  }`}
                >
                  <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                      selSocs.length === 0 ? 'border-blue-500 bg-blue-500' : 'border-zinc-600'
                    }`}
                  >
                    {selSocs.length === 0 && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
                  </span>
                  Todas las sociedades
                </button>
                <div className="h-px bg-white/[0.06]" />
                <div className="max-h-64 overflow-y-auto">
                  {sociedades.map((s) => {
                    const sel = selSocs.includes(s.id_ref);
                    return (
                      <button
                        key={s.id_ref}
                        onClick={() => toggleSoc(s.id_ref)}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-white/[0.04]"
                      >
                        <span
                          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors ${
                            sel ? 'border-blue-500 bg-blue-500' : 'border-zinc-600'
                          }`}
                        >
                          {sel && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
                        </span>
                        <span
                          className={`truncate ${sel ? 'font-semibold text-white' : 'text-zinc-400'}`}
                        >
                          {s.nombre}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {selSocs.length > 0 && (
                  <>
                    <div className="h-px bg-white/[0.06]" />
                    <button
                      onClick={() => setSelSocs([])}
                      className="flex w-full items-center gap-1.5 px-4 py-2 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                    >
                      <X size={10} /> Limpiar selección
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Selector horizonte */}
          <div className="flex gap-0.5 rounded-xl border border-white/10 bg-zinc-900 p-0.5">
            {(Object.keys(HORIZONTE_LABELS) as Horizonte[]).map((h) => (
              <button
                key={h}
                onClick={() => setHorizonte(h)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  horizonte === h ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {HORIZONTE_LABELS[h]}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              void load();
            }}
            className="rounded-xl border border-white/10 bg-zinc-900 p-2 text-zinc-500 transition-all hover:text-zinc-300"
            title="Recargar"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Posición actual (CF Worker — datos bancarios reales) */}
      {finSoc && (
        <div className="space-y-2">
          <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-600">
            Posición bancaria actual
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-2xs mb-1 font-semibold uppercase tracking-widest text-zinc-500">
                Caja disponible
              </p>
              <p className="text-2xl font-semibold text-white">{fmt(finSoc.caja, isPrivateMode)}</p>
            </div>
            <div className="rounded-2xl border border-rose-500/15 bg-rose-500/[0.03] p-5">
              <p className="text-2xs mb-1 font-semibold uppercase tracking-widest text-zinc-500">
                Deuda bancaria
              </p>
              <p className="text-2xl font-semibold text-rose-400">
                {fmt(finSoc.deuda, isPrivateMode)}
              </p>
            </div>
            <div
              className={`rounded-2xl border p-5 ${finSoc.caja - finSoc.deuda >= 0 ? 'border-emerald-500/15 bg-emerald-500/[0.03]' : 'border-rose-500/15 bg-rose-500/[0.03]'}`}
            >
              <p className="text-2xs mb-1 font-semibold uppercase tracking-widest text-zinc-500">
                Balance neto
              </p>
              <p
                className={`text-2xl font-semibold ${finSoc.caja - finSoc.deuda >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
              >
                {fmt(finSoc.caja - finSoc.deuda, isPrivateMode)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/[0.03] p-4 text-sm text-rose-400">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* KPIs de flujos */}
      {!loading && flujos.length > 0 && (
        <div className="space-y-3">
          {/* Fila 1: Reales (confirmados) */}
          <div>
            <p className="text-2xs mb-2 font-semibold uppercase tracking-widest text-zinc-600">
              Reales · confirmados
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] p-4">
                <div className="mb-1 flex items-center gap-2">
                  <TrendingUp size={11} className="text-emerald-400" />
                  <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
                    Entradas cobradas
                  </p>
                </div>
                <p className="text-xl font-semibold text-emerald-400">
                  {fmt(kpis.entradasReal, isPrivateMode)}
                </p>
              </div>
              <div className="rounded-2xl border border-rose-500/15 bg-rose-500/[0.03] p-4">
                <div className="mb-1 flex items-center gap-2">
                  <TrendingDown size={11} className="text-rose-400" />
                  <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
                    Salidas pagadas
                  </p>
                </div>
                <p className="text-xl font-semibold text-rose-400">
                  {fmt(kpis.salidasReal, isPrivateMode)}
                </p>
              </div>
              <div
                className={`rounded-2xl border p-4 ${kpis.netoReal >= 0 ? 'border-blue-500/15 bg-blue-500/[0.03]' : 'border-rose-500/15 bg-rose-500/[0.03]'}`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <Minus
                    size={11}
                    className={kpis.netoReal >= 0 ? 'text-blue-400' : 'text-rose-400'}
                  />
                  <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
                    Neto real
                  </p>
                </div>
                <p
                  className={`text-xl font-semibold ${kpis.netoReal >= 0 ? 'text-blue-400' : 'text-rose-400'}`}
                >
                  {kpis.netoReal >= 0 ? '+' : ''}
                  {fmt(kpis.netoReal, isPrivateMode)}
                </p>
              </div>
            </div>
          </div>

          {/* Fila 2: Previstos (pendientes) */}
          <div>
            <p className="text-2xs mb-2 font-semibold uppercase tracking-widest text-zinc-600">
              Previstos · pendientes
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.02] p-4">
                <div className="mb-1 flex items-center gap-2">
                  <TrendingUp size={11} className="text-emerald-600" />
                  <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-600">
                    Por cobrar
                  </p>
                </div>
                <p className="text-xl font-semibold text-emerald-600">
                  {fmt(kpis.entradasPrev, isPrivateMode)}
                </p>
              </div>
              <div className="rounded-2xl border border-rose-500/10 bg-rose-500/[0.02] p-4">
                <div className="mb-1 flex items-center gap-2">
                  <TrendingDown size={11} className="text-rose-600" />
                  <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-600">
                    Por pagar
                  </p>
                </div>
                <p className="text-xl font-semibold text-rose-600">
                  {fmt(kpis.salidasPrev, isPrivateMode)}
                </p>
              </div>
              <div
                className={`rounded-2xl border p-4 ${kpis.netoTotal >= 0 ? 'border-violet-500/15 bg-violet-500/[0.03]' : 'border-rose-500/15 bg-rose-500/[0.03]'}`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <Clock
                    size={11}
                    className={kpis.netoTotal >= 0 ? 'text-violet-400' : 'text-rose-400'}
                  />
                  <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
                    Saldo neto total
                  </p>
                </div>
                <p
                  className={`text-xl font-semibold ${kpis.netoTotal >= 0 ? 'text-violet-400' : 'text-rose-400'}`}
                >
                  {kpis.netoTotal >= 0 ? '+' : ''}
                  {fmt(kpis.netoTotal, isPrivateMode)}
                </p>
                <p className="text-2xs mt-0.5 text-zinc-600">real + previsto</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtro de vista */}
      {!loading && flujos.length > 0 && (
        <div className="flex w-fit gap-1 rounded-xl border border-white/[0.06] bg-zinc-900/60 p-1">
          {(
            [
              ['todos', 'Todos'],
              ['real', 'Solo pagados'],
              ['pendiente', 'Solo pendientes'],
            ] as [FiltroVista, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFiltro(v)}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-all ${
                filtro === v ? 'bg-zinc-700/60 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Timeline por mes */}
      {loading ? (
        <div className="py-12 text-center text-sm text-zinc-600">Cargando flujos...</div>
      ) : flujosFiltrados.length === 0 ? (
        <div className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center">
          <TrendingUp size={36} className="mx-auto text-zinc-700" />
          <p className="text-sm font-semibold uppercase tracking-widest text-zinc-600">
            Sin flujos registrados
          </p>
          <p className="text-xs text-zinc-600">
            Los flujos aparecen automáticamente cuando se registran facturas, pagos de presupuesto o
            flujos manuales en la app.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {porMes.map(({ mes, items, netoMes, saldoAcumulado }) => {
            const esFuturo = mes >= new Date().toISOString().slice(0, 7);
            return (
              <div
                key={mes}
                className={`overflow-hidden rounded-2xl border ${
                  esFuturo
                    ? 'border-blue-500/10 bg-blue-500/[0.02]'
                    : 'border-white/[0.06] bg-zinc-900/20'
                }`}
              >
                {/* Cabecera mes */}
                <div
                  className={`flex items-center justify-between border-b border-white/[0.05] px-5 py-3 ${
                    esFuturo ? 'bg-blue-500/[0.04]' : 'bg-zinc-900/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-white">
                      {fmtMonth(mes)}
                    </p>
                    {esFuturo && (
                      <span className="text-2xs font-semibold uppercase tracking-widest text-blue-400/60">
                        Previsto
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`text-xs font-semibold ${netoMes >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                    >
                      {netoMes >= 0 ? '+' : ''}
                      {fmt(netoMes, isPrivateMode)}
                    </span>
                    <div className="text-right">
                      <p className="text-2xs uppercase tracking-widest text-zinc-600">
                        Saldo acum.
                      </p>
                      <span
                        className={`text-xs font-semibold ${saldoAcumulado >= 0 ? 'text-zinc-300' : 'text-rose-400'}`}
                      >
                        {fmt(saldoAcumulado, isPrivateMode)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Filas */}
                <div className="divide-y divide-white/[0.03]">
                  {items.map((f, i) => {
                    const capa = getCapa(f);
                    const capaCfg = CAPA_CONFIG[capa];
                    const CapaIcon = capaCfg.Icon;
                    const fuenteLabel = FUENTE_LABEL[f.fuente] ?? f.fuente;
                    const fuenteColor = FUENTE_COLOR[f.fuente] ?? FUENTE_COLOR['flujo_manual'];
                    const esEntrada = f.importe > 0;

                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.01]"
                      >
                        {/* Estado (capa) */}
                        <div
                          className={`text-2xs flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 font-semibold ${capaCfg.bg} ${capaCfg.color}`}
                        >
                          <CapaIcon size={9} />
                          {capaCfg.label}
                        </div>

                        {/* Fuente */}
                        <span
                          className={`text-2xs whitespace-nowrap rounded-full border px-2 py-0.5 font-semibold ${fuenteColor}`}
                        >
                          {fuenteLabel}
                        </span>

                        {/* Concepto y proyecto */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-300">
                            {f.concepto ?? `Flujo ${f.proyecto_id_ref}`}
                          </p>
                          {f.sociedad_id_ref && (
                            <p className="text-2xs text-zinc-600">{socNombre(f.sociedad_id_ref)}</p>
                          )}
                        </div>

                        {/* Fecha */}
                        <p className="text-2xs hidden whitespace-nowrap text-zinc-600 md:block">
                          {new Date(f.fecha).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </p>

                        {/* Importe */}
                        <p
                          className={`whitespace-nowrap text-sm font-semibold tabular-nums ${isPrivateMode ? 'blur-sm' : ''} ${esEntrada ? 'text-emerald-400' : 'text-rose-400'}`}
                        >
                          {esEntrada ? '+' : ''}
                          {formatCurrency(f.importe)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
