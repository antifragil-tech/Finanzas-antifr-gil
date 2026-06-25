// ── analisisFinanciero.ts ──────────────────────────────────────────────────────
// Tipo canónico AnalisisFinanciero (espejo de la tabla proyecto_analisis_financiero)
// y funciones de cálculo financiero por tipo de operación.
// Los tipos de cálculo (XIRR, NPV, MOIC) viven en packages/utils — no reimplementar aquí.

// ── Tipo canónico ─────────────────────────────────────────────────────────────

// Alias backward-compatible para TabNumeros.tsx y otros componentes existentes
export type TipoAnalisis = 'compra_venta' | 'renta' | 'alternativo' | 'explotacion' | 'prestamo' | 'capex_interno';

export type AnalisisFinanciero = {
  id?: string;
  proyecto_id: string;
  tipo_analisis: TipoAnalisis;

  // ── Campos comunes ──────────────────────────────────────────────────────────
  equity_aportado?: number | null;
  valoracion_actual?: number | null;
  tasa_descuento?: number | null;
  porcentaje_equity?: number;           // calculado en cliente, no persistido

  // ── Compra / Venta ──────────────────────────────────────────────────────────
  precio_adquisicion?: number | null;
  gastos_adquisicion?: number | null;
  presupuesto_obra?: number | null;
  gastos_venta?: number | null;
  precio_venta_previsto?: number | null;
  deuda_promotora?: number | null;
  coste_financiero_deuda?: number | null;

  // ── Compra / Venta — campos extendidos ─────────────────────────────────────
  precio_compra_escritura?: number | null;
  gastos_financiacion_notarial?: number | null;
  iva_soportado_obra?: number | null;
  precio_venta_reservado?: number | null;
  anticipo_comprador?: number | null;
  comision_agente_pct?: number | null;
  plazo_ejecucion_obra_meses?: number | null;
  contingencia_obra_pct?: number | null;

  // ── Compra / Venta — duración de la operación (para TIR) ───────────────────
  // Prioridad: fecha_inicio_operacion+fecha_salida_prevista > fechas del proyecto
  //            > plazo_total_operacion_meses > plazo_ejecucion_obra_meses (fallback)
  fecha_inicio_operacion?: string | null;
  fecha_salida_prevista?: string | null;
  plazo_total_operacion_meses?: number | null;

  // ── Compra / Venta — fiscalidad ─────────────────────────────────────────────
  impuesto_sociedades_pct?: number | null;  // default 26%; aplicado sobre beneficio bruto positivo

  // ── Renta ───────────────────────────────────────────────────────────────────
  renta_mensual_bruta?: number | null;
  gastos_operativos_anuales?: number | null;
  capex_inicial?: number | null;
  deuda_hipotecaria?: number | null;
  cuota_hipoteca_mensual?: number | null;

  // ── Renta — campos extendidos ───────────────────────────────────────────────
  tasa_ocupacion_prevista_pct?: number | null;
  superficie_arrendable_m2?: number | null;
  renta_por_m2?: number | null;
  cap_rate_salida_pct?: number | null;
  ibi_anual?: number | null;
  seguro_anual?: number | null;
  capex_mantenimiento_anual?: number | null;  // compartido con explotacion

  // ── Renta — horizonte de análisis (TIR sin venta real) ─────────────────────
  horizonte_analisis_anios?: number | null;      // años del análisis (default 10)
  valor_residual_estimado?: number | null;       // solo si metodo = 'manual'
  metodo_valor_residual?: string | null;         // 'manual'|'valor_actual'|'crecimiento_anual'|'cap_rate_salida'
  fecha_inicio_explotacion?: string | null;      // fallback de fecha_inicio del proyecto

  // ── Renta — financiación detallada (opcional; mejora DSCR/LTV/TIR/VAN) ──────
  tipo_interes_deuda_pct?: number | null;         // TIN anual de la hipoteca, en %
  plazo_restante_anios?: number | null;           // plazo pendiente de amortización
  sistema_amortizacion_deuda?: string | null;     // 'frances' | 'bullet' | 'manual'

  // ── Renta — fiscalidad opcional (cerrada por defecto) ──────────────────────
  aplicar_fiscalidad?: boolean | null;            // si false/null → análisis antes de impuestos
  amortizacion_fiscal_anual?: number | null;      // gasto fiscal deducible (amortización contable)
  costes_venta_pct?: number | null;               // % sobre valor de salida (comisión, gastos)
  impuesto_plusvalia_pct?: number | null;         // % sobre la plusvalía en la venta
  // impuesto_sociedades_pct se reutiliza del bloque común (ya existe en BD)

  // ── Alternativo ─────────────────────────────────────────────────────────────
  descripcion_operacion?: string | null;
  retorno_previsto_total?: number | null;
  nivel_riesgo?: string | null;          // 'bajo' | 'medio' | 'alto'
  nivel_liquidez?: string | null;        // 'alta' | 'media' | 'baja'

  // ── Explotación ─────────────────────────────────────────────────────────────
  ingresos_anuales_previstos?: number | null;
  costes_variables_pct?: number | null;
  costes_fijos_anuales?: number | null;
  ebitda_objetivo_anual?: number | null;
  inversion_circulante?: number | null;
  tasa_crecimiento_anual_pct?: number | null;
  anio_break_even_previsto?: number | null;

  // ── Explotación — valor de continuidad / terminal (opcional, off por defecto) ─
  aplicar_valor_terminal?: boolean | null;
  metodo_valor_terminal?: string | null;        // 'manual' | 'multiplo_ebitda'
  valor_terminal_manual?: number | null;        // valor esperado del negocio al final del horizonte
  multiplo_ebitda_salida?: number | null;       // EBITDA año H × múltiplo

  // ── Préstamo / Inversión financiera ─────────────────────────────────────────
  tipo_instrumento?: string | null;
  nominal_prestamo?: number | null;
  tipo_interes_pct?: number | null;
  plazo_meses?: number | null;
  sistema_amortizacion?: string | null;
  fecha_vencimiento_instrumento?: string | null;
  colateral?: string | null;
  valor_garantia?: number | null;        // valor de la garantía → cobertura = valor / nominal
  rating_interno?: string | null;
  probabilidad_impago_pct?: number | null;
  lgd_pct?: number | null;

  // ── CAPEX interno ───────────────────────────────────────────────────────────
  beneficio_esperado_anual?: number | null;
  vida_util_activo_anios?: number | null;
  valor_residual_pct?: number | null;
  depreciacion_tipo?: string | null;
  tasa_descuento_interna?: number | null;

  created_at?: string;
  updated_at?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// CÁLCULOS PARA EXPLOTACIÓN
// ─────────────────────────────────────────────────────────────────────────────

export function calcularEBITDA(
  ingresos: number,
  costesVariablesPct: number,   // 0-100
  costosFijos: number
): number {
  const margenContribucion = ingresos * (1 - costesVariablesPct / 100);
  return margenContribucion - costosFijos;
}

export function calcularMargenEbitda(ebitda: number, ingresos: number): number | null {
  if (ingresos <= 0) return null;
  return ebitda / ingresos;
}

export function calcularBreakEven(
  costosFijos: number,
  pctMargenContribucion: number   // 0-100
): number | null {
  if (pctMargenContribucion <= 0) return null;
  return costosFijos / (pctMargenContribucion / 100);
}

export function calcularFCF(
  ebitda: number,
  capexMantenimiento: number,
  variacionCirculante: number = 0
): number {
  return ebitda - capexMantenimiento - variacionCirculante;
}

export function calcularPaybackOperativo(
  inversion: number,
  fcfAnual: number
): number | null {
  if (fcfAnual <= 0) return null;
  return inversion / fcfAnual;
}

// ─────────────────────────────────────────────────────────────────────────────
// CÁLCULOS PARA PRÉSTAMO / INVERSIÓN FINANCIERA
// ─────────────────────────────────────────────────────────────────────────────

export type CuotaAmortizacion = {
  mes: number;
  cuota: number;
  interes: number;
  amortizacion: number;
  capitalPendiente: number;
};

export function calcularCuadroAmortizacion(
  nominal: number,
  tipoInteresAnual: number,   // decimal, ej. 0.05
  plazoMeses: number,
  sistema: 'frances' | 'aleman' | 'bullet' = 'frances'
): CuotaAmortizacion[] {
  const r = tipoInteresAnual / 12;
  const cuotas: CuotaAmortizacion[] = [];
  let capitalPendiente = nominal;

  if (sistema === 'bullet') {
    for (let mes = 1; mes <= plazoMeses; mes++) {
      const interes = capitalPendiente * r;
      const amort = mes === plazoMeses ? nominal : 0;
      cuotas.push({
        mes,
        cuota: interes + amort,
        interes,
        amortizacion: amort,
        capitalPendiente: mes === plazoMeses ? 0 : nominal,
      });
    }
    return cuotas;
  }

  const cuotaFija = sistema === 'frances' && r > 0
    ? nominal * (r * Math.pow(1 + r, plazoMeses)) / (Math.pow(1 + r, plazoMeses) - 1)
    : nominal / plazoMeses + nominal * r;

  for (let mes = 1; mes <= plazoMeses; mes++) {
    const interes = capitalPendiente * r;
    const amort = sistema === 'frances' ? cuotaFija - interes : nominal / plazoMeses;
    const cuota = interes + amort;
    capitalPendiente = Math.max(0, capitalPendiente - amort);
    cuotas.push({
      mes,
      cuota: parseFloat(cuota.toFixed(2)),
      interes: parseFloat(interes.toFixed(2)),
      amortizacion: parseFloat(amort.toFixed(2)),
      capitalPendiente: parseFloat(capitalPendiente.toFixed(2)),
    });
  }
  return cuotas;
}

export function calcularInteresesDevengados(
  nominal: number,
  tipoInteresAnual: number,
  mesesTranscurridos: number
): number {
  return nominal * (tipoInteresAnual / 12) * mesesTranscurridos;
}

export function calcularCapitalPendiente(
  cuadro: CuotaAmortizacion[],
  mesActual: number
): number {
  const cuota = cuadro[mesActual - 1];
  return cuota?.capitalPendiente ?? 0;
}

export function calcularPerdidaEsperada(
  nominal: number,
  probabilidadImpago: number,   // 0-1
  lgd: number                    // 0-1, Loss Given Default
): number {
  return nominal * probabilidadImpago * lgd;
}

export function calcularTirInstrumento(
  nominal: number,
  cuadro: CuotaAmortizacion[],
  comisionInicial: number = 0
): number | null {
  if (cuadro.length === 0) return null;
  // Aproximación: tipo de interés mensual × 12 (TNA efectiva del cuadro)
  const r = cuadro[0] ? (cuadro[0].interes / (nominal - comisionInicial)) * 12 : null;
  return r;
}

// ─────────────────────────────────────────────────────────────────────────────
// CÁLCULOS PARA CAPEX INTERNO
// ─────────────────────────────────────────────────────────────────────────────

export function calcularPaybackCapex(
  inversion: number,
  beneficioAnual: number
): number | null {
  if (beneficioAnual <= 0) return null;
  return inversion / beneficioAnual;
}

export function calcularVanCapex(
  inversion: number,
  beneficioAnual: number,
  vidaUtilAnios: number,
  valorResidualPct: number,   // 0-100
  tasaDescuento: number       // decimal, ej. 0.08
): number | null {
  if (vidaUtilAnios <= 0) return null;
  let van = -inversion;
  for (let t = 1; t <= vidaUtilAnios; t++) {
    van += beneficioAnual / Math.pow(1 + tasaDescuento, t);
  }
  const valorResidual = inversion * (valorResidualPct / 100);
  van += valorResidual / Math.pow(1 + tasaDescuento, vidaUtilAnios);
  return van;
}

export function calcularTirCapex(
  inversion: number,
  beneficioAnual: number,
  vidaUtilAnios: number,
  valorResidualPct: number = 0
): number | null {
  if (vidaUtilAnios <= 0 || beneficioAnual <= 0) return null;
  const valorResidual = inversion * (valorResidualPct / 100);
  // Bisección numérica
  let lo = -0.5, hi = 10.0;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    let van = -inversion;
    for (let t = 1; t <= vidaUtilAnios; t++) van += beneficioAnual / Math.pow(1 + mid, t);
    van += valorResidual / Math.pow(1 + mid, vidaUtilAnios);
    if (Math.abs(van) < 1e-6) return mid;
    if (van > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function calcularDepreciacionAnual(
  valorActivo: number,
  vidaUtilAnios: number,
  valorResidualPct: number = 0,
  tipo: 'lineal' | 'acelerada' = 'lineal'
): number {
  const valorResidual = valorActivo * (valorResidualPct / 100);
  const baseDepreciable = valorActivo - valorResidual;
  if (tipo === 'lineal') return baseDepreciable / vidaUtilAnios;
  // Acelerada: doble saldo decreciente simplificado (primer año)
  return (2 / vidaUtilAnios) * valorActivo;
}

export function calcularValorResidualCapex(
  valorActivo: number,
  valorResidualPct: number
): number {
  return valorActivo * (valorResidualPct / 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// CÁLCULOS PARA RENTA PATRIMONIAL
// ─────────────────────────────────────────────────────────────────────────────

export function calcularNOI(
  rentaMensualBruta: number,
  gastosOperativosAnuales: number,
  tasaOcupacionPct: number = 100
): number {
  const rentaEfectiva = rentaMensualBruta * 12 * (tasaOcupacionPct / 100);
  return rentaEfectiva - gastosOperativosAnuales;
}

export function calcularYieldSobreCoste(
  noi: number,
  inversionTotal: number
): number | null {
  if (inversionTotal <= 0) return null;
  return noi / inversionTotal;
}

export function calcularYieldSobreValorActual(
  noi: number,
  valorActual: number
): number | null {
  if (valorActual <= 0) return null;
  return noi / valorActual;
}

export function calcularValorReversion(
  noiFinalAnio: number,
  capRateSalidaPct: number   // porcentaje, ej. 5.5
): number | null {
  if (capRateSalidaPct <= 0) return null;
  return noiFinalAnio / (capRateSalidaPct / 100);
}

export function calcularTirRentaConValorResidual(
  equity: number,
  noi: number,
  servicioDeudaAnual: number,
  valorReversion: number,
  deudaPendienteEnSalida: number,
  horizonteAnios: number,
  _tasaDescuento: number = 0.08
): number | null {
  if (equity <= 0 || horizonteAnios <= 0) return null;
  const cashflowAnual = noi - servicioDeudaAnual;
  const netoPorVenta = valorReversion - deudaPendienteEnSalida;
  // Sin retorno positivo total la TIR no existe (proyecto destruye valor)
  if (cashflowAnual * horizonteAnios + netoPorVenta <= 0) return null;
  // Bisección numérica
  let lo = -0.5, hi = 5.0;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    let van = -equity;
    for (let t = 1; t <= horizonteAnios; t++) van += cashflowAnual / Math.pow(1 + mid, t);
    van += netoPorVenta / Math.pow(1 + mid, horizonteAnios);
    if (Math.abs(van) < 1e-6) return mid;
    if (van > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// CÁLCULOS PARA COMPRA-VENTA
// ─────────────────────────────────────────────────────────────────────────────

export function calcularCosteTotalProyecto(a: {
  precio_adquisicion?: number | null;
  gastos_adquisicion?: number | null;
  presupuesto_obra?: number | null;
  gastos_venta?: number | null;
  coste_financiero_deuda?: number | null;
  contingencia_obra_pct?: number | null;
}): number {
  const base = (a.precio_adquisicion ?? 0) + (a.gastos_adquisicion ?? 0)
    + (a.presupuesto_obra ?? 0) + (a.gastos_venta ?? 0)
    + (a.coste_financiero_deuda ?? 0);
  const contingencia = (a.presupuesto_obra ?? 0) * ((a.contingencia_obra_pct ?? 0) / 100);
  return base + contingencia;
}

export function calcularBeneficioEsperado(
  precioVenta: number,
  costeTotalProyecto: number
): number {
  return precioVenta - costeTotalProyecto;
}

export function calcularMargenSobreVenta(
  beneficio: number,
  precioVenta: number
): number | null {
  if (precioVenta <= 0) return null;
  return beneficio / precioVenta;
}

export function calcularROI(
  beneficio: number,
  inversionTotal: number
): number | null {
  if (inversionTotal <= 0) return null;
  return beneficio / inversionTotal;
}

export function calcularBreakEvenVenta(costeTotalProyecto: number): number {
  return costeTotalProyecto;
}

export function calcularCostePorM2(
  costeTotalProyecto: number,
  superficieM2: number | null
): number | null {
  if (!superficieM2 || superficieM2 <= 0) return null;
  return costeTotalProyecto / superficieM2;
}

export type SensibilidadPrecioRow = {
  variacionPct: number;
  precioVenta: number;
  margen: number;
  tirEquity: number | null;
  anos: number;
};

export function calcularSensibilidadPrecioVenta(
  costeTotalProyecto: number,
  _equity: number,
  variacionesPct: number[] = [-20, -15, -10, -5, 0, 5, 10, 15, 20]
): SensibilidadPrecioRow[] {
  // Precio base = coste total + 15% de margen de referencia
  const precioBase = costeTotalProyecto * 1.15;
  return variacionesPct.map(pct => {
    const precio = precioBase * (1 + pct / 100);
    const margen = precio - costeTotalProyecto;
    return { variacionPct: pct, precioVenta: precio, margen, tirEquity: null, anos: 0 };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SEMÁFOROS Y KPIs EXISTENTES (compatibilidad con TabNumeros.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export type Semaforo = 'verde' | 'ambar' | 'rojo' | 'neutro';

// < 8% rojo · 8-10% ámbar · > 10% verde  (umbrales definidos por Guille)
export function semaforoTir(tir: number | null): Semaforo {
  if (tir === null) return 'neutro';
  if (tir > 0.10) return 'verde';
  if (tir >= 0.08) return 'ambar';
  return 'rojo';
}

export function semaforoYield(y: number | null): Semaforo {
  if (y === null) return 'neutro';
  if (y > 0.10) return 'verde';
  if (y >= 0.08) return 'ambar';
  return 'rojo';
}

export const SEMAFORO_COLORS: Record<Semaforo, string> = {
  verde:  'text-emerald-400',
  ambar:  'text-amber-400',
  rojo:   'text-red-400',
  neutro: 'text-zinc-400',
};

export const SEMAFORO_BG: Record<Semaforo, string> = {
  verde:  'bg-emerald-500/10 border-emerald-500/20',
  ambar:  'bg-amber-500/10  border-amber-500/20',
  rojo:   'bg-red-500/10    border-red-500/20',
  neutro: 'bg-zinc-800/40   border-white/[0.06]',
};

function duracionAnos(inicio: string | null, salida: string | null): number | null {
  if (!inicio || !salida) return null;
  const d = (new Date(salida).getTime() - new Date(inicio).getTime()) / (365.25 * 86400000);
  return d > 0 ? d : null;
}

function tirDosFlujosAnual(equity: number, retornoNeto: number, anos: number): number | null {
  if (equity <= 0 || retornoNeto <= 0 || anos <= 0) return null;
  return (retornoNeto / equity) ** (1 / anos) - 1;
}

export type KpisCompraVenta = {
  inversionTotal: number | null;
  // Resultado del proyecto
  margenBruto: number | null;                  // beneficio antes de impuestos (venta - coste)
  margenPct: number | null;                    // margenBruto / venta
  impuestoSociedades: number | null;           // IS estimado sobre beneficio positivo
  beneficioNeto: number | null;                // margenBruto - impuestoSociedades
  // Rentabilidad sobre equity
  moic: number | null;                         // MOIC neto: (equity+beneficioNeto)/equity
  moicPreTax: number | null;                   // MOIC antes IS: (equity+margenBruto)/equity
  tirEquity: number | null;                    // TIR neta después IS (métrica principal)
  tirPreTax: number | null;                    // TIR antes IS (referencia)
  van: number | null;                          // VAN neto
  // Financiación
  ltvDeudaBancaria: number | null;             // deuda_promotora / coste_total
  financiacionExternaTotalPct: number | null;  // (deuda_promotora + anticipo) / coste_total
  ltv: number | null;                          // alias de ltvDeudaBancaria (compat)
  costeM2: number | null;
  anosUsados: number | null;
  usaFallbackObra: boolean;
  // Desglose para la vista (timing de caja)
  equity: number | null;                       // capital propio aportado (costes iniciales − deuda)
  equityInsuficiente: boolean;                 // deuda ≥ costes iniciales → equity ≤ 0 (TIR no fiable)
  contingencia: number | null;                 // obra × % contingencia
  comisionAgente: number | null;               // comisión sobre venta
  costesSalida: number | null;                 // gastos venta + comisión (se pagan a la salida)
  flujoSalidaNeto: number | null;              // venta − deuda − costes salida − IS
};

export function calcKpisCV(a: AnalisisFinanciero, fechaInicio: string | null, fechaSalida: string | null, superficieM2: number | null, gastoRealAcumulado?: number): KpisCompraVenta {
  const compra    = a.precio_adquisicion ?? 0;
  const gastosAdq = a.gastos_adquisicion ?? 0;
  const obra      = gastoRealAcumulado ?? (a.presupuesto_obra ?? 0);
  const gastosVta = a.gastos_venta ?? 0;
  const costeFin  = a.coste_financiero_deuda ?? 0;
  const venta     = a.precio_venta_previsto ?? 0;
  const tasa      = a.tasa_descuento ?? 0.08;

  const NULL_RESULT: KpisCompraVenta = {
    inversionTotal: null, margenBruto: null, margenPct: null,
    impuestoSociedades: null, beneficioNeto: null,
    moic: null, moicPreTax: null, tirEquity: null, tirPreTax: null, van: null,
    ltvDeudaBancaria: null, financiacionExternaTotalPct: null, ltv: null,
    costeM2: null, anosUsados: null, usaFallbackObra: false,
    equity: null, equityInsuficiente: false, contingencia: null, comisionAgente: null, costesSalida: null, flujoSalidaNeto: null,
  };
  if (!compra && !obra && !venta) return NULL_RESULT;

  // ── Resolución del plazo con prioridad ──────────────────────────────────────
  // 1. Fechas propias del análisis  2. Fechas del proyecto
  // 3. Plazo total operación        4. Fallback: plazo de obra (aviso en UI)
  let anosUsados: number | null = null;
  let usaFallbackObra = false;

  if (a.fecha_inicio_operacion && a.fecha_salida_prevista) {
    anosUsados = duracionAnos(a.fecha_inicio_operacion, a.fecha_salida_prevista);
  }
  if (anosUsados === null && fechaInicio && fechaSalida) {
    anosUsados = duracionAnos(fechaInicio, fechaSalida);
  }
  if (anosUsados === null && a.plazo_total_operacion_meses && a.plazo_total_operacion_meses > 0) {
    anosUsados = a.plazo_total_operacion_meses / 12;
  }
  if (anosUsados === null && a.plazo_ejecucion_obra_meses && a.plazo_ejecucion_obra_meses > 0) {
    anosUsados = a.plazo_ejecucion_obra_meses / 12;
    usaFallbackObra = true;
  }

  const comisionAgente = venta > 0 && a.comision_agente_pct ? venta * (a.comision_agente_pct / 100) : 0;
  const ivaNoRecup     = a.iva_soportado_obra ?? 0;
  const contingencia   = obra * ((a.contingencia_obra_pct ?? 0) / 100);
  const deudaPromotora = a.deuda_promotora ?? 0;

  // ── Coste económico TOTAL vs. timing de caja ────────────────────────────────
  // Para el MARGEN económico se suman todos los costes. Para VAN/TIR se respeta
  // CUÁNDO ocurre cada flujo: los costes de venta, comisión e impuestos van en el
  // flujo de SALIDA (se pagan con la venta), no como inversión del año 0.
  const costesIniciales = compra + gastosAdq + obra + contingencia + ivaNoRecup + costeFin; // desembolsos durante la operación
  const costesSalida    = gastosVta + comisionAgente;                                       // se pagan con la venta
  const inversionTotal  = costesIniciales + costesSalida;                                    // coste económico total
  // Capital propio realmente aportado durante la operación = costes iniciales − deuda.
  const equity          = Math.max(costesIniciales - deudaPromotora, 0);
  // Si la deuda iguala o supera los costes iniciales, el equity es ≤ 0 y la TIR
  // sobre equity deja de tener sentido (se marca y no se muestra como definitiva).
  const equityInsuficiente = costesIniciales > 0 && (costesIniciales - deudaPromotora) <= 0;
  const margenBruto     = venta > 0 ? venta - inversionTotal : null;
  const margenPct       = venta > 0 && margenBruto !== null ? margenBruto / venta : null;

  // ── Fiscalidad ──────────────────────────────────────────────────────────────
  const isPct              = (a.impuesto_sociedades_pct ?? 26) / 100;
  const impuestoSociedades = margenBruto != null ? Math.max(margenBruto, 0) * isPct : null;
  const beneficioNeto      = margenBruto != null && impuestoSociedades != null
    ? margenBruto - impuestoSociedades : null;

  // ── Rentabilidad sobre equity (flujos con timing correcto) ──────────────────
  // Flujo de SALIDA a equity = venta − deuda pendiente − costes de salida − IS.
  // La deuda se devuelve UNA sola vez a la venta (sin doble penalización).
  const flujoSalidaPreTax = venta > 0 ? venta - deudaPromotora - costesSalida : null;
  const flujoSalidaNeto   = flujoSalidaPreTax != null && impuestoSociedades != null
    ? flujoSalidaPreTax - impuestoSociedades : null;

  const moicPreTax = equity > 0 && flujoSalidaPreTax != null ? flujoSalidaPreTax / equity : null;
  const moic       = equity > 0 && flujoSalidaNeto   != null ? flujoSalidaNeto   / equity : null;

  const tirPreTax = equity > 0 && anosUsados && flujoSalidaPreTax != null && flujoSalidaPreTax > 0
    ? tirDosFlujosAnual(equity, flujoSalidaPreTax, anosUsados) : null;
  const tirEquity = equity > 0 && anosUsados && flujoSalidaNeto != null && flujoSalidaNeto > 0
    ? tirDosFlujosAnual(equity, flujoSalidaNeto, anosUsados) : null;

  const van = equity > 0 && anosUsados && flujoSalidaNeto != null
    ? (flujoSalidaNeto / (1 + tasa) ** anosUsados) - equity : null;

  // ── Financiación ────────────────────────────────────────────────────────────
  // LTV sobre coste total con deuda real, no con deuda implícita por % equity
  const anticipoComprador = a.anticipo_comprador ?? 0;
  const ltvDeudaBancaria  = deudaPromotora > 0 && inversionTotal > 0
    ? deudaPromotora / inversionTotal : null;
  const financiacionExternaTotalPct = (deudaPromotora + anticipoComprador) > 0 && inversionTotal > 0
    ? (deudaPromotora + anticipoComprador) / inversionTotal : null;
  const ltv = ltvDeudaBancaria;  // alias para compat con Escenarios/Sensibilidad

  const costeM2 = superficieM2 && superficieM2 > 0 ? inversionTotal / superficieM2 : null;

  return {
    inversionTotal, margenBruto, margenPct, impuestoSociedades, beneficioNeto,
    moic, moicPreTax, tirEquity, tirPreTax, van,
    ltvDeudaBancaria, financiacionExternaTotalPct, ltv,
    costeM2, anosUsados, usaFallbackObra,
    equity, equityInsuficiente, contingencia, comisionAgente, costesSalida, flujoSalidaNeto,
  };
}

export type KpisRenta = {
  inversionTotal: number | null;
  noIAnual: number | null;
  yieldBruto: number | null;
  yieldNeto: number | null;
  cashOnCash: number | null;
  dscr: number | null;
  paybackAnos: number | null;
  margenLatente: number | null;
  ltv: number | null;
};

export function calcKpisRenta(a: AnalisisFinanciero, ingresoRealAnual?: number): KpisRenta {
  const compra      = a.precio_adquisicion ?? 0;
  const gastosAdq   = a.gastos_adquisicion ?? 0;
  const capex       = a.capex_inicial ?? 0;
  const rentaMes    = ingresoRealAnual ? ingresoRealAnual / 12 : (a.renta_mensual_bruta ?? 0);
  const gastosAnual = a.gastos_operativos_anuales ?? 0;
  const hipotecaMes = a.cuota_hipoteca_mensual ?? 0;
  const deudaHip    = a.deuda_hipotecaria ?? 0;
  const valoracion  = a.valoracion_actual;

  if (!compra && !rentaMes) return { inversionTotal: null, noIAnual: null, yieldBruto: null, yieldNeto: null, cashOnCash: null, dscr: null, paybackAnos: null, margenLatente: null, ltv: null };

  const inversionTotal = compra + gastosAdq + capex;
  // Capital propio aportado = coste total − deuda (no un % de la inversión).
  const equity         = Math.max(inversionTotal - deudaHip, 0);
  const rentaAnual     = rentaMes * 12;
  const noIAnual       = rentaAnual - gastosAnual;
  // Bruta sobre el coste inicial total (precio + gastos + capex), igual que la neta
  const yieldBruto     = inversionTotal > 0 ? rentaAnual / inversionTotal : null;
  const yieldNeto      = inversionTotal > 0 ? noIAnual / inversionTotal : null;
  const servDeudaAnual = hipotecaMes * 12;
  const cashOnCash     = equity > 0 ? (noIAnual - servDeudaAnual) / equity : null;
  const dscr           = servDeudaAnual > 0 ? noIAnual / servDeudaAnual : null;
  const cashflowAnual  = noIAnual - servDeudaAnual;
  const paybackAnos    = equity > 0 && cashflowAnual > 0 ? equity / cashflowAnual : null;
  const margenLatente  = valoracion != null ? valoracion - inversionTotal : null;
  const ltv            = deudaHip > 0 && valoracion ? deudaHip / valoracion : null;

  return { inversionTotal, noIAnual, yieldBruto, yieldNeto, cashOnCash, dscr, paybackAnos, margenLatente, ltv };
}

export type KpisAlternativo = {
  capitalRequerido: number | null;       // equity aportado / capital invertido
  retornoTotal: number | null;           // importe total esperado a la salida (capital + plusvalía)
  beneficioEsperado: number | null;      // retorno total − capital
  moic: number | null;
  tirEquity: number | null;
  van: number | null;
  margenLatente: number | null;          // plusvalía latente = valoración actual − capital
  anosUsados: number | null;
  tasaUsada: number | null;
};

export function calcKpisAlternativo(a: AnalisisFinanciero, fechaInicio: string | null, fechaSalida: string | null, cobrosRealesAcumulados?: number): KpisAlternativo {
  const equity     = a.precio_adquisicion ?? 0;
  const retorno    = cobrosRealesAcumulados ?? (a.retorno_previsto_total ?? 0);
  const tasa       = a.tasa_descuento ?? 0.08;
  const anos       = duracionAnos(fechaInicio, fechaSalida);
  const valoracion = a.valoracion_actual;

  const NULO: KpisAlternativo = {
    capitalRequerido: null, retornoTotal: null, beneficioEsperado: null,
    moic: null, tirEquity: null, van: null, margenLatente: null,
    anosUsados: null, tasaUsada: null,
  };
  if (!equity && !retorno) return NULO;

  // Retorno total = importe total esperado a la salida (recuperación de capital +
  // plusvalía), NO solo el beneficio. El beneficio es retorno − capital.
  const moic          = equity > 0 && retorno > 0 ? retorno / equity : null;
  const beneficioEsperado = equity > 0 && retorno > 0 ? retorno - equity : null;
  const tirEquity     = equity > 0 && anos && retorno > 0 ? tirDosFlujosAnual(equity, retorno, anos) : null;
  // VAN: el retorno (a la salida) descontado, menos el capital. La valoración
  // actual NO se suma al VAN (es referencia de mercado hoy, no un cobro).
  const van           = equity > 0 && anos && retorno > 0 ? (retorno / (1 + tasa) ** anos) - equity : null;
  const margenLatente = valoracion != null && equity > 0 ? valoracion - equity : null;

  return {
    capitalRequerido: equity > 0 ? equity : null,
    retornoTotal: retorno > 0 ? retorno : null,
    beneficioEsperado,
    moic, tirEquity, van, margenLatente,
    anosUsados: anos, tasaUsada: tasa,
  };
}

export { duracionAnos };

// ─────────────────────────────────────────────────────────────────────────────
// SEMÁFOROS POR TIPO
// ─────────────────────────────────────────────────────────────────────────────

export function semaforoYieldRenta(y: number | null): Semaforo {
  if (y === null) return 'neutro';
  if (y > 0.06) return 'verde';
  if (y >= 0.04) return 'ambar';
  return 'rojo';
}

export function semaforoDSCR(d: number | null): Semaforo {
  if (d === null) return 'neutro';
  if (d > 1.3) return 'verde';
  if (d >= 1.1) return 'ambar';
  return 'rojo';
}

export function semaforoLTV(ltv: number | null): Semaforo {
  if (ltv === null) return 'neutro';
  if (ltv < 0.5) return 'verde';
  if (ltv <= 0.7) return 'ambar';
  return 'rojo';
}

export function semaforoMargenCV(m: number | null): Semaforo {
  if (m === null) return 'neutro';
  if (m > 0.18) return 'verde';
  if (m >= 0.10) return 'ambar';
  return 'rojo';
}

export function semaforoMargenEbitda(m: number | null): Semaforo {
  if (m === null) return 'neutro';
  if (m > 0.20) return 'verde';
  if (m >= 0.10) return 'ambar';
  return 'rojo';
}

export function semaforoPayback(p: number | null): Semaforo {
  if (p === null) return 'neutro';
  if (p < 3) return 'verde';
  if (p <= 5) return 'ambar';
  return 'rojo';
}

export function semaforoProbImpago(p: number | null): Semaforo {
  if (p === null) return 'neutro';
  if (p < 0.03) return 'verde';
  if (p <= 0.10) return 'ambar';
  return 'rojo';
}

// ─────────────────────────────────────────────────────────────────────────────
// KPIs RENTA EXTENDIDOS
// ─────────────────────────────────────────────────────────────────────────────

export type KpisRentaExtended = {
  inversionTotal: number | null;
  rentaAnualBruta: number | null;
  gastosAnualesTotal: number | null;
  noIAnual: number | null;
  yieldBruto: number | null;
  yieldNetoCoste: number | null;
  yieldNetoValorActual: number | null;
  cashOnCash: number | null;
  dscr: number | null;
  paybackAnos: number | null;
  margenLatente: number | null;
  ltv: number | null;
  valorReversion: number | null;
  tirConResidual: number | null;
  // VAN (convive con la TIR; descuenta los flujos de caja al tipo exigido)
  van: number | null;
  vanSinResidual: number | null;       // VAN solo con las rentas (sin valor residual): mide si la operación crea valor por renta
  tasaDescuentoUsada: number | null;
  diferencialTirTasa: number | null;   // TIR − tasa de descuento (puntos)
  // Financiación a salida (para TIR/VAN con deuda)
  servicioDeudaAnual: number | null;
  deudaSalidaEstimada: number | null;
  financiacionEstimada: boolean;        // deuda a salida calculada con fallback conservador
  // Fiscalidad
  fiscalidadAplicada: boolean;
  // Horizonte y valor residual
  valorResidualUsado: number | null;       // valor residual FUTURO (año horizonte)
  valorResidualPresente: number | null;    // descontado a hoy: futuro / (1+tasa)^h
  revalorizacionResidualPct: number | null; // % revalorización usada (solo valor_actual); null si no aplica
  revalorizacionPorDefecto: boolean;        // true = se usa 0% por estar vacío (supuesto conservador)
  horizonteUsado: number | null;
  metodoResidualLabel: string | null;
  tirSinDatos: boolean; // true = faltan datos para calcular TIR
};

const METODO_LABEL: Record<string, string> = {
  manual:            'Manual',
  valor_actual:      'Valor actual estimado',
  crecimiento_anual: 'Crecimiento anual del activo',
  cap_rate_salida:   'Cap rate de salida',
};

// Revalorización anual del activo usada para el método "valor actual".
// Vacía → 0% (supuesto conservador: el activo mantiene su valor de hoy).
export function revalorizacionResidual(a: AnalisisFinanciero): number {
  return (a.tasa_crecimiento_anual_pct ?? 0) / 100;
}

// Devuelve el VALOR RESIDUAL FUTURO (en el año `horizonte`). El descuento a valor
// presente lo aplica el motor de VAN/TIR (divide por (1+tasa)^horizonte).
function calcValorResidualRenta(
  a: AnalisisFinanciero,
  noi: number,
  horizonte: number
): number | null {
  const metodo = a.metodo_valor_residual ?? 'valor_actual';
  // Manual: el usuario introduce directamente el valor esperado en el año final.
  if (metodo === 'manual') return a.valor_residual_estimado ?? null;
  // Cap rate de salida: NOI / cap rate → valor futuro del activo a la salida.
  if (metodo === 'cap_rate_salida') {
    if (!a.cap_rate_salida_pct || a.cap_rate_salida_pct <= 0 || noi <= 0) return null;
    return noi / (a.cap_rate_salida_pct / 100);
  }
  // Valor actual estimado (y alias 'crecimiento_anual'): valor de mercado HOY
  // capitalizado por la revalorización anual hasta el año `horizonte`. Con
  // revalorización 0% se mantiene el valor de hoy (no es el residual del año 10
  // por arte de magia: es el supuesto explícito de revalorización nula).
  if (a.valoracion_actual == null) return null;
  const g = revalorizacionResidual(a);
  return a.valoracion_actual * Math.pow(1 + g, horizonte);
}

// ── Financiación de renta: servicio de deuda, deuda a salida, LTV ──────────────
// Calcula el servicio de deuda anual y la deuda viva estimada al final del
// horizonte según el sistema de amortización. Si faltan datos usa un fallback
// conservador (no rompe el cálculo) y marca el resultado como estimado.

export type FinanciacionRenta = {
  deudaViva: number;
  servicioDeudaAnual: number | null;
  cuotaMensual: number | null;
  interesesAnual: number | null;
  amortizacionAnual: number | null;
  deudaSalida: number | null;       // deuda viva estimada al final del horizonte
  ltv: number | null;
  sistema: string;
  estimado: boolean;                // deuda a salida o servicio con fallback conservador
  incompleto: boolean;              // faltan datos para un cálculo fiable
};

export function calcFinanciacionRenta(a: AnalisisFinanciero, horizonteAnios: number): FinanciacionRenta {
  const deuda       = a.deuda_hipotecaria ?? 0;
  const interes     = (a.tipo_interes_deuda_pct ?? 0) / 100;
  const plazoAnios  = a.plazo_restante_anios ?? 0;
  const cuotaManual = a.cuota_hipoteca_mensual ?? 0;
  const sistema     = a.sistema_amortizacion_deuda ?? (cuotaManual > 0 ? 'manual' : 'frances');
  const valoracion  = a.valoracion_actual ?? null;
  // LTV sobre valor actual, coherente con la etiqueta del KPI ("Hipoteca / valor actual").
  const ltv         = deuda > 0 && valoracion && valoracion > 0 ? deuda / valoracion : null;

  if (deuda <= 0) {
    return { deudaViva: 0, servicioDeudaAnual: null, cuotaMensual: null, interesesAnual: null,
      amortizacionAnual: null, deudaSalida: null, ltv: null, sistema, estimado: false, incompleto: false };
  }

  // Francés con datos completos → cuadro de amortización real
  if (sistema === 'frances' && interes > 0 && plazoAnios > 0) {
    const plazoMeses = Math.max(1, Math.round(plazoAnios * 12));
    const cuadro = calcularCuadroAmortizacion(deuda, interes, plazoMeses, 'frances');
    const cuotaMensual      = cuadro[0]?.cuota ?? 0;
    const interesesAnual    = cuadro.slice(0, 12).reduce((s, c) => s + c.interes, 0);
    const amortizacionAnual = cuadro.slice(0, 12).reduce((s, c) => s + c.amortizacion, 0);
    const mesSalida   = Math.min(Math.max(1, Math.round(horizonteAnios * 12)), plazoMeses);
    const deudaSalida = cuadro[mesSalida - 1]?.capitalPendiente ?? 0;
    return { deudaViva: deuda, servicioDeudaAnual: cuotaMensual * 12, cuotaMensual,
      interesesAnual, amortizacionAnual, deudaSalida, ltv, sistema, estimado: false, incompleto: false };
  }

  // Bullet / interest-only → solo intereses, principal íntegro a salida
  if (sistema === 'bullet' && interes > 0) {
    const interesesAnual = deuda * interes;
    return { deudaViva: deuda, servicioDeudaAnual: interesesAnual, cuotaMensual: interesesAnual / 12,
      interesesAnual, amortizacionAnual: 0, deudaSalida: deuda, ltv, sistema, estimado: false, incompleto: false };
  }

  // Manual / cuota conocida (incluye datos antiguos: solo deuda + cuota mensual)
  if (cuotaManual > 0) {
    const servicio          = cuotaManual * 12;
    const interesesAnual    = interes > 0 ? deuda * interes : null;
    const amortizacionAnual = interesesAnual != null ? Math.max(0, servicio - interesesAnual) : null;
    // Deuda a salida: con amortización conocida se descuenta lineal; si no, conservador = deuda viva.
    const deudaSalida = amortizacionAnual != null ? Math.max(0, deuda - amortizacionAnual * horizonteAnios) : deuda;
    return { deudaViva: deuda, servicioDeudaAnual: servicio, cuotaMensual: cuotaManual,
      interesesAnual, amortizacionAnual, deudaSalida, ltv, sistema: 'manual',
      estimado: amortizacionAnual == null, incompleto: interes <= 0 };
  }

  // Deuda sin cuota ni datos → fallback conservador (interest-only si hay tipo)
  const interesesAnual = interes > 0 ? deuda * interes : null;
  return { deudaViva: deuda, servicioDeudaAnual: interesesAnual, cuotaMensual: interesesAnual != null ? interesesAnual / 12 : null,
    interesesAnual, amortizacionAnual: 0, deudaSalida: deuda, ltv, sistema, estimado: true, incompleto: true };
}

// ── Desglose del flujo de caja anual de renta (cascada) ───────────────────────
// Separa internamente: renta bruta → ocupación → renta efectiva → gastos →
// NOI → servicio de deuda → caja antes de impuestos → impuestos → caja neta.
// NOTA: NOI mantiene la convención actual del módulo (incluye CAPEX de
// mantenimiento como gasto del activo) para no alterar los KPIs ya conocidos.

export type FlujoAnualRenta = {
  rentaBrutaAnual: number;
  ajusteOcupacion: number;       // ≤ 0
  rentaEfectiva: number;
  gastosOperativos: number;
  ibi: number;
  seguro: number;
  capexMantenimiento: number;
  noi: number;                   // = renta efectiva − gastos op − ibi − seguro − capex mant
  servicioDeuda: number;
  intereses: number | null;
  amortizacion: number | null;
  cajaAntesImpuestos: number;
  baseImponible: number | null;
  impuestos: number;
  fiscalidadAplicada: boolean;
  cajaNetaFinal: number;
};

export function calcFlujoAnualRenta(
  a: AnalisisFinanciero,
  fechaInicio: string | null,
  fechaSalida: string | null,
): FlujoAnualRenta | null {
  const compra   = a.precio_adquisicion ?? 0;
  const rentaMes = a.renta_mensual_bruta ?? 0;
  if (!compra && !rentaMes) return null;

  const tasaOcup  = a.tasa_ocupacion_prevista_pct ?? 100;
  const gastosOp  = a.gastos_operativos_anuales ?? 0;
  const ibi       = a.ibi_anual ?? 0;
  const seguro    = a.seguro_anual ?? 0;
  const capexMant = a.capex_mantenimiento_anual ?? 0;

  const fiEfectiva     = a.fecha_inicio_explotacion ?? fechaInicio;
  const horizonteDeF   = duracionAnos(fiEfectiva, fechaSalida);
  const horizonte      = a.horizonte_analisis_anios ?? (horizonteDeF != null ? Math.round(horizonteDeF) : 10);

  const rentaBrutaAnual = rentaMes * 12;
  const rentaEfectiva   = rentaBrutaAnual * (tasaOcup / 100);
  const ajusteOcupacion = rentaEfectiva - rentaBrutaAnual;
  const noi             = rentaEfectiva - gastosOp - ibi - seguro - capexMant;

  const fin = calcFinanciacionRenta(a, horizonte);
  const servicioDeuda = fin.servicioDeudaAnual ?? 0;
  const cajaAntesImpuestos = noi - servicioDeuda;

  const fiscalidadAplicada = a.aplicar_fiscalidad === true;
  const isPct      = (a.impuesto_sociedades_pct ?? 25) / 100;
  const amortFiscal = a.amortizacion_fiscal_anual ?? 0;
  // Base imponible: NOI − intereses − amortización fiscal (el principal no es gasto).
  const baseImponible = fiscalidadAplicada
    ? noi - (fin.interesesAnual ?? 0) - amortFiscal
    : null;
  const impuestos = fiscalidadAplicada && baseImponible != null ? Math.max(baseImponible, 0) * isPct : 0;
  const cajaNetaFinal = cajaAntesImpuestos - impuestos;

  return {
    rentaBrutaAnual, ajusteOcupacion, rentaEfectiva,
    gastosOperativos: gastosOp, ibi, seguro, capexMantenimiento: capexMant, noi,
    servicioDeuda, intereses: fin.interesesAnual, amortizacion: fin.amortizacionAnual,
    cajaAntesImpuestos, baseImponible, impuestos, fiscalidadAplicada, cajaNetaFinal,
  };
}

// ── VAN/TIR sobre flujos de renta (caja anual constante + venta neta al corte) ─

function vanRentaFlujos(equity: number, cajaAnual: number, ventaNeta: number, horizonte: number, tasa: number): number | null {
  if (equity <= 0 || horizonte <= 0) return null;
  let van = -equity;
  for (let t = 1; t <= horizonte; t++) van += cajaAnual / Math.pow(1 + tasa, t);
  van += ventaNeta / Math.pow(1 + tasa, horizonte);
  return van;
}

function irrRentaFlujos(equity: number, cajaAnual: number, ventaNeta: number, horizonte: number): number | null {
  if (equity <= 0 || horizonte <= 0) return null;
  if (cajaAnual * horizonte + ventaNeta <= 0) return null;   // no recupera el equity
  let lo = -0.5, hi = 5.0;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    let v = -equity;
    for (let t = 1; t <= horizonte; t++) v += cajaAnual / Math.pow(1 + mid, t);
    v += ventaNeta / Math.pow(1 + mid, horizonte);
    if (Math.abs(v) < 1e-6) return mid;
    if (v > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function calcKpisRentaExtended(
  a: AnalisisFinanciero,
  fechaInicio: string | null,
  fechaSalida: string | null,
): KpisRentaExtended {
  const compra      = a.precio_adquisicion ?? 0;
  const gastosAdq   = a.gastos_adquisicion ?? 0;
  const capex       = a.capex_inicial ?? 0;
  const rentaMes    = a.renta_mensual_bruta ?? 0;
  const tasaOcup    = a.tasa_ocupacion_prevista_pct ?? 100;
  const hipotecaMes = a.cuota_hipoteca_mensual ?? 0;
  const deudaHip    = a.deuda_hipotecaria ?? 0;
  const valoracion  = a.valoracion_actual ?? null;
  const tasa        = a.tasa_descuento ?? 0.08;
  const capRata     = a.cap_rate_salida_pct ?? null;
  const gastosOp    = a.gastos_operativos_anuales ?? 0;
  const ibi         = a.ibi_anual ?? 0;
  const seguro      = a.seguro_anual ?? 0;
  const capexMant   = a.capex_mantenimiento_anual ?? 0;

  // Horizonte: explícito en análisis > fechas del proyecto > default 10 años
  const fiEfectiva        = a.fecha_inicio_explotacion ?? fechaInicio;
  const horizonteDeFechas = duracionAnos(fiEfectiva, fechaSalida);
  const horizonteUsado    = a.horizonte_analisis_anios
    ?? (horizonteDeFechas != null ? Math.round(horizonteDeFechas) : 10); // default 10 años

  const metodo            = a.metodo_valor_residual ?? 'valor_actual';
  const metodoResidualLabel = METODO_LABEL[metodo] ?? metodo;

  const null_result: KpisRentaExtended = {
    inversionTotal: null, rentaAnualBruta: null, gastosAnualesTotal: null,
    noIAnual: null, yieldBruto: null, yieldNetoCoste: null, yieldNetoValorActual: null,
    cashOnCash: null, dscr: null, paybackAnos: null, margenLatente: null, ltv: null,
    valorReversion: null, tirConResidual: null,
    van: null, vanSinResidual: null, tasaDescuentoUsada: null, diferencialTirTasa: null,
    servicioDeudaAnual: null, deudaSalidaEstimada: null, financiacionEstimada: false,
    fiscalidadAplicada: false,
    valorResidualUsado: null, valorResidualPresente: null,
    revalorizacionResidualPct: null, revalorizacionPorDefecto: false,
    horizonteUsado: null, metodoResidualLabel, tirSinDatos: false,
  };

  if (!compra && !rentaMes) return null_result;

  const inversionTotal     = compra + gastosAdq + capex;
  // Capital propio aportado = coste total − deuda hipotecaria (NO un % de la
  // inversión). Antes se usaba inversionTotal × %equity, lo que dividía el
  // capital parcial entre flujos completos sin coste de deuda e inflaba TIR/VAN.
  // Sin deuda → equity = coste total → TIR económica del activo. Con deuda, los
  // flujos ya van netos de cuota y la salida neta de la deuda pendiente.
  const equity             = Math.max(inversionTotal - deudaHip, 0);
  const rentaEfectiva      = rentaMes * 12 * (tasaOcup / 100);
  const gastosAnualesTotal = gastosOp + ibi + seguro + capexMant;
  const noIAnual           = rentaEfectiva - gastosAnualesTotal;
  const rentaAnualBruta    = rentaMes * 12;
  // Rentabilidad bruta sobre el coste inicial total (precio + gastos adquisición
  // + capex), misma base que la neta sobre coste para que sean comparables.
  const yieldBruto         = inversionTotal > 0 ? rentaAnualBruta / inversionTotal : null;
  const yieldNetoCoste     = inversionTotal > 0 ? noIAnual / inversionTotal : null;
  const yieldNetoValorActual = valoracion && valoracion > 0 ? noIAnual / valoracion : null;

  // ── Financiación: servicio de deuda y deuda a salida (motor unificado) ──────
  const hAnios = horizonteUsado ?? 10;
  const fin    = calcFinanciacionRenta(a, hAnios);
  // Servicio de deuda: del motor (datos detallados) o, en su defecto, cuota mensual antigua.
  const servDeudaAnual     = fin.servicioDeudaAnual ?? (hipotecaMes * 12);
  const cashOnCash         = equity > 0 ? (noIAnual - servDeudaAnual) / equity : null;
  const dscr               = servDeudaAnual > 0 ? noIAnual / servDeudaAnual : null;
  const cashflowAnual      = noIAnual - servDeudaAnual;
  const paybackAnos        = equity > 0 && cashflowAnual > 0 ? equity / cashflowAnual : null;
  const margenLatente      = valoracion != null ? valoracion - inversionTotal : null;
  // LTV: del motor (base valor/coste) o fallback antiguo (deuda/valoración)
  const ltv                = fin.ltv ?? (deudaHip > 0 && valoracion && valoracion > 0 ? deudaHip / valoracion : null);

  // valorReversion clásico (cap rate): se mantiene para compatibilidad
  const valorReversion     = noIAnual > 0 && capRata && capRata > 0
    ? calcularValorReversion(noIAnual, capRata) : null;

  // Valor residual FUTURO según método elegido + horizonte
  const valorResidualUsado = calcValorResidualRenta(a, noIAnual, hAnios);
  // Valor presente del residual (descontado a hoy a la tasa exigida)
  const valorResidualPresente = valorResidualUsado != null
    ? valorResidualUsado / Math.pow(1 + tasa, hAnios) : null;
  // Revalorización solo aplica al método "valor actual" (y alias crecimiento_anual)
  const usaRevalorizacion   = metodo === 'valor_actual' || metodo === 'crecimiento_anual';
  const revalorizacionResidualPct = usaRevalorizacion ? (a.tasa_crecimiento_anual_pct ?? 0) : null;
  const revalorizacionPorDefecto  = usaRevalorizacion && a.tasa_crecimiento_anual_pct == null;

  // ── Fiscalidad y flujo neto para TIR/VAN ────────────────────────────────────
  const flujo              = calcFlujoAnualRenta(a, fechaInicio, fechaSalida);
  const fiscalidadAplicada = a.aplicar_fiscalidad === true;
  const deudaSalida        = fin.deudaSalida ?? deudaHip;
  // Caja anual para descuento: neta de impuestos si fiscalidad activa, si no antes de impuestos.
  const cajaAnualDescuento = flujo ? (fiscalidadAplicada ? flujo.cajaNetaFinal : flujo.cajaAntesImpuestos) : (noIAnual - servDeudaAnual);
  // Venta neta al corte: valor residual − deuda a salida − (costes venta + plusvalía si fiscalidad)
  const costesVenta        = fiscalidadAplicada && valorResidualUsado != null ? valorResidualUsado * ((a.costes_venta_pct ?? 0) / 100) : 0;
  const baseePlusvalia     = valorResidualUsado != null ? valorResidualUsado - inversionTotal - costesVenta : 0;
  const impuestoPlusvalia  = fiscalidadAplicada ? Math.max(baseePlusvalia, 0) * ((a.impuesto_plusvalia_pct ?? 0) / 100) : 0;
  const ventaNeta          = valorResidualUsado != null ? valorResidualUsado - (deudaSalida ?? 0) - costesVenta - impuestoPlusvalia : null;

  // TIR con residual — requiere equity > 0, horizonte y valor residual
  const tirSinDatos = equity <= 0 || horizonteUsado === null || valorResidualUsado === null;
  const tirConResidual = tirSinDatos || ventaNeta === null ? null
    : irrRentaFlujos(equity, cajaAnualDescuento, ventaNeta, hAnios);

  // VAN — mismo modelo de flujos, descontado a la tasa exigida
  const van = tirSinDatos || ventaNeta === null ? null
    : vanRentaFlujos(equity, cajaAnualDescuento, ventaNeta, hAnios, tasa);
  // VAN solo con las rentas (sin valor residual): mide si la operación crea valor
  // por la renta, al margen del componente patrimonial (plusvalía a la salida).
  const vanSinResidual = equity > 0 && horizonteUsado !== null
    ? vanRentaFlujos(equity, cajaAnualDescuento, 0, hAnios, tasa) : null;
  const diferencialTirTasa = tirConResidual != null ? tirConResidual - tasa : null;

  return {
    inversionTotal, rentaAnualBruta, gastosAnualesTotal, noIAnual,
    yieldBruto, yieldNetoCoste, yieldNetoValorActual,
    cashOnCash, dscr, paybackAnos, margenLatente, ltv,
    valorReversion, tirConResidual,
    van, vanSinResidual, tasaDescuentoUsada: tasa, diferencialTirTasa,
    servicioDeudaAnual: fin.servicioDeudaAnual, deudaSalidaEstimada: deudaSalida, financiacionEstimada: fin.estimado,
    fiscalidadAplicada,
    valorResidualUsado, valorResidualPresente, revalorizacionResidualPct, revalorizacionPorDefecto,
    horizonteUsado, metodoResidualLabel, tirSinDatos,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// KPIs EXPLOTACIÓN
// ─────────────────────────────────────────────────────────────────────────────

export type KpisExplotacion = {
  ingresosAnuales: number | null;
  rentaMensualMedia: number | null;
  ebitdaAnual: number | null;
  margenEbitda: number | null;
  breakEvenIngresos: number | null;
  fcfAnual: number | null;
  paybackOperativo: number | null;
  // Inversión y descuento de flujos
  inversionInicial: number | null;
  impuestosAnual: number | null;          // IS estimado sobre EBITDA (si fiscalidad)
  fiscalidadAplicada: boolean;
  van: number | null;
  tir: number | null;
  tasaDescuentoUsada: number | null;
  horizonteUsado: number | null;
  crecimientoPct: number | null;          // % aplicado al FCF
  // Valor de continuidad / terminal (off por defecto)
  valorTerminalAplicado: boolean;
  valorTerminalFuturo: number | null;
  valorTerminalPresente: number | null;
  metodoTerminalLabel: string | null;
  valorTerminalIncompleto: boolean;       // activado pero faltan datos → no se incluye
};

const METODO_TERMINAL_LABEL: Record<string, string> = {
  manual:         'Valor terminal manual',
  multiplo_ebitda: 'Múltiplo de EBITDA',
};

// VAN/TIR de explotación: −inversión en t0; FCF creciente al g% en años 1..H;
// valor terminal (futuro) sumado al flujo del último año. Sin valor terminal por
// defecto (conservador). El crecimiento se aplica al FCF (simplificación).
function vanTirExplotacion(
  inversion: number, fcf: number, g: number, horizonte: number, tasa: number, valorTerminalFuturo: number,
): { van: number | null; tir: number | null } {
  if (inversion <= 0 || horizonte <= 0) return { van: null, tir: null };

  const flujoAno = (t: number) => fcf * Math.pow(1 + g, t - 1) + (t === horizonte ? valorTerminalFuturo : 0);

  let van = -inversion;
  for (let t = 1; t <= horizonte; t++) van += flujoAno(t) / Math.pow(1 + tasa, t);

  // TIR por bisección; solo si la suma de flujos supera la inversión.
  let tir: number | null = null;
  let sumaFlujos = 0;
  for (let t = 1; t <= horizonte; t++) sumaFlujos += flujoAno(t);
  if (sumaFlujos > inversion) {
    let lo = -0.9, hi = 5.0;
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      let v = -inversion;
      for (let t = 1; t <= horizonte; t++) v += flujoAno(t) / Math.pow(1 + mid, t);
      if (Math.abs(v) < 1e-6) { tir = mid; break; }
      if (v > 0) lo = mid; else hi = mid;
    }
    if (tir === null) tir = (lo + hi) / 2;
  }
  return { van, tir };
}

export function calcKpisExplotacion(a: AnalisisFinanciero): KpisExplotacion {
  const ingresos     = a.ingresos_anuales_previstos ?? 0;
  const costesVarPct = a.costes_variables_pct ?? 0;
  const costosFijos  = a.costes_fijos_anuales ?? 0;
  const capex        = a.capex_mantenimiento_anual ?? 0;
  const inversion    = (a.precio_adquisicion ?? 0) + (a.inversion_circulante ?? 0);
  const tasa         = a.tasa_descuento ?? 0.08;
  const horizonte    = a.horizonte_analisis_anios ?? 10;
  const g            = (a.tasa_crecimiento_anual_pct ?? 0) / 100;
  const fiscalidadAplicada = a.aplicar_fiscalidad === true;
  const isPct        = (a.impuesto_sociedades_pct ?? 25) / 100;

  const NULO: KpisExplotacion = {
    ingresosAnuales: null, rentaMensualMedia: null, ebitdaAnual: null,
    margenEbitda: null, breakEvenIngresos: null, fcfAnual: null, paybackOperativo: null,
    inversionInicial: null, impuestosAnual: null, fiscalidadAplicada: false,
    van: null, tir: null, tasaDescuentoUsada: null, horizonteUsado: null, crecimientoPct: null,
    valorTerminalAplicado: false, valorTerminalFuturo: null, valorTerminalPresente: null,
    metodoTerminalLabel: null, valorTerminalIncompleto: false,
  };
  if (!ingresos && !costosFijos) return NULO;

  const ebitdaAnual       = calcularEBITDA(ingresos, costesVarPct, costosFijos);
  const margenEbitda      = calcularMargenEbitda(ebitdaAnual, ingresos);
  const pctMC             = 100 - costesVarPct;
  const breakEvenIngresos = pctMC > 0 ? calcularBreakEven(costosFijos, pctMC) : null;
  const impuestosAnual    = fiscalidadAplicada ? Math.max(ebitdaAnual, 0) * isPct : 0;
  // FCF = EBITDA − CAPEX mantenimiento − impuestos estimados (si fiscalidad)
  const fcfAnual          = ebitdaAnual - capex - impuestosAnual;
  const paybackOperativo  = inversion > 0 && fcfAnual > 0 ? calcularPaybackOperativo(inversion, fcfAnual) : null;

  // ── Valor de continuidad / terminal (off por defecto) ───────────────────────
  const metodo = a.metodo_valor_terminal ?? 'manual';
  let valorTerminalAplicado = a.aplicar_valor_terminal === true;
  let valorTerminalIncompleto = false;
  let valorTerminalFuturo = 0;
  if (valorTerminalAplicado) {
    if (metodo === 'multiplo_ebitda') {
      const mult = a.multiplo_ebitda_salida ?? 0;
      if (mult > 0) {
        const ebitdaSalida = ebitdaAnual * Math.pow(1 + g, horizonte - 1); // EBITDA del último año
        valorTerminalFuturo = ebitdaSalida * mult;
      } else { valorTerminalIncompleto = true; valorTerminalAplicado = false; }
    } else { // manual
      const vt = a.valor_terminal_manual ?? 0;
      if (vt > 0) valorTerminalFuturo = vt;
      else { valorTerminalIncompleto = true; valorTerminalAplicado = false; }
    }
  }
  const valorTerminalPresente = valorTerminalAplicado
    ? valorTerminalFuturo / Math.pow(1 + tasa, horizonte) : null;

  const { van, tir } = inversion > 0
    ? vanTirExplotacion(inversion, fcfAnual, g, horizonte, tasa, valorTerminalFuturo)
    : { van: null, tir: null };

  return {
    ingresosAnuales: ingresos > 0 ? ingresos : null,
    rentaMensualMedia: ingresos > 0 ? ingresos / 12 : null,
    ebitdaAnual, margenEbitda, breakEvenIngresos, fcfAnual, paybackOperativo,
    inversionInicial: inversion > 0 ? inversion : null,
    impuestosAnual: fiscalidadAplicada ? impuestosAnual : null,
    fiscalidadAplicada,
    van, tir, tasaDescuentoUsada: tasa, horizonteUsado: horizonte, crecimientoPct: a.tasa_crecimiento_anual_pct ?? 0,
    valorTerminalAplicado,
    valorTerminalFuturo: valorTerminalAplicado ? valorTerminalFuturo : null,
    valorTerminalPresente,
    metodoTerminalLabel: valorTerminalAplicado ? (METODO_TERMINAL_LABEL[metodo] ?? metodo) : null,
    valorTerminalIncompleto,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// KPIs PRÉSTAMO / INVERSIÓN FINANCIERA
// ─────────────────────────────────────────────────────────────────────────────

export type KpisPrestamo = {
  cuotaMensual: number | null;
  interesTotales: number | null;          // ingreso financiero esperado (suma de intereses)
  cobroAnual: number | null;              // cuota × 12
  perdidaEsperada: number | null;         // nominal × PD × LGD (null si falta PD o LGD)
  perdidaIncompleta: boolean;             // hay riesgo pero falta PD o LGD
  tirInstrumento: number | null;          // TIR anual (IRR mensual anualizada)
  tirNoConverge: boolean;                 // los flujos no recuperan el capital → TIR no calculable
  van: number | null;                     // VAN base (contractual): −nominal + Σ cuota/(1+tasa/12)^m
  vanAjustado: number | null;             // VAN base − VP(pérdida esperada)
  coberturaGarantia: number | null;       // valor_garantia / nominal
  garantiaSinValor: boolean;              // hay colateral pero sin valor cuantificado
  plazoMeses: number | null;
  tasaDescuentoUsada: number | null;
  sistema: string;
  capitalPendienteActual: number | null;
};

// IRR mensual de una serie -nominal (t0) + cuotas mensuales. Devuelve null si no
// converge (los cobros no superan el capital prestado).
function irrMensualPrestamo(nominal: number, cuotas: number[]): number | null {
  if (nominal <= 0 || cuotas.length === 0) return null;
  const suma = cuotas.reduce((s, c) => s + c, 0);
  if (suma <= nominal) return null; // no recupera el principal → TIR no existe (positiva)
  let lo = -0.99, hi = 1.0;
  const npv = (r: number) => {
    let v = -nominal;
    for (let m = 0; m < cuotas.length; m++) v += cuotas[m]! / Math.pow(1 + r, m + 1);
    return v;
  };
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const v = npv(mid);
    if (Math.abs(v) < 1e-6) return mid;
    if (v > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function calcKpisPrestamo(a: AnalisisFinanciero): KpisPrestamo {
  const nominal    = a.nominal_prestamo ?? 0;
  const tipoInt    = (a.tipo_interes_pct ?? 0) / 100;
  const plazoMeses = a.plazo_meses ?? 0;
  const tasa       = a.tasa_descuento ?? 0.08;
  const sistema    = ((a.sistema_amortizacion ?? 'frances') as 'frances' | 'aleman' | 'bullet');
  const valorGar   = a.valor_garantia ?? null;

  const NULO: KpisPrestamo = {
    cuotaMensual: null, interesTotales: null, cobroAnual: null,
    perdidaEsperada: null, perdidaIncompleta: false,
    tirInstrumento: null, tirNoConverge: false, van: null, vanAjustado: null,
    coberturaGarantia: null, garantiaSinValor: false,
    plazoMeses: null, tasaDescuentoUsada: null, sistema, capitalPendienteActual: null,
  };
  if (!nominal) return NULO;

  const cuadro = plazoMeses > 0 && tipoInt >= 0
    ? calcularCuadroAmortizacion(nominal, tipoInt, plazoMeses, sistema)
    : [];
  const cuotas = cuadro.map(c => c.cuota);

  // ── VAN base (contractual): descuenta los cobros a la tasa exigida ──────────
  const tasaMes = tasa / 12;
  let van: number | null = null;
  if (cuadro.length > 0 && nominal > 0) {
    van = -nominal;
    for (let m = 0; m < cuotas.length; m++) van += cuotas[m]! / Math.pow(1 + tasaMes, m + 1);
  }

  // ── TIR: IRR mensual de los flujos, anualizada ──────────────────────────────
  let tirInstrumento: number | null = null;
  let tirNoConverge = false;
  if (cuadro.length > 0 && nominal > 0) {
    const rMes = irrMensualPrestamo(nominal, cuotas);
    if (rMes != null) tirInstrumento = Math.pow(1 + rMes, 12) - 1;
    else tirNoConverge = true;
  }

  // ── Garantía: cobertura = valor / nominal (no se suma al VAN) ────────────────
  const coberturaGarantia = valorGar != null && valorGar > 0 && nominal > 0 ? valorGar / nominal : null;
  const garantiaSinValor  = !!a.colateral && (valorGar == null || valorGar <= 0);

  // ── Riesgo: pérdida esperada solo si PD y LGD están informados ──────────────
  const tienePD  = a.probabilidad_impago_pct != null;
  const tieneLGD = a.lgd_pct != null;
  const perdidaEsperada = tienePD && tieneLGD
    ? calcularPerdidaEsperada(nominal, (a.probabilidad_impago_pct ?? 0) / 100, (a.lgd_pct ?? 0) / 100)
    : null;
  const perdidaIncompleta = (tienePD || tieneLGD) && !(tienePD && tieneLGD);

  // ── VAN ajustado por riesgo = VAN base − VP(pérdida esperada) ────────────────
  // La pérdida esperada se materializa con el impago; se descuenta al vencimiento.
  let vanAjustado: number | null = null;
  if (van != null && perdidaEsperada != null) {
    const plazoAnos = plazoMeses / 12;
    const vpPerdida = plazoAnos > 0 ? perdidaEsperada / Math.pow(1 + tasa, plazoAnos) : perdidaEsperada;
    vanAjustado = van - vpPerdida;
  }

  return {
    cuotaMensual:   cuadro[0]?.cuota ?? null,
    interesTotales: cuadro.length > 0 ? cuadro.reduce((s, c) => s + c.interes, 0) : null,
    cobroAnual:     cuadro[0]?.cuota != null ? cuadro[0].cuota * 12 : null,
    perdidaEsperada, perdidaIncompleta,
    tirInstrumento, tirNoConverge, van, vanAjustado,
    coberturaGarantia, garantiaSinValor,
    plazoMeses: plazoMeses > 0 ? plazoMeses : null,
    tasaDescuentoUsada: tasa,
    sistema,
    capitalPendienteActual: nominal,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// KPIs CAPEX INTERNO
// ─────────────────────────────────────────────────────────────────────────────

export type KpisCapexInterno = {
  inversionCapex: number | null;
  ahorroBruto: number | null;           // beneficio/ahorro anual esperado (informativo)
  capexMantenimiento: number | null;
  cajaNetaAnual: number | null;         // ahorro bruto − CAPEX mantenimiento (base de VAN/TIR/payback)
  cajaNetaNegativa: boolean;
  paybackCapex: number | null;
  vanCapex: number | null;
  tirCapex: number | null;
  tirNoConverge: boolean;
  depreciacionAnual: number | null;     // dato contable, no afecta a caja
  valorResidual: number | null;
  residualPct: number | null;
  residualPorDefecto: boolean;          // vr% vacío → 0% (supuesto conservador)
  vidaUtilUsada: number | null;
  tasaUsada: number | null;
};

// VAN/TIR de CAPEX: −inversión en t0; caja neta anual durante la vida útil; valor
// residual sumado SOLO al último año. La depreciación NO entra (es contable).
function vanTirCapex(inversion: number, cajaNeta: number, vida: number, tasa: number, valorResidual: number): { van: number | null; tir: number | null; noConverge: boolean } {
  if (inversion <= 0 || vida <= 0) return { van: null, tir: null, noConverge: false };

  const flujo = (t: number) => cajaNeta + (t === vida ? valorResidual : 0);
  let van = -inversion;
  for (let t = 1; t <= vida; t++) van += flujo(t) / Math.pow(1 + tasa, t);

  const sumaFlujos = cajaNeta * vida + valorResidual;
  if (sumaFlujos <= inversion) return { van, tir: null, noConverge: true };

  let lo = -0.9, hi = 5.0, tir: number | null = null;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    let v = -inversion;
    for (let t = 1; t <= vida; t++) v += flujo(t) / Math.pow(1 + mid, t);
    if (Math.abs(v) < 1e-6) { tir = mid; break; }
    if (v > 0) lo = mid; else hi = mid;
  }
  if (tir === null) tir = (lo + hi) / 2;
  return { van, tir, noConverge: false };
}

export function calcKpisCapexInterno(a: AnalisisFinanciero): KpisCapexInterno {
  const inversion      = a.precio_adquisicion ?? 0;
  const ahorroBruto    = a.beneficio_esperado_anual ?? 0;
  const capexMant      = a.capex_mantenimiento_anual ?? 0;
  const vidaUtil       = a.vida_util_activo_anios ?? 0;
  const vrPct          = a.valor_residual_pct ?? 0;
  const tasa           = a.tasa_descuento_interna ?? (a.tasa_descuento ?? 0.08);
  const tipoD          = ((a.depreciacion_tipo ?? 'lineal') as 'lineal' | 'acelerada');

  const NULO: KpisCapexInterno = {
    inversionCapex: null, ahorroBruto: null, capexMantenimiento: null,
    cajaNetaAnual: null, cajaNetaNegativa: false,
    paybackCapex: null, vanCapex: null, tirCapex: null, tirNoConverge: false,
    depreciacionAnual: null, valorResidual: null, residualPct: null, residualPorDefecto: false,
    vidaUtilUsada: null, tasaUsada: null,
  };
  if (!inversion && !ahorroBruto) return NULO;

  // Caja neta anual = ahorro bruto − CAPEX de mantenimiento (base de VAN/TIR/payback).
  const cajaNeta = ahorroBruto - capexMant;
  const valorResidual = inversion > 0 ? calcularValorResidualCapex(inversion, vrPct) : 0;

  const { van, tir, noConverge } = inversion > 0 && vidaUtil > 0
    ? vanTirCapex(inversion, cajaNeta, vidaUtil, tasa, valorResidual)
    : { van: null, tir: null, noConverge: false };

  return {
    inversionCapex: inversion > 0 ? inversion : null,
    ahorroBruto:    ahorroBruto > 0 ? ahorroBruto : null,
    capexMantenimiento: capexMant > 0 ? capexMant : null,
    cajaNetaAnual:  (inversion > 0 || ahorroBruto > 0) ? cajaNeta : null,
    cajaNetaNegativa: (inversion > 0 || ahorroBruto > 0) && cajaNeta <= 0,
    paybackCapex:   inversion > 0 && cajaNeta > 0 ? calcularPaybackCapex(inversion, cajaNeta) : null,
    vanCapex:       van,
    tirCapex:       tir,
    tirNoConverge:  noConverge,
    depreciacionAnual: inversion > 0 && vidaUtil > 0 ? calcularDepreciacionAnual(inversion, vidaUtil, vrPct, tipoD) : null,
    valorResidual:  inversion > 0 ? valorResidual : null,
    residualPct:    inversion > 0 ? vrPct : null,
    residualPorDefecto: inversion > 0 && a.valor_residual_pct == null,
    vidaUtilUsada:  vidaUtil > 0 ? vidaUtil : null,
    tasaUsada:      tasa,
  };
}
