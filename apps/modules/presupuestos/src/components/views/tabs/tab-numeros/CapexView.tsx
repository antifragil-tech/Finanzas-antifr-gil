// Vista ejecutiva de análisis "CAPEX interno".
// Primera lectura: veredicto + calidad + KPIs + VAN/TIR + escenarios.
// Detalle (desglose, depreciación, supuestos) desplegable.
import type { AnalisisFinanciero, KpisCapexInterno } from '../../../../lib/analisisFinanciero';
import {
  calcKpisCapexInterno,
  semaforoTir,
  semaforoPayback,
} from '../../../../lib/analisisFinanciero';
import { evaluarCalidadCapex, evaluarVeredictoCapex } from '../../../../lib/capexInsights';
import type { ProyectoRow } from '../../../../lib/proyectosApi';
import {
  VeredictoBlock,
  CalidadBlock,
  EscenariosResumenTabla,
  type EscenarioFila,
} from './ejecutivo';
import { KpiCard, KpiGrid, Collapsible, SectionHint, fmt, fmtPct, fmtAno, safe } from './shared';

type Props = { analisis: AnalisisFinanciero; proyecto: ProyectoRow };

const CAPEX_FILAS: EscenarioFila[] = [
  { label: 'Ahorro anual', key: 'ahorroBruto', render: fmt },
  { label: 'Caja neta anual', key: 'cajaNetaAnual', render: fmt },
  { label: 'Payback', key: 'paybackCapex', render: fmtAno },
  { label: 'VAN', key: 'vanCapex', render: fmt },
  { label: 'TIR', key: 'tirCapex', render: fmtPct },
];

// ── Desglose (fila) ───────────────────────────────────────────────────────────

function Row({
  label,
  value,
  bold,
  isSub,
  negativo,
}: {
  label: string;
  value: string;
  bold?: boolean;
  isSub?: boolean;
  negativo?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 ${bold ? 'my-1 border-y border-white/[0.06]' : 'border-b border-white/[0.03] last:border-0'}`}
    >
      <span
        className={`${bold ? 'font-semibold text-zinc-200' : isSub ? 'pl-3 text-zinc-600' : 'text-zinc-500'} text-xs`}
      >
        {label}
      </span>
      <span
        className={`text-xs tabular-nums ${bold ? 'font-semibold text-zinc-100' : negativo ? 'text-rose-400/90' : 'text-zinc-300'}`}
      >
        {value}
      </span>
    </div>
  );
}

// ── Bloques de detalle ────────────────────────────────────────────────────────

function DesgloseBlock({ k }: { k: KpisCapexInterno }) {
  if (k.inversionCapex == null && k.ahorroBruto == null) return null;
  return (
    <Collapsible
      title="Desglose del CAPEX"
      subtitle="De la inversión a la caja neta y el valor residual"
    >
      <div className="space-y-0.5">
        <Row
          label="Inversión CAPEX (año 0)"
          value={k.inversionCapex != null ? fmt(-k.inversionCapex) : '—'}
          negativo
        />
        <Row
          label="Ahorro / beneficio anual bruto"
          value={k.ahorroBruto != null ? fmt(k.ahorroBruto) : '—'}
        />
        {k.capexMantenimiento != null && (
          <Row label="CAPEX de mantenimiento" value={fmt(-k.capexMantenimiento)} isSub negativo />
        )}
        <Row
          label="Caja neta anual"
          value={k.cajaNetaAnual != null ? fmt(k.cajaNetaAnual) : '—'}
          bold
        />
        <Row
          label="Vida útil"
          value={k.vidaUtilUsada != null ? `${k.vidaUtilUsada} años` : '—'}
          isSub
        />
        <Row
          label={`Valor residual${k.residualPorDefecto ? ' (0% por defecto)' : k.residualPct != null ? ` (${k.residualPct}% del coste)` : ''}`}
          value={k.valorResidual != null ? fmt(k.valorResidual) : '—'}
          isSub
        />
      </div>
      <SectionHint>
        El VAN/TIR usan la caja neta anual (ahorro − mantenimiento) durante la vida útil, más el
        valor residual sumado al último año. La depreciación es contable y no entra en la caja.
      </SectionHint>
    </Collapsible>
  );
}

function DepreciacionBlock({ analisis, k }: { analisis: AnalisisFinanciero; k: KpisCapexInterno }) {
  return (
    <Collapsible title="Depreciación (dato contable)" subtitle="No afecta a la caja ni al VAN/TIR">
      <KpiGrid cols={3}>
        <KpiCard
          label="Depreciación anual"
          value={k.depreciacionAnual != null ? fmt(k.depreciacionAnual) : '—'}
          sub={analisis.depreciacion_tipo ?? 'lineal'}
          tooltip="Pérdida contable anual estimada del valor del activo según su vida útil. No es una salida de caja."
        />
        <KpiCard
          label="Valor residual del activo"
          value={k.valorResidual != null ? fmt(k.valorResidual) : '—'}
          sub={k.residualPct != null ? `${k.residualPct}% del coste` : undefined}
          tooltip="Valor estimado del activo al final de su vida útil."
        />
        <KpiCard
          label="Vida útil"
          value={k.vidaUtilUsada != null ? `${k.vidaUtilUsada} años` : '—'}
        />
      </KpiGrid>
      <SectionHint>
        La depreciación se muestra como referencia contable. Sin fiscalidad activada, no afecta al
        VAN ni a la TIR.
      </SectionHint>
    </Collapsible>
  );
}

function SupuestosBlock({ k }: { k: KpisCapexInterno }) {
  return (
    <Collapsible title="Supuestos" subtitle="Tasa, vida útil y residual usados">
      <KpiGrid cols={3}>
        <KpiCard
          label="Tasa de descuento"
          value={k.tasaUsada != null ? fmtPct(k.tasaUsada) : '—'}
          sub="Para descontar la caja"
        />
        <KpiCard
          label="Vida útil"
          value={k.vidaUtilUsada != null ? `${k.vidaUtilUsada} años` : '—'}
          sub="Horizonte del análisis"
        />
        <KpiCard
          label="Valor residual %"
          value={k.residualPct != null ? `${k.residualPct}%` : '—'}
          sub={k.residualPorDefecto ? '0% por defecto (conservador)' : 'Del coste CAPEX'}
        />
      </KpiGrid>
    </Collapsible>
  );
}

// ── Vista principal ───────────────────────────────────────────────────────────

export function CapexView({ analisis, proyecto }: Props) {
  const k = calcKpisCapexInterno(analisis);
  const cal = evaluarCalidadCapex(analisis);
  const ver = evaluarVeredictoCapex(analisis, k, cal.score, cal.faltantesCriticos);

  const tieneInversion = k.inversionCapex != null;
  const tieneAhorro = (analisis.beneficio_esperado_anual ?? 0) > 0;
  const sinVida = !((analisis.vida_util_activo_anios ?? 0) > 0);
  const sinTasa = analisis.tasa_descuento_interna == null && analisis.tasa_descuento == null;

  return (
    <div className="space-y-5">
      {/* 1 · Veredicto */}
      <VeredictoBlock tipo={ver.tipo} motivo={ver.motivo} bullets={ver.bullets} />

      {/* 2 · Calidad del dato */}
      <CalidadBlock calidad={cal} />

      {/* 3 · KPIs principales */}
      <div className="space-y-2">
        <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-600">
          Indicadores clave
        </p>
        <KpiGrid cols={4}>
          <KpiCard
            label="Inversión CAPEX"
            value={safe(k.inversionCapex, fmt)}
            sub="Desembolso inicial (año 0)"
            tooltip="Inversión realizada en activo, mejora, software, maquinaria o infraestructura interna."
          />
          <KpiCard
            label="Beneficio o ahorro anual esperado"
            value={safe(k.ahorroBruto, fmt)}
            sub="Bruto (antes de mantenimiento)"
            tooltip="Impacto económico anual estimado del CAPEX, ya sea por ahorro de costes o aumento de ingresos."
          />
          <KpiCard
            label="Impacto en caja anual"
            value={k.cajaNetaAnual != null ? fmt(k.cajaNetaAnual) : '—'}
            sub="Ahorro bruto − CAPEX mantenimiento"
            semaforo={k.cajaNetaAnual != null ? (k.cajaNetaAnual > 0 ? 'verde' : 'rojo') : 'neutro'}
            tooltip="Caja neta anual que genera el CAPEX: ahorro/beneficio bruto menos el coste de mantenimiento. Es la base del VAN, la TIR y el payback."
          />
          <KpiCard
            label="Recuperación del CAPEX"
            value={safe(k.paybackCapex, fmtAno)}
            sub="Inversión / caja neta anual"
            semaforo={semaforoPayback(k.paybackCapex)}
            tooltip="Años necesarios para recuperar la inversión mediante la caja neta anual generada."
          />
          <KpiCard
            label="Valor actual neto del CAPEX (VAN)"
            value={safe(k.vanCapex, fmt)}
            sub={
              k.tasaUsada != null
                ? `Tasa ${fmtPct(k.tasaUsada)}${k.vidaUtilUsada ? ` · ${k.vidaUtilUsada} años` : ''}`
                : undefined
            }
            semaforo={k.vanCapex != null ? (k.vanCapex > 0 ? 'verde' : 'rojo') : 'neutro'}
            tooltip="Valor presente de la caja neta anual y del valor residual descontados a la tasa exigida, menos la inversión. VAN positivo = crea valor."
          />
          <KpiCard
            label="TIR del CAPEX"
            value={k.tirNoConverge ? 'No calculable' : safe(k.tirCapex, fmtPct)}
            sub="Rentabilidad anualizada"
            semaforo={k.tirCapex != null ? semaforoTir(k.tirCapex) : 'neutro'}
            tooltip="Tasa que iguala a cero el VAN: rentabilidad anualizada de la inversión interna con su caja neta y valor residual."
          />
          <KpiCard
            label="Vida útil"
            value={k.vidaUtilUsada != null ? `${k.vidaUtilUsada} años` : '—'}
            sub="Horizonte del análisis"
            tooltip="Años durante los que el activo genera ahorro/beneficio. Es el horizonte del VAN/TIR."
          />
          <KpiCard
            label="Valor residual del activo"
            value={safe(k.valorResidual, fmt)}
            sub={
              k.residualPorDefecto
                ? '0% (supuesto conservador)'
                : k.residualPct != null
                  ? `${k.residualPct}% del coste`
                  : undefined
            }
            tooltip="Valor estimado del activo al final de su vida útil. Se suma al último año y se descuenta."
          />
          <KpiCard
            label="Depreciación anual"
            value={safe(k.depreciacionAnual, fmt)}
            sub={`${analisis.depreciacion_tipo ?? 'lineal'} · dato contable`}
            tooltip="Pérdida contable anual estimada del valor del activo. No es una salida de caja ni afecta al VAN/TIR."
          />
        </KpiGrid>
      </div>

      {/* 4 · Escenarios resumidos */}
      <EscenariosResumenTabla analisis={analisis} proyecto={proyecto} filas={CAPEX_FILAS} />

      {/* Avisos de validación */}
      {!tieneInversion && (
        <SectionHint>
          Falta la inversión CAPEX: el payback, el VAN y la TIR no son definitivos. Añádela en
          "Editar parámetros" → "Inversión".
        </SectionHint>
      )}
      {tieneInversion && !tieneAhorro && (
        <SectionHint>
          Falta el beneficio/ahorro anual: el payback, el VAN y la TIR no son definitivos. Añádelo
          en "Editar parámetros" → "Beneficio / ahorro".
        </SectionHint>
      )}
      {tieneInversion && tieneAhorro && sinVida && (
        <SectionHint>
          Falta la vida útil: sin horizonte no hay VAN ni TIR definitivos. Añádela en "Editar
          parámetros" → "Vida útil".
        </SectionHint>
      )}
      {k.cajaNetaNegativa && (
        <SectionHint>
          La caja neta anual es ≤ 0: el CAPEX de mantenimiento iguala o supera el ahorro. El payback
          no es definitivo y conviene revisar la operación.
        </SectionHint>
      )}
      {k.tirNoConverge && !k.cajaNetaNegativa && (
        <SectionHint>
          Los flujos no recuperan la inversión: la TIR no es calculable. Revisa el ahorro, la vida
          útil y el valor residual.
        </SectionHint>
      )}
      {sinTasa && tieneInversion && (
        <SectionHint>
          No se ha indicado tasa de descuento: se usa 8% por defecto. Ajústala en "Editar
          parámetros" → "Supuestos avanzados".
        </SectionHint>
      )}

      {/* 5 · Detalle desplegable */}
      <div className="space-y-3">
        <DesgloseBlock k={k} />
        <DepreciacionBlock analisis={analisis} k={k} />
        <SupuestosBlock k={k} />
      </div>
    </div>
  );
}
