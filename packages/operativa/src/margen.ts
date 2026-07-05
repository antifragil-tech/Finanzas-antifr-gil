/**
 * Rentabilidad operativa (doc 09).
 *
 * M1 = ingreso devengado − coste profesional (por sesión).
 * M2 = M1 − otros costes directos imputables.
 * M3 = Σ M2 − costes fijos imputados (proyecto/centro/mes).
 * M4 = Σ M3 − costes generales de estructura.
 *
 * Los márgenes son vistas derivadas, nunca datos almacenados (§6.2). Las
 * vistas devengo y caja se muestran por separado y JAMÁS se suman (§4.4).
 */

import { redondear } from './devengo';
import type { Centro, HechoSesion, MargenAgregado, MargenOperativoM3, MargenSesion } from './types';

export function margenSesion(hecho: HechoSesion): MargenSesion {
  const m1 = redondear(hecho.ingresoDevengado - hecho.costeProfesional);
  return {
    sesionId: hecho.sesionId,
    m1,
    m2: redondear(m1 - hecho.otrosCostesDirectos),
  };
}

export type DimensionMargen =
  | 'profesionalId'
  | 'servicio'
  | 'canalId'
  | 'centroId'
  | 'clienteId'
  | 'tipoVenta';

/** Agrega M1/M2 por una dimensión de análisis (doc 09 §5). */
export function agregarMargen(hechos: HechoSesion[], dimension: DimensionMargen): MargenAgregado[] {
  const grupos = new Map<string, HechoSesion[]>();
  for (const h of hechos) {
    const clave = h[dimension];
    const lista = grupos.get(clave) ?? [];
    lista.push(h);
    grupos.set(clave, lista);
  }
  return [...grupos.entries()].map(([clave, lista]) => {
    const ingresoDevengado = redondear(lista.reduce((s, h) => s + h.ingresoDevengado, 0));
    const costeProfesional = redondear(lista.reduce((s, h) => s + h.costeProfesional, 0));
    const otrosCostesDirectos = redondear(lista.reduce((s, h) => s + h.otrosCostesDirectos, 0));
    const m1 = redondear(ingresoDevengado - costeProfesional);
    return {
      clave,
      sesiones: lista.length,
      ingresoDevengado,
      costeProfesional,
      otrosCostesDirectos,
      m1,
      m2: redondear(m1 - otrosCostesDirectos),
    };
  });
}

/**
 * M3 de un centro/proyecto en el mes. Si el acuerdo económico del centro está
 * pendiente_confirmar, el margen se marca incompleto (B2-P3): nunca un margen
 * falsamente alto.
 */
export function margenOperativoM3(
  centro: Centro,
  hechosDelCentro: HechoSesion[],
  costesFijosImputados: number,
): MargenOperativoM3 {
  const sumaM2 = redondear(hechosDelCentro.reduce((s, h) => s + margenSesion(h).m2, 0));
  return {
    clave: centro.id,
    sumaM2,
    costesFijosImputados,
    m3: redondear(sumaM2 - costesFijosImputados),
    incompleto: centro.tipoAcuerdo === 'pendiente_confirmar',
  };
}

/** M4 = Σ M3 − costes generales de estructura (doc 09 §4). */
export function resultadoOperativoM4(
  margenes: MargenOperativoM3[],
  costesGenerales: number,
): { m4: number; incompleto: boolean } {
  const suma = redondear(margenes.reduce((s, m) => s + m.m3, 0));
  return {
    m4: redondear(suma - costesGenerales),
    incompleto: margenes.some((m) => m.incompleto),
  };
}
