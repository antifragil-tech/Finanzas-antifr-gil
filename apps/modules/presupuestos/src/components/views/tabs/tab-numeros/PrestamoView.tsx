// Vista ejecutiva de análisis "Préstamo / inversión financiera" (Alsari prestamista).
// Primera lectura: veredicto + calidad + KPIs + VAN/TIR + escenarios.
// Detalle (cuadro, garantías, riesgo, supuestos) desplegable.
import type { AnalisisFinanciero, KpisPrestamo, Semaforo } from '../../../../lib/analisisFinanciero';
import { calcKpisPrestamo, semaforoTir, semaforoProbImpago } from '../../../../lib/analisisFinanciero';
import { evaluarCalidadPrestamo, evaluarVeredictoPrestamo } from '../../../../lib/prestamoInsights';
import type { ProyectoRow } from '../../../../lib/proyectosApi';
import { VeredictoBlock, CalidadBlock, EscenariosResumenTabla, type EscenarioFila } from './ejecutivo';
import { KpiCard, KpiGrid, Collapsible, SectionHint, fmt, fmtPct, fmtX, safe } from './shared';

type Props = { analisis: AnalisisFinanciero; proyecto: ProyectoRow };

const PREST_FILAS: EscenarioFila[] = [
  { label: 'Cobro anual',      key: 'cobroAnual',        render: fmt },
  { label: 'Pérdida esperada', key: 'perdidaEsperada',   render: fmt },
  { label: 'VAN',              key: 'van',               render: fmt },
  { label: 'VAN ajustado',     key: 'vanAjustado',       render: fmt },
  { label: 'TIR',              key: 'tirInstrumento',    render: fmtPct },
  { label: 'Cobertura gar.',   key: 'coberturaGarantia', render: fmtX },
];

// Cobertura: ≥1,30 holgada · 1-1,30 razonable · <1 insuficiente
function semaforoCobertura(c: number | null): Semaforo {
  if (c == null) return 'neutro';
  if (c >= 1.3) return 'verde';
  if (c >= 1.0) return 'ambar';
  return 'rojo';
}

const SISTEMA_LABEL: Record<string, string> = { frances: 'Francés', aleman: 'Alemán', bullet: 'Bullet / interest-only' };

// ── Bloques de detalle ────────────────────────────────────────────────────────

function CuadroBlock({ analisis, k }: { analisis: AnalisisFinanciero; k: KpisPrestamo }) {
  if (k.cuotaMensual == null && k.interesTotales == null) {
    return (
      <Collapsible title="Cuadro de amortización" subtitle="Calendario de cobros">
        <p className="text-xs text-zinc-600">Falta el tipo de interés o el plazo para generar el cuadro de amortización.</p>
      </Collapsible>
    );
  }
  return (
    <Collapsible title="Cuadro de amortización" subtitle={`${SISTEMA_LABEL[k.sistema] ?? k.sistema} · ${k.plazoMeses ?? '—'} meses`}>
      <KpiGrid cols={4}>
        <KpiCard label="Capital prestado" value={analisis.nominal_prestamo != null ? fmt(analisis.nominal_prestamo) : '—'} sub="Desembolso en el año 0" />
        <KpiCard label="Cuota estimada" value={k.cuotaMensual != null ? fmt(k.cuotaMensual) : '—'} sub={`${SISTEMA_LABEL[k.sistema] ?? k.sistema} · mensual`} tooltip="Pago periódico estimado según el sistema de amortización." />
        <KpiCard label="Ingreso financiero esperado" value={k.interesTotales != null ? fmt(k.interesTotales) : '—'} sub="Suma de intereses cobrados" tooltip="Intereses totales que se cobran durante la vida del préstamo." />
        <KpiCard label="Cobro anual" value={k.cobroAnual != null ? fmt(k.cobroAnual) : '—'} sub="Cuota × 12" />
      </KpiGrid>
      <SectionHint>El VAN base descuenta este calendario de cobros a la tasa exigida. La garantía no se suma al VAN: solo mide cobertura.</SectionHint>
    </Collapsible>
  );
}

function GarantiasBlock({ analisis, k }: { analisis: AnalisisFinanciero; k: KpisPrestamo }) {
  return (
    <Collapsible
      title="Garantías y cobertura"
      subtitle={analisis.colateral ? analisis.colateral : 'Sin garantía registrada'}
      badge={k.coberturaGarantia != null ? <span className="text-xs text-zinc-400">Cobertura {fmtX(k.coberturaGarantia)}</span> : undefined}
    >
      {k.coberturaGarantia != null ? (
        <KpiGrid cols={3}>
          <KpiCard label="Valor de garantía" value={analisis.valor_garantia != null ? fmt(analisis.valor_garantia) : '—'} sub="Valor del colateral" />
          <KpiCard label="Capital prestado" value={analisis.nominal_prestamo != null ? fmt(analisis.nominal_prestamo) : '—'} />
          <KpiCard label="Cobertura de garantía" value={fmtX(k.coberturaGarantia)} sub="Valor garantía / capital" semaforo={semaforoCobertura(k.coberturaGarantia)} tooltip="Valor de la garantía dividido entre el capital prestado. ≥1,30 holgada · 1-1,30 razonable · <1 insuficiente. No se suma al VAN: solo mide cobertura." />
        </KpiGrid>
      ) : (
        <p className="text-xs text-zinc-600">
          {k.garantiaSinValor
            ? 'Hay garantía registrada pero sin valor cuantificado: no se puede calcular la cobertura. Añade el "Valor de garantía" en "Editar parámetros" → "Garantías".'
            : 'Sin garantía cuantificada. La operación se evalúa sin cobertura: el riesgo de impago pesa más.'}
        </p>
      )}
      <SectionHint>La garantía no se trata como cobro automático ni se asume su ejecución al 100%: solo indica cobertura frente al capital.</SectionHint>
    </Collapsible>
  );
}

function RiesgoBlock({ analisis, k }: { analisis: AnalisisFinanciero; k: KpisPrestamo }) {
  return (
    <Collapsible title="Riesgo e impago" subtitle="Pérdida esperada y VAN ajustado">
      {k.perdidaIncompleta && (
        <SectionHint>Riesgo incompleto: falta la probabilidad de impago (PD) o la LGD. La pérdida esperada y el VAN ajustado no son definitivos.</SectionHint>
      )}
      <KpiGrid cols={4}>
        <KpiCard label="Probabilidad de impago" value={analisis.probabilidad_impago_pct != null ? `${analisis.probabilidad_impago_pct}%` : '—'} sub="PD" semaforo={analisis.probabilidad_impago_pct != null ? semaforoProbImpago(analisis.probabilidad_impago_pct / 100) : 'neutro'} tooltip="Probabilidad estimada de que la contraparte no pague." />
        <KpiCard label="LGD" value={analisis.lgd_pct != null ? `${analisis.lgd_pct}%` : '—'} sub="Pérdida dado el impago" tooltip="Porcentaje del capital que se pierde si se produce el impago (Loss Given Default)." />
        <KpiCard label="Pérdida esperada" value={k.perdidaEsperada != null ? fmt(k.perdidaEsperada) : '—'} sub="Capital × PD × LGD" tooltip="Pérdida estadística esperada por riesgo de impago." />
        <KpiCard label="VAN ajustado por riesgo" value={k.vanAjustado != null ? fmt(k.vanAjustado) : '—'} sub="VAN base − VP(pérdida esperada)" semaforo={k.vanAjustado != null ? (k.vanAjustado > 0 ? 'verde' : 'rojo') : 'neutro'} tooltip="VAN base menos el valor presente de la pérdida esperada. No mezcla rentabilidad contractual y riesgo en una sola cifra: se muestran ambas lecturas." />
        {analisis.rating_interno && <KpiCard label="Rating interno" value={analisis.rating_interno} semaforo="neutro" />}
      </KpiGrid>
    </Collapsible>
  );
}

function SupuestosBlock({ k }: { k: KpisPrestamo }) {
  return (
    <Collapsible title="Supuestos" subtitle="Tasa, plazo y sistema usados">
      <KpiGrid cols={3}>
        <KpiCard label="Tasa de descuento" value={k.tasaDescuentoUsada != null ? fmtPct(k.tasaDescuentoUsada) : '—'} sub="Para descontar los cobros" />
        <KpiCard label="Plazo" value={k.plazoMeses != null ? `${k.plazoMeses} meses` : '—'} sub={k.plazoMeses != null ? `${(k.plazoMeses / 12).toFixed(1)} años` : undefined} />
        <KpiCard label="Sistema de amortización" value={SISTEMA_LABEL[k.sistema] ?? k.sistema} />
      </KpiGrid>
    </Collapsible>
  );
}

// ── Vista principal ───────────────────────────────────────────────────────────

export function PrestamoView({ analisis, proyecto }: Props) {
  const k = calcKpisPrestamo(analisis);
  const cal = evaluarCalidadPrestamo(analisis);
  const ver = evaluarVeredictoPrestamo(analisis, k, cal.score, cal.faltantesCriticos);

  const tieneCapital = (analisis.nominal_prestamo ?? 0) > 0;
  const sinTipo = !((analisis.tipo_interes_pct ?? 0) > 0);
  const sinPlazo = !((analisis.plazo_meses ?? 0) > 0);
  const sinTasa = analisis.tasa_descuento == null;

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
            label="Capital prestado"
            value={tieneCapital ? fmt(analisis.nominal_prestamo!) : '—'}
            sub={analisis.tipo_instrumento ?? 'préstamo'}
            tooltip="Importe nominal invertido o prestado. Sale en el año 0."
          />
          <KpiCard
            label="Tipo de interés anual"
            value={analisis.tipo_interes_pct != null ? `${analisis.tipo_interes_pct}%` : '—'}
            sub="TIN del instrumento"
            tooltip="Tipo de interés nominal anual del préstamo."
          />
          <KpiCard
            label="Ingreso financiero esperado"
            value={safe(k.interesTotales, fmt)}
            sub="Suma de intereses cobrados"
            tooltip="Intereses totales que se cobran durante la vida del préstamo."
          />
          <KpiCard
            label="Cuota estimada"
            value={safe(k.cuotaMensual, fmt)}
            sub={`${SISTEMA_LABEL[k.sistema] ?? k.sistema} · ${k.plazoMeses ?? '—'} meses`}
            tooltip="Pago periódico estimado según el sistema de amortización."
          />
          <KpiCard
            label="Valor actual neto (VAN)"
            value={safe(k.van, fmt)}
            sub={k.tasaDescuentoUsada != null ? `Base · tasa ${fmtPct(k.tasaDescuentoUsada)}` : 'Base'}
            semaforo={k.van != null ? (k.van > 0 ? 'verde' : 'rojo') : 'neutro'}
            tooltip="VAN base (contractual): valor presente de los cobros descontados a la tasa exigida, menos el capital prestado. No incluye el riesgo de impago."
          />
          <KpiCard
            label="VAN ajustado por riesgo"
            value={k.vanAjustado != null ? fmt(k.vanAjustado) : '—'}
            sub="VAN base − pérdida esperada (VP)"
            semaforo={k.vanAjustado != null ? (k.vanAjustado > 0 ? 'verde' : 'rojo') : 'neutro'}
            tooltip="VAN base menos el valor presente de la pérdida esperada por impago. Se muestra aparte del VAN base para no mezclar rentabilidad y riesgo."
          />
          <KpiCard
            label="TIR del instrumento"
            value={k.tirNoConverge ? 'No calculable' : safe(k.tirInstrumento, fmtPct)}
            sub="IRR anualizada de los cobros"
            semaforo={k.tirInstrumento != null ? semaforoTir(k.tirInstrumento) : 'neutro'}
            tooltip="Rentabilidad anualizada del instrumento: tasa que iguala a cero el valor presente de los flujos (desembolso y cobros)."
          />
          <KpiCard
            label="Plazo"
            value={k.plazoMeses != null ? `${(k.plazoMeses / 12).toFixed(1)} años` : '—'}
            sub={k.plazoMeses != null ? `${k.plazoMeses} meses` : 'Sin plazo'}
            tooltip="Duración del préstamo hasta el vencimiento."
          />
          <KpiCard
            label="Cobertura de garantía"
            value={k.coberturaGarantia != null ? fmtX(k.coberturaGarantia) : '—'}
            sub="Valor garantía / capital"
            semaforo={semaforoCobertura(k.coberturaGarantia)}
            tooltip="Valor de la garantía dividido entre el capital prestado. ≥1,30 holgada · 1-1,30 razonable · <1 insuficiente. No se suma al VAN."
          />
          <KpiCard
            label="Pérdida esperada"
            value={k.perdidaEsperada != null ? fmt(k.perdidaEsperada) : '—'}
            sub="Capital × PD × LGD"
            tooltip="Pérdida estadística esperada por riesgo de impago. Requiere probabilidad de impago y LGD."
          />
          <KpiCard
            label="Probabilidad de impago"
            value={analisis.probabilidad_impago_pct != null ? `${analisis.probabilidad_impago_pct}%` : '—'}
            sub="PD de la contraparte"
            semaforo={analisis.probabilidad_impago_pct != null ? semaforoProbImpago(analisis.probabilidad_impago_pct / 100) : 'neutro'}
            tooltip="Probabilidad estimada de que la contraparte no pague."
          />
        </KpiGrid>
      </div>

      {/* 4 · Escenarios resumidos */}
      <EscenariosResumenTabla analisis={analisis} proyecto={proyecto} filas={PREST_FILAS} />

      {/* Avisos de validación */}
      {!tieneCapital && (
        <SectionHint>Falta el capital prestado: la cuota, el VAN y la TIR no son definitivos. Complétalo en "Editar parámetros" → "Capital".</SectionHint>
      )}
      {tieneCapital && sinTipo && (
        <SectionHint>Falta el tipo de interés: los intereses y la TIR no son fiables. Añádelo en "Editar parámetros" → "Tipo y plazo".</SectionHint>
      )}
      {tieneCapital && !sinTipo && sinPlazo && (
        <SectionHint>Falta el plazo: sin cuadro de amortización no hay VAN ni TIR definitivos. Añádelo en "Editar parámetros" → "Tipo y plazo".</SectionHint>
      )}
      {k.tirNoConverge && (
        <SectionHint>Los cobros no recuperan el capital prestado: la TIR no es calculable. Revisa tipo, plazo y sistema de amortización.</SectionHint>
      )}
      {sinTasa && tieneCapital && (
        <SectionHint>No se ha indicado tasa de descuento: se usa 8% por defecto. Ajústala en "Editar parámetros" → "Supuestos".</SectionHint>
      )}

      {/* 5 · Detalle desplegable */}
      <div className="space-y-3">
        <CuadroBlock analisis={analisis} k={k} />
        <GarantiasBlock analisis={analisis} k={k} />
        <RiesgoBlock analisis={analisis} k={k} />
        <SupuestosBlock k={k} />
      </div>
    </div>
  );
}
