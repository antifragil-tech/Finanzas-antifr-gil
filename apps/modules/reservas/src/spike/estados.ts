import type { EstadoCita, EstadoPago } from './mockData';

type BadgeTone = 'blue' | 'emerald' | 'rose' | 'amber' | 'violet' | 'zinc';

export interface EstadoMeta {
  label: string;
  tone: BadgeTone;
  // Colores sutiles para el evento (vía onBeforeEventRender). Poca saturación,
  // back translúcido + borde suave (sensación glass).
  bar: string;
  back: string;
  border: string;
  font: string;
}

// Semántica del OS: amber=pendiente · blue=confirmada · emerald=completada ·
// rose=no-show/cancelada · violet=reprogramada · zinc=neutro.
export const ESTADO_META: Record<EstadoCita, EstadoMeta> = {
  pendiente: {
    label: 'Pendiente',
    tone: 'amber',
    bar: '#f59e0b',
    back: 'rgba(245, 158, 11, 0.10)',
    border: 'rgba(245, 158, 11, 0.22)',
    font: '#e8e8ea',
  },
  confirmada: {
    label: 'Confirmada',
    tone: 'blue',
    bar: '#3b82f6',
    back: 'rgba(59, 130, 246, 0.10)',
    border: 'rgba(96, 165, 250, 0.22)',
    font: '#e8e8ea',
  },
  completada: {
    label: 'Completada',
    tone: 'emerald',
    bar: '#10b981',
    back: 'rgba(16, 185, 129, 0.10)',
    border: 'rgba(52, 211, 153, 0.22)',
    font: '#e8e8ea',
  },
  no_asiste: {
    label: 'No-show',
    tone: 'rose',
    bar: '#f43f5e',
    back: 'rgba(244, 63, 94, 0.10)',
    border: 'rgba(251, 113, 133, 0.26)',
    font: '#e8e8ea',
  },
  cancelada: {
    label: 'Cancelada',
    tone: 'rose',
    bar: '#9f1239',
    back: 'rgba(244, 63, 94, 0.06)',
    border: 'rgba(251, 113, 133, 0.18)',
    font: '#a1a1aa',
  },
  reprogramada: {
    label: 'Reprogramada',
    tone: 'violet',
    bar: '#a78bfa',
    back: 'rgba(139, 92, 246, 0.10)',
    border: 'rgba(167, 139, 250, 0.22)',
    font: '#e8e8ea',
  },
};

export const PAGO_LABEL: Record<EstadoPago, string> = {
  pendiente_pago: 'Pendiente de pago',
  pagado: 'Pagado',
  pago_parcial: 'Pago parcial',
  incluido_bono: 'Incluido en bono',
  incluido_programa: 'Incluido en programa',
  pendiente_revision: 'Pendiente de revisión',
  devuelto: 'Devuelto',
  no_requiere_pago: 'No requiere pago',
};

// Etiqueta corta para el badge dentro del evento del calendario.
export const PAGO_CORTO: Record<EstadoPago, string> = {
  pendiente_pago: 'Pend.',
  pagado: 'Pagado',
  pago_parcial: 'Parcial',
  incluido_bono: 'Bono',
  incluido_programa: 'Programa',
  pendiente_revision: 'Revisión',
  devuelto: 'Devuelto',
  no_requiere_pago: 'No req.',
};

export const PAGO_TONE: Record<EstadoPago, BadgeTone> = {
  pendiente_pago: 'amber',
  pagado: 'emerald',
  pago_parcial: 'amber',
  incluido_bono: 'violet',
  incluido_programa: 'violet',
  pendiente_revision: 'amber',
  devuelto: 'rose',
  no_requiere_pago: 'zinc',
};

// Color del puntito de pago dentro del evento (coherente con los tonos).
export const PAGO_DOT: Record<EstadoPago, string> = {
  pendiente_pago: '#f59e0b',
  pagado: '#10b981',
  pago_parcial: '#f59e0b',
  incluido_bono: '#a78bfa',
  incluido_programa: '#a78bfa',
  pendiente_revision: '#f59e0b',
  devuelto: '#f43f5e',
  no_requiere_pago: '#71717a',
};

// Citas "completadas pero sin abonar" → alerta operativa.
export const PAGO_SIN_ABONAR: EstadoPago[] = ['pendiente_pago', 'pendiente_revision', 'pago_parcial'];
