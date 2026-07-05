import { describe, expect, it } from 'vitest';
import { aplicarAjuste, generarLiquidacion, puedeAvanzar } from './liquidaciones';
import { getProfesional } from './mocks/profesionales';
import type { Profesional, SesionLiquidable } from './types';

function sesiones(
  profesionalId: string,
  n: number,
  estado: SesionLiquidable['estado'] = 'validada',
): SesionLiquidable[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${profesionalId}-s${i + 1}`,
    fecha: `2026-07-${String(i + 1).padStart(2, '0')}`,
    profesionalId,
    servicio: 'fisioterapia',
    clienteId: `cli-${i + 1}`,
    estado,
  }));
}

function prof(id: string): Profesional {
  const p = getProfesional(id);
  if (!p) throw new Error(`no existe ${id}`);
  return p;
}

describe('liquidaciones mensuales (doc 08)', () => {
  it('María Solís: 10 sesiones validadas × 30 € = 300 €, estado calculada', () => {
    const liq = generarLiquidacion(
      prof('prof-maria-solis'),
      '2026-07',
      sesiones('prof-maria-solis', 10),
    );
    expect(liq.importeFinal).toBe(300);
    expect(liq.estado).toBe('calculada');
    expect(liq.requiereRevisionCeo).toBe(false);
    expect(liq.sesionesIncluidas).toHaveLength(10);
  });

  it('solo cuentan sesiones validadas (§4.3): las realizadas sin validar no liquidan', () => {
    const mezcla = [...sesiones('prof-cecilia', 5), ...sesiones('prof-cecilia', 3, 'realizada')];
    const liq = generarLiquidacion(prof('prof-cecilia'), '2026-07', mezcla);
    expect(liq.importeFinal).toBe(100); // 5 × 20 €
  });

  it('Carlos: el cálculo aflora (6 × 25 = 150 €) pero queda bloqueada_por_incidencia', () => {
    const liq = generarLiquidacion(prof('prof-carlos'), '2026-07', sesiones('prof-carlos', 6));
    expect(liq.importeCalculado).toBe(150);
    expect(liq.estado).toBe('bloqueada_por_incidencia');
    expect(liq.motivoBloqueo).toBe('relacion_sin_regularizar');
    expect(puedeAvanzar(liq, 'pendiente_documento')).toBe(false);
  });

  it('Marta: 3 sueltas (105 €) + 2 clientes plan (60 €) = 165 €, requiere revisión CEO', () => {
    const liq = generarLiquidacion(prof('prof-marta'), '2026-07', sesiones('prof-marta', 3), {
      clientesActivosPlan: 2,
    });
    expect(liq.importeFinal).toBe(165);
    expect(liq.requiereRevisionCeo).toBe(true);
    // Sin CEO no pasa de calculada (B1-P1)…
    expect(puedeAvanzar(liq, 'pendiente_documento')).toBe(false);
    // …con CEO sí.
    expect(puedeAvanzar(liq, 'pendiente_documento', { revisadaPorCeo: true })).toBe(true);
  });

  it('Lidia: parte fija Antifrágil 400 €/mes, el resto Lidomare', () => {
    const liq = generarLiquidacion(prof('prof-lidia'), '2026-07', []);
    expect(liq.importeFinal).toBe(400);
    expect(liq.lineas[0]?.detalle).toContain('Lidomare');
  });

  it('ajustes (§4.6): importe_final = calculado + Σ ajustes, sin editar el cálculo', () => {
    const base = generarLiquidacion(
      prof('prof-maria-solis'),
      '2026-07',
      sesiones('prof-maria-solis', 4),
    );
    const conAjuste = aplicarAjuste(base, {
      importe: -30,
      motivo: 'sesión duplicada en agenda',
      autor: 'ceo',
      fecha: '2026-08-02',
    });
    expect(conAjuste.importeCalculado).toBe(120);
    expect(conAjuste.importeFinal).toBe(90);
  });

  it('pagada exige pagos que cubran el importe final (§5)', () => {
    const liq = {
      ...generarLiquidacion(prof('prof-cecilia'), '2026-07', sesiones('prof-cecilia', 5)),
      estado: 'pendiente_pago' as const,
    };
    expect(puedeAvanzar(liq, 'pagada', { pagos: [] })).toBe(false);
    expect(
      puedeAvanzar(liq, 'pagada', {
        pagos: [
          { fecha: '2026-08-05', importe: 100, medio: 'transferencia', cuentaTesoreria: 'banco' },
        ],
      }),
    ).toBe(true);
  });
});
