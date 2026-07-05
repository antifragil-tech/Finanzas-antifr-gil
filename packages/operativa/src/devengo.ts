/**
 * Devengo de bonos y programas (doc 10).
 *
 * Principios: el devengo lo dispara una sesión consumida, nunca la venta
 * (§6.1); se calcula sobre lo realmente cobrado, no sobre catálogo (§6.2);
 * los saldos y pendientes son derivados (§3); todo cuadra contra el
 * invariante V1 (§4).
 */

import type {
  Caducidad,
  Devolucion,
  EfectoSesion,
  EventoSesionBono,
  ResumenVentaBono,
  TipoSesionBono,
  VentaBono,
} from './types';

const CENTIMOS = 100;

/** Redondeo a céntimo, estable para sumas de importes. */
export function redondear(importe: number): number {
  return Math.round(importe * CENTIMOS) / CENTIMOS;
}

/** Devengo por sesión = importe realmente cobrado ÷ nº de unidades (doc 10 §6.1-6.2). */
export function devengoUnitario(venta: Pick<VentaBono, 'importeCobrado' | 'unidades'>): number {
  if (venta.unidades <= 0) throw new Error('Una venta de bono necesita unidades > 0');
  return redondear(venta.importeCobrado / venta.unidades);
}

/**
 * Efecto económico de cada tipo de sesión (tabla exacta doc 10 §5).
 * Decisiones asumidas y trazadas: no_show_cobrado consume y devenga (B3-P2,
 * recomendado); el profesional NO cobra el no-show (B3-P6, asumido).
 */
export function efectoSesion(tipo: TipoSesionBono): EfectoSesion {
  switch (tipo) {
    case 'consumida':
      return { consumeUnidad: true, devengaIngreso: true, generaCosteProfesional: true };
    case 'no_show_cobrado':
      return { consumeUnidad: true, devengaIngreso: true, generaCosteProfesional: false };
    case 'cortesia':
      return { consumeUnidad: false, devengaIngreso: false, generaCosteProfesional: true };
    case 'reservada':
    case 'no_show_no_cobrado':
    case 'cancelada_a_tiempo':
    case 'pendiente_regularizar':
      return { consumeUnidad: false, devengaIngreso: false, generaCosteProfesional: false };
  }
}

/**
 * Resumen derivado de una venta de bono. El pendiente se deriva del resto de
 * componentes, de modo que el invariante V1 se cumple por construcción salvo
 * inconsistencia real de los hechos (más consumo/devolución que unidades),
 * que se refleja en `cuadra = false`.
 */
export function resumenVenta(
  venta: VentaBono,
  eventos: EventoSesionBono[],
  devoluciones: Devolucion[] = [],
  caducidades: Caducidad[] = [],
): ResumenVentaBono {
  const unitario = devengoUnitario(venta);
  const propios = eventos.filter((e) => e.ventaId === venta.id);

  const unidadesConsumidas = propios.filter((e) => efectoSesion(e.tipo).consumeUnidad).length;
  const devengado = redondear(
    propios.filter((e) => efectoSesion(e.tipo).devengaIngreso).length * unitario,
  );

  const unidadesDevueltas = devoluciones
    .filter((d) => d.ventaId === venta.id)
    .reduce((s, d) => s + d.unidades, 0);
  const devuelto = redondear(
    devoluciones.filter((d) => d.ventaId === venta.id).reduce((s, d) => s + d.importe, 0),
  );

  const unidadesCaducadas = caducidades
    .filter((c) => c.ventaId === venta.id)
    .reduce((s, c) => s + c.unidadesCaducadas, 0);
  const tratadoPorCaducidad = redondear(
    caducidades.filter((c) => c.ventaId === venta.id).reduce((s, c) => s + c.importe, 0),
  );

  const saldoUnidades = venta.unidades - unidadesConsumidas - unidadesDevueltas - unidadesCaducadas;
  const pendienteDeDevengar = redondear(
    venta.importeCobrado - devengado - devuelto - tratadoPorCaducidad,
  );

  // V1: devengado + pendiente + devuelto + caducado = cobrado (por construcción);
  // el descuadre real se detecta en el saldo de unidades y el signo del pendiente.
  const cuadra = saldoUnidades >= 0 && pendienteDeDevengar >= 0;

  return {
    ventaId: venta.id,
    importeCobrado: venta.importeCobrado,
    devengoUnitario: unitario,
    unidadesConsumidas,
    saldoUnidades,
    devengado,
    devuelto,
    tratadoPorCaducidad,
    pendienteDeDevengar,
    cuadra,
  };
}

/** Comprobación explícita del invariante V1 (doc 10 §4, §15). */
export function cumpleInvarianteV1(r: ResumenVentaBono): boolean {
  return (
    redondear(r.devengado + r.pendienteDeDevengar + r.devuelto + r.tratadoPorCaducidad) ===
    redondear(r.importeCobrado)
  );
}

/**
 * Caducidad (doc 10 §6.6): al vencer con saldo, el remanente se reconoce como
 * ingreso_por_caducidad — SIEMPRE marcado pendiente de criterio fiscal (B3-P1).
 */
export function caducarVenta(
  venta: VentaBono,
  resumen: ResumenVentaBono,
  fecha: string,
): Caducidad {
  if (resumen.saldoUnidades <= 0) {
    throw new Error('Solo se caduca una venta con saldo de unidades > 0');
  }
  return {
    ventaId: venta.id,
    unidadesCaducadas: resumen.saldoUnidades,
    importe: resumen.pendienteDeDevengar,
    fecha,
    pendienteCriterioFiscal: true,
  };
}

/**
 * Devolución (doc 10 §6.7): solo unidades no consumidas, a devengo unitario;
 * nunca toca devengos ya registrados.
 */
export function devolverUnidades(
  venta: VentaBono,
  resumen: ResumenVentaBono,
  unidades: number,
  fecha: string,
  motivo: string,
): Devolucion {
  if (unidades <= 0 || unidades > resumen.saldoUnidades) {
    throw new Error('Solo se devuelven unidades no consumidas dentro del saldo');
  }
  return {
    ventaId: venta.id,
    unidades,
    importe: redondear(unidades * resumen.devengoUnitario),
    fecha,
    motivo,
  };
}
