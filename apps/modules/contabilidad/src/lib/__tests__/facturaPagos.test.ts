import { describe, it, expect } from 'vitest';
import {
  TOLERANCIA_PAGO_EUR,
  calcularTotalAPagar,
  calcularEstadoPago,
  evaluarIncidenciasDelPago,
} from '../facturaPagos';

// Espejo de la RPC registrar_pago_factura. La referencia es total_a_pagar
// (= total − retención), nunca base_imponible.

describe('calcularTotalAPagar', () => {
  it('resta la retención al total', () => {
    expect(calcularTotalAPagar(1210, 100)).toBe(1110);
  });
  it('trata retención null como 0', () => {
    expect(calcularTotalAPagar(1210, null)).toBe(1210);
    expect(calcularTotalAPagar(1210, undefined)).toBe(1210);
  });
});

describe('calcularEstadoPago', () => {
  it('sin pagos → sin_pagos, pendiente = total', () => {
    const r = calcularEstadoPago(1000, []);
    expect(r.estadoPago).toBe('sin_pagos');
    expect(r.pendiente).toBe(1000);
    expect(r.totalPagado).toBe(0);
  });

  it('pago parcial → pago_parcial con saldo pendiente', () => {
    const r = calcularEstadoPago(1000, [400]);
    expect(r.estadoPago).toBe('pago_parcial');
    expect(r.pendiente).toBe(600);
  });

  it('pago exacto → pagada (sin diferencia, fuera de tolerancia)', () => {
    const r = calcularEstadoPago(1000, [1000]);
    expect(r.estadoPago).toBe('pagada');
    expect(r.pendiente).toBe(0);
    expect(r.dentroTolerancia).toBe(false);
  });

  it('diferencia ≤ tolerancia → pagada dentro de tolerancia', () => {
    const r = calcularEstadoPago(1000, [999.7]);
    expect(r.estadoPago).toBe('pagada');
    expect(r.pendiente).toBeCloseTo(0.3, 2);
    expect(r.dentroTolerancia).toBe(true);
  });

  it('sobrepago → sobrepagada con pendiente negativo', () => {
    const r = calcularEstadoPago(1000, [1200]);
    expect(r.estadoPago).toBe('sobrepagada');
    expect(r.pendiente).toBe(-200);
  });

  it('regularización negativa corrige un sobrepago previo', () => {
    const r = calcularEstadoPago(1000, [1200, -200]);
    expect(r.estadoPago).toBe('pagada');
    expect(r.pendiente).toBe(0);
  });

  it('usa total_a_pagar con retención (no base imponible)', () => {
    const totalAPagar = calcularTotalAPagar(1210, 100); // 1110
    const r = calcularEstadoPago(totalAPagar, [1110]);
    expect(r.estadoPago).toBe('pagada');
    expect(r.pendiente).toBe(0);
  });
});

describe('evaluarIncidenciasDelPago', () => {
  it('un pago parcial NO crea infrapago', () => {
    expect(evaluarIncidenciasDelPago({ tipoPago: 'parcial', pendienteDespues: 600 })).toEqual([]);
  });

  it('un pago marcado como total que no llega → infrapago', () => {
    expect(evaluarIncidenciasDelPago({ tipoPago: 'total', pendienteDespues: 300 })).toEqual(['infrapago']);
  });

  it('un sobrepago crea incidencia de sobrepago', () => {
    expect(evaluarIncidenciasDelPago({ tipoPago: 'total', pendienteDespues: -200 })).toEqual(['sobrepago']);
  });

  it('dentro de tolerancia no crea incidencia', () => {
    expect(evaluarIncidenciasDelPago({ tipoPago: 'total', pendienteDespues: 0.3 })).toEqual([]);
    expect(TOLERANCIA_PAGO_EUR).toBe(0.5);
  });
});
