import { describe, expect, it } from 'vitest';
import { agregarMargen, margenOperativoM3, margenSesion, resultadoOperativoM4 } from './margen';
import type { Centro, HechoSesion } from './types';

function hecho(parcial: Partial<HechoSesion>): HechoSesion {
  return {
    sesionId: 's1',
    fecha: '2026-07-01',
    profesionalId: 'prof-maria-solis',
    servicio: 'fisioterapia',
    clienteId: 'cli-1',
    centroId: 'centro-playamar',
    canalId: 'canal-organico',
    tipoVenta: 'bono',
    ingresoDevengado: 45,
    costeProfesional: 30,
    otrosCostesDirectos: 0,
    ...parcial,
  };
}

describe('márgenes M1-M4 (doc 09)', () => {
  it('A) sesión de bono 225/5 con coste 30: M1 = 15', () => {
    expect(margenSesion(hecho({})).m1).toBe(15);
  });

  it('B) sesión suelta 55 − 30: M1 = 25', () => {
    expect(margenSesion(hecho({ tipoVenta: 'suelta', ingresoDevengado: 55 })).m1).toBe(25);
  });

  it('programa 225/5 con Cecilia (20 €): M1 = 25 por sesión (doc 09 §5.1)', () => {
    expect(margenSesion(hecho({ profesionalId: 'prof-cecilia', costeProfesional: 20 })).m1).toBe(
      25,
    );
  });

  it('E) cortesía: ingreso 0, coste 30 → margen −30, visible', () => {
    expect(margenSesion(hecho({ ingresoDevengado: 0, etiqueta: 'cortesia' })).m1).toBe(-30);
  });

  it('M2 = M1 − otros costes directos (comisión datáfono)', () => {
    const m = margenSesion(
      hecho({ tipoVenta: 'suelta', ingresoDevengado: 55, otrosCostesDirectos: 0.83 }),
    );
    expect(m.m2).toBe(24.17);
  });

  it('agrega por profesional: margen total del bono completo = 5 × 15 = 75', () => {
    const hechos = Array.from({ length: 5 }, (_, i) => hecho({ sesionId: `s${i + 1}` }));
    const [agg] = agregarMargen(hechos, 'profesionalId');
    expect(agg?.m1).toBe(75);
    expect(agg?.sesiones).toBe(5);
  });

  it('M3 de centro con acuerdo pendiente_confirmar queda marcado incompleto (B2-P3)', () => {
    const lidomare: Centro = {
      id: 'centro-lidomare',
      nombre: 'Lidomare',
      proyecto: 'clinica',
      tipoAcuerdo: 'pendiente_confirmar',
    };
    const m3 = margenOperativoM3(lidomare, [hecho({ centroId: 'centro-lidomare' })], 100);
    expect(m3.m3).toBe(-85);
    expect(m3.incompleto).toBe(true);

    const m4 = resultadoOperativoM4([m3], 50);
    expect(m4.m4).toBe(-135);
    expect(m4.incompleto).toBe(true);
  });
});
