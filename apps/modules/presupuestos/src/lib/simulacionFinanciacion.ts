// ── simulacionFinanciacion.ts ──────────────────────────────────────────────────
// "¿Merece la pena financiar?" — simulador what-if de apalancamiento por proyecto.
//
// Para un proyecto sin financiación (comprado 100% con equity), genera 3 niveles
// de deuda (conservadora / moderada / agresiva) y compara contra la base sin
// financiar.
//
// El VEREDICTO NO se basa solo en comparar rentabilidad del activo vs tipo de
// interés (eso queda como dato secundario). Prioriza, en este orden:
//   1. DSCR (la renta cubre la cuota)
//   2. Cash flow después de deuda
//   3. Rentabilidad sobre capital propio
//   4. TIR financiada vs TIR sin deuda
//   5. VAN financiado vs VAN sin deuda
//
// TIR/VAN financiados se calculan con flujos coherentes (sin doble penalización
// de la deuda): año 0 = -equity; años = NOI − cuota; salida = valor residual −
// deuda PENDIENTE (ya amortizada por las cuotas), no la deuda inicial completa.

import {
  type AnalisisFinanciero,
  calcKpisRentaExtended,
  calcKpisCV,
  calcularCuadroAmortizacion,
} from './analisisFinanciero';

// ── Supuestos de financiación editables ───────────────────────────────────────

export type SupuestosFinanciacion = {
  tipoInteresPct: number; // tipo nominal anual, en %  (ej. 3.5)
  plazoAnios: number; // plazo de amortización en años (solo renta)
};

export const SUPUESTOS_DEFAULT_RENTA: SupuestosFinanciacion = {
  tipoInteresPct: 3.5,
  plazoAnios: 20,
};
export const SUPUESTOS_DEFAULT_CV: SupuestosFinanciacion = { tipoInteresPct: 5.0, plazoAnios: 2 };

// ── Niveles de apalancamiento (LTV sobre el coste/valor de referencia) ────────

export type NivelFinanciacion = 'sin' | 'conservadora' | 'moderada' | 'agresiva';

const NIVELES: { id: NivelFinanciacion; label: string; ltv: number }[] = [
  { id: 'sin', label: 'Sin financiación', ltv: 0 },
  { id: 'conservadora', label: 'Conservadora', ltv: 0.5 },
  { id: 'moderada', label: 'Moderada', ltv: 0.6 },
  { id: 'agresiva', label: 'Agresiva', ltv: 0.7 },
];

// ── Resultado por opción ──────────────────────────────────────────────────────

export type OpcionFinanciacion = {
  id: NivelFinanciacion;
  label: string;
  ltv: number; // 0-1 — % de la INVERSIÓN/coste financiado
  deuda: number; // importe financiado
  ltvValorActual: number | null; // deuda / valor actual estimado (lectura sobre tasación)
  equity: number; // capital propio necesario
  equityLiberado: number; // equity ahorrado vs. "sin financiación"
  cuotaMensual: number | null; // servicio de deuda mensual
  servicioDeudaAnual: number | null;
  costeFinancieroTotal: number | null; // intereses totales del periodo (CV) / vida (renta)
  cashflowAnual: number | null; // caja anual después de deuda (renta)
  dscr: number | null; // solo renta: NOI / servicio deuda
  rentabilidadEquity: number | null; // cash-on-cash (renta) o TIR equity (CV), decimal
  moic: number | null; // solo CV
  tir: number | null; // TIR con apalancamiento (renta: con residual; CV: equity)
  van: number | null; // VAN con apalancamiento, a la tasa de descuento
  riesgoAlto: boolean; // DSCR < 1 → la renta no cubre la cuota
};

// ── Veredicto del apalancamiento ──────────────────────────────────────────────

export type VeredictoNivel = 'positivo' | 'ajustado' | 'reduce' | 'na';

export type VeredictoFinanciacion = {
  nivel: VeredictoNivel;
  titulo: string;
  mensaje: string;
  riesgoAlto: boolean; // algún escenario con DSCR < 1
  recomendada: NivelFinanciacion | null;
};

export type ResultadoSimulacion = {
  aplica: boolean;
  tipo: 'renta' | 'compra_venta' | null;
  yaFinanciado: boolean;
  inversionTotal: number | null;
  baseReferenciaLtv: number | null;
  rentabilidadActivo: number | null; // yield neto s/coste (renta) o ROI anual (CV) — DATO SECUNDARIO
  tipoInteres: number; // decimal — DATO SECUNDARIO
  opciones: OpcionFinanciacion[]; // incluye "sin financiación" como primera
  veredicto: VeredictoFinanciacion;
  motivoNoAplica: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const num = (v: number | null | undefined): number | null =>
  v != null && isFinite(v) && !isNaN(v) ? v : null;

function tirDosFlujos(equity: number, retornoNeto: number, anos: number): number | null {
  if (equity <= 0 || retornoNeto <= 0 || anos <= 0) return null;
  return (retornoNeto / equity) ** (1 / anos) - 1;
}

// VAN y TIR de un flujo de renta: -equity en t0, cashflowAnual constante,
// ventaNeta al final del horizonte. Mismo modelo para base y opciones, de modo
// que la comparación TIR↔TIR y VAN↔VAN sea siempre coherente.
function tirVanRenta(
  equity: number,
  cashflowAnual: number,
  ventaNeta: number,
  horizonte: number,
  tasa: number,
): { tir: number | null; van: number | null } {
  if (equity <= 0 || horizonte <= 0) return { tir: null, van: null };
  let van = -equity;
  for (let t = 1; t <= horizonte; t++) van += cashflowAnual / Math.pow(1 + tasa, t);
  van += ventaNeta / Math.pow(1 + tasa, horizonte);

  let tir: number | null = null;
  if (cashflowAnual * horizonte + ventaNeta > 0) {
    let lo = -0.5,
      hi = 5.0;
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      let v = -equity;
      for (let t = 1; t <= horizonte; t++) v += cashflowAnual / Math.pow(1 + mid, t);
      v += ventaNeta / Math.pow(1 + mid, horizonte);
      if (Math.abs(v) < 1e-6) {
        tir = mid;
        break;
      }
      if (v > 0) lo = mid;
      else hi = mid;
    }
    if (tir === null) tir = (lo + hi) / 2;
  }
  return { tir, van };
}

const fmtPctTxt = (v: number | null) => (v != null ? `${(v * 100).toFixed(1)}%` : '—');
const fmtXtxt = (v: number | null) => (v != null ? `${v.toFixed(2)}x` : '—');

// ── Construcción del veredicto (DSCR-first) ───────────────────────────────────

function construirVeredicto(
  tipo: 'renta' | 'compra_venta',
  base: OpcionFinanciacion,
  financiadas: OpcionFinanciacion[],
): VeredictoFinanciacion {
  const tirBase = num(base.tir);
  const cocBase = num(base.rentabilidadEquity);

  const conTir = financiadas.filter((o) => num(o.tir) != null);
  const mejorTir = conTir.length ? Math.max(...conTir.map((o) => o.tir as number)) : null;
  const mejoraTir = mejorTir != null && tirBase != null ? mejorTir - tirBase : null;

  const dscrs =
    tipo === 'renta'
      ? financiadas.map((o) => num(o.dscr)).filter((d): d is number => d != null)
      : [];
  const minDscr = dscrs.length ? Math.min(...dscrs) : null;
  const riesgoAlto = minDscr != null && minDscr < 1;

  // Una opción solo es "positiva" si (señales independientes de la escala):
  //  · (renta) DSCR ≥ 1,25  · TIR financiada mejora la de sin deuda
  // El VAN NO se usa como filtro: es un importe absoluto y, al financiar con menos
  // equity, baja de forma natural; compararlo en bruto penalizaría el apalancamiento.
  const esPositiva = (o: OpcionFinanciacion): boolean => {
    const t = num(o.tir);
    if (t == null || tirBase == null || t <= tirBase + 1e-4) return false;
    if (tipo === 'renta') {
      if (o.dscr == null || o.dscr < 1.25) return false;
    } else {
      if (o.moic != null && o.moic <= 1) return false;
    }
    return true;
  };
  const positivas = financiadas
    .filter(esPositiva)
    .sort((a, b) => (b.tir ?? -Infinity) - (a.tir ?? -Infinity));

  if (positivas.length > 0) {
    const r = positivas[0]!;
    const detalle =
      tipo === 'renta' && r.dscr != null
        ? ` y la renta cubre la cuota con holgura (DSCR ${fmtXtxt(r.dscr)})`
        : '';
    return {
      nivel: 'positivo',
      titulo: 'Apalancamiento positivo',
      mensaje: `Con deuda al ${(r.ltv * 100).toFixed(0)}% la TIR sobre tu capital mejora respecto a comprar sin deuda (${fmtPctTxt(tirBase)} → ${fmtPctTxt(r.tir)})${detalle}. Libera capital, aunque reduce la caja libre anual y añade riesgo financiero.`,
      riesgoAlto,
      recomendada: r.id,
    };
  }

  // No es claramente positivo. Distinguir TIR del activo vs TIR del equity.
  const empeoraTirReal = mejoraTir != null && mejoraTir <= 0; // se puede comparar y NO mejora
  const noComparable = mejoraTir == null; // no hay TIR de equity comparable

  if (tipo === 'renta' && riesgoAlto) {
    return {
      nivel: 'reduce',
      titulo: 'Libera capital, pero la renta no cubre la cuota',
      mensaje: `La financiación libera capital, pero la renta no cubre cómodamente la cuota (DSCR mínimo ${fmtXtxt(minDscr)}, por debajo de 1)${empeoraTirReal ? ' y la TIR sobre equity no mejora' : ''}.`,
      riesgoAlto,
      recomendada: null,
    };
  }

  if (tipo === 'renta' && minDscr != null && minDscr <= 1.15) {
    return {
      nivel: 'ajustado',
      titulo: 'Financiación muy ajustada',
      mensaje: `La renta apenas cubre la cuota (DSCR ${fmtXtxt(minDscr)}). Hay poco margen ante imprevistos${empeoraTirReal ? ' y la TIR sobre equity no mejora' : ''}.`,
      riesgoAlto,
      recomendada: null,
    };
  }

  if (noComparable) {
    // No se puede comparar la TIR sobre equity (faltan datos o equity ≈ 0): no se
    // afirma que reduzca; se invita a analizar las palancas.
    return {
      nivel: 'ajustado',
      titulo: 'Analizar financiación',
      mensaje:
        'Compara capital liberado, DSCR, caja libre y TIR sobre equity para decidir. No hay datos suficientes para concluir si mejora la rentabilidad sobre tu capital.',
      riesgoAlto,
      recomendada: null,
    };
  }

  if (empeoraTirReal) {
    const peorCoc =
      cocBase != null &&
      financiadas.some(
        (o) => num(o.rentabilidadEquity) != null && (o.rentabilidadEquity as number) < cocBase,
      );
    return {
      nivel: 'reduce',
      titulo: 'Libera capital, pero no mejora la rentabilidad sobre equity',
      mensaje: `Financiar libera capital para otras inversiones, pero a este tipo y plazo no mejora la TIR sobre tu capital respecto a comprar sin deuda${peorCoc ? ' y reduce la caja libre' : ''}.`,
      riesgoAlto,
      recomendada: null,
    };
  }

  // Mejora algo la TIR de equity pero la cobertura no es holgada (DSCR < 1,25 en renta).
  return {
    nivel: 'ajustado',
    titulo: 'Financiación con cautela',
    mensaje: `La TIR sobre equity mejora algo, pero la cobertura de la cuota no es holgada${minDscr != null ? ` (DSCR ${fmtXtxt(minDscr)})` : ''}. Revisa el margen antes de decidir.`,
    riesgoAlto,
    recomendada: null,
  };
}

// ── Simulación para RENTA patrimonial ─────────────────────────────────────────

function simularRenta(
  a: AnalisisFinanciero,
  fechaInicio: string | null,
  fechaSalida: string | null,
  sup: SupuestosFinanciacion,
): ResultadoSimulacion {
  const k = calcKpisRentaExtended(a, fechaInicio, fechaSalida);
  const inversionTotal = k.inversionTotal;
  const noi = k.noIAnual;

  const naVeredicto: VeredictoFinanciacion = {
    nivel: 'na',
    titulo: '',
    mensaje: '',
    riesgoAlto: false,
    recomendada: null,
  };
  const baseVacia: ResultadoSimulacion = {
    aplica: false,
    tipo: 'renta',
    yaFinanciado: false,
    inversionTotal: null,
    baseReferenciaLtv: null,
    rentabilidadActivo: null,
    tipoInteres: sup.tipoInteresPct / 100,
    opciones: [],
    veredicto: naVeredicto,
    motivoNoAplica:
      'Completa el análisis de renta (precio de adquisición y renta mensual) para simular la financiación.',
  };
  if (inversionTotal == null || inversionTotal <= 0 || noi == null) return baseVacia;

  const interes = sup.tipoInteresPct / 100;
  const plazoMeses = Math.max(1, Math.round(sup.plazoAnios * 12));
  const horizonte = k.horizonteUsado ?? 10;
  const tasa = a.tasa_descuento ?? 0.08;
  const valorResidual = k.valorResidualUsado;
  // Los escenarios (50/60/70%) se calculan sobre la INVERSIÓN/coste, no sobre el
  // valor actual: así no se capan ni quedan idénticos. El LTV sobre valor actual
  // se muestra aparte como lectura adicional.
  const valorActual = a.valoracion_actual && a.valoracion_actual > 0 ? a.valoracion_actual : null;
  const yieldNetoCoste = noi / inversionTotal;
  const yaFinanciado = (a.deuda_hipotecaria ?? 0) > 0 || (a.cuota_hipoteca_mensual ?? 0) > 0;

  const opciones: OpcionFinanciacion[] = NIVELES.map((n) => {
    const deuda = inversionTotal * n.ltv;
    const equity = Math.max(inversionTotal - deuda, 0);
    const ltvValorActual = valorActual != null && deuda > 0 ? deuda / valorActual : null;

    if (n.id === 'sin') {
      // Base sin deuda: mismo modelo de flujos (equity = inversión total, sin cuota).
      const ventaNeta = valorResidual != null ? valorResidual : 0;
      const { tir, van } =
        valorResidual != null
          ? tirVanRenta(inversionTotal, noi, ventaNeta, horizonte, tasa)
          : { tir: null, van: null };
      return {
        id: n.id,
        label: n.label,
        ltv: 0,
        deuda: 0,
        ltvValorActual: null,
        equity: inversionTotal,
        equityLiberado: 0,
        cuotaMensual: null,
        servicioDeudaAnual: null,
        costeFinancieroTotal: null,
        cashflowAnual: noi,
        dscr: null,
        rentabilidadEquity: inversionTotal > 0 ? noi / inversionTotal : null,
        moic: null,
        tir,
        van,
        riesgoAlto: false,
      };
    }

    const cuadro = calcularCuadroAmortizacion(deuda, interes, plazoMeses, 'frances');
    const cuotaMensual = cuadro[0]?.cuota ?? 0;
    const servicio = cuotaMensual * 12;
    const costeFinancieroTotal = cuadro.reduce((s, c) => s + c.interes, 0);
    const mesSalida = Math.min(Math.max(1, Math.round(horizonte * 12)), plazoMeses);
    // Deuda PENDIENTE a la salida (ya amortizada por las cuotas) — no la deuda inicial.
    const deudaPendienteSalida = cuadro[mesSalida - 1]?.capitalPendiente ?? 0;
    const dscr = servicio > 0 ? noi / servicio : null;
    const cashflowAnual = noi - servicio;
    const cashOnCash = equity > 0 ? cashflowAnual / equity : null;
    const ventaNeta = valorResidual != null ? valorResidual - deudaPendienteSalida : null;
    const { tir, van } =
      ventaNeta != null
        ? tirVanRenta(equity, cashflowAnual, ventaNeta, horizonte, tasa)
        : { tir: null, van: null };

    return {
      id: n.id,
      label: n.label,
      ltv: n.ltv,
      deuda,
      ltvValorActual,
      equity,
      equityLiberado: inversionTotal - equity,
      cuotaMensual,
      servicioDeudaAnual: servicio,
      costeFinancieroTotal,
      cashflowAnual,
      dscr,
      rentabilidadEquity: cashOnCash,
      moic: null,
      tir,
      van,
      riesgoAlto: dscr != null && dscr < 1,
    };
  });

  const base = opciones.find((o) => o.id === 'sin')!;
  const financiadas = opciones.filter((o) => o.id !== 'sin');
  const veredicto = construirVeredicto('renta', base, financiadas);

  return {
    aplica: true,
    tipo: 'renta',
    yaFinanciado,
    inversionTotal,
    baseReferenciaLtv: inversionTotal,
    rentabilidadActivo: yieldNetoCoste,
    tipoInteres: interes,
    opciones,
    veredicto,
    motivoNoAplica: null,
  };
}

// ── Simulación para COMPRA-VENTA (préstamo promotor tipo bullet) ──────────────

function simularCompraVenta(
  a: AnalisisFinanciero,
  fechaInicio: string | null,
  fechaSalida: string | null,
  sup: SupuestosFinanciacion,
): ResultadoSimulacion {
  const k = calcKpisCV(a, fechaInicio, fechaSalida, a.superficie_arrendable_m2 ?? null);
  const inversionTotal = k.inversionTotal;
  const margenBruto = k.margenBruto;
  const anos = k.anosUsados;

  const naVeredicto: VeredictoFinanciacion = {
    nivel: 'na',
    titulo: '',
    mensaje: '',
    riesgoAlto: false,
    recomendada: null,
  };
  const baseVacia: ResultadoSimulacion = {
    aplica: false,
    tipo: 'compra_venta',
    yaFinanciado: false,
    inversionTotal: null,
    baseReferenciaLtv: null,
    rentabilidadActivo: null,
    tipoInteres: sup.tipoInteresPct / 100,
    opciones: [],
    veredicto: naVeredicto,
    motivoNoAplica:
      'Completa el análisis de compra-venta (coste, precio de venta y plazo de la operación) para simular la financiación.',
  };
  if (
    inversionTotal == null ||
    inversionTotal <= 0 ||
    margenBruto == null ||
    anos == null ||
    anos <= 0
  ) {
    return baseVacia;
  }

  const interes = sup.tipoInteresPct / 100;
  const isPct = (a.impuesto_sociedades_pct ?? 26) / 100;
  const tasa = a.tasa_descuento ?? 0.08;
  const baseRef = inversionTotal;
  const roiAnual = margenBruto / inversionTotal / anos;
  const yaFinanciado = (a.deuda_promotora ?? 0) > 0;

  const opciones: OpcionFinanciacion[] = NIVELES.map((n) => {
    const deuda = Math.min(baseRef * n.ltv, inversionTotal);
    const equity = Math.max(inversionTotal - deuda, 0);

    // Préstamo promotor bullet: intereses acumulados; principal se devuelve a la venta.
    const costeFinanciero = n.id === 'sin' ? 0 : deuda * interes * anos;
    const margenApalancado = margenBruto - costeFinanciero;
    const is = Math.max(margenApalancado, 0) * isPct;
    const beneficioNeto = margenApalancado - is;
    const retornoNeto = equity + beneficioNeto;
    const tir = tirDosFlujos(equity, retornoNeto, anos);
    const moic = equity > 0 ? retornoNeto / equity : null;
    const van =
      equity > 0 && retornoNeto > 0 ? retornoNeto / Math.pow(1 + tasa, anos) - equity : null;

    return {
      id: n.id,
      label: n.label,
      ltv: n.ltv,
      deuda,
      ltvValorActual: null,
      equity,
      equityLiberado: inversionTotal - equity,
      cuotaMensual: null,
      servicioDeudaAnual: null,
      costeFinancieroTotal: n.id === 'sin' ? null : costeFinanciero,
      cashflowAnual: null,
      dscr: null,
      rentabilidadEquity: tir,
      moic,
      tir,
      van,
      riesgoAlto: false,
    };
  });

  const base = opciones.find((o) => o.id === 'sin')!;
  const financiadas = opciones.filter((o) => o.id !== 'sin');
  const veredicto = construirVeredicto('compra_venta', base, financiadas);

  return {
    aplica: true,
    tipo: 'compra_venta',
    yaFinanciado,
    inversionTotal,
    baseReferenciaLtv: baseRef,
    rentabilidadActivo: roiAnual,
    tipoInteres: interes,
    opciones,
    veredicto,
    motivoNoAplica: null,
  };
}

// ── Punto de entrada ──────────────────────────────────────────────────────────

export function simularFinanciacion(
  a: AnalisisFinanciero,
  fechaInicio: string | null,
  fechaSalida: string | null,
  sup: SupuestosFinanciacion,
): ResultadoSimulacion {
  if (a.tipo_analisis === 'renta') return simularRenta(a, fechaInicio, fechaSalida, sup);
  if (a.tipo_analisis === 'compra_venta')
    return simularCompraVenta(a, fechaInicio, fechaSalida, sup);
  return {
    aplica: false,
    tipo: null,
    yaFinanciado: false,
    inversionTotal: null,
    baseReferenciaLtv: null,
    rentabilidadActivo: null,
    tipoInteres: sup.tipoInteresPct / 100,
    opciones: [],
    veredicto: { nivel: 'na', titulo: '', mensaje: '', riesgoAlto: false, recomendada: null },
    motivoNoAplica:
      'La simulación de financiación solo aplica a proyectos en renta o compra-venta.',
  };
}
