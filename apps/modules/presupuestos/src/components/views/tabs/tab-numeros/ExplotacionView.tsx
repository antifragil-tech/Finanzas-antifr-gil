// Vista ejecutiva de análisis "Negocio operativo / explotación".
// Primera lectura: veredicto + calidad + KPIs clave + VAN/TIR + escenarios.
// Detalle (desglose operativo, valor de continuidad, supuestos) desplegable.
import type { AnalisisFinanciero, KpisExplotacion } from '../../../../lib/analisisFinanciero';
import {
  calcKpisExplotacion, semaforoMargenEbitda, semaforoPayback, semaforoTir,
} from '../../../../lib/analisisFinanciero';
import { evaluarCalidadExplotacion, evaluarVeredictoExplotacion } from '../../../../lib/explotacionInsights';
import type { ProyectoRow } from '../../../../lib/proyectosApi';
import { VeredictoBlock, CalidadBlock, EscenariosResumenTabla, type EscenarioFila } from './ejecutivo';
import { KpiCard, KpiGrid, Collapsible, SectionHint, fmt, fmtPct, fmtAno, safe } from './shared';

type Props = { analisis: AnalisisFinanciero; proyecto: ProyectoRow };

const EXPL_FILAS: EscenarioFila[] = [
  { label: 'Ingresos',  key: 'ingresosAnuales',   render: fmt },
  { label: 'EBITDA',    key: 'ebitdaAnual',        render: fmt },
  { label: 'Caja anual', key: 'fcfAnual',          render: fmt },
  { label: 'Payback',   key: 'paybackOperativo',   render: fmtAno },
  { label: 'VAN',       key: 'van',                render: fmt },
  { label: 'TIR',       key: 'tir',                render: fmtPct },
];

// ── Desglose (fila) ───────────────────────────────────────────────────────────

function Row({ label, value, bold, isSub, negativo }: { label: string; value: string; bold?: boolean; isSub?: boolean; negativo?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${bold ? 'border-y border-white/[0.06] my-1' : 'border-b border-white/[0.03] last:border-0'}`}>
      <span className={`${bold ? 'text-zinc-200 font-semibold' : isSub ? 'text-zinc-600 pl-3' : 'text-zinc-500'} text-xs`}>{label}</span>
      <span className={`text-xs tabular-nums ${bold ? 'font-semibold text-zinc-100' : negativo ? 'text-rose-400/90' : 'text-zinc-300'}`}>{value}</span>
    </div>
  );
}

// ── Bloques de detalle ────────────────────────────────────────────────────────

function DesgloseBlock({ analisis, k }: { analisis: AnalisisFinanciero; k: KpisExplotacion }) {
  const ingresos = analisis.ingresos_anuales_previstos ?? 0;
  if (ingresos <= 0) return null;
  const cvPct = analisis.costes_variables_pct ?? 0;
  const costesVar = ingresos * (cvPct / 100);
  const costesFijos = analisis.costes_fijos_anuales ?? 0;
  const capex = analisis.capex_mantenimiento_anual ?? 0;
  return (
    <Collapsible title="Desglose operativo" subtitle="De ingresos a caja libre, paso a paso">
      <div className="space-y-0.5">
        <Row label="Ingresos anuales" value={fmt(ingresos)} />
        <Row label={`Costes variables (${cvPct}%)`} value={fmt(-costesVar)} isSub negativo />
        <Row label="Margen de contribución" value={fmt(ingresos - costesVar)} />
        <Row label="Costes fijos" value={fmt(-costesFijos)} isSub negativo />
        <Row label="EBITDA anual" value={safe(k.ebitdaAnual, fmt)} bold />
        {capex > 0 && <Row label="CAPEX de mantenimiento" value={fmt(-capex)} isSub negativo />}
        {k.fiscalidadAplicada
          ? <Row label="Impuestos estimados" value={fmt(-(k.impuestosAnual ?? 0))} isSub negativo />
          : <Row label="Impuestos" value="No aplicados" isSub />}
        <Row label="Caja libre anual (FCF)" value={safe(k.fcfAnual, fmt)} bold />
      </div>
      {!k.fiscalidadAplicada && (
        <SectionHint>Análisis antes de impuestos. Actívalos en "Editar parámetros" → bloque "Fiscalidad" para ver la caja libre después de impuestos.</SectionHint>
      )}
    </Collapsible>
  );
}

function ValorContinuidadBlock({ k }: { k: KpisExplotacion }) {
  return (
    <Collapsible
      title="Valor de continuidad"
      subtitle={k.valorTerminalAplicado ? (k.metodoTerminalLabel ?? 'Aplicado') : 'No aplicado — supuesto conservador'}
      badge={<span className={`text-2xs font-semibold uppercase tracking-widest ${k.valorTerminalAplicado ? 'text-emerald-400' : 'text-zinc-600'}`}>{k.valorTerminalAplicado ? 'Activo' : 'Inactivo'}</span>}
    >
      {k.valorTerminalIncompleto && (
        <SectionHint>El valor de continuidad está activado pero faltan datos (múltiplo de EBITDA o valor manual). No se incluye en el VAN/TIR hasta completarlo.</SectionHint>
      )}
      {!k.valorTerminalAplicado && !k.valorTerminalIncompleto && (
        <p className="text-xs text-zinc-600">
          Sin valor de continuidad: se asume que el negocio no tiene valor residual al final del horizonte. Supuesto conservador.
          Actívalo en "Editar parámetros" → bloque "Valor de continuidad" (manual o múltiplo de EBITDA).
        </p>
      )}
      {k.valorTerminalAplicado && (
        <KpiGrid cols={3}>
          <KpiCard label="Método" value={k.metodoTerminalLabel ?? '—'} sub="Cómo se estima el valor final" />
          <KpiCard label="Valor terminal futuro" value={k.valorTerminalFuturo != null ? fmt(k.valorTerminalFuturo) : '—'} sub={`En el año ${k.horizonteUsado ?? 10}`} tooltip="Valor estimado del negocio al final del horizonte. Se suma al flujo del último año." />
          <KpiCard label="Valor presente del terminal" value={k.valorTerminalPresente != null ? fmt(k.valorTerminalPresente) : '—'} sub={k.tasaDescuentoUsada != null ? `Descontado al ${fmtPct(k.tasaDescuentoUsada)}` : 'Descontado a hoy'} tooltip="Valor terminal futuro traído a hoy. Es lo que aporta el valor de continuidad al VAN." />
        </KpiGrid>
      )}
    </Collapsible>
  );
}

function SupuestosBlock({ k }: { k: KpisExplotacion }) {
  return (
    <Collapsible title="Supuestos e horizonte" subtitle="Tasa, horizonte y crecimiento usados">
      <KpiGrid cols={3}>
        <KpiCard label="Tasa de descuento" value={k.tasaDescuentoUsada != null ? fmtPct(k.tasaDescuentoUsada) : '—'} sub="Para descontar los flujos" />
        <KpiCard label="Horizonte de análisis" value={k.horizonteUsado != null ? `${k.horizonteUsado} años` : '—'} sub="Años proyectados" />
        <KpiCard label="Crecimiento anual del FCF" value={k.crecimientoPct != null ? `${k.crecimientoPct}%` : '—'} sub="Aplicado a la caja libre (simplificación)" tooltip="Crecimiento anual aplicado directamente a la caja libre, como simplificación frente a proyectar cada línea." />
      </KpiGrid>
    </Collapsible>
  );
}

// ── Vista principal ───────────────────────────────────────────────────────────

export function ExplotacionView({ analisis, proyecto }: Props) {
  const k = calcKpisExplotacion(analisis);
  const cal = evaluarCalidadExplotacion(analisis);
  const ver = evaluarVeredictoExplotacion(analisis, k, cal.score, cal.faltantesCriticos);

  const tieneIngresos = (analisis.ingresos_anuales_previstos ?? 0) > 0;
  const tieneInversion = k.inversionInicial != null;
  const sinTasa = analisis.tasa_descuento == null;
  const sinHorizonte = analisis.horizonte_analisis_anios == null;

  return (
    <div className="space-y-5">
      {/* 1 · Veredicto */}
      <VeredictoBlock tipo={ver.tipo} motivo={ver.motivo} bullets={ver.bullets} />

      {/* 2 · Calidad del dato */}
      <CalidadBlock calidad={cal} />

      {/* 3 · KPIs principales */}
      <div className="space-y-2">
        <p className="text-2xs font-semibold text-zinc-600 uppercase tracking-widest">Indicadores clave</p>
        <KpiGrid cols={4}>
          <KpiCard
            label="Inversión inicial"
            value={safe(k.inversionInicial, fmt)}
            sub="Inversión + puesta en marcha + circulante"
            tooltip="Desembolso inicial del negocio: inversión/CAPEX inicial, puesta en marcha y capital circulante."
          />
          <KpiCard
            label="Ingresos anuales previstos"
            value={safe(k.ingresosAnuales, fmt)}
            sub="Facturación anual esperada"
            tooltip="Facturación anual esperada del negocio o explotación."
          />
          <KpiCard
            label="EBITDA anual"
            value={safe(k.ebitdaAnual, fmt)}
            sub="Ingresos − costes variables − costes fijos"
            semaforo={k.ebitdaAnual != null ? (k.ebitdaAnual > 0 ? 'verde' : 'rojo') : 'neutro'}
            tooltip="Beneficio operativo antes de intereses, impuestos, depreciaciones y amortizaciones. Mide la capacidad operativa real del negocio."
          />
          <KpiCard
            label="Margen EBITDA"
            value={safe(k.margenEbitda, fmtPct)}
            sub="EBITDA / ingresos"
            semaforo={semaforoMargenEbitda(k.margenEbitda)}
            tooltip="EBITDA dividido entre ingresos. Indica qué porcentaje de la facturación se convierte en beneficio operativo."
          />
          <KpiCard
            label="Punto de equilibrio de ingresos"
            value={safe(k.breakEvenIngresos, fmt)}
            sub="Ingresos mínimos para cubrir costes fijos"
            tooltip="Ingresos necesarios para cubrir todos los costes. Por debajo de este nivel, el negocio pierde dinero."
          />
          <KpiCard
            label="Flujo de caja libre anual (FCF)"
            value={safe(k.fcfAnual, fmt)}
            sub="EBITDA − CAPEX − impuestos"
            semaforo={k.fcfAnual != null ? (k.fcfAnual > 0 ? 'verde' : 'rojo') : 'neutro'}
            tooltip="Caja operativa estimada después de CAPEX de mantenimiento e impuestos. Es lo que el negocio genera de verdad cada año."
          />
          <KpiCard
            label="Recuperación de la inversión"
            value={safe(k.paybackOperativo, fmtAno)}
            sub="Inversión / caja libre anual"
            semaforo={semaforoPayback(k.paybackOperativo)}
            tooltip="Años necesarios para recuperar la inversión inicial con la caja libre generada."
          />
          <KpiCard
            label="Valor actual neto (VAN)"
            value={safe(k.van, fmt)}
            sub={k.tasaDescuentoUsada != null ? `Tasa ${fmtPct(k.tasaDescuentoUsada)} · ${k.horizonteUsado} años` : undefined}
            semaforo={k.van != null ? (k.van > 0 ? 'verde' : 'rojo') : 'neutro'}
            tooltip="Valor presente de la caja libre proyectada (más el valor de continuidad si se activa) descontada a la tasa exigida, menos la inversión inicial. VAN positivo = crea valor."
          />
          <KpiCard
            label="TIR"
            value={safe(k.tir, fmtPct)}
            sub="Rentabilidad anualizada del negocio"
            semaforo={semaforoTir(k.tir)}
            tooltip="Tasa que iguala a cero el VAN: rentabilidad anualizada del negocio considerando inversión inicial y caja libre proyectada."
          />
        </KpiGrid>
      </div>

      {/* 4 · Escenarios resumidos */}
      <EscenariosResumenTabla analisis={analisis} proyecto={proyecto} filas={EXPL_FILAS} />

      {/* Avisos de validación */}
      {!tieneIngresos && (
        <SectionHint>Faltan los ingresos anuales: el EBITDA, el VAN y la TIR no son definitivos. Complétalos en "Editar parámetros" → "Ingresos".</SectionHint>
      )}
      {tieneIngresos && !tieneInversion && (
        <SectionHint>Falta la inversión inicial: la recuperación, el VAN y la TIR no son definitivos. Añádela en "Editar parámetros" → "Inversión inicial".</SectionHint>
      )}
      {sinTasa && (
        <SectionHint>No se ha indicado tasa de descuento: se usa 8% por defecto. Ajústala en "Editar parámetros" → "Horizonte".</SectionHint>
      )}
      {sinHorizonte && (
        <SectionHint>No se ha indicado horizonte: se usan 10 años por defecto. Ajústalo en "Editar parámetros" → "Horizonte".</SectionHint>
      )}

      {/* 5 · Detalle desplegable */}
      <div className="space-y-3">
        <DesgloseBlock analisis={analisis} k={k} />
        <ValorContinuidadBlock k={k} />
        <SupuestosBlock k={k} />
      </div>
    </div>
  );
}
