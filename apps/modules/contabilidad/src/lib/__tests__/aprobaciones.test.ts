import { describe, it, expect } from 'vitest';
import { calcularEstadoNuevo, accionDeAvance } from '../aprobaciones';

// Regresión de la máquina de estados de aprobación de facturas (espejo de la RPC
// avanzar_estado_factura_con_auditoria). Protege las transiciones del workflow.

describe('calcularEstadoNuevo', () => {
  it('Guille valida factura <= 1.000 € → pendiente_pago', () => {
    expect(calcularEstadoNuevo('borrador_ocr', 'valida', 800, 1000)).toBe('pendiente_pago');
  });

  it('Guille valida factura > 1.000 € → revision_javi', () => {
    expect(calcularEstadoNuevo('borrador_ocr', 'valida', 1500, 1000)).toBe('revision_javi');
  });

  it('importe exactamente en el umbral (1.000 €) → pendiente_pago (no supera)', () => {
    expect(calcularEstadoNuevo('borrador_ocr', 'valida', 1000, 1000)).toBe('pendiente_pago');
  });

  it('Javi aprueba → pendiente_pago', () => {
    expect(calcularEstadoNuevo('revision_javi', 'aprueba', 1500, 1000)).toBe('pendiente_pago');
  });

  it('Alicia marca pagada → pagada', () => {
    expect(calcularEstadoNuevo('pendiente_pago', 'marca_pagada', 1500, 1000)).toBe('pagada');
  });

  it('rechazo desde el estado actual → rechazada', () => {
    expect(calcularEstadoNuevo('revision_javi', 'rechaza', 1500, 1000)).toBe('rechazada');
    expect(calcularEstadoNuevo('borrador_ocr', 'rechaza', 500, 1000)).toBe('rechazada');
  });

  it('transiciones inválidas lanzan', () => {
    expect(() => calcularEstadoNuevo('pagada', 'valida', 800, 1000)).toThrow();
    expect(() => calcularEstadoNuevo('borrador_ocr', 'aprueba', 800, 1000)).toThrow();
    expect(() => calcularEstadoNuevo('borrador_ocr', 'marca_pagada', 800, 1000)).toThrow();
    expect(() => calcularEstadoNuevo('pagada', 'rechaza', 800, 1000)).toThrow();
  });
});

describe('accionDeAvance', () => {
  it('desde borrador_ocr es "valida" (Guille)', () => {
    expect(accionDeAvance('borrador_ocr')).toBe('valida');
  });
  it('desde revision_javi es "aprueba" (Javi)', () => {
    expect(accionDeAvance('revision_javi')).toBe('aprueba');
  });
});
