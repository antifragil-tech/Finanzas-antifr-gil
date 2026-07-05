import { describe, expect, it } from 'vitest';
import { cxpDeLiquidaciones, diasVencido, estaVencida, importePendiente, tramoAging } from './cxcp';
import { generarLiquidacion } from './liquidaciones';
import { getProfesional } from './mocks/profesionales';

describe('CxC/CxP (doc 11)', () => {
  it('aging exacto: 0-30, 31-60, 61-90, +90', () => {
    expect(tramoAging(0)).toBe('0-30');
    expect(tramoAging(30)).toBe('0-30');
    expect(tramoAging(31)).toBe('31-60');
    expect(tramoAging(60)).toBe('31-60');
    expect(tramoAging(61)).toBe('61-90');
    expect(tramoAging(90)).toBe('61-90');
    expect(tramoAging(91)).toBe('+90');
  });

  it('vencido es derivado de la fecha, y una cuenta cobrada nunca está vencida', () => {
    expect(diasVencido('2026-06-01', '2026-07-05')).toBe(34);
    expect(estaVencida({ vencimiento: '2026-06-01', estado: 'pendiente' }, '2026-07-05')).toBe(
      true,
    );
    expect(estaVencida({ vencimiento: '2026-06-01', estado: 'cobrado' }, '2026-07-05')).toBe(false);
    expect(estaVencida({ estado: 'pendiente' }, '2026-07-05')).toBe(false);
  });

  it('importe pendiente = importe − parciales aplicados', () => {
    expect(importePendiente({ importe: 150, cobradoParcial: 50 })).toBe(100);
    expect(importePendiente({ importe: 400, pagadoParcial: 0 })).toBe(400);
  });

  it('una liquidación validada es CxP viva (doc 08 §9); una calculada aún no', () => {
    const solis = getProfesional('prof-maria-solis');
    if (!solis) throw new Error('mock ausente');
    const calculada = generarLiquidacion(solis, '2026-07', []);
    const validada = { ...calculada, estado: 'validada' as const, importeFinal: 300 };

    expect(cxpDeLiquidaciones([calculada])).toHaveLength(0);
    const cxp = cxpDeLiquidaciones([validada]);
    expect(cxp).toHaveLength(1);
    expect(cxp[0]?.importe).toBe(300);
    expect(cxp[0]?.origen).toBe('liquidacion');
  });
});
