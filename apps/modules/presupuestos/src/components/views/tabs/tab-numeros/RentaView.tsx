// Vista ejecutiva de análisis "Patrimonial en renta".
// Primera lectura: veredicto + calidad del dato + KPIs clave + VAN/TIR + escenarios.
// Detalle (flujo anual, financiación, fiscalidad, mercado) en bloques desplegables.
import { AlertTriangle } from 'lucide-react';
import type { AnalisisFinanciero } from '../../../../lib/analisisFinanciero';
import {
  calcKpisRentaExtended, calcFlujoAnualRenta, calcFinanciacionRenta,
  semaforoTir, semaforoYieldRenta, semaforoDSCR, semaforoLTV, semaforoPayback,
} from '../../../../lib/analisisFinanciero';
import { evaluarCalidadRenta, evaluarVeredictoRenta, lecturaExplotarLiquidar, type ExplotarLiquidarNivel } from '../../../../lib/rentaInsights';
import type { ProyectoRow } from '../../../../lib/proyectosApi';
import { VeredictoBlock, CalidadBlock, EscenariosResumenTabla, type EscenarioFila } from './ejecutivo';
import { KpiCard, KpiGrid, Collapsible, SectionHint, fmt, fmtPct, fmtX, fmtAno, safe } from './shared';

type Props = { analisis: AnalisisFinanciero; proyecto: ProyectoRow };

// Métricas del resumen de escenarios para renta.
const RENTA_FILAS: EscenarioFila[] = [
  { label: 'Renta anual',    key: 'rentaAnualBruta',    render: fmt },
  { label: 'NOI',            key: 'noIAnual',           render: fmt },
  { label: 'Cash flow',      key: 'cashflowAnual',      render: fmt },
  { label: 'VAN',            key: 'van',                render: fmt },
  { label: 'TIR',            key: 'tirConResidual',     render: fmtPct },
  { label: 'Valor residual', key: 'valorResidualUsado', render: fmt },
];


// ── Desglose del flujo anual ──────────────────────────────────────────────────

function FlujoRow({ label, value, bold, isSub, positivo }: { label: string; value: string; bold?: boolean; isSub?: boolean; positivo?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${bold ? 'border-y border-white/[0.06] my-1' : 'border-b border-white/[0.03] last:border-0'}`}>
      <span className={`${bold ? 'text-zinc-200 font-semibold' : isSub ? 'text-zinc-600 pl-3' : 'text-zinc-500'} text-xs`}>{label}</span>
      <span className={`text-xs tabular-nums ${bold ? 'font-semibold text-zinc-100' : positivo === false ? 'text-rose-400/90' : 'text-zinc-300'}`}>{value}</span>
    </div>
  );
}

function FlujoAnualBlock({ analisis, proyecto }: Props) {
  const f = calcFlujoAnualRenta(analisis, proyecto.fecha_inicio, proyecto.fecha_prevista_salida);
  if (!f) return null;
  return (
    <Collapsible title="Desglose del flujo anual" subtitle="De renta bruta a caja neta, paso a paso">
      <div className="space-y-0.5">
        <FlujoRow label="Renta bruta anual" value={fmt(f.rentaBrutaAnual)} />
        <FlujoRow label="Ajuste por ocupación / vacancia" value={fmt(f.ajusteOcupacion)} isSub positivo={false} />
        <FlujoRow label="Renta efectiva" value={fmt(f.rentaEfectiva)} bold />
        <FlujoRow label="Gastos operativos" value={fmt(-f.gastosOperativos)} isSub positivo={false} />
        <FlujoRow label="IBI" value={fmt(-f.ibi)} isSub positivo={false} />
        <FlujoRow label="Seguro" value={fmt(-f.seguro)} isSub positivo={false} />
        <FlujoRow label="CAPEX de mantenimiento" value={fmt(-f.capexMantenimiento)} isSub positivo={false} />
        <FlujoRow label="Renta neta operativa (NOI)" value={fmt(f.noi)} bold />
        <FlujoRow label="Servicio de deuda" value={fmt(-f.servicioDeuda)} isSub positivo={false} />
        {f.intereses != null && <FlujoRow label="· de los cuales intereses" value={fmt(-f.intereses)} isSub />}
        {f.amortizacion != null && <FlujoRow label="· de los cuales amortización" value={fmt(-f.amortizacion)} isSub />}
        <FlujoRow label="Caja antes de impuestos" value={fmt(f.cajaAntesImpuestos)} bold />
        {f.fiscalidadAplicada
          ? <FlujoRow label="Impuestos estimados" value={fmt(-f.impuestos)} isSub positivo={false} />
          : <FlujoRow label="Impuestos" value="No aplicados" isSub />}
        <FlujoRow label="Caja neta final" value={fmt(f.cajaNetaFinal)} bold />
      </div>
      {!f.fiscalidadAplicada && (
        <SectionHint>Análisis antes de impuestos. Activa la fiscalidad en "Editar parámetros" para ver la caja después de impuestos.</SectionHint>
      )}
    </Collapsible>
  );
}

// ── Financiación (detalle) ────────────────────────────────────────────────────

function FinanciacionBlock({ analisis, kpis }: { analisis: AnalisisFinanciero; kpis: ReturnType<typeof calcKpisRentaExtended> }) {
  const horizonte = kpis.horizonteUsado ?? 10;
  const fin = calcFinanciacionRenta(analisis, horizonte);
  if (fin.deudaViva <= 0) {
    return (
      <Collapsible title="Financiación" subtitle="Sin deuda registrada">
        <p className="text-xs text-zinc-600">Este proyecto se analiza sin deuda. Añade deuda hipotecaria, tipo de interés y plazo en "Editar parámetros" para ver DSCR, LTV y el efecto del apalancamiento.</p>
      </Collapsible>
    );
  }
  const SISTEMA_LABEL: Record<string, string> = { frances: 'Francés', bullet: 'Bullet / solo intereses', manual: 'Manual' };
  return (
    <Collapsible
      title="Financiación"
      subtitle={`${SISTEMA_LABEL[fin.sistema] ?? fin.sistema}${fin.estimado ? ' · estimado' : ''}`}
      badge={kpis.ltv != null ? <span className="text-xs text-zinc-400">LTV {fmtPct(kpis.ltv)}</span> : undefined}
    >
      <KpiGrid cols={4}>
        <KpiCard label="Deuda viva actual" value={fmt(fin.deudaViva)} sub="Saldo pendiente hoy" />
        <KpiCard label="Cuota mensual" value={fin.cuotaMensual != null ? fmt(fin.cuotaMensual) : '—'} sub="Servicio de deuda" />
        <KpiCard label="Intereses anuales" value={fin.interesesAnual != null ? fmt(fin.interesesAnual) : '—'} sub="Año 1 estimado" />
        <KpiCard label="Amortización anual" value={fin.amortizacionAnual != null ? fmt(fin.amortizacionAnual) : '—'} sub="Año 1 estimado" />
        <KpiCard label="Deuda estimada a salida" value={fin.deudaSalida != null ? fmt(fin.deudaSalida) : '—'} sub={`Al año ${horizonte}`} />
        {kpis.dscr != null && (
          <KpiCard label="Ratio de cobertura de deuda (DSCR)" value={fmtX(kpis.dscr)} sub="NOI / servicio de deuda" semaforo={semaforoDSCR(kpis.dscr)} />
        )}
        {kpis.ltv != null && (
          <KpiCard label="Endeudamiento sobre valor (LTV)" value={fmtPct(kpis.ltv)} sub="Deuda / valor actual" semaforo={semaforoLTV(kpis.ltv)} />
        )}
      </KpiGrid>
      {fin.incompleto && (
        <SectionHint>Faltan datos de la deuda (tipo de interés o plazo). El servicio y la deuda a salida usan un supuesto conservador.</SectionHint>
      )}
    </Collapsible>
  );
}

// ── Fiscalidad (detalle) ──────────────────────────────────────────────────────

function FiscalidadBlock({ analisis, proyecto }: Props) {
  const aplicada = analisis.aplicar_fiscalidad === true;
  const f = calcFlujoAnualRenta(analisis, proyecto.fecha_inicio, proyecto.fecha_prevista_salida);
  return (
    <Collapsible
      title="Fiscalidad"
      subtitle={aplicada ? 'Aplicada — caja después de impuestos' : 'No aplicada — análisis antes de impuestos'}
      badge={<span className={`text-2xs font-semibold uppercase tracking-widest ${aplicada ? 'text-emerald-400' : 'text-zinc-600'}`}>{aplicada ? 'Activa' : 'Inactiva'}</span>}
    >
      {!aplicada ? (
        <p className="text-xs text-zinc-600">
          La fiscalidad está desactivada: los análisis (TIR, VAN, caja) se muestran <strong className="text-zinc-400">antes de impuestos</strong>.
          Actívala en "Editar parámetros" → bloque "Fiscalidad avanzada" para estimar el Impuesto de Sociedades, la amortización fiscal y los costes/plusvalía de la venta.
        </p>
      ) : (
        <KpiGrid cols={4}>
          <KpiCard label="Tipo de Impuesto de Sociedades" value={`${analisis.impuesto_sociedades_pct ?? 25}%`} sub="Sobre base imponible positiva" />
          <KpiCard label="Amortización fiscal anual" value={analisis.amortizacion_fiscal_anual != null ? fmt(analisis.amortizacion_fiscal_anual) : '—'} sub="Gasto deducible" />
          {f?.baseImponible != null && <KpiCard label="Base imponible estimada" value={fmt(f.baseImponible)} sub="NOI − intereses − amortización" />}
          {f?.impuestos != null && <KpiCard label="Impuestos estimados" value={fmt(f.impuestos)} sub="Sobre base positiva" />}
          <KpiCard label="Costes de venta" value={analisis.costes_venta_pct != null ? `${analisis.costes_venta_pct}%` : '—'} sub="Sobre valor de salida" />
          <KpiCard label="Impuesto sobre plusvalía" value={analisis.impuesto_plusvalia_pct != null ? `${analisis.impuesto_plusvalia_pct}%` : '—'} sub="Sobre plusvalía en venta" />
          {f?.cajaNetaFinal != null && <KpiCard label="Caja después de impuestos" value={fmt(f.cajaNetaFinal)} sub="Caja neta anual" semaforo={f.cajaNetaFinal > 0 ? 'verde' : 'rojo'} />}
        </KpiGrid>
      )}
    </Collapsible>
  );
}

// ── Mercado (€/m²) ────────────────────────────────────────────────────────────

function MercadoBlock({ analisis, kpis }: { analisis: AnalisisFinanciero; kpis: ReturnType<typeof calcKpisRentaExtended> }) {
  const m2 = analisis.superficie_arrendable_m2 ?? null;
  if (!m2 || m2 <= 0) {
    return (
      <Collapsible title="Mercado" subtitle="Métricas por m²">
        <p className="text-xs text-zinc-600">Falta la superficie arrendable (m²). Añádela en "Editar parámetros" para ver precio, valor y renta por m².</p>
      </Collapsible>
    );
  }
  const inv = kpis.inversionTotal ?? 0;
  const valorActual = analisis.valoracion_actual ?? null;
  const rentaMes = analisis.renta_mensual_bruta ?? 0;
  const precioM2 = inv > 0 ? inv / m2 : null;
  const valorM2  = valorActual ? valorActual / m2 : null;
  const rentaM2  = rentaMes > 0 ? rentaMes / m2 : null;
  const descuento = valorActual && inv > 0 ? (valorActual - inv) / inv : null;
  return (
    <Collapsible title="Mercado" subtitle={`${m2.toLocaleString('es-ES')} m² arrendables`}>
      <KpiGrid cols={4}>
        <KpiCard label="Coste de compra €/m²" value={precioM2 != null ? fmt(precioM2) : '—'} sub="Inversión total / m²" />
        <KpiCard label="Valor actual €/m²" value={valorM2 != null ? fmt(valorM2) : '—'} sub="Valor estimado / m²" />
        <KpiCard label="Renta €/m²/mes" value={rentaM2 != null ? `${rentaM2.toLocaleString('es-ES', { maximumFractionDigits: 1 })} €` : '—'} sub="Renta mensual / m²" />
        <KpiCard label="Rentabilidad neta sobre valor actual" value={safe(kpis.yieldNetoValorActual, fmtPct)} sub="NOI / valor actual" semaforo={semaforoYieldRenta(kpis.yieldNetoValorActual)} />
        {descuento != null && (
          <KpiCard
            label={descuento >= 0 ? 'Prima sobre coste' : 'Descuento sobre coste'}
            value={fmtPct(Math.abs(descuento))}
            sub="Valor actual vs. inversión"
            semaforo={descuento >= 0 ? 'verde' : 'rojo'}
          />
        )}
        {kpis.margenLatente != null && (
          <KpiCard label="Plusvalía latente" value={fmt(kpis.margenLatente)} sub="Valor actual − inversión total" semaforo={kpis.margenLatente > 0 ? 'verde' : 'rojo'} />
        )}
      </KpiGrid>
    </Collapsible>
  );
}

// ── Valor residual (cómo se llega al valor de salida) ─────────────────────────

function ValorResidualBlock({ analisis, kpis }: { analisis: AnalisisFinanciero; kpis: ReturnType<typeof calcKpisRentaExtended> }) {
  if (kpis.valorResidualUsado == null) {
    return (
      <Collapsible title="Valor residual" subtitle="Cómo se calcula el valor de salida">
        <p className="text-xs text-zinc-600">Falta el valor actual estimado, el cap rate de salida o el valor manual, según el método elegido. Complétalo en "Editar parámetros" → "Horizonte y salida".</p>
      </Collapsible>
    );
  }
  const metodo = analisis.metodo_valor_residual ?? 'valor_actual';
  const esValorActual = metodo === 'valor_actual' || metodo === 'crecimiento_anual';
  const h = kpis.horizonteUsado ?? 10;
  return (
    <Collapsible
      title="Valor residual"
      subtitle={`${kpis.metodoResidualLabel ?? '—'} · ${h} años`}
      badge={kpis.revalorizacionPorDefecto ? <span className="text-2xs font-semibold text-amber-400 uppercase tracking-widest">0% supuesto</span> : undefined}
    >
      <div className="space-y-3">
        <KpiGrid cols={4}>
          {esValorActual && (
            <KpiCard label="Valor actual estimado" value={analisis.valoracion_actual != null ? fmt(analisis.valoracion_actual) : '—'} sub="Valor de mercado hoy" tooltip="Valor de mercado del activo a día de hoy. Es el punto de partida para proyectar el valor residual." />
          )}
          {esValorActual && (
            <KpiCard label="Revalorización anual usada" value={kpis.revalorizacionResidualPct != null ? fmtPct(kpis.revalorizacionResidualPct / 100) : '—'} sub={kpis.revalorizacionPorDefecto ? '0% por defecto (conservador)' : 'Apreciación anual estimada'} tooltip="Apreciación anual estimada del activo. Si se deja vacía se usa 0% (supuesto conservador: el activo mantiene su valor de hoy)." />
          )}
          {metodo === 'cap_rate_salida' && (
            <KpiCard label="Cap rate de salida" value={analisis.cap_rate_salida_pct != null ? `${analisis.cap_rate_salida_pct}%` : '—'} sub="NOI / cap rate = valor futuro" tooltip="Tasa de capitalización a la salida. El valor residual se estima como NOI dividido entre este cap rate." />
          )}
          <KpiCard label="Valor residual futuro" value={fmt(kpis.valorResidualUsado)} sub={`Estimado en el año ${h}`} tooltip="Valor estimado del activo al final del horizonte de análisis. No implica venta real; se usa para calcular TIR y VAN." />
          <KpiCard label="Valor presente del residual" value={kpis.valorResidualPresente != null ? fmt(kpis.valorResidualPresente) : '—'} sub={kpis.tasaDescuentoUsada != null ? `Descontado al ${fmtPct(kpis.tasaDescuentoUsada)}` : 'Descontado a hoy'} tooltip="Valor residual futuro traído a hoy, descontado a la tasa exigida. Es lo que aporta el residual al VAN." />
        </KpiGrid>
        {kpis.revalorizacionPorDefecto && (
          <SectionHint>
            Se está usando <strong className="text-amber-400">0% de revalorización</strong> como supuesto conservador: el valor residual mantiene el valor de hoy. Si esperas que el activo se aprecie, indica la "Revalorización anual estimada" en "Editar parámetros".
          </SectionHint>
        )}
        {metodo === 'manual' && (
          <SectionHint>Valor introducido manualmente como valor esperado en el año {h}. No se revaloriza; solo se descuenta a hoy para el VAN.</SectionHint>
        )}
      </div>
    </Collapsible>
  );
}

// ── Explotar vs liquidar ──────────────────────────────────────────────────────

const EXPLOTAR_STYLE: Record<ExplotarLiquidarNivel, { color: string; border: string; bg: string }> = {
  explotar: { color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/[0.06]' },
  neutral:  { color: 'text-amber-400',   border: 'border-amber-500/20',   bg: 'bg-amber-500/[0.06]' },
  revisar:  { color: 'text-rose-400',    border: 'border-rose-500/20',    bg: 'bg-rose-500/[0.06]' },
  na:       { color: 'text-zinc-400',    border: 'border-white/[0.08]',   bg: 'bg-zinc-900/40' },
};

function ExplotarLiquidarBlock({ kpis }: { kpis: ReturnType<typeof calcKpisRentaExtended> }) {
  const tasa = kpis.tasaDescuentoUsada ?? 0.08;
  const lectura = lecturaExplotarLiquidar(kpis.yieldNetoValorActual, tasa);
  const st = EXPLOTAR_STYLE[lectura.nivel];
  return (
    <div className={`rounded-2xl border p-5 ${st.border} ${st.bg}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Explotar vs liquidar</p>
            <span className={`text-sm font-semibold ${st.color}`}>{lectura.titulo}</span>
          </div>
          <p className="text-sm text-zinc-300 mt-1">{lectura.mensaje}</p>
          <p className="text-2xs text-zinc-600 mt-2">{lectura.nota}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xs text-zinc-500 uppercase tracking-widest">Rentab. neta s/ valor actual</p>
          <p className={`text-2xl font-light ${st.color}`}>{safe(kpis.yieldNetoValorActual, fmtPct)}</p>
          <p className="text-2xs text-zinc-600">Tasa exigida: {fmtPct(tasa)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Vista principal ───────────────────────────────────────────────────────────

export function RentaAnalisisView({ analisis, proyecto }: Props) {
  const k = calcKpisRentaExtended(analisis, proyecto.fecha_inicio, proyecto.fecha_prevista_salida);
  const cal = evaluarCalidadRenta(analisis);
  const tieneRenta = (analisis.renta_mensual_bruta ?? 0) > 0;
  const tieneDeuda = (analisis.deuda_hipotecaria ?? 0) > 0;
  const ver = evaluarVeredictoRenta(analisis, k, cal.score, cal.faltantesCriticos);

  // Validación suave: sin renta mensual no se calculan rentabilidades
  if (!tieneRenta) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-5 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">Falta la renta mensual</p>
            <p className="text-xs text-zinc-500 mt-1">Sin renta mensual no se pueden calcular las rentabilidades de renta. Añádela en "Editar parámetros".</p>
          </div>
        </div>
        <CalidadBlock calidad={cal} />
      </div>
    );
  }

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
            label="Inversión total"
            value={safe(k.inversionTotal, fmt)}
            sub="Compra, gastos y CAPEX inicial"
            tooltip="Capital total invertido en el activo: precio de compra, gastos de adquisición y CAPEX inicial."
          />
          <KpiCard
            label="Renta anual bruta"
            value={safe(k.rentaAnualBruta, fmt)}
            sub={analisis.tasa_ocupacion_prevista_pct != null ? `${analisis.tasa_ocupacion_prevista_pct}% ocupación` : undefined}
            tooltip="Ingresos anuales antes de descontar gastos. Se calcula multiplicando la renta mensual por 12."
          />
          <KpiCard
            label="Renta neta operativa (NOI)"
            value={safe(k.noIAnual, fmt)}
            sub="Renta anual después de gastos operativos"
            semaforo={k.noIAnual != null ? (k.noIAnual > 0 ? 'verde' : 'rojo') : 'neutro'}
            tooltip="Renta anual después de restar gastos del activo: IBI, seguro, mantenimiento y otros costes no repercutidos. No incluye deuda ni impuestos societarios."
          />
          <KpiCard
            label="Rentabilidad bruta sobre coste"
            value={safe(k.yieldBruto, fmtPct)}
            sub="Renta anual bruta / inversión total"
            tooltip="Renta anual bruta dividida entre el coste inicial total (precio de adquisición + gastos de adquisición + capex). Mide cuánto genera el activo antes de gastos sobre todo lo invertido. Misma base que la rentabilidad neta sobre coste."
          />
          <KpiCard
            label="Rentabilidad neta sobre coste"
            value={safe(k.yieldNetoCoste, fmtPct)}
            sub="Renta neta operativa / inversión total"
            semaforo={semaforoYieldRenta(k.yieldNetoCoste)}
            tooltip="Renta neta operativa dividida entre la inversión total. Métrica clave para evaluar la rentabilidad real del activo sobre el dinero invertido."
          />
          <KpiCard
            label="Rentabilidad sobre capital aportado"
            value={safe(k.cashOnCash, fmtPct)}
            sub="Caja neta anual / capital propio aportado"
            semaforo={semaforoTir(k.cashOnCash)}
            tooltip="Caja neta anual generada dividida entre el capital propio aportado. Si hay deuda, mide la rentabilidad real sobre el equity invertido."
          />
          <KpiCard
            label={`TIR con valor residual${k.horizonteUsado ? ` — ${k.horizonteUsado} años` : ''}`}
            value={safe(k.tirConResidual, fmtPct)}
            sub={k.valorResidualUsado != null ? `Residual: ${fmt(k.valorResidualUsado)} · ${k.metodoResidualLabel ?? '—'}` : undefined}
            semaforo={semaforoTir(k.tirConResidual)}
            tooltip="Tasa Interna de Retorno calculada con las rentas esperadas y el valor residual estimado al final del horizonte. No significa que se vaya a vender el activo."
          />
          <KpiCard
            label="Valor actual neto (VAN)"
            value={safe(k.van, fmt)}
            sub={k.tasaDescuentoUsada != null ? `Tasa ${fmtPct(k.tasaDescuentoUsada)}${k.diferencialTirTasa != null ? ` · TIR−tasa ${(k.diferencialTirTasa * 100).toFixed(1)} p.p.` : ''}` : undefined}
            semaforo={k.van != null ? (k.van > 0 ? 'verde' : 'rojo') : 'neutro'}
            tooltip="Valor Actual Neto: suma de los flujos de caja anuales y del valor residual descontados a la tasa exigida, menos el capital aportado. Un VAN positivo indica que el proyecto crea valor por encima de la rentabilidad mínima exigida."
          />
        </KpiGrid>

        {/* DSCR y LTV solo si hay deuda */}
        {tieneDeuda && (k.dscr != null || k.ltv != null) && (
          <KpiGrid cols={4}>
            {k.dscr != null && (
              <KpiCard
                label="Ratio de cobertura de deuda (DSCR)"
                value={fmtX(k.dscr)}
                sub="Cobertura del servicio de deuda"
                semaforo={semaforoDSCR(k.dscr)}
                tooltip="Mide si la renta neta operativa cubre las cuotas de deuda. Un valor superior a 1 indica que el activo genera más caja que la deuda que debe pagar."
              />
            )}
            {k.ltv != null && (
              <KpiCard
                label="Endeudamiento sobre valor (LTV)"
                value={fmtPct(k.ltv)}
                sub="Hipoteca / valor actual"
                semaforo={semaforoLTV(k.ltv)}
                tooltip="Deuda asociada al activo dividida entre su valor actual. Mide el nivel de apalancamiento del proyecto."
              />
            )}
          </KpiGrid>
        )}
      </div>

      {/* 4 · Explotar vs liquidar (lectura ejecutiva sobre valor actual) */}
      <ExplotarLiquidarBlock kpis={k} />

      {/* 5 · Escenarios resumidos */}
      <EscenariosResumenTabla analisis={analisis} proyecto={proyecto} filas={RENTA_FILAS} />

      {/* Avisos de validación */}
      {k.tirSinDatos && (
        <SectionHint>
          Faltan horizonte o valor residual: la TIR y el VAN no son definitivos. Complétalos en "Editar parámetros" → "Horizonte de análisis".
        </SectionHint>
      )}

      {/* 5 · Detalle desplegable */}
      <div className="space-y-3">
        <FlujoAnualBlock analisis={analisis} proyecto={proyecto} />
        <ValorResidualBlock analisis={analisis} kpis={k} />
        <FinanciacionBlock analisis={analisis} kpis={k} />
        <FiscalidadBlock analisis={analisis} proyecto={proyecto} />
        <MercadoBlock analisis={analisis} kpis={k} />

        {/* Detalle de rentabilidad (secundario) */}
        <Collapsible title="Detalle de rentabilidad" subtitle="Recuperación del capital, valor residual y más">
          <KpiGrid cols={4}>
            <KpiCard
              label="Rentabilidad neta sobre valor actual"
              value={safe(k.yieldNetoValorActual, fmtPct)}
              sub="Renta neta operativa / valor actual"
              semaforo={semaforoYieldRenta(k.yieldNetoValorActual)}
              tooltip="Renta neta operativa dividida entre el valor actual estimado del activo. Sirve para decidir si compensa mantener el activo o venderlo y reinvertir."
            />
            {k.paybackAnos != null && (
              <KpiCard
                label="Recuperación del capital"
                value={fmtAno(k.paybackAnos)}
                sub="Años para recuperar el capital vía caja neta"
                semaforo={semaforoPayback(k.paybackAnos)}
                tooltip="Años estimados necesarios para recuperar el capital aportado mediante la caja neta generada por el activo."
              />
            )}
            {k.margenLatente != null && (
              <KpiCard
                label="Plusvalía latente"
                value={fmt(k.margenLatente)}
                sub="Valor actual estimado menos inversión total"
                semaforo={k.margenLatente > 0 ? 'verde' : 'rojo'}
                tooltip="Diferencia entre el valor actual estimado del activo y la inversión total realizada. Es una ganancia potencial no realizada."
              />
            )}
            {k.valorResidualUsado != null && (
              <KpiCard
                label="Valor residual estimado"
                value={fmt(k.valorResidualUsado)}
                sub="Valor residual usado para el horizonte de análisis"
                tooltip="Valor estimado del activo al final del horizonte de análisis. No implica venta real; se usa para calcular la TIR económica."
              />
            )}
            <KpiCard
              label="Gastos anuales totales"
              value={safe(k.gastosAnualesTotal, fmt)}
              sub="Gastos operativos, IBI, seguro y CAPEX de mantenimiento"
              tooltip="Suma anual de gastos operativos, IBI, seguro y CAPEX de mantenimiento."
            />
          </KpiGrid>
        </Collapsible>
      </div>

      <SectionHint>
        La TIR y el VAN se calculan con un valor residual teórico al final del horizonte de análisis. No implican venta real del activo.
      </SectionHint>
    </div>
  );
}
