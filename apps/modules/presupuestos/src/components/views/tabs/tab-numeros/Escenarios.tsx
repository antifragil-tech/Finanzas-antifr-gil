// Escenarios conservador / base / optimista por proyecto
// Carga automáticamente desde Supabase; genera desde el análisis base si no hay guardados.
import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  RefreshCw,
  Save,
  TrendingDown,
  TrendingUp,
  Minus,
  Cloud,
  CloudOff,
} from 'lucide-react';
import type { AnalisisFinanciero, TipoAnalisis } from '../../../../lib/analisisFinanciero';
import type { ProyectoRow } from '../../../../lib/proyectosApi';
import {
  generarEscenariosDesdeAnalisis,
  getEscenariosProyecto,
  upsertEscenarioProyecto,
  type EscenarioGenerado,
} from '../../../../lib/escenariosProyectoApi';
import type { EscenarioFinanciero } from '@alsari/types';
import { fmt, fmtPct, fmtX, fmtAno } from './shared';

// ── Tipos de estado ───────────────────────────────────────────────────────────

type ScenarioState =
  | { kind: 'loading' }
  | { kind: 'error_migration' } // tabla no existe aún
  | { kind: 'empty' } // sin datos en DB ni generados
  | { kind: 'generated'; escenarios: EscenarioGenerado[] } // generados en cliente, sin guardar
  | { kind: 'loaded'; escenarios: EscenarioGenerado[]; savedAt: string | null }; // cargados de Supabase

// ── Conversión DB → EscenarioGenerado ────────────────────────────────────────

function dbToGenerado(db: EscenarioFinanciero): EscenarioGenerado {
  return {
    escenario: db.escenario,
    nombre: db.nombre,
    parametros: db.parametros as unknown as AnalisisFinanciero,
    resultado: db.resultado,
  };
}

// ── KPIs por tipo ─────────────────────────────────────────────────────────────

type KpiDef = { key: string; label: string; render: (v: unknown) => string };

const KPIS_POR_TIPO: Record<TipoAnalisis, KpiDef[]> = {
  renta: [
    {
      key: 'yieldNetoCoste',
      label: 'Rentabilidad neta s/ coste',
      render: (v) => (typeof v === 'number' ? fmtPct(v) : '—'),
    },
    {
      key: 'noIAnual',
      label: 'Renta neta operativa (NOI)',
      render: (v) => (typeof v === 'number' ? fmt(v) : '—'),
    },
    {
      key: 'tirConResidual',
      label: 'TIR con valor residual',
      render: (v) => (typeof v === 'number' ? fmtPct(v) : '—'),
    },
    {
      key: 'dscr',
      label: 'Cobertura de deuda (DSCR)',
      render: (v) => (typeof v === 'number' ? fmtX(v) : '—'),
    },
    {
      key: 'valorReversion',
      label: 'Valor residual',
      render: (v) => (typeof v === 'number' ? fmt(v) : '—'),
    },
  ],
  compra_venta: [
    {
      key: 'margenBruto',
      label: 'Beneficio antes IS',
      render: (v) => (typeof v === 'number' ? fmt(v) : '—'),
    },
    {
      key: 'beneficioNeto',
      label: 'Beneficio neto',
      render: (v) => (typeof v === 'number' ? fmt(v) : '—'),
    },
    { key: 'moic', label: 'MOIC neto', render: (v) => (typeof v === 'number' ? fmtX(v) : '—') },
    {
      key: 'tirEquity',
      label: 'TIR neta',
      render: (v) => (typeof v === 'number' ? fmtPct(v) : '—'),
    },
  ],
  explotacion: [
    {
      key: 'ebitdaAnual',
      label: 'EBITDA anual',
      render: (v) => (typeof v === 'number' ? fmt(v) : '—'),
    },
    {
      key: 'margenEbitda',
      label: 'Margen EBITDA',
      render: (v) => (typeof v === 'number' ? fmtPct(v) : '—'),
    },
    {
      key: 'fcfAnual',
      label: 'Flujo de caja libre (FCF)',
      render: (v) => (typeof v === 'number' ? fmt(v) : '—'),
    },
    {
      key: 'paybackOperativo',
      label: 'Recuperación inversión',
      render: (v) => (typeof v === 'number' ? fmtAno(v) : '—'),
    },
  ],
  prestamo: [
    {
      key: 'tirInstrumento',
      label: 'TIR del instrumento',
      render: (v) => (typeof v === 'number' ? fmtPct(v) : '—'),
    },
    {
      key: 'interesTotales',
      label: 'Intereses totales',
      render: (v) => (typeof v === 'number' ? fmt(v) : '—'),
    },
    {
      key: 'perdidaEsperada',
      label: 'Pérdida esperada',
      render: (v) => (typeof v === 'number' ? fmt(v) : '—'),
    },
  ],
  capex_interno: [
    {
      key: 'paybackCapex',
      label: 'Recuperación del CAPEX',
      render: (v) => (typeof v === 'number' ? fmtAno(v) : '—'),
    },
    {
      key: 'vanCapex',
      label: 'VAN del CAPEX',
      render: (v) => (typeof v === 'number' ? fmt(v) : '—'),
    },
    {
      key: 'tirCapex',
      label: 'TIR del CAPEX',
      render: (v) => (typeof v === 'number' ? fmtPct(v) : '—'),
    },
    {
      key: 'valorResidual',
      label: 'Valor residual',
      render: (v) => (typeof v === 'number' ? fmt(v) : '—'),
    },
  ],
  alternativo: [
    { key: 'moic', label: 'MOIC', render: (v) => (typeof v === 'number' ? fmtX(v) : '—') },
    {
      key: 'tirEquity',
      label: 'Rentabilidad (TIR)',
      render: (v) => (typeof v === 'number' ? fmtPct(v) : '—'),
    },
    { key: 'van', label: 'VAN', render: (v) => (typeof v === 'number' ? fmt(v) : '—') },
  ],
};

// ── Estilos por escenario ─────────────────────────────────────────────────────

const ESCENARIO_STYLE = {
  conservador: {
    label: 'Conservador',
    desc: 'Hipótesis prudentes: menores ingresos, mayores costes o mayor plazo.',
    icon: TrendingDown,
    color: 'text-amber-400',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/5',
  },
  base: {
    label: 'Base',
    desc: 'Escenario central construido con los datos actuales del análisis.',
    icon: Minus,
    color: 'text-zinc-300',
    border: 'border-white/[0.08]',
    bg: 'bg-zinc-900/40',
  },
  optimista: {
    label: 'Optimista',
    desc: 'Hipótesis favorables: mejores ingresos, costes controlados o menor plazo.',
    icon: TrendingUp,
    color: 'text-emerald-400',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/5',
  },
};

// ── Tarjeta de escenario ──────────────────────────────────────────────────────

function EscenarioCard({
  eg,
  kpis,
  isBest,
  isWorst,
  esDeBD,
}: {
  eg: EscenarioGenerado;
  kpis: KpiDef[];
  isBest: boolean;
  isWorst: boolean;
  esDeBD: boolean;
}) {
  const style = ESCENARIO_STYLE[eg.escenario as keyof typeof ESCENARIO_STYLE];
  const Icon = style.icon;

  return (
    <div className={`space-y-3 rounded-2xl border p-5 ${style.border} ${style.bg}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={15} className={style.color} />
          <div>
            <p className={`text-sm font-semibold ${style.color}`}>{style.label}</p>
            <p className="text-2xs mt-0.5 leading-tight text-zinc-600">{style.desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isBest && (
            <span className="text-2xs rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-semibold uppercase tracking-widest text-emerald-400">
              Mejor
            </span>
          )}
          {isWorst && (
            <span className="text-2xs rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 font-semibold uppercase tracking-widest text-rose-400">
              Peor
            </span>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="space-y-2">
        {kpis.map((kpi) => {
          const raw = eg.resultado[kpi.key];
          const val = kpi.render(raw);
          return (
            <div key={kpi.key} className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">{kpi.label}</span>
              <span className={`font-medium ${val === '—' ? 'text-zinc-700' : 'text-zinc-200'}`}>
                {val}
              </span>
            </div>
          );
        })}
      </div>

      {/* Indicador guardado / sin guardar */}
      <div
        className={`text-2xs flex items-center gap-1 border-t border-white/[0.04] pt-1 font-medium ${esDeBD ? 'text-emerald-600' : 'text-amber-600'}`}
      >
        {esDeBD ? (
          <>
            <Cloud size={10} /> Guardado
          </>
        ) : (
          <>
            <CloudOff size={10} /> Sin guardar
          </>
        )}
      </div>
    </div>
  );
}

// ── Comparación conservador → optimista ──────────────────────────────────────

function ComparacionRow({ label, cons, opt }: { label: string; cons: unknown; opt: unknown }) {
  const cNum = typeof cons === 'number' && isFinite(cons) ? cons : null;
  const oNum = typeof opt === 'number' && isFinite(opt) ? opt : null;
  if (cNum === null || oNum === null) return null;
  const diff = oNum - cNum;
  const pct = cNum !== 0 ? diff / Math.abs(cNum) : null;
  return (
    <div className="flex items-center justify-between border-b border-white/[0.03] py-1.5 text-xs last:border-0">
      <span className="text-zinc-500">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-amber-400">
          {cNum.toLocaleString('es-ES', { maximumFractionDigits: 2 })}
        </span>
        <span className="text-zinc-700">→</span>
        <span className="text-emerald-400">
          {oNum.toLocaleString('es-ES', { maximumFractionDigits: 2 })}
        </span>
        {pct !== null && (
          <span className={`font-medium ${diff >= 0 ? 'text-emerald-500' : 'text-rose-400'}`}>
            ({diff >= 0 ? '+' : ''}
            {(pct * 100).toFixed(0)}%)
          </span>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

type Props = { analisis: AnalisisFinanciero; proyecto: ProyectoRow };

export function Escenarios({ analisis, proyecto }: Props) {
  const [state, setState] = useState<ScenarioState>({ kind: 'loading' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const tipo = analisis.tipo_analisis;
  const kpis = KPIS_POR_TIPO[tipo] ?? [];

  // ── Cargar escenarios guardados desde Supabase ────────────────────────────

  const cargarDesdeDB = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const rows = await getEscenariosProyecto(proyecto.id_ref, tipo);
      if (rows.length > 0) {
        const sorted = ['conservador', 'base', 'optimista']
          .map((esc) => rows.find((r) => r.escenario === esc))
          .filter((r): r is EscenarioFinanciero => r != null)
          .map(dbToGenerado);
        const lastUpdated =
          rows
            .map((r) => r.updated_at)
            .sort()
            .at(-1) ?? null;
        setState({ kind: 'loaded', escenarios: sorted, savedAt: lastUpdated });
      } else {
        setState({ kind: 'empty' });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('PGRST205') || msg.includes('escenarios_financieros')) {
        setState({ kind: 'error_migration' });
      } else {
        setState({ kind: 'empty' }); // tabla existe pero vacía u otro error menor
      }
    }
  }, [proyecto.id_ref, tipo]);

  // Re-carga al montar y cada vez que cambia proyecto o tipo
  useEffect(() => {
    void cargarDesdeDB();
  }, [cargarDesdeDB]);

  // ── Acciones ──────────────────────────────────────────────────────────────

  const tieneBase = !!(
    analisis.precio_adquisicion ||
    analisis.nominal_prestamo ||
    analisis.ingresos_anuales_previstos ||
    analisis.retorno_previsto_total ||
    analisis.renta_mensual_bruta
  );

  function handleGenerar() {
    if (!tieneBase) return;
    const eg = generarEscenariosDesdeAnalisis(
      analisis,
      proyecto.fecha_inicio,
      proyecto.fecha_prevista_salida,
    );
    setState({ kind: 'generated', escenarios: eg });
    setError('');
  }

  async function handleGuardar(escenarios: EscenarioGenerado[]) {
    setSaving(true);
    setError('');
    try {
      for (const eg of escenarios) {
        await upsertEscenarioProyecto(
          proyecto.id_ref,
          tipo,
          eg.escenario,
          eg.nombre,
          eg.parametros as unknown as Record<string, unknown>,
          eg.resultado,
        );
      }
      // Re-cargar desde DB para confirmar persistencia
      await cargarDesdeDB();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  // ── Helpers de render ─────────────────────────────────────────────────────

  const escenarios = state.kind === 'generated' || state.kind === 'loaded' ? state.escenarios : [];
  const esDeBD = state.kind === 'loaded';

  const firstKpiKey = kpis[0]?.key ?? '';
  const vals = escenarios.map((e) => ({
    esc: e.escenario,
    v: typeof e.resultado[firstKpiKey] === 'number' ? (e.resultado[firstKpiKey] as number) : null,
  }));
  const validVals = vals.filter((x) => x.v !== null);
  const bestEsc =
    validVals.length > 0 ? validVals.reduce((a, b) => (a.v! >= b.v! ? a : b)).esc : null;
  const worstEsc =
    validVals.length > 0 ? validVals.reduce((a, b) => (a.v! <= b.v! ? a : b)).esc : null;
  const cons = escenarios.find((e) => e.escenario === 'conservador');
  const opt = escenarios.find((e) => e.escenario === 'optimista');

  // ── Render ────────────────────────────────────────────────────────────────

  if (state.kind === 'loading')
    return (
      <div className="flex justify-center py-10">
        <Loader2 size={18} className="animate-spin text-zinc-600" />
      </div>
    );

  if (state.kind === 'error_migration')
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/5 py-10">
        <p className="text-sm font-medium text-amber-400">Tabla de escenarios no disponible</p>
        <p className="mt-1 max-w-sm text-center text-xs text-zinc-500">
          Aplica la migración{' '}
          <code className="text-zinc-400">20260531000002_proyecto_escenarios.sql</code> en Supabase
          Dashboard para activar esta funcionalidad.
        </p>
      </div>
    );

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
            Escenarios financieros
          </p>
          {state.kind === 'loaded' && state.savedAt != null && (
            <span className="text-2xs text-zinc-600">
              · Guardado{' '}
              {new Date(state.savedAt).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
              })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {tieneBase && (
            <button
              onClick={handleGenerar}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-zinc-300 transition-all hover:border-white/20 hover:text-white"
            >
              <RefreshCw size={12} />
              {state.kind === 'empty' ? 'Generar escenarios' : 'Regenerar'}
            </button>
          )}
          {state.kind === 'generated' && (
            <button
              onClick={() => void handleGuardar(state.escenarios)}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-600/20 px-4 py-2 text-xs font-medium text-violet-300 transition-all hover:bg-violet-600/30 disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Guardar
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {/* Estado vacío */}
      {(state.kind === 'empty' || escenarios.length === 0) && (
        <div className="rounded-2xl border border-dashed border-white/10 py-8 text-center">
          {tieneBase ? (
            <p className="text-sm text-zinc-600">
              No hay escenarios guardados. Genera escenarios desde el análisis base.
            </p>
          ) : (
            <p className="text-sm text-zinc-600">
              Completa primero los datos del análisis financiero para generar escenarios.
            </p>
          )}
        </div>
      )}

      {/* Tarjetas */}
      {escenarios.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {escenarios.map((eg) => (
              <EscenarioCard
                key={eg.escenario}
                eg={eg}
                kpis={kpis}
                isBest={eg.escenario === bestEsc && bestEsc !== worstEsc}
                isWorst={eg.escenario === worstEsc && bestEsc !== worstEsc}
                esDeBD={esDeBD}
              />
            ))}
          </div>

          {/* Rango conservador → optimista */}
          {cons &&
            opt &&
            kpis.some((kpi) => {
              const c = cons.resultado[kpi.key];
              const o = opt.resultado[kpi.key];
              return typeof c === 'number' && isFinite(c) && typeof o === 'number' && isFinite(o);
            }) && (
              <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/30 p-5">
                <p className="text-2xs mb-3 font-semibold uppercase tracking-widest text-zinc-500">
                  Rango conservador → optimista
                </p>
                {kpis.map((kpi) => (
                  <ComparacionRow
                    key={kpi.key}
                    label={kpi.label}
                    cons={cons.resultado[kpi.key]}
                    opt={opt.resultado[kpi.key]}
                  />
                ))}
              </div>
            )}
        </>
      )}
    </div>
  );
}
