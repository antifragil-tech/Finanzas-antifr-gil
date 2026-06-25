// ── exportProyectoFinanciero.ts ────────────────────────────────────────────────
// Capa común para el informe financiero en PDF. NO recalcula nada por su cuenta:
// invoca exactamente las mismas funciones de cálculo, insights y escenarios que
// usan las vistas de pantalla, y produce un modelo `InformeFinanciero` que el
// componente PDF pinta. Así los KPIs del PDF coinciden con la pantalla.

import type { AnalisisFinanciero, TipoAnalisis } from './analisisFinanciero';
import {
  calcKpisRentaExtended, calcFlujoAnualRenta,
  calcKpisCV, calcKpisExplotacion, calcKpisPrestamo, calcKpisCapexInterno, calcKpisAlternativo,
} from './analisisFinanciero';
import { evaluarCalidadRenta, evaluarVeredictoRenta, lecturaExplotarLiquidar } from './rentaInsights';
import { evaluarCalidadCV, evaluarVeredictoCV } from './cvInsights';
import { evaluarCalidadExplotacion, evaluarVeredictoExplotacion } from './explotacionInsights';
import { evaluarCalidadPrestamo, evaluarVeredictoPrestamo } from './prestamoInsights';
import { evaluarCalidadCapex, evaluarVeredictoCapex } from './capexInsights';
import { evaluarCalidadAlternativo, evaluarVeredictoAlternativo } from './alternativoInsights';
import { generarEscenariosDesdeAnalisis } from './escenariosProyectoApi';
import type { ProyectoRow } from './proyectosApi';
import type { CalidadDato, Veredicto } from './insights';

// ── Modelo del informe ────────────────────────────────────────────────────────

export type Fila = { label: string; valor: string };
export type Seccion = { titulo: string; filas: Fila[] };
export type EscenarioCol = { metrica: string; pesimista: string; base: string; optimista: string };
export type CampoCalidadInforme = { label: string; estado: 'completo' | 'estimado' | 'faltante'; critico: boolean };

export type InformeFinanciero = {
  nombreProyecto: string;
  tipoLabel: string;
  sociedad: string | null;
  fechaGeneracion: string;
  veredictoTipo: string;
  veredictoMotivo: string;
  veredictoBullets: string[];
  kpisResumen: Fila[];
  datosIntroducidos: Seccion[];
  kpisCalculados: Fila[];
  escenarios: EscenarioCol[];
  desglose: Seccion[];
  supuestos: Fila[];
  calidadScore: number;
  calidadNivel: string;
  calidadCampos: CampoCalidadInforme[];
  alertas: string[];
  formulas: { nombre: string; formula: string }[];
  // Lectura ejecutiva "Explotar vs liquidar" (solo renta; null en el resto)
  explotarLiquidar: ExplotarLiquidarInforme | null;
};

export type ExplotarLiquidarInforme = {
  nivel: 'explotar' | 'neutral' | 'revisar';
  titulo: string;
  mensaje: string;
  nota: string;
  rentaValor: string; // rentabilidad neta sobre valor actual, formateada
  tasaValor: string;  // tasa exigida, formateada
};

// ── Formato (local; no depende de componentes) ────────────────────────────────

const NI = 'No informado';
const eur  = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const pct  = (n: number) => `${(n * 100).toFixed(1)}%`;
const mult = (n: number) => `${n.toFixed(2)}x`;
const ano  = (n: number) => `${n.toFixed(1)} años`;
const ok = (v: number | null | undefined): v is number => v != null && isFinite(v) && !isNaN(v);
const fmt   = (v: number | null | undefined, f: (n: number) => string) => ok(v) ? f(v) : '—';

const TIPO_LABEL: Record<TipoAnalisis, string> = {
  renta:         'Patrimonial en renta',
  compra_venta:  'Compra / reforma / venta',
  explotacion:   'Negocio operativo',
  prestamo:      'Préstamo / inversión financiera',
  capex_interno: 'CAPEX interno',
  alternativo:   'Alternativo',
};

const RIESGO_L: Record<string, string> = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' };
const LIQ_L: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };
const SIST_L: Record<string, string> = { frances: 'Francés', aleman: 'Alemán', bullet: 'Bullet / interest-only', manual: 'Manual' };

// ── Helpers comunes ───────────────────────────────────────────────────────────

const ALERTAS_BASE = [
  'El informe se basa en los datos introducidos por el usuario.',
  'Los cálculos son estimaciones financieras y no constituyen asesoramiento financiero, fiscal o legal.',
  'El resultado puede variar si cambian los supuestos.',
];

// Construye las columnas de escenarios a partir del generador real (mismo que la pantalla).
function escenarios(a: AnalisisFinanciero, p: ProyectoRow, filas: { label: string; key: string; render: (n: number) => string }[]): EscenarioCol[] {
  const esc = generarEscenariosDesdeAnalisis(a, p.fecha_inicio, p.fecha_prevista_salida);
  const get = (escName: string) => esc.find(e => e.escenario === escName)?.resultado ?? {};
  const cons = get('conservador'), base = get('base'), opt = get('optimista');
  const cell = (r: Record<string, unknown>, key: string, render: (n: number) => string) =>
    typeof r[key] === 'number' && isFinite(r[key] as number) ? render(r[key] as number) : '—';
  return filas.map(f => ({
    metrica: f.label,
    pesimista: cell(cons, f.key, f.render),
    base: cell(base, f.key, f.render),
    optimista: cell(opt, f.key, f.render),
  }));
}

function campos(cal: CalidadDato): CampoCalidadInforme[] {
  return cal.campos.map(c => ({ label: c.label, estado: c.estado, critico: c.critico }));
}

function alertasDesde(cal: CalidadDato, extra: string[] = []): string[] {
  const out: string[] = [];
  if (cal.faltantesCriticos.length > 0) out.push(`Faltan datos críticos: ${cal.faltantesCriticos.join(', ')}.`);
  out.push(...extra.filter(Boolean));
  return [...out, ...ALERTAS_BASE];
}

// ── Builders por tipo ─────────────────────────────────────────────────────────

function buildRenta(a: AnalisisFinanciero, p: ProyectoRow, base: Pick<InformeFinanciero, 'nombreProyecto' | 'tipoLabel' | 'sociedad' | 'fechaGeneracion'>): InformeFinanciero {
  const k = calcKpisRentaExtended(a, p.fecha_inicio, p.fecha_prevista_salida);
  const cal = evaluarCalidadRenta(a);
  const ver: Veredicto = evaluarVeredictoRenta(a, k, cal.score, cal.faltantesCriticos);
  const f = calcFlujoAnualRenta(a, p.fecha_inicio, p.fecha_prevista_salida);
  const tieneDeuda = (a.deuda_hipotecaria ?? 0) > 0;

  return {
    ...base,
    veredictoTipo: ver.tipo, veredictoMotivo: ver.motivo, veredictoBullets: ver.bullets,
    kpisResumen: [
      { label: 'Inversión total', valor: fmt(k.inversionTotal, eur) },
      { label: 'Rentab. neta sobre coste', valor: fmt(k.yieldNetoCoste, pct) },
      { label: 'Rentab. neta sobre valor actual', valor: fmt(k.yieldNetoValorActual, pct) },
      { label: 'TIR con valor residual', valor: fmt(k.tirConResidual, pct) },
      { label: 'Valor actual neto (VAN)', valor: fmt(k.van, eur) },
    ],
    datosIntroducidos: [
      { titulo: 'Inversión', filas: [
        { label: 'Coste histórico / inversión', valor: fmt(a.precio_adquisicion, eur) },
        { label: 'Gastos de adquisición', valor: fmt(a.gastos_adquisicion, eur) },
        { label: 'CAPEX inicial', valor: fmt(a.capex_inicial, eur) },
        { label: 'Valor actual estimado', valor: fmt(a.valoracion_actual, eur) },
      ]},
      { titulo: 'Renta y gastos', filas: [
        { label: 'Renta mensual bruta', valor: fmt(a.renta_mensual_bruta, (n) => eur(n) + '/mes') },
        { label: 'Ocupación', valor: a.tasa_ocupacion_prevista_pct != null ? `${a.tasa_ocupacion_prevista_pct}%` : NI },
        { label: 'Gastos operativos anuales', valor: fmt(a.gastos_operativos_anuales, eur) },
        { label: 'IBI anual', valor: fmt(a.ibi_anual, eur) },
        { label: 'Seguro anual', valor: fmt(a.seguro_anual, eur) },
        { label: 'CAPEX mantenimiento anual', valor: fmt(a.capex_mantenimiento_anual, eur) },
      ]},
      { titulo: 'Financiación', filas: [
        { label: 'Deuda hipotecaria', valor: fmt(a.deuda_hipotecaria, eur) },
        { label: 'Cuota hipoteca mensual', valor: fmt(a.cuota_hipoteca_mensual, (n) => eur(n) + '/mes') },
        { label: 'Tipo de interés de deuda', valor: a.tipo_interes_deuda_pct != null ? `${a.tipo_interes_deuda_pct}%` : NI },
        { label: 'Plazo restante', valor: a.plazo_restante_anios != null ? `${a.plazo_restante_anios} años` : NI },
      ]},
    ],
    kpisCalculados: [
      { label: 'Inversión total', valor: fmt(k.inversionTotal, eur) },
      { label: 'Renta anual bruta', valor: fmt(k.rentaAnualBruta, eur) },
      { label: 'Renta neta operativa (NOI)', valor: fmt(k.noIAnual, eur) },
      { label: 'Rentabilidad bruta sobre coste', valor: fmt(k.yieldBruto, pct) },
      { label: 'Rentabilidad neta sobre coste', valor: fmt(k.yieldNetoCoste, pct) },
      { label: 'Rentabilidad neta sobre valor actual', valor: fmt(k.yieldNetoValorActual, pct) },
      { label: 'Rentabilidad sobre capital aportado', valor: fmt(k.cashOnCash, pct) },
      { label: 'TIR con valor residual', valor: fmt(k.tirConResidual, pct) },
      { label: 'Valor actual neto (VAN)', valor: fmt(k.van, eur) },
      ...(tieneDeuda ? [
        { label: 'Cobertura de deuda (DSCR)', valor: fmt(k.dscr, mult) },
        { label: 'Endeudamiento sobre valor (LTV)', valor: fmt(k.ltv, pct) },
      ] : []),
      { label: 'Recuperación del capital', valor: fmt(k.paybackAnos, ano) },
      { label: 'Plusvalía latente', valor: fmt(k.margenLatente, eur) },
      { label: 'Valor residual estimado', valor: fmt(k.valorResidualUsado, eur) },
    ],
    escenarios: escenarios(a, p, [
      { label: 'Renta anual', key: 'rentaAnualBruta', render: eur },
      { label: 'NOI', key: 'noIAnual', render: eur },
      { label: 'Cash flow', key: 'cashflowAnual', render: eur },
      { label: 'VAN', key: 'van', render: eur },
      { label: 'TIR', key: 'tirConResidual', render: pct },
      { label: 'Valor residual', key: 'valorResidualUsado', render: eur },
    ]),
    desglose: f ? [{ titulo: 'Flujo anual', filas: [
      { label: 'Renta bruta anual', valor: eur(f.rentaBrutaAnual) },
      { label: 'Ajuste por ocupación', valor: eur(f.ajusteOcupacion) },
      { label: 'Renta efectiva', valor: eur(f.rentaEfectiva) },
      { label: 'Gastos operativos', valor: eur(-f.gastosOperativos) },
      { label: 'IBI', valor: eur(-f.ibi) },
      { label: 'Seguro', valor: eur(-f.seguro) },
      { label: 'CAPEX de mantenimiento', valor: eur(-f.capexMantenimiento) },
      { label: 'Renta neta operativa (NOI)', valor: eur(f.noi) },
      { label: 'Servicio de deuda', valor: eur(-f.servicioDeuda) },
      { label: 'Caja antes de impuestos', valor: eur(f.cajaAntesImpuestos) },
      { label: 'Impuestos', valor: f.fiscalidadAplicada ? eur(-f.impuestos) : 'No aplicados' },
      { label: 'Caja neta final', valor: eur(f.cajaNetaFinal) },
    ]}] : [],
    supuestos: [
      { label: 'Tasa de descuento', valor: fmt(k.tasaDescuentoUsada, pct) },
      { label: 'Horizonte de análisis', valor: k.horizonteUsado != null ? `${k.horizonteUsado} años` : NI },
      { label: 'Método de valor residual', valor: k.metodoResidualLabel ?? NI },
      { label: 'Revalorización anual usada', valor: k.revalorizacionResidualPct != null ? `${k.revalorizacionResidualPct}%${k.revalorizacionPorDefecto ? ' (0% por defecto)' : ''}` : '—' },
      { label: 'Fiscalidad', valor: k.fiscalidadAplicada ? 'Aplicada' : 'No aplicada (antes de impuestos)' },
    ],
    calidadScore: cal.score, calidadNivel: cal.nivel, calidadCampos: campos(cal),
    alertas: alertasDesde(cal, [
      a.tasa_ocupacion_prevista_pct == null ? 'Ocupación no informada: se asume 100% de ocupación.' : '',
      a.horizonte_analisis_anios == null ? 'Horizonte no informado: se usan 10 años.' : '',
      k.revalorizacionPorDefecto ? 'Revalorización no informada: se usa 0% (supuesto conservador).' : '',
      !k.fiscalidadAplicada ? 'Fiscalidad no aplicada: análisis antes de impuestos.' : '',
      k.tirSinDatos ? 'Faltan horizonte o valor residual: la TIR y el VAN no son definitivos.' : '',
    ]),
    formulas: [
      { nombre: 'NOI', formula: 'Renta efectiva menos gastos operativos, IBI, seguro y CAPEX de mantenimiento' },
      { nombre: 'Rentabilidad neta sobre coste', formula: 'NOI dividido entre la inversión total' },
      { nombre: 'Rentabilidad neta sobre valor actual', formula: 'NOI dividido entre el valor actual estimado' },
      { nombre: 'VAN', formula: 'VAN = -inversión inicial + suma de cajas descontadas + valor residual descontado' },
      { nombre: 'TIR', formula: 'Tasa que hace el VAN igual a cero (flujos anuales más valor residual)' },
      { nombre: 'DSCR', formula: 'NOI dividido entre el servicio de deuda anual' },
    ],
    explotarLiquidar: (() => {
      const tasa = k.tasaDescuentoUsada ?? 0.08;
      const l = lecturaExplotarLiquidar(k.yieldNetoValorActual, tasa);
      return l.nivel === 'na'
        ? null
        : {
            nivel: l.nivel,
            titulo: l.titulo,
            mensaje: l.mensaje,
            nota: l.nota,
            rentaValor: fmt(k.yieldNetoValorActual, pct),
            tasaValor: pct(tasa),
          };
    })(),
  };
}

function buildCV(a: AnalisisFinanciero, p: ProyectoRow, base: Pick<InformeFinanciero, 'nombreProyecto' | 'tipoLabel' | 'sociedad' | 'fechaGeneracion'>): InformeFinanciero {
  const k = calcKpisCV(a, p.fecha_inicio, p.fecha_prevista_salida, a.superficie_arrendable_m2 ?? null);
  const venta = a.precio_venta_previsto ?? 0;
  const kPes = calcKpisCV({ ...a, precio_venta_previsto: venta * 0.9 }, p.fecha_inicio, p.fecha_prevista_salida, a.superficie_arrendable_m2 ?? null);
  const cal = evaluarCalidadCV(a);
  const ver = evaluarVeredictoCV(a, k, kPes, cal.score, cal.faltantesCriticos);
  const tieneDeuda = (a.deuda_promotora ?? 0) > 0;

  return {
    ...base,
    veredictoTipo: ver.tipo, veredictoMotivo: ver.motivo, veredictoBullets: ver.bullets,
    kpisResumen: [
      { label: 'Coste total del proyecto', valor: fmt(k.inversionTotal, eur) },
      { label: 'Beneficio neto esperado', valor: fmt(k.beneficioNeto, eur) },
      { label: 'TIR neta estimada', valor: fmt(k.tirEquity, pct) },
      { label: 'Valor actual neto (VAN)', valor: fmt(k.van, eur) },
    ],
    datosIntroducidos: [
      { titulo: 'Compra y reforma', filas: [
        { label: 'Precio de adquisición', valor: fmt(a.precio_adquisicion, eur) },
        { label: 'Gastos de adquisición', valor: fmt(a.gastos_adquisicion, eur) },
        { label: 'Presupuesto obra / reforma', valor: fmt(a.presupuesto_obra, eur) },
        { label: 'Contingencia obra', valor: a.contingencia_obra_pct != null ? `${a.contingencia_obra_pct}%` : NI },
        { label: 'IVA soportado obra', valor: fmt(a.iva_soportado_obra, eur) },
      ]},
      { titulo: 'Venta', filas: [
        { label: 'Precio de venta previsto', valor: fmt(a.precio_venta_previsto, eur) },
        { label: 'Gastos de venta', valor: fmt(a.gastos_venta, eur) },
        { label: 'Comisión de agente', valor: a.comision_agente_pct != null ? `${a.comision_agente_pct}%` : NI },
      ]},
      { titulo: 'Financiación y fiscalidad', filas: [
        { label: 'Deuda promotora', valor: fmt(a.deuda_promotora, eur) },
        { label: 'Coste financiero deuda', valor: fmt(a.coste_financiero_deuda, eur) },
        { label: 'Impuesto de sociedades', valor: a.impuesto_sociedades_pct != null ? `${a.impuesto_sociedades_pct}%` : '26% (por defecto)' },
      ]},
    ],
    kpisCalculados: [
      { label: 'Coste total del proyecto', valor: fmt(k.inversionTotal, eur) },
      { label: 'Precio de venta estimado', valor: venta > 0 ? eur(venta) : '—' },
      { label: 'Beneficio antes de impuestos', valor: fmt(k.margenBruto, eur) },
      { label: 'Impuesto de sociedades estimado', valor: fmt(k.impuestoSociedades, eur) },
      { label: 'Beneficio neto esperado', valor: fmt(k.beneficioNeto, eur) },
      { label: 'Margen sobre venta', valor: fmt(k.margenPct, pct) },
      { label: 'MOIC neto', valor: fmt(k.moic, mult) },
      { label: 'TIR neta estimada', valor: fmt(k.tirEquity, pct) },
      { label: 'Valor actual neto (VAN)', valor: fmt(k.van, eur) },
      { label: 'Plazo', valor: fmt(k.anosUsados, ano) },
      ...(tieneDeuda ? [{ label: 'Endeudamiento bancario sobre coste', valor: fmt(k.ltvDeudaBancaria, pct) }] : []),
      ...(k.costeM2 != null ? [{ label: 'Coste por metro cuadrado', valor: eur(k.costeM2) }] : []),
    ],
    escenarios: escenarios(a, p, [
      { label: 'Precio venta', key: 'precioVenta', render: eur },
      { label: 'Coste total', key: 'inversionTotal', render: eur },
      { label: 'Beneficio', key: 'beneficioNeto', render: eur },
      { label: 'Margen', key: 'margenPct', render: pct },
      { label: 'VAN', key: 'van', render: eur },
      { label: 'TIR', key: 'tirEquity', render: pct },
    ]),
    desglose: [{ titulo: 'Resultado de la operación', filas: [
      { label: 'Precio de adquisición', valor: eur(-(a.precio_adquisicion ?? 0)) },
      { label: 'Gastos de adquisición', valor: eur(-(a.gastos_adquisicion ?? 0)) },
      { label: 'Obra / reforma', valor: eur(-(a.presupuesto_obra ?? 0)) },
      { label: 'Contingencia de obra', valor: fmt(k.contingencia, (n) => eur(-n)) },
      { label: 'Coste total del proyecto', valor: fmt(k.inversionTotal, eur) },
      { label: 'Precio de venta previsto', valor: venta > 0 ? eur(venta) : '—' },
      { label: 'Gastos de venta', valor: eur(-(a.gastos_venta ?? 0)) },
      { label: 'Comisión de agente', valor: fmt(k.comisionAgente, (n) => eur(-n)) },
      { label: 'Beneficio antes de impuestos', valor: fmt(k.margenBruto, eur) },
      { label: 'Impuesto de sociedades', valor: fmt(k.impuestoSociedades, (n) => eur(-n)) },
      { label: 'Beneficio neto esperado', valor: fmt(k.beneficioNeto, eur) },
    ]}],
    supuestos: [
      { label: 'Tasa de descuento', valor: pct(a.tasa_descuento ?? 0.08) },
      { label: 'Plazo de la operación', valor: fmt(k.anosUsados, ano) },
      { label: 'Impuesto de sociedades', valor: `${a.impuesto_sociedades_pct ?? 26}%` },
    ],
    calidadScore: cal.score, calidadNivel: cal.nivel, calidadCampos: campos(cal),
    alertas: alertasDesde(cal, [
      venta <= 0 ? 'Falta el precio de venta: el beneficio, la TIR y el VAN no son definitivos.' : '',
      k.anosUsados == null ? 'Falta el plazo de la operación: la TIR y el VAN no son definitivos.' : '',
      k.usaFallbackObra ? 'TIR/VAN calculadas usando el plazo de obra como estimación.' : '',
      k.equityInsuficiente ? 'Capital aportado insuficiente o negativo: revisar estructura de financiación.' : '',
    ]),
    formulas: [
      { nombre: 'Coste total', formula: 'Compra + gastos adq. + obra + contingencia + IVA + financiación + gastos venta + comisión' },
      { nombre: 'Beneficio neto', formula: 'Precio de venta − coste total − impuesto de sociedades' },
      { nombre: 'Equity (año 0)', formula: 'Compra + gastos adq. + obra + contingencia + IVA + financiación − deuda' },
      { nombre: 'VAN', formula: 'Flujo de salida /(1+tasa)^años − equity, con flujo salida = venta − deuda − gastos venta − comisión − IS' },
      { nombre: 'TIR', formula: '(flujo de salida / equity)^(1/años) − 1' },
    ],
    explotarLiquidar: null,
  };
}

function buildExplotacion(a: AnalisisFinanciero, p: ProyectoRow, base: Pick<InformeFinanciero, 'nombreProyecto' | 'tipoLabel' | 'sociedad' | 'fechaGeneracion'>): InformeFinanciero {
  const k = calcKpisExplotacion(a);
  const cal = evaluarCalidadExplotacion(a);
  const ver = evaluarVeredictoExplotacion(a, k, cal.score, cal.faltantesCriticos);
  const cvPct = a.costes_variables_pct ?? 0;
  const costesVar = (a.ingresos_anuales_previstos ?? 0) * (cvPct / 100);

  return {
    ...base,
    veredictoTipo: ver.tipo, veredictoMotivo: ver.motivo, veredictoBullets: ver.bullets,
    kpisResumen: [
      { label: 'EBITDA anual', valor: fmt(k.ebitdaAnual, eur) },
      { label: 'Margen EBITDA', valor: fmt(k.margenEbitda, pct) },
      { label: 'TIR', valor: fmt(k.tir, pct) },
      { label: 'Valor actual neto (VAN)', valor: fmt(k.van, eur) },
    ],
    datosIntroducidos: [
      { titulo: 'Inversión e ingresos', filas: [
        { label: 'Inversión inicial', valor: fmt(a.precio_adquisicion, eur) },
        { label: 'Capital circulante', valor: fmt(a.inversion_circulante, eur) },
        { label: 'Ingresos anuales previstos', valor: fmt(a.ingresos_anuales_previstos, eur) },
      ]},
      { titulo: 'Costes', filas: [
        { label: 'Costes variables', valor: a.costes_variables_pct != null ? `${a.costes_variables_pct}%` : NI },
        { label: 'Costes fijos anuales', valor: fmt(a.costes_fijos_anuales, eur) },
        { label: 'CAPEX mantenimiento anual', valor: fmt(a.capex_mantenimiento_anual, eur) },
      ]},
    ],
    kpisCalculados: [
      { label: 'Inversión inicial', valor: fmt(k.inversionInicial, eur) },
      { label: 'Ingresos anuales previstos', valor: fmt(k.ingresosAnuales, eur) },
      { label: 'EBITDA anual', valor: fmt(k.ebitdaAnual, eur) },
      { label: 'Margen EBITDA', valor: fmt(k.margenEbitda, pct) },
      { label: 'Punto de equilibrio de ingresos', valor: fmt(k.breakEvenIngresos, eur) },
      { label: 'Flujo de caja libre anual (FCF)', valor: fmt(k.fcfAnual, eur) },
      { label: 'Recuperación de la inversión', valor: fmt(k.paybackOperativo, ano) },
      { label: 'Valor actual neto (VAN)', valor: fmt(k.van, eur) },
      { label: 'TIR', valor: fmt(k.tir, pct) },
    ],
    escenarios: escenarios(a, p, [
      { label: 'Ingresos', key: 'ingresosAnuales', render: eur },
      { label: 'EBITDA', key: 'ebitdaAnual', render: eur },
      { label: 'Caja anual', key: 'fcfAnual', render: eur },
      { label: 'Payback', key: 'paybackOperativo', render: ano },
      { label: 'VAN', key: 'van', render: eur },
      { label: 'TIR', key: 'tir', render: pct },
    ]),
    desglose: [{ titulo: 'Operativo anual', filas: [
      { label: 'Ingresos anuales', valor: eur(a.ingresos_anuales_previstos ?? 0) },
      { label: `Costes variables (${cvPct}%)`, valor: eur(-costesVar) },
      { label: 'Costes fijos', valor: eur(-(a.costes_fijos_anuales ?? 0)) },
      { label: 'EBITDA anual', valor: fmt(k.ebitdaAnual, eur) },
      { label: 'CAPEX de mantenimiento', valor: eur(-(a.capex_mantenimiento_anual ?? 0)) },
      { label: 'Impuestos', valor: k.fiscalidadAplicada ? fmt(k.impuestosAnual, (n) => eur(-n)) : 'No aplicados' },
      { label: 'Caja libre anual (FCF)', valor: fmt(k.fcfAnual, eur) },
    ]}],
    supuestos: [
      { label: 'Tasa de descuento', valor: fmt(k.tasaDescuentoUsada, pct) },
      { label: 'Horizonte', valor: k.horizonteUsado != null ? `${k.horizonteUsado} años` : NI },
      { label: 'Crecimiento anual del FCF', valor: k.crecimientoPct != null ? `${k.crecimientoPct}%` : '—' },
      { label: 'Valor de continuidad', valor: k.valorTerminalAplicado ? `${k.metodoTerminalLabel ?? 'Aplicado'} · ${fmt(k.valorTerminalFuturo, eur)}` : 'No aplicado (conservador)' },
      { label: 'Fiscalidad', valor: k.fiscalidadAplicada ? 'Aplicada' : 'No aplicada' },
    ],
    calidadScore: cal.score, calidadNivel: cal.nivel, calidadCampos: campos(cal),
    alertas: alertasDesde(cal, [
      k.valorTerminalIncompleto ? 'El valor de continuidad está activado pero faltan datos: no se incluye en VAN/TIR.' : '',
      !k.valorTerminalAplicado ? 'Sin valor de continuidad: VAN/TIR conservadores (sin valor residual del negocio).' : '',
    ]),
    formulas: [
      { nombre: 'EBITDA', formula: 'Ingresos × (1 − costes variables %) − costes fijos' },
      { nombre: 'FCF', formula: 'EBITDA − CAPEX mantenimiento − impuestos (si aplica)' },
      { nombre: 'VAN', formula: '−inversión + Σ FCF × (1+g)^(t−1)/(1+tasa)^t (+ valor terminal si aplica)' },
      { nombre: 'TIR', formula: 'Tasa que iguala el VAN a cero' },
    ],
    explotarLiquidar: null,
  };
}

function buildPrestamo(a: AnalisisFinanciero, p: ProyectoRow, base: Pick<InformeFinanciero, 'nombreProyecto' | 'tipoLabel' | 'sociedad' | 'fechaGeneracion'>): InformeFinanciero {
  const k = calcKpisPrestamo(a);
  const cal = evaluarCalidadPrestamo(a);
  const ver = evaluarVeredictoPrestamo(a, k, cal.score, cal.faltantesCriticos);

  return {
    ...base,
    veredictoTipo: ver.tipo, veredictoMotivo: ver.motivo, veredictoBullets: ver.bullets,
    kpisResumen: [
      { label: 'Capital prestado', valor: fmt(a.nominal_prestamo, eur) },
      { label: 'TIR del instrumento', valor: k.tirNoConverge ? 'No calculable' : fmt(k.tirInstrumento, pct) },
      { label: 'VAN base', valor: fmt(k.van, eur) },
      { label: 'VAN ajustado por riesgo', valor: fmt(k.vanAjustado, eur) },
    ],
    datosIntroducidos: [
      { titulo: 'Instrumento', filas: [
        { label: 'Tipo de instrumento', valor: a.tipo_instrumento ?? NI },
        { label: 'Capital prestado', valor: fmt(a.nominal_prestamo, eur) },
        { label: 'Tipo de interés anual', valor: a.tipo_interes_pct != null ? `${a.tipo_interes_pct}%` : NI },
        { label: 'Plazo', valor: a.plazo_meses != null ? `${a.plazo_meses} meses` : NI },
        { label: 'Sistema de amortización', valor: SIST_L[a.sistema_amortizacion ?? 'frances'] ?? (a.sistema_amortizacion ?? NI) },
      ]},
      { titulo: 'Garantía y riesgo', filas: [
        { label: 'Colateral / garantía', valor: a.colateral ?? NI },
        { label: 'Valor de garantía', valor: fmt(a.valor_garantia, eur) },
        { label: 'Probabilidad de impago (PD)', valor: a.probabilidad_impago_pct != null ? `${a.probabilidad_impago_pct}%` : NI },
        { label: 'LGD', valor: a.lgd_pct != null ? `${a.lgd_pct}%` : NI },
        { label: 'Rating interno', valor: a.rating_interno ?? NI },
      ]},
    ],
    kpisCalculados: [
      { label: 'Capital prestado', valor: fmt(a.nominal_prestamo, eur) },
      { label: 'Tipo de interés anual', valor: a.tipo_interes_pct != null ? `${a.tipo_interes_pct}%` : '—' },
      { label: 'Ingreso financiero esperado', valor: fmt(k.interesTotales, eur) },
      { label: 'Cuota estimada', valor: fmt(k.cuotaMensual, eur) },
      { label: 'Valor actual neto (VAN base)', valor: fmt(k.van, eur) },
      { label: 'VAN ajustado por riesgo', valor: fmt(k.vanAjustado, eur) },
      { label: 'TIR del instrumento', valor: k.tirNoConverge ? 'No calculable' : fmt(k.tirInstrumento, pct) },
      { label: 'Plazo', valor: k.plazoMeses != null ? `${(k.plazoMeses / 12).toFixed(1)} años` : '—' },
      { label: 'Cobertura de garantía', valor: fmt(k.coberturaGarantia, mult) },
      { label: 'Pérdida esperada', valor: fmt(k.perdidaEsperada, eur) },
      { label: 'Probabilidad de impago', valor: a.probabilidad_impago_pct != null ? `${a.probabilidad_impago_pct}%` : '—' },
    ],
    escenarios: escenarios(a, p, [
      { label: 'Cobro anual', key: 'cobroAnual', render: eur },
      { label: 'Pérdida esperada', key: 'perdidaEsperada', render: eur },
      { label: 'VAN', key: 'van', render: eur },
      { label: 'VAN ajustado', key: 'vanAjustado', render: eur },
      { label: 'TIR', key: 'tirInstrumento', render: pct },
      { label: 'Cobertura gar.', key: 'coberturaGarantia', render: mult },
    ]),
    desglose: [{ titulo: 'Instrumento y riesgo', filas: [
      { label: 'Capital prestado', valor: fmt(a.nominal_prestamo, eur) },
      { label: 'Tipo de interés', valor: a.tipo_interes_pct != null ? `${a.tipo_interes_pct}%` : '—' },
      { label: 'Plazo', valor: k.plazoMeses != null ? `${k.plazoMeses} meses` : '—' },
      { label: 'Sistema de amortización', valor: SIST_L[k.sistema] ?? k.sistema },
      { label: 'Ingreso financiero esperado', valor: fmt(k.interesTotales, eur) },
      { label: 'VAN base', valor: fmt(k.van, eur) },
      { label: 'Pérdida esperada', valor: fmt(k.perdidaEsperada, eur) },
      { label: 'VAN ajustado por riesgo', valor: fmt(k.vanAjustado, eur) },
      { label: 'Cobertura de garantía', valor: fmt(k.coberturaGarantia, mult) },
    ]}],
    supuestos: [
      { label: 'Tasa de descuento', valor: fmt(k.tasaDescuentoUsada, pct) },
      { label: 'Sistema de amortización', valor: SIST_L[k.sistema] ?? k.sistema },
    ],
    calidadScore: cal.score, calidadNivel: cal.nivel, calidadCampos: campos(cal),
    alertas: alertasDesde(cal, [
      k.tirNoConverge ? 'Los cobros no recuperan el capital: la TIR no es calculable.' : '',
      k.perdidaIncompleta ? 'Falta PD o LGD: la pérdida esperada y el VAN ajustado no son definitivos.' : '',
      k.garantiaSinValor ? 'Garantía sin valor cuantificado: no se calcula cobertura.' : '',
    ]),
    formulas: [
      { nombre: 'VAN base', formula: '−capital + Σ cuota /(1+tasa/12)^m' },
      { nombre: 'TIR', formula: 'IRR mensual de los flujos, anualizada: (1+r)^12 − 1' },
      { nombre: 'Pérdida esperada', formula: 'Capital × PD × LGD' },
      { nombre: 'VAN ajustado', formula: 'VAN base − valor presente de la pérdida esperada' },
      { nombre: 'Cobertura de garantía', formula: 'Valor de garantía / capital prestado' },
    ],
    explotarLiquidar: null,
  };
}

function buildCapex(a: AnalisisFinanciero, p: ProyectoRow, base: Pick<InformeFinanciero, 'nombreProyecto' | 'tipoLabel' | 'sociedad' | 'fechaGeneracion'>): InformeFinanciero {
  const k = calcKpisCapexInterno(a);
  const cal = evaluarCalidadCapex(a);
  const ver = evaluarVeredictoCapex(a, k, cal.score, cal.faltantesCriticos);

  return {
    ...base,
    veredictoTipo: ver.tipo, veredictoMotivo: ver.motivo, veredictoBullets: ver.bullets,
    kpisResumen: [
      { label: 'Inversión CAPEX', valor: fmt(k.inversionCapex, eur) },
      { label: 'Impacto en caja anual', valor: fmt(k.cajaNetaAnual, eur) },
      { label: 'TIR del CAPEX', valor: k.tirNoConverge ? 'No calculable' : fmt(k.tirCapex, pct) },
      { label: 'Valor actual neto (VAN)', valor: fmt(k.vanCapex, eur) },
    ],
    datosIntroducidos: [
      { titulo: 'Inversión y ahorro', filas: [
        { label: 'Inversión CAPEX', valor: fmt(a.precio_adquisicion, eur) },
        { label: 'Beneficio / ahorro anual esperado', valor: fmt(a.beneficio_esperado_anual, eur) },
        { label: 'CAPEX mantenimiento anual', valor: fmt(a.capex_mantenimiento_anual, eur) },
      ]},
      { titulo: 'Vida útil y residual', filas: [
        { label: 'Vida útil', valor: a.vida_util_activo_anios != null ? `${a.vida_util_activo_anios} años` : NI },
        { label: 'Valor residual', valor: a.valor_residual_pct != null ? `${a.valor_residual_pct}%` : '0% (por defecto)' },
        { label: 'Método de depreciación', valor: a.depreciacion_tipo ?? 'lineal' },
      ]},
    ],
    kpisCalculados: [
      { label: 'Inversión CAPEX', valor: fmt(k.inversionCapex, eur) },
      { label: 'Beneficio o ahorro anual esperado', valor: fmt(k.ahorroBruto, eur) },
      { label: 'Impacto en caja anual', valor: fmt(k.cajaNetaAnual, eur) },
      { label: 'Recuperación del CAPEX', valor: fmt(k.paybackCapex, ano) },
      { label: 'Valor actual neto del CAPEX (VAN)', valor: fmt(k.vanCapex, eur) },
      { label: 'TIR del CAPEX', valor: k.tirNoConverge ? 'No calculable' : fmt(k.tirCapex, pct) },
      { label: 'Vida útil', valor: k.vidaUtilUsada != null ? `${k.vidaUtilUsada} años` : '—' },
      { label: 'Valor residual del activo', valor: fmt(k.valorResidual, eur) },
      { label: 'Depreciación anual', valor: fmt(k.depreciacionAnual, eur) },
    ],
    escenarios: escenarios(a, p, [
      { label: 'Ahorro anual', key: 'ahorroBruto', render: eur },
      { label: 'Caja neta anual', key: 'cajaNetaAnual', render: eur },
      { label: 'Payback', key: 'paybackCapex', render: ano },
      { label: 'VAN', key: 'vanCapex', render: eur },
      { label: 'TIR', key: 'tirCapex', render: pct },
    ]),
    desglose: [{ titulo: 'CAPEX y caja', filas: [
      { label: 'Inversión CAPEX (año 0)', valor: fmt(k.inversionCapex, (n) => eur(-n)) },
      { label: 'Ahorro / beneficio anual bruto', valor: fmt(k.ahorroBruto, eur) },
      { label: 'CAPEX de mantenimiento', valor: fmt(k.capexMantenimiento, (n) => eur(-n)) },
      { label: 'Caja neta anual', valor: fmt(k.cajaNetaAnual, eur) },
      { label: 'Vida útil', valor: k.vidaUtilUsada != null ? `${k.vidaUtilUsada} años` : '—' },
      { label: 'Valor residual', valor: fmt(k.valorResidual, eur) },
    ]}],
    supuestos: [
      { label: 'Tasa de descuento', valor: fmt(k.tasaUsada, pct) },
      { label: 'Vida útil', valor: k.vidaUtilUsada != null ? `${k.vidaUtilUsada} años` : NI },
      { label: 'Valor residual %', valor: k.residualPct != null ? `${k.residualPct}%${k.residualPorDefecto ? ' (0% por defecto)' : ''}` : '—' },
    ],
    calidadScore: cal.score, calidadNivel: cal.nivel, calidadCampos: campos(cal),
    alertas: alertasDesde(cal, [
      k.cajaNetaNegativa ? 'La caja neta anual es ≤ 0: el mantenimiento se come el ahorro; payback no definitivo.' : '',
      k.tirNoConverge ? 'Los flujos no recuperan la inversión: la TIR no es calculable.' : '',
    ]),
    formulas: [
      { nombre: 'Caja neta anual', formula: 'Ahorro/beneficio bruto − CAPEX de mantenimiento' },
      { nombre: 'Recuperación del CAPEX', formula: 'Inversión / caja neta anual' },
      { nombre: 'VAN', formula: '−inversión + Σ caja neta /(1+tasa)^t + valor residual /(1+tasa)^vida' },
      { nombre: 'TIR', formula: 'Tasa que iguala el VAN a cero' },
    ],
    explotarLiquidar: null,
  };
}

function buildAlternativo(a: AnalisisFinanciero, p: ProyectoRow, base: Pick<InformeFinanciero, 'nombreProyecto' | 'tipoLabel' | 'sociedad' | 'fechaGeneracion'>): InformeFinanciero {
  const k = calcKpisAlternativo(a, p.fecha_inicio, p.fecha_prevista_salida);
  const cal = evaluarCalidadAlternativo(a, k.anosUsados != null);
  const ver = evaluarVeredictoAlternativo(a, k, cal.score, cal.faltantesCriticos);

  return {
    ...base,
    veredictoTipo: ver.tipo, veredictoMotivo: ver.motivo, veredictoBullets: ver.bullets,
    kpisResumen: [
      { label: 'Capital requerido', valor: fmt(k.capitalRequerido, eur) },
      { label: 'Retorno esperado total', valor: fmt(k.retornoTotal, eur) },
      { label: 'Múltiplo sobre capital (MOIC)', valor: fmt(k.moic, mult) },
      { label: 'Valor actual neto (VAN)', valor: fmt(k.van, eur) },
    ],
    datosIntroducidos: [
      { titulo: 'Operación', filas: [
        { label: 'Capital requerido', valor: fmt(a.precio_adquisicion, eur) },
        { label: 'Retorno esperado total', valor: fmt(a.retorno_previsto_total, eur) },
        { label: 'Valoración actual', valor: fmt(a.valoracion_actual, eur) },
        { label: 'Descripción', valor: a.descripcion_operacion ?? NI },
      ]},
      { titulo: 'Riesgo y liquidez', filas: [
        { label: 'Nivel de riesgo', valor: a.nivel_riesgo ? (RIESGO_L[a.nivel_riesgo] ?? a.nivel_riesgo) : NI },
        { label: 'Nivel de liquidez', valor: a.nivel_liquidez ? (LIQ_L[a.nivel_liquidez] ?? a.nivel_liquidez) : NI },
      ]},
    ],
    kpisCalculados: [
      { label: 'Capital requerido', valor: fmt(k.capitalRequerido, eur) },
      { label: 'Retorno esperado total', valor: fmt(k.retornoTotal, eur) },
      { label: 'Beneficio esperado', valor: fmt(k.beneficioEsperado, eur) },
      { label: 'Rentabilidad estimada (TIR)', valor: fmt(k.tirEquity, pct) },
      { label: 'Múltiplo sobre capital (MOIC)', valor: fmt(k.moic, mult) },
      { label: 'Valor actual neto (VAN)', valor: fmt(k.van, eur) },
      { label: 'Plazo hasta el retorno', valor: fmt(k.anosUsados, ano) },
      { label: 'Plusvalía latente', valor: fmt(k.margenLatente, eur) },
      { label: 'Nivel de riesgo', valor: a.nivel_riesgo ? (RIESGO_L[a.nivel_riesgo] ?? a.nivel_riesgo) : '—' },
      { label: 'Nivel de liquidez', valor: a.nivel_liquidez ? (LIQ_L[a.nivel_liquidez] ?? a.nivel_liquidez) : '—' },
    ],
    escenarios: escenarios(a, p, [
      { label: 'Retorno esperado', key: 'retornoTotal', render: eur },
      { label: 'Beneficio', key: 'beneficioEsperado', render: eur },
      { label: 'MOIC', key: 'moic', render: mult },
      { label: 'VAN', key: 'van', render: eur },
      { label: 'TIR', key: 'tirEquity', render: pct },
    ]),
    desglose: [{ titulo: 'Operación', filas: [
      { label: 'Capital requerido', valor: fmt(k.capitalRequerido, eur) },
      { label: 'Retorno esperado total', valor: fmt(k.retornoTotal, eur) },
      { label: 'Beneficio esperado', valor: fmt(k.beneficioEsperado, eur) },
      { label: 'Valoración actual', valor: fmt(a.valoracion_actual, eur) },
      { label: 'Plusvalía latente', valor: fmt(k.margenLatente, eur) },
    ]}],
    supuestos: [
      { label: 'Tasa de descuento', valor: fmt(k.tasaUsada, pct) },
      { label: 'Plazo hasta el retorno', valor: fmt(k.anosUsados, ano) },
    ],
    calidadScore: cal.score, calidadNivel: cal.nivel, calidadCampos: campos(cal),
    alertas: alertasDesde(cal, [
      k.beneficioEsperado != null && k.beneficioEsperado <= 0 ? 'El retorno esperado no supera el capital invertido.' : '',
      a.valoracion_actual == null ? 'Sin valoración actual: no se calcula la plusvalía latente.' : '',
      'La plusvalía latente es una referencia de mercado hoy y no se suma al VAN.',
    ]),
    formulas: [
      { nombre: 'MOIC', formula: 'Retorno esperado total / capital requerido' },
      { nombre: 'Beneficio esperado', formula: 'Retorno esperado total − capital requerido' },
      { nombre: 'VAN', formula: 'Retorno /(1+tasa)^años − capital' },
      { nombre: 'TIR', formula: '(retorno / capital)^(1/años) − 1' },
    ],
    explotarLiquidar: null,
  };
}

// ── Punto de entrada ──────────────────────────────────────────────────────────

export function construirInforme(a: AnalisisFinanciero, proyecto: ProyectoRow): InformeFinanciero {
  const portada = {
    nombreProyecto: proyecto.nombre,
    tipoLabel: TIPO_LABEL[a.tipo_analisis] ?? a.tipo_analisis,
    sociedad: proyecto.sociedad_tenedora,
    fechaGeneracion: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
  };
  switch (a.tipo_analisis) {
    case 'renta':         return buildRenta(a, proyecto, portada);
    case 'compra_venta':  return buildCV(a, proyecto, portada);
    case 'explotacion':   return buildExplotacion(a, proyecto, portada);
    case 'prestamo':      return buildPrestamo(a, proyecto, portada);
    case 'capex_interno': return buildCapex(a, proyecto, portada);
    case 'alternativo':   return buildAlternativo(a, proyecto, portada);
    default:              return buildRenta(a, proyecto, portada);
  }
}

// Nombre de archivo: informe-financiero-{slug}-{YYYY-MM-DD}.pdf
export function nombreArchivoInforme(proyecto: ProyectoRow): string {
  const slug = (proyecto.nombre || 'proyecto')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'proyecto';
  const hoy = new Date().toISOString().slice(0, 10);
  return `informe-financiero-${slug}-${hoy}.pdf`;
}
