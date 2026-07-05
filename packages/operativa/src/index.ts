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
