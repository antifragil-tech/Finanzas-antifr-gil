import { describe, it, expect } from 'vitest';
import {
  clean,
  token,
  carpetaFacturaSegments,
  nombreJustificante,
  NOMBRE_FACTURA_PDF,
} from '../drivePaths';

describe('clean', () => {
  it('quita acentos y caracteres inválidos, mantiene espacios', () => {
    expect(clean('Armía Group')).toBe('Armia Group');
    expect(clean('A/B:C*?')).toBe('A-B-C--');
    expect(clean('  hola   mundo ')).toBe('hola mundo');
  });
});

describe('token', () => {
  it('usa guion bajo en vez de espacios', () => {
    expect(token('CONSTRUCCIONES HERMANOS COCA')).toBe('CONSTRUCCIONES_HERMANOS_COCA');
  });
  it('vacío → NA', () => {
    expect(token('')).toBe('NA');
  });
});

describe('carpetaFacturaSegments', () => {
  it('construye Contabilidad/Sociedad/Año/Mes/subcarpeta', () => {
    expect(
      carpetaFacturaSegments({
        sociedadNombre: 'Armia Group',
        fechaFactura: '2026-06-15',
        proveedorNombre: 'CONSTRUCCIONES HERMANOS COCA',
        numeroFactura: '236',
      }),
    ).toEqual([
      'Contabilidad',
      'Armia Group',
      '2026',
      '06',
      '2026-06-15_CONSTRUCCIONES_HERMANOS_COCA_236',
    ]);
  });

  it('sin número de factura → s-n', () => {
    const seg = carpetaFacturaSegments({
      sociedadNombre: 'Alrive',
      fechaFactura: '2026-04-30',
      proveedorNombre: 'E.S. ALHAURIN S.L.',
      numeroFactura: null,
    });
    expect(seg[0]).toBe('Contabilidad');
    expect(seg[2]).toBe('2026');
    expect(seg[3]).toBe('04');
    expect(seg[4]).toContain('_s-n');
  });

  it('sociedad vacía → "Sin sociedad"', () => {
    expect(
      carpetaFacturaSegments({
        sociedadNombre: '',
        fechaFactura: '2026-01-02',
        proveedorNombre: 'X',
        numeroFactura: '1',
      })[1],
    ).toBe('Sin sociedad');
  });
});

describe('nombreJustificante', () => {
  it('formatea índice a 2 dígitos + fecha', () => {
    expect(nombreJustificante(1, '2026-06-20')).toBe('justificante_01_2026-06-20.pdf');
    expect(nombreJustificante(12, '2026-06-20T10:00:00')).toBe('justificante_12_2026-06-20.pdf');
  });
  it('sin fecha → sin-fecha', () => {
    expect(nombreJustificante(2, null)).toBe('justificante_02_sin-fecha.pdf');
  });
});

describe('constantes', () => {
  it('nombre del PDF de factura', () => {
    expect(NOMBRE_FACTURA_PDF).toBe('factura.pdf');
  });
});
