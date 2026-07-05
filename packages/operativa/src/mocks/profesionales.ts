/**
 * Equipo con las reglas operativas EXACTAS del doc 08 §2/§4.
 * Importes = reglas operativas de liquidación, no contratos.
 * Los casos pendientes se modelan como ESTADO, nunca se ocultan (R4).
 */

import type { Profesional } from '../types';

export const PROFESIONALES: Profesional[] = [
  {
    id: 'prof-lidia',
    nombre: 'Lidia Muesa',
    rol: 'recepcion',
    relacion: 'nomina_compartida',
    terceroCopagador: 'Lidomare',
    reglas: [{ tipo: 'nomina_compartida', importe: 400, unidad: 'eur_mes', confirmada: true }],
    notas: 'Antifrágil paga 400 €/mes fijos; el resto lo paga Lidomare (doc 08 §4.2).',
  },
  {
    id: 'prof-maria-moreno',
    nombre: 'María Moreno',
    rol: 'fisioterapeuta',
    relacion: 'nomina',
    // El importe exacto lo fija la nómina mensual de gestoría (doc 08 §4.1).
    // Cifra mock ilustrativa — NO es el dato real (no documentado en los docs).
    reglas: [{ tipo: 'nomina_fija', importe: 1400, unidad: 'eur_mes', confirmada: true }],
    notas:
      'Nómina mensual (documento de gestoría manda). Parte coordinación pendiente de criterio (B2-P6).',
  },
  {
    id: 'prof-maria-solis',
    nombre: 'María Solís',
    rol: 'fisioterapeuta',
    relacion: 'autonomo',
    reglas: [{ tipo: 'por_sesion', importe: 30, unidad: 'eur_sesion', confirmada: true }],
  },
  {
    id: 'prof-cecilia',
    nombre: 'Cecilia',
    rol: 'fisioterapeuta',
    relacion: 'autonomo',
    reglas: [{ tipo: 'por_sesion', importe: 20, unidad: 'eur_sesion', confirmada: true }],
  },
  {
    id: 'prof-marta',
    nombre: 'Marta',
    rol: 'nutricionista',
    relacion: 'autonomo',
    reglas: [
      { tipo: 'por_sesion', importe: 35, unidad: 'eur_sesion', confirmada: true },
      // Regla de plan PENDIENTE DE CONFIRMAR (B1-P1): bloquea avance sin CEO.
      { tipo: 'mensual_por_plan', importe: 30, unidad: 'eur_mes_cliente', confirmada: false },
    ],
    notas: '35 €/sesión suelta; 30 €/mes·cliente en plan multi-mes (regla de plan sin confirmar).',
  },
  {
    id: 'prof-carlos',
    nombre: 'Carlos',
    rol: 'entrenador',
    relacion: 'pendiente_regularizar',
    reglas: [
      { tipo: 'pendiente_regularizar', importe: 25, unidad: 'eur_sesion', confirmada: true },
    ],
    notas:
      'Pendiente de regularización (doc 08 §4.5): el cálculo aflora la deuda, la liquidación queda bloqueada_por_incidencia. Nunca flujo opaco.',
  },
];

export function getProfesional(id: string): Profesional | undefined {
  return PROFESIONALES.find((p) => p.id === id);
}

/** Tarifa por sesión de un profesional (para el coste del hecho económico). */
export function costePorSesion(id: string): number {
  const p = getProfesional(id);
  const regla = p?.reglas.find(
    (r) => r.tipo === 'por_sesion' || r.tipo === 'pendiente_regularizar',
  );
  return regla?.importe ?? 0;
}
