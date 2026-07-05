// Catálogo seguro del contexto global de Antifrágil OS.
// Solo identificadores y etiquetas de interfaz: sin datos económicos, sin
// pacientes, sin datos clínicos, sin Supabase. Los centros/proyectos son
// unidades de negocio ya públicas dentro del OS (mismos nombres que usan los
// docs de finanzas y el plan de split).

export type CentroId =
  | 'antifragil_global'
  | 'clinica_playamar'
  | 'lidomare'
  | 'vivofacil'
  | 'oasis'
  | 'nine_am_club';

export type RolId = 'ceo' | 'coordinacion' | 'recepcion' | 'profesional';

export type PeriodoId = 'hoy' | 'esta_semana' | 'este_mes' | 'trimestre' | 'personalizado_mock';

export const CENTROS: { id: CentroId; label: string; nota?: string }[] = [
  { id: 'antifragil_global', label: 'Antifrágil (global)' },
  { id: 'clinica_playamar', label: 'Clínica Playamar' },
  { id: 'lidomare', label: 'Lidomare', nota: 'centro asociado' },
  { id: 'vivofacil', label: 'Vivofácil', nota: 'canal B2B' },
  { id: 'oasis', label: 'Oasis', nota: 'pendiente de definir' },
  { id: 'nine_am_club', label: '9AM Club', nota: 'pendiente de definir' },
];

export const ROLES: { id: RolId; label: string }[] = [
  { id: 'ceo', label: 'CEO' },
  { id: 'coordinacion', label: 'Coordinación' },
  { id: 'recepcion', label: 'Recepción' },
  { id: 'profesional', label: 'Profesional' },
];

export const PERIODOS: { id: PeriodoId; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'esta_semana', label: 'Esta semana' },
  { id: 'este_mes', label: 'Este mes' },
  { id: 'trimestre', label: 'Trimestre' },
  { id: 'personalizado_mock', label: 'Personalizado (mock)' },
];

export const CONTEXTO_INICIAL = {
  centro: 'antifragil_global' as CentroId,
  periodo: 'hoy' as PeriodoId,
  rol: 'ceo' as RolId,
};

export function centroLabel(id: CentroId): string {
  return CENTROS.find((c) => c.id === id)?.label ?? id;
}
export function rolLabel(id: RolId): string {
  return ROLES.find((r) => r.id === id)?.label ?? id;
}
export function periodoLabel(id: PeriodoId): string {
  return PERIODOS.find((p) => p.id === id)?.label ?? id;
}
