// Lógica PURA de pagos de factura (sin red): cálculo del estado de pago y
// evaluación de incidencias. Es el espejo de la RPC `registrar_pago_factura` para
// la UI y los tests. La referencia es `total_a_pagar` (= total − retención), NUNCA
// `base_imponible` (eso es `presupuesto_pagos`, un concepto distinto: seguimiento
// presupuestario, no tesorería).

import type { EstadoPago, TipoPago, TipoIncidenciaFactura } from '@alsari/types';

// Tolerancia de cuadre de pagos. Absorbe redondeos de céntimos y pequeñas
// comisiones bancarias: por debajo no genera incidencia ni deja la factura
// "abierta". Constante por ahora; más adelante → `configuracion_contabilidad`.
export const TOLERANCIA_PAGO_EUR = 0.5;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// total_a_pagar = total − retención (retención null/undefined → 0). NO base_imponible.
export function calcularTotalAPagar(total: number, retencionImporte: number | null | undefined): number {
  return round2((total ?? 0) - (retencionImporte ?? 0));
}

export type ResumenPago = {
  totalAPagar: number;
  totalPagado: number;
  pendiente: number;
  pct: number; // 0..1 (puede superar 1 en sobrepago)
  estadoPago: EstadoPago;
  dentroTolerancia: boolean; // pagada con diferencia residual ≤ tolerancia (no exacta)
};

export function calcularEstadoPago(
  totalAPagar: number,
  importes: number[],
  tol: number = TOLERANCIA_PAGO_EUR,
): ResumenPago {
  const totalPagado = round2(importes.reduce((a, b) => a + b, 0));
  const pendiente = round2(totalAPagar - totalPagado);
  const pct = totalAPagar > 0 ? totalPagado / totalAPagar : 0;

  let estadoPago: EstadoPago;
  if (importes.length === 0) estadoPago = 'sin_pagos';
  else if (pendiente > tol) estadoPago = 'pago_parcial';
  else if (pendiente < -tol) estadoPago = 'sobrepagada';
  else estadoPago = 'pagada';

  const dentroTolerancia = estadoPago === 'pagada' && Math.abs(pendiente) > 0;
  return { totalAPagar, totalPagado, pendiente, pct, estadoPago, dentroTolerancia };
}

// Incidencias que la RPC crearía para ESTE pago (espejo de `registrar_pago_factura`):
// - `sobrepago`: el total pagado supera el total por encima de tolerancia.
// - `infrapago`: el pago se marca como `total` pero no alcanza el pendiente.
// Un pago `parcial` NO genera incidencia: es saldo pendiente normal.
export function evaluarIncidenciasDelPago(args: {
  tipoPago: TipoPago;
  pendienteDespues: number;
  tol?: number;
}): TipoIncidenciaFactura[] {
  const tol = args.tol ?? TOLERANCIA_PAGO_EUR;
  const incidencias: TipoIncidenciaFactura[] = [];
  if (args.pendienteDespues < -tol) incidencias.push('sobrepago');
  if (args.tipoPago === 'total' && args.pendienteDespues > tol) incidencias.push('infrapago');
  return incidencias;
}
