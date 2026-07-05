// Dominio operativo de Antifrágil OS — lógica pura + mocks, sin backend.
// Fuente: docs/finanzas/08-11. Capa de gestión, NO fiscal (D-op-6).

export * from './types';
export {
  redondear,
  devengoUnitario,
  efectoSesion,
  resumenVenta,
  cumpleInvarianteV1,
  caducarVenta,
  devolverUnidades,
} from './devengo';
export { generarLiquidacion, aplicarAjuste, puedeAvanzar } from './liquidaciones';
export type { ContextoLiquidacion } from './liquidaciones';
export { margenSesion, agregarMargen, margenOperativoM3, resultadoOperativoM4 } from './margen';
export type { DimensionMargen } from './margen';
export { diasVencido, tramoAging, estaVencida, importePendiente, cxpDeLiquidaciones } from './cxcp';
export { PROFESIONALES, getProfesional, costePorSesion } from './mocks/profesionales';
export { PRODUCTOS, CENTROS, CANALES } from './mocks/catalogo';
export {
  MES_DEMO,
  sesionesDemo,
  hechosDemo,
  VENTAS_DEMO,
  EVENTOS_DEMO,
  resumenesVentasDemo,
  liquidacionesDemo,
  totalesDemo,
} from './mocks/escenario';
export * from './finanzas';
export {
  ingresosDemo,
  gastosDemo,
  gastosProfesionalesDemo,
  GASTOS_DEMO,
  facturasEmitidasDemo,
  facturasRecibidasDemo,
  CONCEPTOS_PENDIENTES,
} from './mocks/finanzasDemo';
export * from './importacion';
