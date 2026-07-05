/**
 * Liquidaciones mensuales de equipo (doc 08).
 *
 * Reglas: solo cuentan sesiones `validada` (§4.3/§6); las reglas no
 * confirmadas o relaciones sin regularizar BLOQUEAN, nunca esconden (R4);
 * importe_final = importe_calculado + Σ ajustes (§4.6); una sesión pertenece
 * a una única liquidación (R3).
 */

import { redondear } from './devengo';
import type {
  AjusteManual,
  EstadoLiquidacion,
  LineaLiquidacion,
  LiquidacionMensual,
  PagoLiquidacion,
  Profesional,
  SesionLiquidable,
} from './types';

export interface ContextoLiquidacion {
  /** Nº de clientes activos en plan multi-mes (regla mensual_por_plan, doc 08 §4.4). */
  clientesActivosPlan?: number;
}

/** Orden de avance del ciclo (doc 08 §5); bloqueada_por_incidencia es transversal. */
const CICLO: EstadoLiquidacion[] = [
  'pendiente_calculo',
  'calculada',
  'pendiente_documento',
  'validada',
  'pendiente_pago',
  'pagada',
  'revisada',
];

function esDelMes(fecha: string, mes: string): boolean {
  return fecha.startsWith(mes);
}

/**
 * Genera la liquidación persona × mes a partir de las sesiones validadas y
 * las reglas vigentes del profesional. No muta nada: devuelve la entidad.
 */
export function generarLiquidacion(
  profesional: Profesional,
  mes: string,
  sesiones: SesionLiquidable[],
  contexto: ContextoLiquidacion = {},
): LiquidacionMensual {
  const validadas = sesiones.filter(
    (s) => s.profesionalId === profesional.id && s.estado === 'validada' && esDelMes(s.fecha, mes),
  );

  const lineas: LineaLiquidacion[] = [];
  let requiereRevisionCeo = false;

  for (const regla of profesional.reglas) {
    switch (regla.tipo) {
      case 'nomina_fija':
        lineas.push({
          regla: regla.tipo,
          detalle: 'Nómina mensual a cargo de Antifrágil',
          cantidad: 1,
          importe: regla.importe,
        });
        break;
      case 'nomina_compartida':
        lineas.push({
          regla: regla.tipo,
          detalle: `Parte fija Antifrágil (resto: ${profesional.terceroCopagador ?? 'tercero'})`,
          cantidad: 1,
          importe: regla.importe,
        });
        break;
      case 'por_sesion':
      case 'pendiente_regularizar': {
        // Carlos: el cálculo se hace igual (25 €/sesión) — la deuda aflora,
        // pero la liquidación queda bloqueada (doc 08 §4.5).
        lineas.push({
          regla: regla.tipo,
          detalle: `${validadas.length} sesiones validadas × ${regla.importe} €`,
          cantidad: validadas.length,
          importe: redondear(validadas.length * regla.importe),
        });
        break;
      }
      case 'mensual_por_plan': {
        const clientes = contexto.clientesActivosPlan ?? 0;
        lineas.push({
          regla: regla.tipo,
          detalle: `${clientes} clientes activos en plan × ${regla.importe} €/mes`,
          cantidad: clientes,
          importe: redondear(clientes * regla.importe),
        });
        break;
      }
      case 'ajuste_manual':
        // Los ajustes entran por aplicarAjuste, no como regla base (doc 08 §4.6).
        break;
    }
    if (!regla.confirmada) requiereRevisionCeo = true;
  }

  const importeCalculado = redondear(lineas.reduce((s, l) => s + l.importe, 0));
  const sinRegularizar = profesional.relacion === 'pendiente_regularizar';
  const tipoEvidencia =
    profesional.relacion === 'nomina' || profesional.relacion === 'nomina_compartida'
      ? ('nomina' as const)
      : ('factura_autonomo' as const);

  return {
    profesionalId: profesional.id,
    mes,
    lineas,
    importeCalculado,
    ajustes: [],
    importeFinal: importeCalculado,
    estado: sinRegularizar ? 'bloqueada_por_incidencia' : 'calculada',
    ...(sinRegularizar ? { motivoBloqueo: 'relacion_sin_regularizar' } : {}),
    requiereRevisionCeo,
    evidencia: { tipo: tipoEvidencia, recibida: false },
    sesionesIncluidas: validadas.map((s) => s.id),
  };
}

/** Ajuste manual (doc 08 §4.6): nunca edita el cálculo, se suma con motivo y autor. */
export function aplicarAjuste(liq: LiquidacionMensual, ajuste: AjusteManual): LiquidacionMensual {
  const ajustes = [...liq.ajustes, ajuste];
  return {
    ...liq,
    ajustes,
    importeFinal: redondear(liq.importeCalculado + ajustes.reduce((s, a) => s + a.importe, 0)),
  };
}

/**
 * ¿Puede avanzar al siguiente estado? Reglas doc 08 §4.4/§4.8/§5:
 * bloqueada no avanza; reglas sin confirmar no pasan de `calculada` sin CEO;
 * `pagada` exige pagos que cubran el importe final.
 */
export function puedeAvanzar(
  liq: LiquidacionMensual,
  destino: EstadoLiquidacion,
  opts: { pagos?: PagoLiquidacion[]; revisadaPorCeo?: boolean } = {},
): boolean {
  if (liq.estado === 'bloqueada_por_incidencia') return false;
  const desde = CICLO.indexOf(liq.estado);
  const hasta = CICLO.indexOf(destino);
  if (desde === -1 || hasta === -1 || hasta !== desde + 1) return false;
  if (liq.requiereRevisionCeo && desde >= CICLO.indexOf('calculada') && !opts.revisadaPorCeo) {
    return false;
  }
  // R2 (doc 08 §4.8): no se valida sin documento — nómina o factura de autónomo.
  if (destino === 'validada' && !liq.evidencia.recibida) return false;
  if (destino === 'pagada') {
    const pagado = redondear((opts.pagos ?? []).reduce((s, p) => s + p.importe, 0));
    if (pagado < liq.importeFinal) return false;
  }
  return true;
}
