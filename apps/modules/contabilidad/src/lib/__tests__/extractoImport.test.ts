import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  canonicalMovimiento,
  hashMovimiento,
  hashArchivo,
  xlsxToRows,
  rowsToCsv,
  rangoFechas,
  hayMovimientosSinSaldoNiReferencia,
  prepararMovimientos,
  type MovParaHash,
} from '../extractoImport';
import { parsearExtracto } from '../csvParsers';

const base: MovParaHash = {
  sociedad_id_ref: 'S-001',
  iban: 'ES12 3456 7890 1234 5678 9012',
  fecha: '2026-06-01',
  importe: -123.45,
  concepto_normalizado: 'pago  proveedor',
  saldo: 1000.5,
  referencia: 'REF-9',
};

describe('canonicalMovimiento', () => {
  it('normaliza importe a céntimos, IBAN sin espacios, concepto colapsado', () => {
    expect(canonicalMovimiento(base)).toBe(
      'S-001|ES1234567890123456789012|2026-06-01|-12345|pago proveedor|100050|ref-9',
    );
  });
  it('saldo nulo y referencia nula → campos vacíos', () => {
    expect(canonicalMovimiento({ ...base, saldo: null, referencia: null })).toBe(
      'S-001|ES1234567890123456789012|2026-06-01|-12345|pago proveedor||',
    );
  });
});

describe('hashMovimiento', () => {
  it('determinista: mismo movimiento → mismo hash', async () => {
    expect(await hashMovimiento(base)).toBe(await hashMovimiento({ ...base }));
  });
  it('distinto importe → distinto hash', async () => {
    expect(await hashMovimiento(base)).not.toBe(
      await hashMovimiento({ ...base, importe: -123.46 }),
    );
  });
  it('el saldo desambigua dos movimientos por lo demás idénticos', async () => {
    const a = { ...base, saldo: 100 };
    const b = { ...base, saldo: 200 };
    expect(await hashMovimiento(a)).not.toBe(await hashMovimiento(b));
  });
  it('hash sha256 de 64 hex', async () => {
    expect(await hashMovimiento(base)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('hashArchivo', () => {
  it('mismo contenido → mismo hash; distinto → distinto', async () => {
    expect(await hashArchivo('abc')).toBe(await hashArchivo('abc'));
    expect(await hashArchivo('abc')).not.toBe(await hashArchivo('abd'));
  });
});

describe('xlsxToRows + rowsToCsv → parser', () => {
  function buildXlsx(aoa: string[][]): ArrayBuffer {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  }
  const aoa = [
    ['Fecha', 'Concepto', 'Importe', 'Saldo'],
    ['01/06/2026', 'PAGO PROVEEDOR', '-123,45', '1.000,50'],
    ['02/06/2026', 'TRANSFERENCIA RECIBIDA', '500,00', '1.500,50'],
  ];

  it('xlsxToRows extrae la matriz de la primera hoja', async () => {
    const rows = await xlsxToRows(buildXlsx(aoa));
    expect(rows[0]).toEqual(['Fecha', 'Concepto', 'Importe', 'Saldo']);
    expect(rows[1]?.[1]).toBe('PAGO PROVEEDOR');
  });

  it('rowsToCsv → parsearExtracto(genérico) recupera los movimientos', async () => {
    const csv = rowsToCsv(await xlsxToRows(buildXlsx(aoa)));
    const movs = parsearExtracto(csv, 'otro');
    expect(movs.length).toBe(2);
    expect(movs[0]?.importe).toBe(-123.45);
    expect(movs[1]?.importe).toBe(500);
  });
});

describe('csv parser sigue funcionando', () => {
  it('parser genérico parsea un CSV con cabecera (celdas entrecomilladas, formato ES)', () => {
    // Celdas entre comillas: igual que produce rowsToCsv y robusto frente a la coma decimal.
    const csv = '"Fecha";"Concepto";"Importe";"Saldo"\n"01/06/2026";"COMISION";"-3,50";"100,00"';
    const movs = parsearExtracto(csv, 'otro');
    expect(movs.length).toBe(1);
    expect(movs[0]?.importe).toBe(-3.5);
  });
});

describe('rangoFechas', () => {
  it('devuelve min y max', () => {
    expect(
      rangoFechas([{ fecha: '2026-06-10' }, { fecha: '2026-06-01' }, { fecha: '2026-06-30' }]),
    ).toEqual({ min: '2026-06-01', max: '2026-06-30' });
  });
  it('lista vacía → null', () => {
    expect(rangoFechas([])).toEqual({ min: null, max: null });
  });
});

describe('hayMovimientosSinSaldoNiReferencia', () => {
  it('detecta movimientos sin saldo ni referencia', () => {
    expect(hayMovimientosSinSaldoNiReferencia([{ saldo: 100, referencia: null }])).toBe(false);
    expect(hayMovimientosSinSaldoNiReferencia([{ saldo: null, referencia: 'X' }])).toBe(false);
    expect(hayMovimientosSinSaldoNiReferencia([{ saldo: null, referencia: null }])).toBe(true);
  });
});

describe('prepararMovimientos', () => {
  it('enriquece y añade hash + cuenta_bancaria_id', async () => {
    const movs = await prepararMovimientos(
      [{ fecha: '2026-06-01', concepto: 'PAGO PROVEEDOR', importe: -100, saldo: 900 }],
      {
        sociedad_id_ref: 'S-001',
        iban: 'ES12',
        banco: 'otro',
        fuente: 'xlsx_otro',
        cuenta_bancaria_id: 'cb1',
        reglas: [],
      },
    );
    expect(movs).toHaveLength(1);
    expect(movs[0]?.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(movs[0]?.cuenta_bancaria_id).toBe('cb1');
    expect(movs[0]?.sociedad_id_ref).toBe('S-001');
  });
  it('dos movimientos idénticos producen el mismo hash (se deduplicarán)', async () => {
    const raw = { fecha: '2026-06-01', concepto: 'COMISION', importe: -3.5, saldo: 100 };
    const movs = await prepararMovimientos([raw, { ...raw }], {
      sociedad_id_ref: 'S-001',
      iban: 'ES12',
      banco: 'otro',
      fuente: 'x',
      cuenta_bancaria_id: null,
      reglas: [],
    });
    expect(movs[0]?.hash).toBe(movs[1]?.hash);
  });
});
