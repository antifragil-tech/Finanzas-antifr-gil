import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, History } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { formatCurrency } from '@alsari/utils';
import { deriveKpis, type DerivedKpis } from '../../lib/sumasSaldosParser';
import { getPeriodosBySociedad, getLineasBSS, fmtPeriodo, fmtPeriodoCorto } from '../../lib/sumasSaldosImport';

// Histórico de KPIs por sociedad. Los KPIs de cada período se derivan al vuelo
// desde las líneas guardadas en balance_sumas_saldos — la misma lógica que el
// import — por lo que funciona retroactivamente con los balances ya subidos.

type Props = { societyIdRef: string };

type PeriodoKpis = { periodo: string; kpis: DerivedKpis };

const GRID_METRICS: { key: keyof DerivedKpis; label: string; upIsGood: boolean }[] = [
  { key: 'caja_disponible',       label: 'Caja disponible',    upIsGood: true },
  { key: 'deuda_bancaria',        label: 'Deuda bancaria',     upIsGood: false },
  { key: 'deuda_socios',          label: 'Deuda socios',       upIsGood: false },
  { key: 'deuda_financiera_neta', label: 'Deuda fin. neta',    upIsGood: false },
  { key: 'activo_total',          label: 'Activo total',       upIsGood: true },
  { key: 'pasivo_total',          label: 'Pasivo total',       upIsGood: false },
  { key: 'patrimonio_neto',       label: 'Patrimonio neto',    upIsGood: true },
  { key: 'fondo_maniobra',        label: 'Fondo de maniobra',  upIsGood: true },
];

const CHART_METRICS: { key: keyof DerivedKpis; label: string }[] = [
  { key: 'caja_disponible',       label: 'Caja' },
  { key: 'deuda_financiera_neta', label: 'Deuda fin. neta' },
  { key: 'patrimonio_neto',       label: 'Patrimonio neto' },
  { key: 'fondo_maniobra',        label: 'Fondo maniobra' },
  { key: 'activo_total',          label: 'Activo total' },
];

export function HistoricoKpisSection({ societyIdRef }: Props) {
  const [historico, setHistorico] = useState<PeriodoKpis[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [selIdx, setSelIdx]       = useState(0);
  const [chartKey, setChartKey]   = useState<keyof DerivedKpis>('caja_disponible');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const periodos = await getPeriodosBySociedad(societyIdRef);
        const asc = [...periodos].sort((a, b) => a.periodo.localeCompare(b.periodo));
        const results = await Promise.all(
          asc.map(async p => {
            const lineas = await getLineasBSS(societyIdRef, p.periodo);
            return { periodo: p.periodo, kpis: deriveKpis(lineas) };
          }),
        );
        if (cancelled) return;
        setHistorico(results);
        setSelIdx(Math.max(0, results.length - 1)); // por defecto, el más reciente
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error cargando histórico');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [societyIdRef]);

  const sel  = historico[selIdx];
  const prev = selIdx > 0 ? historico[selIdx - 1] : undefined;

  const chartData = useMemo(
    () => historico.map(h => ({
      periodo: fmtPeriodoCorto(h.periodo),
      valor: h.kpis[chartKey],
    })),
    [historico, chartKey],
  );

  if (loading) {
    return <div className="flex items-center gap-2 text-zinc-500 text-xs py-4"><RefreshCw size={13} className="animate-spin" />Cargando histórico...</div>;
  }
  if (error) {
    return <p className="text-xs text-rose-400 py-2">{error}</p>;
  }
  if (historico.length === 0 || !sel) {
    return (
      <div className="flex flex-col items-center py-8 gap-2 text-zinc-600">
        <History size={28} className="text-zinc-700" />
        <p className="text-xs font-medium uppercase tracking-widest">Sin balances importados</p>
        <p className="text-2xs text-zinc-700">Sube balances de sumas y saldos mensuales para construir el histórico</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navegador de períodos */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSelIdx(i => Math.max(0, i - 1))}
            disabled={selIdx === 0}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            aria-label="Período anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <select
            value={selIdx}
            onChange={e => setSelIdx(Number(e.target.value))}
            className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
          >
            {historico.map((h, i) => (
              <option key={h.periodo} value={i}>{fmtPeriodo(h.periodo)}</option>
            ))}
          </select>
          <button
            onClick={() => setSelIdx(i => Math.min(historico.length - 1, i + 1))}
            disabled={selIdx === historico.length - 1}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            aria-label="Período siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <span className="text-2xs font-medium text-zinc-600 uppercase tracking-widest">
          {historico.length} {historico.length === 1 ? 'período' : 'períodos'}
        </span>
      </div>

      {/* Grid de KPIs del período seleccionado, con delta vs período anterior */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {GRID_METRICS.map(m => (
          <KpiCell
            key={m.key}
            label={m.label}
            value={sel.kpis[m.key]}
            prevValue={prev?.kpis[m.key]}
            upIsGood={m.upIsGood}
          />
        ))}
      </div>
      {prev && (
        <p className="text-2xs text-zinc-600 -mt-3">
          Variación vs {fmtPeriodo(prev.periodo)}
        </p>
      )}

      {/* Evolución temporal */}
      {historico.length >= 2 ? (
        <div>
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            {CHART_METRICS.map(m => (
              <button
                key={m.key}
                onClick={() => setChartKey(m.key)}
                className={`px-3 py-1 rounded-full text-2xs font-medium uppercase tracking-wider border transition-colors ${
                  chartKey === m.key
                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                    : 'bg-transparent border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="histKpiFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="periodo" stroke="#52525b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#52525b" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} width={52} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e1f2a', borderColor: '#3f3f46', borderRadius: '8px' }}
                  labelStyle={{ color: '#f4f4f5' }}
                  formatter={(value: number) => [formatCurrency(value), CHART_METRICS.find(m => m.key === chartKey)?.label ?? '']}
                />
                <Area dataKey="valor" type="monotone" stroke="#3b82f6" strokeWidth={2} fill="url(#histKpiFill)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <p className="text-2xs text-zinc-600">
          Sube un segundo período para ver la evolución temporal.
        </p>
      )}
    </div>
  );
}

// ── Celda KPI con delta ───────────────────────────────────────────────────────

function KpiCell({ label, value, prevValue, upIsGood }: {
  label: string;
  value: number;
  prevValue: number | undefined;
  upIsGood: boolean;
}) {
  const delta    = prevValue !== undefined ? value - prevValue : null;
  const deltaPct = delta !== null && prevValue !== undefined && Math.abs(prevValue) > 0.005
    ? (delta / Math.abs(prevValue)) * 100
    : null;
  const isFlat = delta !== null && Math.abs(delta) < 0.005;
  const good   = delta !== null && (delta > 0) === upIsGood;

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
      <p className="text-2xs font-medium text-zinc-500 uppercase tracking-widest">{label}</p>
      <p className="text-lg font-light tracking-tight text-zinc-100 mt-1">{formatCurrency(value)}</p>
      {delta !== null && (
        isFlat ? (
          <p className="text-2xs text-zinc-600 mt-0.5">sin variación</p>
        ) : (
          <p className={`text-2xs font-medium mt-0.5 ${good ? 'text-emerald-500' : 'text-rose-400'}`}>
            {delta > 0 ? '▲' : '▼'} {formatCurrency(Math.abs(delta))}
            {deltaPct !== null && ` (${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`}
          </p>
        )
      )}
    </div>
  );
}
