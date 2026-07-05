import { describe, expect, it } from 'vitest';
import {
  caducarVenta,
  cumpleInvarianteV1,
  devengoUnitario,
  devolverUnidades,
  efectoSesion,
  resumenVenta,
} from './devengo';
import type { EventoSesionBono, TipoSesionBono, VentaBono } from './types';

// Ejemplo canónico doc 10 §2/§7: bono 225 € / 5 sesiones de fisioterapia.
const BONO_225_5: VentaBono = {
  id: 'v1',
  clienteId: 'cli-1',
  productoId: 'prod-bono-fisio-5',
  fechaVenta: '2026-07-01',
  importeCobrado: 225,
  unidades: 5,
  vencimiento: '2027-01-01',
  estado: 'activo',
};

function consumo(n: number, tipo: TipoSesionBono = 'consumida'): EventoSesionBono[] {
  return Array.from({ length: n }, (_, i) => ({
    ventaId: 'v1',
    sesionId: `s${i + 1}`,
    fecha: `2026-07-${String(i + 2).padStart(2, '0')}`,
    profesionalId: 'prof-maria-solis',
    tipo,
  }));
}

describe('devengo de bonos (doc 10)', () => {
  it('A) devengo por sesión = cobrado / unidades: 225/5 = 45', () => {
    expect(devengoUnitario(BONO_225_5)).toBe(45);
  });

  it('bono con descuento (§6.2): vendido a 200 € devenga 40 €/sesión', () => {
    expect(devengoUnitario({ ...BONO_225_5, importeCobrado: 200 })).toBe(40);
  });

  it('C) parcialmente consumido (3 de 5): devengado 135, pendiente 90, invariante cuadra', () => {
    const r = resumenVenta(BONO_225_5, consumo(3));
    expect(r.devengado).toBe(135);
    expect(r.pendienteDeDevengar).toBe(90);
    expect(r.saldoUnidades).toBe(2);
    expect(r.cuadra).toBe(true);
    expect(cumpleInvarianteV1(r)).toBe(true);
  });

  it('consumo completo (5 de 5): devengado 225, pendiente 0 — nunca más, nunca antes', () => {
    const r = resumenVenta(BONO_225_5, consumo(5));
    expect(r.devengado).toBe(225);
    expect(r.pendienteDeDevengar).toBe(0);
    expect(r.saldoUnidades).toBe(0);
    expect(cumpleInvarianteV1(r)).toBe(true);
  });

  it('la venta sola no devenga nada: el devengo lo disparan las sesiones (§6.1)', () => {
    const r = resumenVenta(BONO_225_5, []);
    expect(r.devengado).toBe(0);
    expect(r.pendienteDeDevengar).toBe(225);
  });

  it('D) caducidad con 2 pendientes: 90 € como ingreso_por_caducidad, pendiente de criterio fiscal', () => {
    const r = resumenVenta(BONO_225_5, consumo(3));
    const cad = caducarVenta(BONO_225_5, r, '2027-01-01');
    expect(cad.unidadesCaducadas).toBe(2);
    expect(cad.importe).toBe(90);
    expect(cad.pendienteCriterioFiscal).toBe(true);

    const final = resumenVenta(BONO_225_5, consumo(3), [], [cad]);
    expect(final.pendienteDeDevengar).toBe(0);
    expect(final.tratadoPorCaducidad).toBe(90);
    expect(cumpleInvarianteV1(final)).toBe(true);
  });

  it('devolución (§6.7): solo unidades no consumidas, a devengo unitario', () => {
    const r = resumenVenta(BONO_225_5, consumo(3));
    const dev = devolverUnidades(BONO_225_5, r, 2, '2026-08-01', 'traslado');
    expect(dev.importe).toBe(90);

    const final = resumenVenta(BONO_225_5, consumo(3), [dev]);
    expect(final.devuelto).toBe(90);
    expect(final.pendienteDeDevengar).toBe(0);
    expect(final.saldoUnidades).toBe(0);
    expect(cumpleInvarianteV1(final)).toBe(true);

    expect(() => devolverUnidades(BONO_225_5, final, 1, '2026-08-02', 'extra')).toThrow();
  });

  it('tabla §5: no_show_cobrado consume y devenga; cancelada_a_tiempo y no_show_no_cobrado no', () => {
    expect(efectoSesion('no_show_cobrado')).toEqual({
      consumeUnidad: true,
      devengaIngreso: true,
      generaCosteProfesional: false,
    });
    expect(efectoSesion('cancelada_a_tiempo').consumeUnidad).toBe(false);
    expect(efectoSesion('no_show_no_cobrado').devengaIngreso).toBe(false);
    expect(efectoSesion('cortesia')).toEqual({
      consumeUnidad: false,
      devengaIngreso: false,
      generaCosteProfesional: true,
    });
  });

  it('V2: el consumo por encima del saldo descuadra y se detecta', () => {
    const r = resumenVenta(BONO_225_5, consumo(6));
    expect(r.saldoUnidades).toBe(-1);
    expect(r.cuadra).toBe(false);
  });
});
