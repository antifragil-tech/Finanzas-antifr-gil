// Simulador "¿merece la pena financiar?" — 3 niveles de apalancamiento vs. base sin financiar.
import { useState, useMemo } from 'react';
import { Landmark, TrendingUp, TrendingDown, Info, ShieldCheck, AlertTriangle } from 'lucide-react';
import type { AnalisisFinanciero } from '../../../../lib/analisisFinanciero';
import type { ProyectoRow } from '../../../../lib/proyectosApi';
import {
  simularFinanciacion,
  SUPUESTOS_DEFAULT_RENTA,
  SUPUESTOS_DEFAULT_CV,
  type OpcionFinanciacion,
  type VeredictoNivel,
} from '../../../../lib/simulacionFinanciacion';
import { semaforoDSCR, semaforoTir, SEMAFORO_COLORS } from '../../../../lib/analisisFinanciero';
import { fmt, fmtPct, fmtX, lbl, inp } from './shared';

type Props = { analisis: AnalisisFinanciero; proyecto: ProyectoRow };
type Tipo = 'renta' | 'compra_venta';

// ── Estilos por nivel de apalancamiento (encabezado de la tarjeta) ────────────

const NIVEL_STYLE: Record<string, { color: string; border: string; bg: string }> = {
  sin:          { color: 'text-zinc-300',    border: 'border-white/[0.08]',   bg: 'bg-zinc-900/40' },
  conservadora: { color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5' },
  moderada:     { color: 'text-blue-400',    border: 'border-blue-500/20',    bg: 'bg-blue-500/5' },
  agresiva:     { color: 'text-amber-400',   border: 'border-amber-500/20',   bg: 'bg-amber-500/5' },
};

// ── Estilos del veredicto ─────────────────────────────────────────────────────

const VEREDICTO_UI: Record<VeredictoNivel, { color: string; border: string; bg: string; icon: typeof TrendingUp }> = {
  positivo: { color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', icon: TrendingUp },
  ajustado: { color: 'text-amber-400',   border: 'border-amber-500/20',   bg: 'bg-amber-500/5',   icon: AlertTriangle },
  reduce:   { color: 'text-rose-400',    border: 'border-rose-500/20',    bg: 'bg-rose-500/5',    icon: TrendingDown },
  na:       { color: 'text-zinc-400',    border: 'border-white/[0.08]',   bg: 'bg-zinc-900/40',   icon: Info },
};

function MetricRow({ label, value, semaforo }: { label: string; value: string; semaforo?: keyof typeof SEMAFORO_COLORS }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className={`font-medium ${value === '—' ? 'text-zinc-700' : semaforo ? SEMAFORO_COLORS[semaforo] : 'text-zinc-200'}`}>
        {value}
      </span>
    </div>
  );
}

function OpcionCard({ opcion, tipo, mejora }: { opcion: OpcionFinanciacion; tipo: Tipo; mejora: number | null }) {
  const style = NIVEL_STYLE[opcion.id] ?? NIVEL_STYLE.sin;
  const esSin = opcion.id === 'sin';
  // DSCR < 1 → riesgo alto: la renta no cubre la cuota. Marca visual aunque la TIR salga positiva.
  const riesgo = opcion.riesgoAlto;
  const borde = riesgo ? 'border-rose-500/30' : style!.border;
  const fondo = riesgo ? 'bg-rose-500/[0.03]' : style!.bg;

  return (
    <div className={`rounded-2xl border p-5 space-y-3 ${borde} ${fondo}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${style!.color}`}>{opcion.label}</p>
          <p className="text-2xs text-zinc-600 leading-tight mt-0.5">
            {esSin ? 'Compra 100% con capital propio' : `Deuda ${(opcion.ltv * 100).toFixed(0)}% de la inversión`}
          </p>
        </div>
        {!esSin && mejora != null && (
          <span
            title="TIR financiada vs TIR sin deuda"
            className={`px-2 py-0.5 text-2xs font-semibold rounded-full uppercase tracking-widest border shrink-0 ${
              mejora >= 0
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            {mejora >= 0 ? '+' : ''}{(mejora * 100).toFixed(1)} pp TIR
          </span>
        )}
      </div>

      {riesgo && (
        <div className="flex items-center gap-1.5 text-2xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2 py-1">
          <AlertTriangle size={11} /> Riesgo alto · la renta no cubre la cuota (DSCR &lt; 1)
        </div>
      )}

      <div className="space-y-2 pt-1">
        <MetricRow label="Deuda" value={esSin ? '—' : fmt(opcion.deuda)} />
        {!esSin && opcion.ltvValorActual != null && <MetricRow label="LTV s/ valor actual" value={fmtPct(opcion.ltvValorActual)} />}
        <MetricRow label="Capital propio necesario" value={fmt(opcion.equity)} />
        {!esSin && <MetricRow label="Capital liberado" value={fmt(opcion.equityLiberado)} />}

        {tipo === 'renta' && (
          <>
            <MetricRow label="Cuota mensual" value={opcion.cuotaMensual != null ? fmt(opcion.cuotaMensual) : '—'} />
            <MetricRow label="Cash flow anual" value={opcion.cashflowAnual != null ? fmt(opcion.cashflowAnual) : '—'} semaforo={opcion.cashflowAnual != null ? (opcion.cashflowAnual >= 0 ? 'verde' : 'rojo') : 'neutro'} />
            <MetricRow
              label="Cobertura deuda (DSCR)"
              value={opcion.dscr != null ? fmtX(opcion.dscr) : '—'}
              semaforo={opcion.dscr != null ? semaforoDSCR(opcion.dscr) : 'neutro'}
            />
            <MetricRow
              label="Rentab. s/ capital propio"
              value={opcion.rentabilidadEquity != null ? fmtPct(opcion.rentabilidadEquity) : '—'}
              semaforo={opcion.rentabilidadEquity != null ? semaforoTir(opcion.rentabilidadEquity) : 'neutro'}
            />
            <MetricRow
              label="TIR con valor residual"
              value={opcion.tir != null ? fmtPct(opcion.tir) : '—'}
              semaforo={opcion.tir != null ? semaforoTir(opcion.tir) : 'neutro'}
            />
            <MetricRow label="VAN" value={opcion.van != null ? fmt(opcion.van) : '—'} semaforo={opcion.van != null ? (opcion.van > 0 ? 'verde' : 'rojo') : 'neutro'} />
          </>
        )}

        {tipo === 'compra_venta' && (
          <>
            {!esSin && <MetricRow label="Coste financiero total" value={opcion.costeFinancieroTotal != null ? fmt(opcion.costeFinancieroTotal) : '—'} />}
            <MetricRow label="MOIC neto" value={opcion.moic != null ? fmtX(opcion.moic) : '—'} />
            <MetricRow
              label="TIR neta s/ capital propio"
              value={opcion.tir != null ? fmtPct(opcion.tir) : '—'}
              semaforo={opcion.tir != null ? semaforoTir(opcion.tir) : 'neutro'}
            />
            <MetricRow label="VAN" value={opcion.van != null ? fmt(opcion.van) : '—'} semaforo={opcion.van != null ? (opcion.van > 0 ? 'verde' : 'rojo') : 'neutro'} />
          </>
        )}
      </div>
    </div>
  );
}

export function Financiacion({ analisis, proyecto }: Props) {
  const defaults = analisis.tipo_analisis === 'compra_venta' ? SUPUESTOS_DEFAULT_CV : SUPUESTOS_DEFAULT_RENTA;

  const [interes, setInteres] = useState(String(defaults.tipoInteresPct));
  const [plazo, setPlazo]     = useState(String(defaults.plazoAnios));

  const sim = useMemo(() => simularFinanciacion(
    analisis, proyecto.fecha_inicio, proyecto.fecha_prevista_salida,
    { tipoInteresPct: parseFloat(interes) || 0, plazoAnios: parseFloat(plazo) || 1 },
  ), [analisis, proyecto.fecha_inicio, proyecto.fecha_prevista_salida, interes, plazo]);

  // ── No aplica ───────────────────────────────────────────────────────────────
  if (!sim.aplica) {
    return (
      <div className="flex flex-col items-center justify-center py-10 rounded-2xl border border-dashed border-white/10 gap-2 text-center px-6">
        <Landmark size={26} className="text-zinc-700" />
        <p className="text-sm text-zinc-500 max-w-md">{sim.motivoNoAplica}</p>
      </div>
    );
  }

  const tipo = sim.tipo as Tipo;
  const ver  = sim.veredicto;
  const vUi   = VEREDICTO_UI[ver.nivel];
  const VIcon = vUi.icon;

  // Medallas y comparativas: SIEMPRE la misma métrica (TIR financiada vs TIR sin deuda).
  const rentOf  = (o: OpcionFinanciacion): number | null => (tipo === 'renta' ? o.tir ?? o.rentabilidadEquity : o.tir) ?? null;
  const sinOpcion = sim.opciones.find(o => o.id === 'sin');
  const rentBase  = sinOpcion ? rentOf(sinOpcion) : null;
  const recomendada = ver.recomendada ? sim.opciones.find(o => o.id === ver.recomendada) ?? null : null;

  return (
    <div className="space-y-5">

      {/* Encabezado + supuestos */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Landmark size={14} className="text-violet-400" />
          <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">¿Merece la pena financiar?</p>
        </div>
        <div className="flex items-end gap-3">
          <div className="w-32">
            <label className={lbl}>Tipo de interés</label>
            <div className="relative">
              <input type="number" min="0" step="0.1" className={`${inp} pr-8`} value={interes} onChange={e => setInteres(e.target.value)} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-600">%</span>
            </div>
          </div>
          {tipo === 'renta' && (
            <div className="w-32">
              <label className={lbl}>Plazo</label>
              <div className="relative">
                <input type="number" min="1" step="1" className={`${inp} pr-12`} value={plazo} onChange={e => setPlazo(e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-600">años</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Banner ya financiado */}
      {sim.yaFinanciado && (
        <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
          <Info size={13} className="mt-px shrink-0" />
          <span>Este proyecto ya tiene deuda registrada. La simulación es un análisis teórico de cuánto cambiarían los retornos con distintos niveles de financiación.</span>
        </div>
      )}

      {/* Veredicto (DSCR → caja → rentabilidad → TIR → VAN) */}
      <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 border ${vUi.border} ${vUi.bg}`}>
        <VIcon size={15} className={`${vUi.color} mt-0.5 shrink-0`} />
        <div className="text-xs leading-relaxed">
          <p className="text-zinc-300">
            <strong className={vUi.color}>{ver.titulo}.</strong>{' '}{ver.mensaje}
          </p>
          {/* Dato secundario: rentabilidad del activo vs coste de la deuda (NO determina el veredicto) */}
          <p className="text-2xs text-zinc-600 mt-1">
            Dato: rentabilidad del activo {sim.rentabilidadActivo != null ? fmtPct(sim.rentabilidadActivo) : '—'}
            {tipo === 'compra_venta' ? ' anual' : ' s/ coste'} · coste de la deuda {fmtPct(sim.tipoInteres)}.
          </p>
          {recomendada && (
            <p className="text-zinc-500 mt-1.5 flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-emerald-500" />
              Opción recomendada: <strong className="text-zinc-300">{recomendada.label}</strong> (deuda {(recomendada.ltv * 100).toFixed(0)}%
              {tipo === 'renta' && recomendada.dscr != null ? `, DSCR ${fmtX(recomendada.dscr)}` : ''}
              {recomendada.tir != null ? `, TIR ${fmtPct(recomendada.tir)}` : ''}).
            </p>
          )}
        </div>
      </div>

      {/* Tarjetas de opciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {sim.opciones.map(o => {
          const r = rentOf(o);
          const mejora = (o.id !== 'sin' && r != null && rentBase != null) ? r - rentBase : null;
          return <OpcionCard key={o.id} opcion={o} tipo={tipo} mejora={mejora} />;
        })}
      </div>

      <p className="text-xs text-zinc-600 bg-zinc-900/60 border border-white/[0.05] rounded-lg px-3 py-2">
        {tipo === 'renta'
          ? 'Los escenarios financian un % de la INVERSIÓN/coste (50/60/70%); el "LTV s/ valor actual" es la lectura sobre la tasación. Hipoteca a tipo y plazo indicados (sistema francés). El DSCR mide si la renta neta cubre la cuota: por debajo de 1 la renta no llega a pagarla. La TIR/VAN financiados usan flujos = NOI − cuota cada año y, a la salida, el valor residual menos la deuda PENDIENTE (ya amortizada por las cuotas).'
          : 'Préstamo promotor tipo bullet: los intereses se acumulan y el principal se devuelve a la venta. El coste financiero reduce el beneficio, pero al necesitar menos capital propio la TIR del equity se amplifica si el retorno supera el coste de la deuda.'}
        {' '}Las medallas comparan siempre TIR financiada vs TIR sin deuda. Simulación orientativa; no se guarda.
      </p>
    </div>
  );
}
