/**
 * Motor financiero operativo del MVP: ingresos, gastos y facturas
 * (criterio de negocio del cockpit 2026-07-05 + docs 02/09/11).
 *
 * Reglas duras:
 * - Cobrado no es devengado; factura emitida no implica cobro; factura
 *   recibida no implica pago.
 * - Sin documento válido, un gasto o liquidación puede estar CALCULADO,
 *   pero NUNCA validado para pago.
 * - Los conceptos sin criterio confirmado viajan como pendiente_confirmacion:
 *   no rompen cálculos, pero marcan el resultado como provisional.
 */

import { redondear } from './devengo';
import type { TipoVenta } from './types';

// ---------------------------------------------------------------------------
// Ingresos
// ---------------------------------------------------------------------------

export type OrigenIngreso = TipoVenta | 'partner';

export interface IngresoOperativo {
  id: string;
  origen: OrigenIngreso;
  concepto: string;
  fecha: string;
  centroId: string;
  canalId: string;
  importeDevengado: number;
  /** Lo efectivamente cobrado (caja). Puede ser 0 (pendiente) o parcial. */
  importeCobrado: number;
  /** Medio de cobro normalizado — separa datafono (banco) de efectivo (caja). */
  metodoPago?: 'tarjeta' | 'efectivo' | 'transferencia' | 'bizum' | 'otro';
  facturaEmitidaId?: string;
  pendienteConfirmacion?: boolean;
}

// ---------------------------------------------------------------------------
// Gastos / costes
// ---------------------------------------------------------------------------

export type CategoriaGasto =
  | 'coste_profesional_variable'
  | 'nominas_laboral'
  | 'gasto_clinica'
  | 'amortizable';

export type TipoGasto =
  // A) coste profesional variable
  | 'coste_por_sesion'
  | 'coste_por_cliente_plan'
  | 'formacion_profesional'
  // B) nóminas y costes laborales
  | 'nomina_fija'
  | 'seguridad_social'
  | 'irpf_retenciones'
  | 'coste_coordinacion'
  | 'coste_compartido'
  // C) gastos de clínica
  | 'alquiler'
  | 'suministros'
  | 'software'
  | 'gestoria'
  | 'material'
  | 'tpv_comisiones'
  | 'marketing'
  | 'mantenimiento'
  | 'gasto_extra'
  // D) amortizables / inversiones
  | 'equipamiento'
  | 'reformas'
  | 'herramientas'
  // provisional: conceptos sin significado confirmado (GEA, AFDH…)
  | 'concepto_provisional';

/** Capa de imputación al margen (doc 09 §4.2). */
export type CapaCoste = 'directo' | 'fijo' | 'compartido' | 'general' | 'amortizable';

export const CATEGORIA_DE: Record<TipoGasto, CategoriaGasto> = {
  coste_por_sesion: 'coste_profesional_variable',
  coste_por_cliente_plan: 'coste_profesional_variable',
  formacion_profesional: 'coste_profesional_variable',
  nomina_fija: 'nominas_laboral',
  seguridad_social: 'nominas_laboral',
  irpf_retenciones: 'nominas_laboral',
  coste_coordinacion: 'nominas_laboral',
  coste_compartido: 'nominas_laboral',
  alquiler: 'gasto_clinica',
  suministros: 'gasto_clinica',
  software: 'gasto_clinica',
  gestoria: 'gasto_clinica',
  material: 'gasto_clinica',
  tpv_comisiones: 'gasto_clinica',
  marketing: 'gasto_clinica',
  mantenimiento: 'gasto_clinica',
  gasto_extra: 'gasto_clinica',
  equipamiento: 'amortizable',
  reformas: 'amortizable',
  herramientas: 'amortizable',
  concepto_provisional: 'gasto_clinica',
};

export type TipoDocumentoGasto = 'nomina' | 'factura_recibida' | 'ticket' | 'no_requerido';

export interface DocumentoAsociado {
  tipo: TipoDocumentoGasto;
  recibido: boolean;
  referencia?: string;
}

export type EstadoValidacion = 'calculado' | 'validado' | 'bloqueado_sin_documento';

export interface GastoOperativo {
  id: string;
  tipo: TipoGasto;
  concepto: string;
  /** Fecha de DEVENGO del gasto (cuando se genera la obligación). */
  fecha: string;
  /** Fecha de PAGO real si difiere del devengo (nóminas de mayo pagadas en junio). */
  fechaPago?: string;
  /** Cuenta de tesorería con la que se paga (columna "Tesorería" del cashflow). */
  cuentaTesoreria?: 'banco' | 'caja';
  importe: number;
  capa: CapaCoste;
  documento: DocumentoAsociado;
  centroId?: string;
  profesionalId?: string;
  /** Concepto sin criterio confirmado (UG/PM, GEA, AFDH, formaciones…). */
  pendienteConfirmacion?: boolean;
  nota?: string;
}

/** Regla dura: sin documento requerido y recibido, el pago no se valida. */
export function puedeValidarsePago(gasto: GastoOperativo): boolean {
  if (gasto.documento.tipo === 'no_requerido') return true;
  return gasto.documento.recibido;
}

/** Estado de validación DERIVADO del documento (nunca un flag manual). */
export function estadoValidacion(gasto: GastoOperativo): EstadoValidacion {
  if (!puedeValidarsePago(gasto)) return 'bloqueado_sin_documento';
  return 'validado';
}

// ---------------------------------------------------------------------------
// Facturas emitidas operativas / recibidas (doc 02 — mundo NO fiscal)
// ---------------------------------------------------------------------------

export type EstadoFacturaEmitida =
  | 'borrador'
  | 'emitida_operativa'
  | 'cobrada'
  | 'pendiente_documento_oficial'
  | 'vinculada_factura_externa';

export interface FacturaEmitidaOperativa {
  id: string;
  serie: string;
  numero: number;
  origenTipo: 'sesion' | 'bono' | 'programa' | 'partner';
  origenId: string;
  contraparte: string;
  fecha: string;
  importe: number;
  estado: EstadoFacturaEmitida;
  refFacturaExterna?: string;
}

export type EstadoFacturaRecibida =
  | 'pendiente_recibir'
  | 'recibida'
  | 'validada'
  | 'pendiente_pago'
  | 'pagada'
  | 'bloqueada';

export interface FacturaRecibida {
  id: string;
  contraparte: string;
  tipo: 'proveedor' | 'autonomo' | 'gasto_clinica';
  fecha: string;
  importe: number;
  estado: EstadoFacturaRecibida;
  /** Gasto o liquidación a la que da soporte documental. */
  gastoId?: string;
  liquidacionRef?: string;
}

/** Una factura emitida solo suma a caja cuando está COBRADA. */
export function importeCobradoDeFacturas(facturas: FacturaEmitidaOperativa[]): number {
  return redondear(
    facturas.filter((f) => f.estado === 'cobrada').reduce((s, f) => s + f.importe, 0),
  );
}

/** Una factura recibida solo es pago ejecutado cuando está PAGADA. */
export function importePagadoDeFacturas(facturas: FacturaRecibida[]): number {
  return redondear(
    facturas.filter((f) => f.estado === 'pagada').reduce((s, f) => s + f.importe, 0),
  );
}

// ---------------------------------------------------------------------------
// Escalera de márgenes M1 → M3 con gastos reales (doc 09 §4)
// ---------------------------------------------------------------------------

export interface EscaleraMargen {
  ingresoDevengado: number;
  costeProfesionalVariable: number;
  m1: number;
  otrosCostesDirectos: number;
  m2: number;
  costesFijos: number;
  m3: number;
  amortizablesFueraDeM3: number;
  /** true si algún componente viene de un concepto pendiente_confirmacion. */
  provisional: boolean;
  gastosBloqueados: number;
}

const CAPAS_DIRECTAS: CapaCoste[] = ['directo'];
const CAPAS_FIJAS: CapaCoste[] = ['fijo', 'compartido', 'general'];

export function escaleraMargen(
  ingresos: IngresoOperativo[],
  gastos: GastoOperativo[],
): EscaleraMargen {
  const ingresoDevengado = redondear(ingresos.reduce((s, i) => s + i.importeDevengado, 0));

  const variable = gastos.filter((g) => CATEGORIA_DE[g.tipo] === 'coste_profesional_variable');
  const costeProfesionalVariable = redondear(variable.reduce((s, g) => s + g.importe, 0));
  const m1 = redondear(ingresoDevengado - costeProfesionalVariable);

  const directosNoProfesional = gastos.filter(
    (g) => CAPAS_DIRECTAS.includes(g.capa) && CATEGORIA_DE[g.tipo] !== 'coste_profesional_variable',
  );
  const otrosCostesDirectos = redondear(directosNoProfesional.reduce((s, g) => s + g.importe, 0));
  const m2 = redondear(m1 - otrosCostesDirectos);

  const fijos = gastos.filter(
    (g) => CAPAS_FIJAS.includes(g.capa) && CATEGORIA_DE[g.tipo] !== 'coste_profesional_variable',
  );
  const costesFijos = redondear(fijos.reduce((s, g) => s + g.importe, 0));
  const m3 = redondear(m2 - costesFijos);

  const amortizablesFueraDeM3 = redondear(
    gastos.filter((g) => g.capa === 'amortizable').reduce((s, g) => s + g.importe, 0),
  );

  return {
    ingresoDevengado,
    costeProfesionalVariable,
    m1,
    otrosCostesDirectos,
    m2,
    costesFijos,
    m3,
    amortizablesFueraDeM3,
    provisional:
      gastos.some((g) => g.pendienteConfirmacion) || ingresos.some((i) => i.pendienteConfirmacion),
    gastosBloqueados: redondear(
      gastos
        .filter((g) => estadoValidacion(g) === 'bloqueado_sin_documento')
        .reduce((s, g) => s + g.importe, 0),
    ),
  };
}

/** Totales de caja vs devengo — SIEMPRE por separado, nunca sumados. */
export function totalesCajaDevengo(ingresos: IngresoOperativo[], gastos: GastoOperativo[]) {
  return {
    devengado: redondear(ingresos.reduce((s, i) => s + i.importeDevengado, 0)),
    cobrado: redondear(ingresos.reduce((s, i) => s + i.importeCobrado, 0)),
    pendienteCobro: redondear(
      ingresos.reduce((s, i) => s + Math.max(0, i.importeDevengado - i.importeCobrado), 0),
    ),
    gastoDevengado: redondear(gastos.reduce((s, g) => s + g.importe, 0)),
  };
}
