import { formatCurrency } from '@alsari/utils';
import {
  escaleraMargen,
  estadoValidacion,
  gastosDemo,
  ingresosDemo,
  liquidacionesDemo,
} from '@antifragil/operativa';
import type { CentroId, PeriodoId, RolId } from '../context/osGlobalOptions';

// ─────────────────────────────────────────────────────────────────────────────
// Datos ficticios de interfaz. No representan actividad real de Antifrágil.
// Recuentos inventados y sin importes económicos; existen solo para que el
// dashboard tenga forma mientras los módulos reales no están conectados.
// Sin Supabase, sin fetch, sin datos clínicos, sin nombres de pacientes.
// ─────────────────────────────────────────────────────────────────────────────

export type Tone = 'neutral' | 'ok' | 'warn' | 'info';

export type MockKpi = {
  id: string;
  label: string;
  valor: string;
  hint?: string;
  tone?: Tone;
  roles: RolId[];
};

export type MockAlerta = {
  id: string;
  texto: string;
  tone: Tone;
  roles: RolId[];
};

export type MockModulo = {
  id: string;
  nombre: string;
  detalle: string;
  fuente: string;
  estado: 'diseño' | 'draft' | 'no_apply';
};

// Factor puramente cosmético para que cambiar el periodo se note en la UI.
const FACTOR: Record<PeriodoId, number> = {
  hoy: 1,
  esta_semana: 5,
  este_mes: 20,
  trimestre: 60,
  personalizado_mock: 10,
};

// Idem para el centro: global muestra más volumen que un centro individual.
const PESO_CENTRO: Record<CentroId, number> = {
  antifragil_global: 1,
  clinica_playamar: 0.7,
  lidomare: 0.2,
  vivofacil: 0.15,
  oasis: 0,
  nine_am_club: 0,
};

function n(base: number, periodo: PeriodoId, centro: CentroId): string {
  return String(Math.round(base * FACTOR[periodo] * PESO_CENTRO[centro]));
}

const ESCALERA = escaleraMargen(ingresosDemo(), gastosDemo());
const GASTOS_BLOQUEADOS = gastosDemo().filter(
  (g) => estadoValidacion(g) === 'bloqueado_sin_documento',
).length;
const LIQ_BLOQUEADAS = liquidacionesDemo().filter(
  (l) => l.estado === 'bloqueada_por_incidencia' || !l.evidencia.recibida,
).length;

export function getResumenOperativo(centro: CentroId, periodo: PeriodoId): MockKpi[] {
  return [
    {
      id: 'citas',
      label: 'Citas',
      valor: n(12, periodo, centro),
      hint: 'mock',
      roles: ['ceo', 'coordinacion', 'recepcion'],
    },
    {
      id: 'cobros',
      label: 'Cobros pendientes',
      valor: n(3, periodo, centro),
      hint: 'mock',
      tone: 'warn',
      roles: ['ceo', 'coordinacion', 'recepcion'],
    },
    {
      id: 'liquidaciones',
      label: 'Liquidaciones pendientes',
      valor: n(4, periodo, centro),
      hint: 'mock · FOP-B1',
      tone: 'warn',
      roles: ['ceo'],
    },
    {
      id: 'bonos',
      label: 'Bonos activos',
      valor: n(9, periodo, centro),
      hint: 'mock · FOP-B3',
      tone: 'info',
      roles: ['ceo', 'coordinacion'],
    },
    {
      id: 'incidencias',
      label: 'Incidencias',
      valor: n(3, periodo, centro),
      hint: 'mock',
      tone: 'warn',
      roles: ['ceo', 'coordinacion', 'recepcion'],
    },
    {
      id: 'margen',
      label: 'Margen operativo (M3)',
      valor: formatCurrency(ESCALERA.m3 * FACTOR[periodo] * PESO_CENTRO[centro]),
      hint: ESCALERA.provisional ? 'provisional · conceptos por confirmar' : 'escenario demo',
      tone: ESCALERA.m3 >= 0 ? 'ok' : 'warn',
      roles: ['ceo'],
    },
  ];
}

export function getActividadPropia(periodo: PeriodoId): MockKpi[] {
  // Vista del rol profesional: solo SU actividad, sin datos de terceros.
  const f = FACTOR[periodo];
  return [
    {
      id: 'mis-citas',
      label: 'Mis citas',
      valor: String(5 * f),
      hint: 'mock',
      roles: ['profesional'],
    },
    {
      id: 'mis-pendientes',
      label: 'Pendientes de validar',
      valor: String(Math.max(1, Math.round(f / 2))),
      hint: 'mock',
      tone: 'warn',
      roles: ['profesional'],
    },
    {
      id: 'mi-liquidacion',
      label: 'Mi liquidación',
      valor: 'n/d',
      hint: 'módulo no conectado',
      roles: ['profesional'],
    },
  ];
}

export const FINANZAS_OPERATIVAS: MockKpi[] = [
  {
    id: 'caja',
    label: 'Caja',
    valor: '—',
    hint: 'pendiente de configurar (FOP-A1)',
    roles: ['ceo'],
  },
  {
    id: 'tesoreria',
    label: 'Tesorería',
    valor: '—',
    hint: 'PR #4 · NO APPLY',
    roles: ['ceo'],
  },
  {
    id: 'cxc-cxp',
    label: 'CxC / CxP',
    valor: '—',
    hint: 'diseño FOP-A2 (PR #20)',
    roles: ['ceo'],
  },
  {
    id: 'rentabilidad',
    label: 'Rentabilidad',
    valor: '—',
    hint: 'diseño FOP-B2 (PR #15)',
    roles: ['ceo'],
  },
  {
    id: 'forecast',
    label: 'Forecast',
    valor: '—',
    hint: 'diseño FOP-D1 (PR #22)',
    roles: ['ceo'],
  },
];

export const MODULOS_CONECTADOS: MockModulo[] = [
  {
    id: 'reservas',
    nombre: 'Reservas',
    detalle: 'Agenda, cobros y pendientes de recepción',
    fuente: 'PR #5 (canónico)',
    estado: 'draft',
  },
  {
    id: 'facturacion',
    nombre: 'Facturación',
    detalle: 'Facturación emitida — OS precontable',
    fuente: 'PR #1',
    estado: 'diseño',
  },
  {
    id: 'tesoreria',
    nombre: 'Tesorería',
    detalle: 'Caja/banco + arqueo (FOP-A1)',
    fuente: 'PR #4',
    estado: 'no_apply',
  },
  {
    id: 'liquidaciones',
    nombre: 'Liquidaciones',
    detalle: 'Equipo y pagos profesionales (FOP-B1)',
    fuente: 'PR #13',
    estado: 'diseño',
  },
  {
    id: 'rentabilidad',
    nombre: 'Rentabilidad',
    detalle: 'Margen por sesión/servicio/canal/centro (FOP-B2)',
    fuente: 'PR #15',
    estado: 'diseño',
  },
  {
    id: 'bonos',
    nombre: 'Bonos y devengo',
    detalle: 'Programas y reconocimiento de ingreso (FOP-B3)',
    fuente: 'PR #19',
    estado: 'diseño',
  },
];

export const ALERTAS: MockAlerta[] = [
  {
    id: 'documentos-pendientes',
    texto: `${GASTOS_BLOQUEADOS} pagos bloqueados sin documento y ${LIQ_BLOQUEADAS} liquidaciones sin nómina/factura`,
    tone: 'warn',
    roles: ['ceo'],
  },
  {
    id: 'sesiones-cobro',
    texto: 'Hay sesiones pendientes de cobro',
    tone: 'warn',
    roles: ['ceo', 'coordinacion', 'recepcion'],
  },
  {
    id: 'liquidaciones-validar',
    texto: 'Hay liquidaciones pendientes de validar',
    tone: 'warn',
    roles: ['ceo'],
  },
  {
    id: 'bonos-devengar',
    texto: 'Hay bonos pendientes de devengar',
    tone: 'info',
    roles: ['ceo', 'coordinacion'],
  },
  {
    id: 'tesoreria-no-apply',
    texto: 'Tesorería pendiente de conexión (NO APPLY)',
    tone: 'neutral',
    roles: ['ceo'],
  },
];
