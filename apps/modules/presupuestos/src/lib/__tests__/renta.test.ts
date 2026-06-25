import { describe, it, expect } from 'vitest';
import { calcKpisRentaExtended, type AnalisisFinanciero } from '../analisisFinanciero';
import { lecturaExplotarLiquidar } from '../rentaInsights';
import { construirInforme } from '../exportProyectoFinanciero';
import type { ProyectoRow } from '../proyectosApi';

// Regresión de renta patrimonial: la rentabilidad neta sobre el valor actual
// (NOI / valoración) y la lectura "Explotar vs liquidar" son métricas que el
// usuario revisa para decidir entre seguir explotando o rotar el capital, así
// que blindamos su cálculo y su presencia en el informe PDF.

const baseRenta = (over: Partial<AnalisisFinanciero>): AnalisisFinanciero => ({
  proyecto_id: 'test',
  tipo_analisis: 'renta',
  ...over,
});

const proyecto = (over: Partial<ProyectoRow> = {}): ProyectoRow =>
  ({
    nombre: 'Proyecto test',
    sociedad_tenedora: null,
    fecha_inicio: null,
    fecha_prevista_salida: null,
    ...over,
  }) as unknown as ProyectoRow;

describe('calcKpisRentaExtended — rentabilidad neta sobre valor actual', () => {
  it('Ciudad Rialsa: NOI 141.750 / valor 1.500.000 ≈ 9,45%', () => {
    const k = calcKpisRentaExtended(
      baseRenta({
        precio_adquisicion: 799682,
        renta_mensual_bruta: 141750 / 12, // NOI = renta anual (sin gastos) = 141.750
        tasa_ocupacion_prevista_pct: 100,
        valoracion_actual: 1500000,
      }),
      null,
      null,
    );
    expect(k.noIAnual).toBeCloseTo(141750, 0);
    expect(k.yieldNetoValorActual).toBeCloseTo(0.0945, 4);
  });

  it('Villa el Chorro: NOI 119.100 / valor 1.500.000 ≈ 7,94%', () => {
    const k = calcKpisRentaExtended(
      baseRenta({
        precio_adquisicion: 900000,
        renta_mensual_bruta: 119100 / 12,
        tasa_ocupacion_prevista_pct: 100,
        valoracion_actual: 1500000,
      }),
      null,
      null,
    );
    expect(k.yieldNetoValorActual).toBeCloseTo(0.0794, 4);
  });

  it('ocupación no informada (null) se trata como 100%', () => {
    const sinOcup = calcKpisRentaExtended(
      baseRenta({
        precio_adquisicion: 1000000,
        renta_mensual_bruta: 10000, // 120.000/año
        tasa_ocupacion_prevista_pct: null,
        valoracion_actual: 1500000,
      }),
      null,
      null,
    );
    const con100 = calcKpisRentaExtended(
      baseRenta({
        precio_adquisicion: 1000000,
        renta_mensual_bruta: 10000,
        tasa_ocupacion_prevista_pct: 100,
        valoracion_actual: 1500000,
      }),
      null,
      null,
    );
    expect(sinOcup.noIAnual).toBeCloseTo(120000, 0);
    expect(sinOcup.noIAnual).toBe(con100.noIAnual);
  });
});

describe('lecturaExplotarLiquidar — bandas', () => {
  it('rentabilidad >= tasa → explotar (Rialsa 9,45% vs 8%)', () => {
    expect(lecturaExplotarLiquidar(0.0945, 0.08).nivel).toBe('explotar');
  });
  it('dentro de 1 punto por debajo → neutral (Villa 7,94% vs 8%)', () => {
    expect(lecturaExplotarLiquidar(0.0794, 0.08).nivel).toBe('neutral');
  });
  it('más de 1 punto por debajo → revisar', () => {
    expect(lecturaExplotarLiquidar(0.05, 0.08).nivel).toBe('revisar');
  });
  it('sin valor actual → na', () => {
    expect(lecturaExplotarLiquidar(null, 0.08).nivel).toBe('na');
  });
});

describe('construirInforme — modelo del PDF (renta)', () => {
  const informe = construirInforme(
    baseRenta({
      precio_adquisicion: 799682,
      renta_mensual_bruta: 141750 / 12,
      tasa_ocupacion_prevista_pct: null, // dispara el aviso de default
      valoracion_actual: 1500000,
    }),
    proyecto({ nombre: 'Ciudad Rialsa' }),
  );

  it('incluye la fila "Rentabilidad neta sobre valor actual"', () => {
    const fila = informe.kpisCalculados.find(
      (f) => f.label === 'Rentabilidad neta sobre valor actual',
    );
    expect(fila).toBeDefined();
    expect(fila?.valor).toMatch(/^9\.\d%$/);
  });

  it('avisa del default de ocupación al 100%', () => {
    expect(informe.alertas).toContain('Ocupación no informada: se asume 100% de ocupación.');
  });

  it('expone la lectura "Explotar vs liquidar"', () => {
    expect(informe.explotarLiquidar).not.toBeNull();
    expect(informe.explotarLiquidar?.titulo).toBeTruthy();
  });
});
