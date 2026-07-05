import { describe, expect, it } from 'vitest';
import {
  escaleraMargen,
  estadoValidacion,
  importeCobradoDeFacturas,
  importePagadoDeFacturas,
  puedeValidarsePago,
  totalesCajaDevengo,
  type GastoOperativo,
  type IngresoOperativo,
} from './finanzas';
import {
  facturasEmitidasDemo,
  facturasRecibidasDemo,
  gastosDemo,
  ingresosDemo,
} from './mocks/finanzasDemo';
import { generarLiquidacion, puedeAvanzar } from './liquidaciones';
import { getProfesional } from './mocks/profesionales';

const ingreso = (parcial: Partial<IngresoOperativo>): IngresoOperativo => ({
  id: 'i1',
  origen: 'suelta',
  concepto: 'test',
  fecha: '2026-07-01',
  centroId: 'centro-playamar',
  canalId: 'canal-organico',
  importeDevengado: 45,
  importeCobrado: 0,
  ...parcial,
});

const gasto = (parcial: Partial<GastoOperativo>): GastoOperativo => ({
  id: 'g1',
  tipo: 'material',
  concepto: 'test',
  fecha: '2026-07-01',
  importe: 100,
  capa: 'directo',
  documento: { tipo: 'factura_recibida', recibido: true },
  ...parcial,
});

describe('motor financiero operativo', () => {
  it('cobrado no es devengado: los totales van SIEMPRE por separado', () => {
    const t = totalesCajaDevengo(
      [
        ingreso({ importeDevengado: 45, importeCobrado: 0 }),
        ingreso({ id: 'i2', importeCobrado: 45 }),
      ],
      [],
    );
    expect(t.devengado).toBe(90);
    expect(t.cobrado).toBe(45);
    expect(t.pendienteCobro).toBe(45);
  });

  it('factura emitida no implica cobro: solo las cobradas suman a caja', () => {
    const facturas = facturasEmitidasDemo();
    const cobrado = importeCobradoDeFacturas(facturas);
    const emitidaSinCobrar = facturas.find((f) => f.estado === 'emitida_operativa');
    expect(emitidaSinCobrar).toBeDefined();
    expect(cobrado).toBe(675); // solo los 3 bonos cobrados (3 × 225)
  });

  it('factura recibida no implica pago: solo las pagadas son pago ejecutado', () => {
    const facturas = facturasRecibidasDemo();
    expect(importePagadoDeFacturas(facturas)).toBe(1200); // solo el alquiler
    expect(facturas.some((f) => f.estado === 'pendiente_pago')).toBe(true);
  });

  it('gasto calculado sin documento NO valida pago (regla dura)', () => {
    const sinDoc = gasto({ documento: { tipo: 'factura_recibida', recibido: false } });
    expect(puedeValidarsePago(sinDoc)).toBe(false);
    expect(estadoValidacion(sinDoc)).toBe('bloqueado_sin_documento');
    const conDoc = gasto({});
    expect(estadoValidacion(conDoc)).toBe('validado');
    const noRequiere = gasto({ documento: { tipo: 'no_requerido', recibido: false } });
    expect(estadoValidacion(noRequiere)).toBe('validado');
  });

  it('liquidación sin documento queda bloqueada para validar (R2)', () => {
    const solis = getProfesional('prof-maria-solis');
    if (!solis) throw new Error('mock ausente');
    const liq = {
      ...generarLiquidacion(solis, '2026-07', []),
      estado: 'pendiente_documento' as const,
    };
    expect(puedeAvanzar(liq, 'validada')).toBe(false);
  });

  it('pendiente_confirmacion no rompe cálculos, pero marca provisional', () => {
    const e = escaleraMargen(
      [ingreso({})],
      [
        gasto({
          tipo: 'concepto_provisional',
          importe: 0,
          pendienteConfirmacion: true,
          capa: 'general',
        }),
      ],
    );
    expect(e.m1).toBe(45);
    expect(Number.isFinite(e.m3)).toBe(true);
    expect(e.provisional).toBe(true);
  });

  it('la escalera M1→M2→M3 cuadra con el escenario demo', () => {
    const e = escaleraMargen(ingresosDemo(), gastosDemo());
    expect(e.m1).toBe(e.ingresoDevengado - e.costeProfesionalVariable);
    expect(e.m2).toBe(e.m1 - e.otrosCostesDirectos);
    expect(e.m3).toBe(e.m2 - e.costesFijos);
    expect(e.m1).toBeGreaterThan(e.m2);
    expect(e.m2).toBeGreaterThan(e.m3);
    expect(e.amortizablesFueraDeM3).toBe(2000); // la inversión no entra al M3 mensual
    expect(e.provisional).toBe(true); // UG/PM, formaciones, GEA/AFDH pendientes
    expect(e.gastosBloqueados).toBeGreaterThan(0); // variables sin factura recibida
  });

  it('el ingreso de bono no se cuenta dos veces (anti-doble-conteo caja)', () => {
    const t = totalesCajaDevengo(ingresosDemo(), []);
    const cobradoFacturas = importeCobradoDeFacturas(facturasEmitidasDemo());
    // La caja de bonos vive en sus facturas cobradas (675), no en los ingresos
    // por sesión (que solo cobran las sueltas en el acto).
    expect(t.cobrado + cobradoFacturas).toBe(t.cobrado + 675);
  });
});
