// Bloques de UI compartidos del "patrón ejecutivo" de los análisis financieros.
// Reutilizables por todos los tipos (renta, compra-venta, explotación, ...).
//   · VeredictoBlock         — tarjeta de veredicto (Atractivo/Defensivo/...).
//   · CalidadBlock           — calidad del dato (% + desglose desplegable).
//   · EscenariosResumenTabla — tabla compacta Pesimista/Base/Optimista.
import { useMemo } from 'react';
import { Sparkles, ShieldCheck, ShieldAlert, Gauge, AlertTriangle, CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import type { AnalisisFinanciero } from '../../../../lib/analisisFinanciero';
import type { ProyectoRow } from '../../../../lib/proyectosApi';
import type { VeredictoTipo, CalidadNivel, CalidadDato } from '../../../../lib/insights';
import { generarEscenariosDesdeAnalisis } from '../../../../lib/escenariosProyectoApi';
import { Collapsible } from './shared';

// ── Veredicto ─────────────────────────────────────────────────────────────────

const VEREDICTO_STYLE: Record<VeredictoTipo, { color: string; border: string; bg: string; icon: typeof Sparkles }> = {
  Atractivo: { color: 'text-emerald-400', border: 'border-emerald-500/25', bg: 'bg-emerald-500/[0.06]', icon: Sparkles },
  Defensivo: { color: 'text-blue-400',    border: 'border-blue-500/25',    bg: 'bg-blue-500/[0.06]',    icon: ShieldCheck },
  Agresivo:  { color: 'text-amber-400',   border: 'border-amber-500/25',   bg: 'bg-amber-500/[0.06]',   icon: ShieldAlert },
  Revisar:   { color: 'text-rose-400',    border: 'border-rose-500/25',    bg: 'bg-rose-500/[0.06]',    icon: AlertTriangle },
};

export function VeredictoBlock({ tipo, motivo, bullets }: { tipo: VeredictoTipo; motivo: string; bullets: string[] }) {
  const s = VEREDICTO_STYLE[tipo];
  const Icon = s.icon;
  return (
    <div className={`rounded-2xl border p-5 ${s.border} ${s.bg}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] ${s.color}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Veredicto</p>
            <span className={`text-sm font-semibold ${s.color}`}>{tipo}</span>
          </div>
          <p className="text-sm text-zinc-300 mt-1">{motivo}</p>
          <ul className="mt-2.5 space-y-1">
            {bullets.map((b, i) => (
              <li key={i} className="text-xs text-zinc-500 flex items-start gap-1.5">
                <span className={`mt-1 h-1 w-1 rounded-full shrink-0 ${s.color.replace('text-', 'bg-')}`} />
                {b}
              </li>
            ))}
          </ul>
          <p className="text-2xs text-zinc-700 mt-3">Ayuda interna de análisis — no es una recomendación de inversión definitiva.</p>
        </div>
      </div>
    </div>
  );
}

// ── Calidad del dato ──────────────────────────────────────────────────────────

const CALIDAD_STYLE: Record<CalidadNivel, { color: string; bar: string }> = {
  Alta:  { color: 'text-emerald-400', bar: 'bg-emerald-400' },
  Media: { color: 'text-amber-400',   bar: 'bg-amber-400' },
  Baja:  { color: 'text-rose-400',    bar: 'bg-rose-400' },
};

const ESTADO_ICON = {
  completo: { icon: CheckCircle2, color: 'text-emerald-500' },
  estimado: { icon: MinusCircle,  color: 'text-amber-500' },
  faltante: { icon: XCircle,      color: 'text-rose-500' },
} as const;

export function CalidadBlock({ calidad }: { calidad: CalidadDato }) {
  const cal = calidad;
  const s = CALIDAD_STYLE[cal.nivel];
  return (
    <Collapsible
      title="Calidad del análisis"
      subtitle={`${cal.completos.length} completos · ${cal.estimados.length} estimados · ${cal.faltantes.length} faltantes`}
      badge={
        <div className="flex items-center gap-2">
          <Gauge size={13} className={s.color} />
          <span className={`text-sm font-semibold ${s.color}`}>{cal.score}%</span>
          <span className={`text-2xs font-semibold uppercase tracking-widest ${s.color}`}>{cal.nivel}</span>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div className={`h-full ${s.bar} transition-all`} style={{ width: `${cal.score}%` }} />
        </div>
        {cal.faltantesCriticos.length > 0 && (
          <p className="text-xs text-rose-400 flex items-start gap-1.5">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            Faltan datos críticos: {cal.faltantesCriticos.join(', ')}.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {cal.campos.map(c => {
            const ei = ESTADO_ICON[c.estado];
            const Icon = ei.icon;
            return (
              <div key={c.label} className="flex items-center gap-2 text-xs">
                <Icon size={12} className={`${ei.color} shrink-0`} />
                <span className={c.estado === 'faltante' ? 'text-zinc-500' : 'text-zinc-400'}>{c.label}</span>
                {c.critico && c.estado === 'faltante' && <span className="text-2xs text-rose-500/80 uppercase tracking-wider">clave</span>}
              </div>
            );
          })}
        </div>
        <p className="text-2xs text-zinc-700">
          <span className="text-emerald-500">●</span> Completo · <span className="text-amber-500">●</span> Estimado (valor por defecto) · <span className="text-rose-500">●</span> Faltante
        </p>
      </div>
    </Collapsible>
  );
}

// ── Escenarios resumidos (compacto) ───────────────────────────────────────────

// Una fila = una métrica con su clave en el `resultado` del escenario y su formato.
export type EscenarioFila = { label: string; key: string; render: (v: number) => string };

export function EscenariosResumenTabla({
  analisis, proyecto, filas,
}: {
  analisis: AnalisisFinanciero;
  proyecto: ProyectoRow;
  filas: EscenarioFila[];
}) {
  const esc = useMemo(
    () => generarEscenariosDesdeAnalisis(analisis, proyecto.fecha_inicio, proyecto.fecha_prevista_salida),
    [analisis, proyecto.fecha_inicio, proyecto.fecha_prevista_salida],
  );
  const cons = esc.find(e => e.escenario === 'conservador')?.resultado ?? {};
  const base = esc.find(e => e.escenario === 'base')?.resultado ?? {};
  const opt  = esc.find(e => e.escenario === 'optimista')?.resultado ?? {};

  const num = (r: Record<string, unknown>, k: string): number | null =>
    typeof r[k] === 'number' && isFinite(r[k] as number) ? r[k] as number : null;

  const cell = (r: Record<string, unknown>, f: EscenarioFila) => {
    const v = num(r, f.key);
    return v != null ? f.render(v) : '—';
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/30 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
        <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Escenarios</p>
        <p className="text-2xs text-zinc-700">Pesimista · Base · Optimista</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[440px]">
          <thead>
            <tr className="border-b border-white/[0.05]">
              <th className="px-4 py-2 text-left text-2xs font-semibold text-zinc-600 uppercase tracking-widest">Métrica</th>
              <th className="px-4 py-2 text-right text-2xs font-semibold text-amber-500/80 uppercase tracking-widest">Pesimista</th>
              <th className="px-4 py-2 text-right text-2xs font-semibold text-zinc-400 uppercase tracking-widest">Base</th>
              <th className="px-4 py-2 text-right text-2xs font-semibold text-emerald-500/80 uppercase tracking-widest">Optimista</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.key} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-2 text-zinc-500">{f.label}</td>
                <td className="px-4 py-2 text-right tabular-nums text-amber-300/90 whitespace-nowrap">{cell(cons, f)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-zinc-200 whitespace-nowrap">{cell(base, f)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-emerald-300/90 whitespace-nowrap">{cell(opt, f)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
