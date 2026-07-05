import { describe, it, expect } from 'vitest';
import { normalizeNif, matchSociedadPorNif, type SociedadLite } from '../sociedadMatch';

const SOCIEDADES: SociedadLite[] = [
  { id_ref: 'S-002-1', cif: null }, // Alrive (sin cif)
  { id_ref: 'S-001', cif: 'B-93626158' }, // Alsari Inversiones (con guion)
  { id_ref: 'S-002', cif: 'B-92182500.' }, // Rialsa (con punto)
  { id_ref: 'H-002', cif: 'B-26757070' }, // Armia
];

describe('normalizeNif', () => {
  it('quita guiones, puntos, espacios y pasa a mayúsculas', () => {
    expect(normalizeNif('B-93626158')).toBe('B93626158');
    expect(normalizeNif('b 93626158')).toBe('B93626158');
    expect(normalizeNif('B-92182500.')).toBe('B92182500');
    expect(normalizeNif('25727984t')).toBe('25727984T');
  });
  it('null/undefined → cadena vacía', () => {
    expect(normalizeNif(null)).toBe('');
    expect(normalizeNif(undefined)).toBe('');
  });
});

describe('matchSociedadPorNif', () => {
  it('B93626158 (OCR sin guion) casa con B-93626158 (almacenado con guion)', () => {
    expect(matchSociedadPorNif('B93626158', SOCIEDADES)?.id_ref).toBe('S-001');
  });
  it('tolera punto en el cif almacenado (Rialsa)', () => {
    expect(matchSociedadPorNif('B92182500', SOCIEDADES)?.id_ref).toBe('S-002');
  });
  it('sin match → null', () => {
    expect(matchSociedadPorNif('X00000000', SOCIEDADES)).toBeNull();
  });
  it('nif vacío/null → null (no asigna nada)', () => {
    expect(matchSociedadPorNif('', SOCIEDADES)).toBeNull();
    expect(matchSociedadPorNif(null, SOCIEDADES)).toBeNull();
  });
  it('ignora sociedades con cif null', () => {
    expect(matchSociedadPorNif('', [{ id_ref: 'S-002-1', cif: null }])).toBeNull();
  });
  it('match múltiple (dos sociedades con mismo NIF) → null (no asigna)', () => {
    const dup: SociedadLite[] = [
      { id_ref: 'A', cif: 'B-93626158' },
      { id_ref: 'B', cif: 'B93626158' },
    ];
    expect(matchSociedadPorNif('B93626158', dup)).toBeNull();
  });
});
