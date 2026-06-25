// Vista ejecutiva de análisis "Compra / reforma / venta".
// Primera lectura: veredicto + calidad del dato + KPIs clave + VAN/TIR + escenarios.
// Detalle (desglose, financiación, sensibilidad, €/m²) en bloques desplegables.
import type { AnalisisFinanciero, KpisCompraVenta } from '../../../../lib/analisisFinanciero';
import {
  calcKpisCV, semaforoMargenCV, semaforoTir, semaforoLTV,
} from '../../../../lib/analisisFinanciero';
import { evaluarCalidadCV, evaluarVeredictoCV } from '../../../../lib/cvInsights';
import type { ProyectoRow } from '../../../../lib/proyectosApi';
import { VeredictoBlock, CalidadBlock, EscenariosResumenTabla, type EscenarioFila } from './ejecutivo';
import { KpiCard, KpiGrid, Collapsible, SectionHint, fmt, fmtPct, fmtAno, safe } from './shared';

type Props = { analisis: AnalisisFinanciero; proyecto: ProyectoRow };

// Métricas del resumen de escenarios para compra-venta.
const CV_FILAS: EscenarioFila[] = [
  { label: 'Precio venta', key: 'precioVenta',    render: fmt },
  { label: 'Coste total',  key: 'inversionTotal', render: fmt },
  { label: 'Beneficio',    key: 'beneficioNeto',  render: fmt },
  { label: 'Margen',       key: 'margenPct',      render: fmtPct },
  { label: 'VAN',          key: 'van',            render: fmt },
  { label: 'TIR',          key: 'tirEquity',      render: fmtPct },
];

// ── Desglose (fila) ───────────────────────────────────────────────────────────

function DesgloseRow({ label, value, bold, isSub, negativo }: { label: string; value: string; bold?: boolean; isSub?: boolean; negativo?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${bold ? 'border-y border-white/[0.06] my-1' : 'border-b border-white/[0.03] last:border-0'}`}>
      <span className={`${bold ? 'text-zinc-200 font-semibold' : isSub ? 'text-zinc-600 pl-3' : 'text-zinc-500'} text-xs`}>{label}</span>
      <span className={`text-xs tabular-nums ${bold ? 'font-semibold text-zinc-100' : negativo ? 'text-rose-400/90' : 'text-zinc-300'}`}>{value}</span>
    </div>
  );
}

// ── Bloques de detalle ────────────────────────────────────────────────────────

function DesgloseBlock({ analisis, k }: { analisis: AnalisisFinanciero; k: KpisCompraVenta }) {
  const compra   = analisis.precio_adquisicion ?? 0;
  const gastosAdq = analisis.gastos_adquisicion ?? 0;
  const obra     = analisis.presupuesto_obra ?? 0;
  const iva      = analisis.iva_soportado_obra ?? 0;
  const costeFin = analisis.coste_financiero_deuda ?? 0;
  const venta    = analisis.precio_venta_previsto ?? 0;
  const gastosVta = analisis.gastos_venta ?? 0;
  return (
    <Collapsible title="Desglose del resultado" subtitle="De la compra al beneficio neto, paso a paso">
      <div className="space-y-0.5">
        <DesgloseRow label="Precio de adquisición" value={fmt(compra)} negativo />
        <DesgloseRow label="Gastos de adquisición" value={fmt(gastosAdq)} isSub negativo />
        <DesgloseRow label="Obra / reforma" value={fmt(obra)} isSub negativo />
        {k.contingencia != null && k.contingencia > 0 && <DesgloseRow label="Contingencia de obra" value={fmt(k.contingencia)} isSub negativo />}
        {iva > 0 && <DesgloseRow label="IVA no recuperable" value={fmt(iva)} isSub negativo />}
        {costeFin > 0 && <DesgloseRow label="Coste financiero de la deuda" value={fmt(costeFin)} isSub negativo />}
        <DesgloseRow label="Coste total del proyecto" value={safe(k.inversionTotal, fmt)} bold />
        <DesgloseRow label="Precio de venta previsto" value={fmt(venta)} />
        {gastosVta > 0 && <DesgloseRow label="Gastos de venta" value={fmt(gastosVta)} isSub negativo />}
        {k.comisionAgente != null && k.comisionAgente > 0 && <DesgloseRow label="Comisión de agente" value={fmt(k.comisionAgente)} isSub negativo />}
        <DesgloseRow label="Beneficio antes de impuestos" value={safe(k.margenBruto, fmt)} bold />
        {k.impuestoSociedades != null && <DesgloseRow label="Impuesto de sociedades estimado" value={fmt(k.impuestoSociedades)} isSub negativo />}
        <DesgloseRow label="Beneficio neto esperado" value={safe(k.beneficioNeto, fmt)} bold />
      </div>
      <SectionHint>
        Para el margen se suman todos los costes. Para TIR/VAN se respeta el momento de cada flujo: los gastos de venta, la comisión y los impuestos se pagan a la salida, no en el año 0.
      </SectionHint>
    </Collapsible>
  );
}

function FinanciacionBlock({ analisis, k }: { analisis: AnalisisFinanciero; k: KpisCompraVenta }) {
  const deuda = analisis.deuda_promotora ?? 0;
  if (deuda <= 0) return null; // solo si hay deuda
  return (
    <Collapsible title="Financiación" subtitle="Préstamo promotor" badge={k.ltvDeudaBancaria != null ? <span className="text-xs text-zinc-400">LTV {fmtPct(k.ltvDeudaBancaria)}</span> : undefined}>
      <KpiGrid cols={4}>
        <KpiCard label="Deuda bancaria / promotora" value={fmt(deuda)} sub="Se devuelve a la venta" tooltip="Importe del préstamo promotor. Se devuelve íntegro con el precio de venta (una sola vez)." />
        {k.equity != null && <KpiCard label="Capital propio aportado" value={fmt(k.equity)} sub="Costes iniciales − deuda" tooltip="Capital propio realmente desembolsado durante la operación." />}
        {k.ltvDeudaBancaria != null && (
          <KpiCard label="Endeudamiento bancario sobre coste" value={fmtPct(k.ltvDeudaBancaria)} sub="Deuda promotora / coste total" semaforo={semaforoLTV(k.ltvDeudaBancaria)} tooltip="Deuda bancaria dividida entre el coste total del proyecto." />
        )}
        {analisis.coste_financiero_deuda != null && analisis.coste_financiero_deuda > 0 && (
          <KpiCard label="Coste financiero de la deuda" value={fmt(analisis.coste_financiero_deuda)} sub="Intereses del préstamo" tooltip="Intereses totales del préstamo promotor durante la operación." />
        )}
      </KpiGrid>
    </Collapsible>
  );
}

function SensibilidadVentaBlock({ analisis, proyecto }: Props) {
  const venta = analisis.precio_venta_previsto ?? 0;
  if (venta <= 0) return null;
  const variaciones = [-0.10, -0.05, 0, 0.05];
  const rows = variaciones.map(d => {
    const k = calcKpisCV({ ...analisis, precio_venta_previsto: venta * (1 + d) }, proyecto.fecha_inicio, proyecto.fecha_prevista_salida, analisis.superficie_arrendable_m2 ?? null);
    return { d, beneficio: k.beneficioNeto, margen: k.margenPct, van: k.van, tir: k.tirEquity };
  });
  return (
    <Collapsible title="Sensibilidad a precio de venta" subtitle="Qué pasa si el precio de venta varía">
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[480px]">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {['Precio venta', 'Beneficio neto', 'Margen', 'VAN', 'TIR'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-2xs font-semibold text-zinc-600 uppercase tracking-widest whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const malo = (r.beneficio != null && r.beneficio < 0) || (r.van != null && r.van < 0);
              return (
                <tr key={r.d} className={`border-b border-white/[0.03] last:border-0 ${r.d === 0 ? 'bg-white/[0.02]' : ''}`}>
                  <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">
                    {r.d === 0 ? 'Base' : `${r.d > 0 ? '+' : ''}${(r.d * 100).toFixed(0)}%`}{' '}
                    <span className="text-zinc-600">{fmt(venta * (1 + r.d))}</span>
                  </td>
                  <td className={`px-3 py-2 tabular-nums ${malo ? 'text-rose-400' : 'text-zinc-300'}`}>{r.beneficio != null ? fmt(r.beneficio) : '—'}</td>
                  <td className="px-3 py-2 tabular-nums text-zinc-300">{r.margen != null ? fmtPct(r.margen) : '—'}</td>
                  <td className={`px-3 py-2 tabular-nums ${r.van != null && r.van < 0 ? 'text-rose-400' : 'text-zinc-300'}`}>{r.van != null ? fmt(r.van) : '—'}</td>
                  <td className="px-3 py-2 tabular-nums text-zinc-300">{r.tir != null ? fmtPct(r.tir) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Collapsible>
  );
}

function CosteM2Block({ analisis, k }: { analisis: AnalisisFinanciero; k: KpisCompraVenta }) {
  const m2 = analisis.superficie_arrendable_m2 ?? null;
  if (!m2 || m2 <= 0 || k.costeM2 == null) return null; // ocultar si falta superficie
  const venta = analisis.precio_venta_previsto ?? 0;
  const ventaM2 = venta > 0 ? venta / m2 : null;
  return (
    <Collapsible title="Coste / m²" subtitle={`${m2.toLocaleString('es-ES')} m²`}>
      <KpiGrid cols={3}>
        <KpiCard label="Coste por metro cuadrado" value={fmt(k.costeM2)} sub="Coste total / superficie" tooltip="Coste total del proyecto dividido entre la superficie. Sirve para comparar promociones similares." />
        {ventaM2 != null && <KpiCard label="Precio de venta por m²" value={fmt(ventaM2)} sub="Precio de venta / superficie" />}
      </KpiGrid>
    </Collapsible>
  );
}

// ── Vista principal ───────────────────────────────────────────────────────────

export function CompraVentaView({ analisis, proyecto }: Props) {
  const k = calcKpisCV(analisis, proyecto.fecha_inicio, proyecto.fecha_prevista_salida, analisis.superficie_arrendable_m2 ?? null);
  const venta = analisis.precio_venta_previsto ?? 0;
  // Escenario pesimista (venta −10%) para el veredicto y la sensibilidad.
  const kPes = calcKpisCV({ ...analisis, precio_venta_previsto: venta * 0.9 }, proyecto.fecha_inicio, proyecto.fecha_prevista_salida, analisis.superficie_arrendable_m2 ?? null);
  const cal = evaluarCalidadCV(analisis);
  const ver = evaluarVeredictoCV(analisis, k, kPes, cal.score, cal.faltantesCriticos);

  const tieneVenta = venta > 0;
  const tienePlazo = k.anosUsados != null;
  const tieneDeuda = (analisis.deuda_promotora ?? 0) > 0;
  const isPct = analisis.impuesto_sociedades_pct ?? 26;

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
            label="Coste total del proyecto"
            value={safe(k.inversionTotal, fmt)}
            sub="Compra, gastos, obra y financiación"
            tooltip="Suma de compra, gastos de adquisición, obra, contingencia, IVA no recuperable, financiación, gastos de venta y comisión."
          />
          <KpiCard
            label="Precio de venta estimado"
            value={tieneVenta ? fmt(venta) : '—'}
            sub={k.inversionTotal != null && tieneVenta ? `Coste total: ${fmt(k.inversionTotal)}` : 'Pendiente de estimar'}
            tooltip="Precio de venta previsto de la operación."
          />
          <KpiCard
            label="Beneficio antes de impuestos"
            value={safe(k.margenBruto, fmt)}
            sub={k.margenPct != null ? fmtPct(k.margenPct) + ' sobre venta' : undefined}
            semaforo={semaforoMargenCV(k.margenPct)}
            tooltip="Diferencia entre el precio de venta previsto y el coste total del proyecto, antes de aplicar impuesto de sociedades."
          />
          <KpiCard
            label="Beneficio neto esperado"
            value={safe(k.beneficioNeto, fmt)}
            sub={`Después de IS estimado (${isPct}%)`}
            semaforo={k.beneficioNeto != null ? (k.beneficioNeto > 0 ? 'verde' : 'rojo') : 'neutro'}
            tooltip="Beneficio después de aplicar el impuesto de sociedades estimado. Es el resultado económico real para el inversor."
          />
          <KpiCard
            label="Margen sobre venta"
            value={safe(k.margenPct, fmtPct)}
            sub="Beneficio antes de impuestos / venta"
            semaforo={semaforoMargenCV(k.margenPct)}
            tooltip="Beneficio antes de impuestos dividido entre el precio de venta. Mide el colchón de la operación."
          />
          <KpiCard
            label="TIR neta estimada"
            value={safe(k.tirEquity, fmtPct)}
            sub={k.anosUsados ? `${k.anosUsados.toFixed(1)} años · después IS` : 'Falta plazo'}
            semaforo={semaforoTir(k.tirEquity)}
            tooltip="Rentabilidad anualizada neta del capital propio invertido, después del impuesto de sociedades. Año 0: capital aportado; salida: venta − deuda − costes de venta − impuestos."
          />
          <KpiCard
            label="Valor actual neto (VAN)"
            value={safe(k.van, fmt)}
            sub={`Tasa ${fmtPct(analisis.tasa_descuento ?? 0.08)} · neto IS`}
            semaforo={k.van != null ? (k.van > 0 ? 'verde' : 'rojo') : 'neutro'}
            tooltip="Valor presente del flujo de salida (venta − deuda − costes de venta − impuestos) descontado a la tasa exigida, menos el capital aportado. VAN positivo = crea valor."
          />
          <KpiCard
            label="Plazo"
            value={k.anosUsados != null ? fmtAno(k.anosUsados) : '—'}
            sub={k.usaFallbackObra ? 'Estimado con plazo de obra' : 'Entrada → venta'}
            tooltip="Duración total de la operación, desde la entrada en el activo hasta la venta."
          />
        </KpiGrid>
      </div>

      {/* 4 · Escenarios resumidos */}
      <EscenariosResumenTabla analisis={analisis} proyecto={proyecto} filas={CV_FILAS} />

      {/* Avisos de validación */}
      {k.equityInsuficiente && (
        <SectionHint>
          Capital aportado insuficiente o negativo (la deuda iguala o supera los costes iniciales): revisar estructura de financiación. La TIR sobre capital propio no es fiable en este caso.
        </SectionHint>
      )}
      {!tieneVenta && (
        <SectionHint>
          Falta el precio de venta previsto: el beneficio, la TIR y el VAN no son definitivos. Complétalo en "Editar parámetros" → bloque "Venta".
        </SectionHint>
      )}
      {tieneVenta && !tienePlazo && (
        <SectionHint>
          Falta el plazo de la operación: la TIR y el VAN no son definitivos. Añade fechas o el plazo total en "Editar parámetros" → "Horizonte y salida".
        </SectionHint>
      )}
      {k.usaFallbackObra && tienePlazo && (
        <SectionHint>
          TIR/VAN calculadas usando el plazo de obra como estimación. Para mayor precisión, introduce el plazo total de la operación.
        </SectionHint>
      )}

      {/* 5 · Detalle desplegable */}
      <div className="space-y-3">
        <DesgloseBlock analisis={analisis} k={k} />
        {tieneDeuda && <FinanciacionBlock analisis={analisis} k={k} />}
        <SensibilidadVentaBlock analisis={analisis} proyecto={proyecto} />
        <CosteM2Block analisis={analisis} k={k} />
      </div>
    </div>
  );
}
