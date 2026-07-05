/**
 * Cuentas por cobrar / pagar (doc 11).
 *
 * `vencido` es SIEMPRE derivado de la fecha, nunca un flag manual (§9);
 * `cobrado`/`pagado` solo los produce dinero real aplicado (§7); un bono
 * cobrado pendiente de devengar NO es CxC (§11).
 */

import { redondear } from './devengo';
import type { CuentaPorCobrar, CuentaPorPagar, LiquidacionMensual, TramoAging } from './types';

const DIA_MS = 86_400_000;

export function diasVencido(vencimiento: string, hoy: string): number {
  const dias = Math.floor(
    (new Date(`${hoy}T00:00:00`).getTime() - new Date(`${vencimiento}T00:00:00`).getTime()) /
      DIA_MS,
  );
  return Math.max(0, dias);
}

/** Tramos exactos de antigüedad (doc 11 §9). */
export function tramoAging(dias: number): TramoAging {
  if (dias <= 30) return '0-30';
  if (dias <= 60) return '31-60';
  if (dias <= 90) return '61-90';
  return '+90';
}

export function estaVencida(
  cuenta: Pick<CuentaPorCobrar, 'vencimiento' | 'estado'>,
  hoy: string,
): boolean {
  if (!cuenta.vencimiento) return false;
  const cerrada = ['cobrado', 'pagado', 'cancelado', 'incobrable'].includes(cuenta.estado);
  return !cerrada && cuenta.vencimiento < hoy;
}

export function importePendiente(
  cuenta:
    | Pick<CuentaPorCobrar, 'importe' | 'cobradoParcial'>
    | Pick<CuentaPorPagar, 'importe' | 'pagadoParcial'>,
): number {
  const aplicado = 'cobradoParcial' in cuenta ? cuenta.cobradoParcial : cuenta.pagadoParcial;
  return redondear(cuenta.importe - aplicado);
}

/**
 * CxP derivadas de liquidaciones (doc 11 §5, doc 08 §9): una liquidación es
 * cuenta por pagar viva entre `validada` y `pagada`.
 */
export function cxpDeLiquidaciones(liquidaciones: LiquidacionMensual[]): CuentaPorPagar[] {
  return liquidaciones
    .filter((l) => l.estado === 'validada' || l.estado === 'pendiente_pago')
    .map((l) => ({
      id: `cxp-liq-${l.profesionalId}-${l.mes}`,
      contraparte: l.profesionalId,
      origen: 'liquidacion' as const,
      origenId: `${l.profesionalId}-${l.mes}`,
      importe: l.importeFinal,
      pagadoParcial: 0,
      estado: 'pendiente' as const,
    }));
}
