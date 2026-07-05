/**
 * Tipos del dominio operativo de Antifrágil OS (capa de gestión, NO fiscal).
 *
 * Fuente de verdad: docs/finanzas/08 (liquidaciones), 09 (rentabilidad),
 * 10 (bonos y devengo), 11 (CxC/CxP). Los nombres de estados son los
 * literales de los docs. Todo importe es en euros (number); los saldos,
 * pendientes y márgenes son SIEMPRE derivados, nunca almacenados (doc 10 §3,
 * doc 09 §6.2, doc 11 §3). Cliente = id/seudónimo administrativo; cero datos
 * clínicos (D-op-5).
 */

// ---------------------------------------------------------------------------
// Profesionales y liquidaciones (doc 08)
// ---------------------------------------------------------------------------

export type RolProfesional =
  | 'recepcion'
  | 'fisioterapeuta'
  | 'nutricionista'
  | 'entrenador'
  | 'coordinacion';

/** Doc 08 §3.2 — naturaleza de la relación con Antifrágil. */
export type TipoRelacion =
  | 'nomina'
  | 'nomina_compartida'
  | 'autonomo'
  | 'colaborador'
  | 'pendiente_regularizar';

/** Doc 08 §4 — catálogo de reglas de liquidación (bonus_descuento reservado, fuera de B1). */
export type TipoRegla =
  | 'nomina_fija'
  | 'nomina_compartida'
  | 'por_sesion'
  | 'mensual_por_plan'
  | 'pendiente_regularizar'
  | 'ajuste_manual';

export type UnidadRegla = 'eur_mes' | 'eur_sesion' | 'eur_mes_cliente';

export interface ReglaLiquidacion {
  tipo: TipoRegla;
  importe: number;
  unidad: UnidadRegla;
  /** false = pendiente de confirmar (p. ej. plan de Marta, doc 08 §4.4): bloquea avance sin CEO. */
  confirmada: boolean;
}

export interface Profesional {
  id: string;
  nombre: string;
  rol: RolProfesional;
  relacion: TipoRelacion;
  reglas: ReglaLiquidacion[];
  /** Solo nomina_compartida (doc 08 §4.2): quién paga el resto. */
  terceroCopagador?: string;
  notas?: string;
}

/** Doc 08 §3.4 — ciclo de la sesión de cara a liquidación. */
export type EstadoSesionLiquidable = 'realizada' | 'validada' | 'liquidada';

export interface SesionLiquidable {
  id: string;
  /** Fecha ISO (YYYY-MM-DD). El coste se devenga en la fecha de la sesión. */
  fecha: string;
  profesionalId: string;
  servicio: string;
  /** Seudónimo/id administrativo, nunca identidad clínica. */
  clienteId: string;
  estado: EstadoSesionLiquidable;
}

/** Doc 08 §5 — ciclo de la liquidación mensual. */
export type EstadoLiquidacion =
  | 'pendiente_calculo'
  | 'calculada'
  | 'pendiente_documento'
  | 'validada'
  | 'pendiente_pago'
  | 'pagada'
  | 'revisada'
  | 'bloqueada_por_incidencia';

export interface AjusteManual {
  importe: number;
  motivo: string;
  autor: string;
  fecha: string;
}

export interface LineaLiquidacion {
  regla: TipoRegla;
  detalle: string;
  cantidad: number;
  importe: number;
}

export interface LiquidacionMensual {
  profesionalId: string;
  /** Mes YYYY-MM (clave persona × mes, doc 08 §3.7). */
  mes: string;
  lineas: LineaLiquidacion[];
  importeCalculado: number;
  ajustes: AjusteManual[];
  importeFinal: number;
  estado: EstadoLiquidacion;
  /** Presente solo si estado = bloqueada_por_incidencia (p. ej. relacion_sin_regularizar). */
  motivoBloqueo?: string;
  /** true si alguna regla aplicada no está confirmada: no avanza sin CEO (doc 08 §4.4). */
  requiereRevisionCeo: boolean;
  /** Ids de sesiones incluidas — una sesión pertenece a UNA liquidación (R3). */
  sesionesIncluidas: string[];
}

export interface PagoLiquidacion {
  fecha: string;
  importe: number;
  medio: 'transferencia' | 'efectivo' | 'bizum';
  cuentaTesoreria: 'banco' | 'caja';
}

// ---------------------------------------------------------------------------
// Bonos, programas y devengo (doc 10)
// ---------------------------------------------------------------------------

export type TipoProducto = 'bono_sesiones' | 'programa_mensual' | 'sesion_suelta';

export interface ProductoCatalogo {
  id: string;
  nombre: string;
  tipo: TipoProducto;
  unidades: number;
  precioCatalogo: number;
  servicio: string;
  caducidadMeses?: number;
}

/** Doc 10 §4 — ciclo de la venta de bono/programa. */
export type EstadoVentaBono =
  | 'borrador'
  | 'vendido'
  | 'activo'
  | 'parcialmente_consumido'
  | 'consumido'
  | 'caducado'
  | 'devuelto_parcial'
  | 'devuelto_total'
  | 'cancelado'
  | 'bloqueado_por_incidencia';

export interface VentaBono {
  id: string;
  clienteId: string;
  productoId: string;
  fechaVenta: string;
  /** Importe realmente cobrado (con descuento si lo hubo) — base del devengo (doc 10 §6.2). */
  importeCobrado: number;
  unidades: number;
  vencimiento?: string;
  estado: EstadoVentaBono;
}

/** Doc 10 §5 — tipos de sesión dentro de un bono y su efecto económico. */
export type TipoSesionBono =
  | 'reservada'
  | 'consumida'
  | 'no_show_cobrado'
  | 'no_show_no_cobrado'
  | 'cancelada_a_tiempo'
  | 'cortesia'
  | 'pendiente_regularizar';

export interface EventoSesionBono {
  ventaId: string;
  sesionId: string;
  fecha: string;
  profesionalId: string;
  tipo: TipoSesionBono;
}

export interface Devolucion {
  ventaId: string;
  unidades: number;
  importe: number;
  fecha: string;
  motivo: string;
}

export interface Caducidad {
  ventaId: string;
  unidadesCaducadas: number;
  importe: number;
  fecha: string;
  /** B3-P1: el tratamiento fiscal del remanente NO se inventa — queda pendiente de gestoría. */
  pendienteCriterioFiscal: true;
}

/** Efecto económico de un tipo de sesión (tabla doc 10 §5). */
export interface EfectoSesion {
  consumeUnidad: boolean;
  devengaIngreso: boolean;
  generaCosteProfesional: boolean;
}

/**
 * Resumen DERIVADO de una venta. Invariante V1 (doc 10 §4):
 * devengado + pendienteDeDevengar + devuelto + tratadoPorCaducidad = importeCobrado.
 */
export interface ResumenVentaBono {
  ventaId: string;
  importeCobrado: number;
  devengoUnitario: number;
  unidadesConsumidas: number;
  saldoUnidades: number;
  devengado: number;
  devuelto: number;
  tratadoPorCaducidad: number;
  pendienteDeDevengar: number;
  cuadra: boolean;
}

export interface DevengoRegistrado {
  ventaId: string;
  sesionId: string;
  importe: number;
  fechaDevengo: string;
  /** Separa devengo por prestación del reconocimiento por caducidad (doc 10 §6.6). */
  origen: 'prestacion' | 'ingreso_por_caducidad';
}

// ---------------------------------------------------------------------------
// Rentabilidad y márgenes (doc 09)
// ---------------------------------------------------------------------------

export type VistaMargen = 'devengo' | 'caja';

export type TipoVenta = 'suelta' | 'bono' | 'programa' | 'plan';

export type TipoAcuerdoCentro =
  | 'propio'
  | 'cesion'
  | 'porcentaje'
  | 'renta'
  | 'pendiente_confirmar';

export interface Centro {
  id: string;
  nombre: string;
  proyecto: string;
  tipoAcuerdo: TipoAcuerdoCentro;
}

export type TipoCanal = 'organico' | 'referido' | 'pagado' | 'partner_b2b' | 'walk_in';

export interface Canal {
  id: string;
  nombre: string;
  tipo: TipoCanal;
  activo: boolean;
}

/** Hecho económico por sesión: la unidad mínima de análisis de margen (doc 09 §5.1). */
export interface HechoSesion {
  sesionId: string;
  fecha: string;
  profesionalId: string;
  servicio: string;
  clienteId: string;
  centroId: string;
  canalId: string;
  tipoVenta: TipoVenta;
  ingresoDevengado: number;
  costeProfesional: number;
  otrosCostesDirectos: number;
  /** Etiquetas de trazabilidad (cortesía, no-show…), nunca alteran los importes. */
  etiqueta?: string;
}

export interface MargenSesion {
  sesionId: string;
  /** M1 = ingreso devengado − coste profesional (doc 09 §4). */
  m1: number;
  /** M2 = M1 − otros costes directos imputables. */
  m2: number;
}

export interface MargenAgregado {
  clave: string;
  sesiones: number;
  ingresoDevengado: number;
  costeProfesional: number;
  otrosCostesDirectos: number;
  m1: number;
  m2: number;
}

export interface MargenOperativoM3 {
  clave: string;
  sumaM2: number;
  costesFijosImputados: number;
  m3: number;
  /** true si el acuerdo del centro está pendiente_confirmar: el M3 no es fiable (B2-P3). */
  incompleto: boolean;
}

// ---------------------------------------------------------------------------
// CxC / CxP (doc 11)
// ---------------------------------------------------------------------------

export type EstadoCxC =
  | 'pendiente'
  | 'reclamado'
  | 'parcialmente_cobrado'
  | 'cobrado'
  | 'incobrable'
  | 'disputado'
  | 'cancelado'
  | 'bloqueado_por_incidencia';

export type EstadoCxP =
  | 'pendiente'
  | 'programado'
  | 'parcialmente_pagado'
  | 'pagado'
  | 'disputado'
  | 'cancelado'
  | 'bloqueado_por_incidencia';

export type OrigenCompromiso = 'sesion' | 'bono' | 'factura' | 'liquidacion' | 'partner' | 'legacy';

export interface CuentaPorCobrar {
  id: string;
  contraparte: string;
  origen: OrigenCompromiso;
  origenId: string;
  importe: number;
  cobradoParcial: number;
  vencimiento?: string;
  estado: EstadoCxC;
}

export interface CuentaPorPagar {
  id: string;
  contraparte: string;
  origen: OrigenCompromiso;
  origenId: string;
  importe: number;
  pagadoParcial: number;
  vencimiento?: string;
  estado: EstadoCxP;
}

/** Doc 11 §9 — tramos exactos de antigüedad. */
export type TramoAging = '0-30' | '31-60' | '61-90' | '+90';
