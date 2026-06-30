// ─────────────────────────────────────────────────────────────────────────────
// DATOS DE DEMOSTRACIÓN de las rutas del OS (Demo v0.2 · Fase 5).
//
// TODO es MOCK estático: NO hay Supabase, NO hay fetch, NO hay datos reales.
// Parametrizado por proyecto + periodo (y con acceso por rol) para que el
// contexto global se refleje en todas las pantallas de forma coherente.
// Reutiliza getPanel() para las cifras compartidas. Cifras ilustrativas.
// ─────────────────────────────────────────────────────────────────────────────

import {
  getPanel,
  PROYECTOS_ESTADO,
  ROLES,
  SOCIEDAD,
  FILTROS,
  type ProyectoId,
  type FiltroId,
  type RolId,
} from '../panel/panelMock';

export { SOCIEDAD, ROLES, PROYECTOS_ESTADO };

function factor(periodo: FiltroId): number {
  return FILTROS.find((f) => f.id === periodo)?.factor ?? 1;
}
function scale(n: number, periodo: FiltroId): number {
  return Math.round(n * factor(periodo));
}

// ── Acceso por rol (simulación visual, NO permisos reales) ───────────────────
export const acceso = {
  tesoreriaCompleta: (rol: RolId) => rol === 'direccion' || rol === 'responsable',
  tesoreriaSimplificada: (rol: RolId) => rol === 'recepcion',
  rentabilidad: (rol: RolId) => rol === 'direccion' || rol === 'responsable',
};

export function rolLabel(rol: RolId): string {
  return ROLES.find((r) => r.id === rol)?.label ?? rol;
}

// ── /financiero ──────────────────────────────────────────────────────────────
export type VencimientoTipo = 'pago' | 'cobro';
type Venc = { concepto: string; fecha: string; importe: number; tipo: VencimientoTipo };

const VENCIMIENTOS: Record<ProyectoId, Venc[]> = {
  todos: [
    { concepto: 'Alquiler clínica', fecha: '05/07', importe: 1500, tipo: 'pago' },
    { concepto: 'Cuota datáfono', fecha: '07/07', importe: 90, tipo: 'pago' },
    { concepto: 'Cobro mutua', fecha: '10/07', importe: 640, tipo: 'cobro' },
    { concepto: 'Seguro RC', fecha: '14/07', importe: 180, tipo: 'pago' },
  ],
  clinica: [
    { concepto: 'Alquiler clínica', fecha: '05/07', importe: 1500, tipo: 'pago' },
    { concepto: 'Cuota datáfono', fecha: '07/07', importe: 90, tipo: 'pago' },
    { concepto: 'Cobro mutua', fecha: '10/07', importe: 640, tipo: 'cobro' },
  ],
  '9am': [
    { concepto: 'Patrocinio evento', fecha: '12/07', importe: 300, tipo: 'pago' },
    { concepto: 'Cuota socios', fecha: '15/07', importe: 150, tipo: 'cobro' },
  ],
  lido: [],
  eventos: [],
};

const ALERTAS: Record<ProyectoId, string[]> = {
  todos: ['Caja en efectivo sin arqueo desde hace 3 días', '2 cobros vencen esta semana'],
  clinica: ['Caja en efectivo sin arqueo desde hace 3 días', 'Margen por debajo del objetivo (demo)'],
  '9am': ['Definir presupuesto de eventos', 'Captación de comunidad pendiente'],
  lido: ['Proyecto diferido · sin actividad financiera'],
  eventos: ['Proyecto diferido · sin actividad financiera'],
};

export function getFinanciero(proyecto: ProyectoId, periodo: FiltroId) {
  const p = getPanel(proyecto, periodo);
  return {
    tesoreria: p.tesoreria,
    diferido: p.diferido,
    vencimientos: VENCIMIENTOS[proyecto],
    alertas: ALERTAS[proyecto],
    a1: proyecto === 'todos' || proyecto === 'clinica'
      ? 'Tesorería A1 — separar efectivo y banco + arqueo de caja · pendiente (ver docs/finanzas/06)'
      : null,
  };
}

// ── /rentabilidad ────────────────────────────────────────────────────────────
const SES_BASE: Record<ProyectoId, number> = { todos: 136, clinica: 120, '9am': 16, lido: 0, eventos: 0 };
const ING_MEDIO: Record<ProyectoId, number> = { todos: 38, clinica: 42, '9am': 18, lido: 0, eventos: 0 };

export function getRentabilidad(proyecto: ProyectoId, periodo: FiltroId) {
  const r = getPanel(proyecto, 'mes').rentabilidad;
  return {
    sesionesCompletadas: scale(SES_BASE[proyecto], periodo),
    ingresoMedioSesion: ING_MEDIO[proyecto],
    costeProfesionalSesion: r.costeProfesionalSesion,
    porServicio: r.porServicio,
    proyectos: PROYECTOS_ESTADO.map((pe) => ({
      id: pe.id,
      label: pe.nombre,
      margen: getPanel(pe.id, 'mes').rentabilidad.margenClinicaPct,
      sesiones: scale(SES_BASE[pe.id], periodo),
    })),
  };
}

// ── /contabilidad ────────────────────────────────────────────────────────────
type ContaBase = { rec: number; emi: number; extr: number; inc: number; concil: number; asientos: number; docs: string[] };
const CONTA: Record<ProyectoId, ContaBase> = {
  todos: {
    rec: 5, emi: 3, extr: 2, inc: 2, concil: 82, asientos: 7,
    docs: ['IVA 2T 2026 (borrador)', 'Modelo 111 — retenciones IRPF', 'Resumen de facturas de junio', 'Extractos bancarios junio'],
  },
  clinica: {
    rec: 5, emi: 3, extr: 2, inc: 2, concil: 82, asientos: 7,
    docs: ['IVA 2T 2026 (borrador)', 'Modelo 111 — retenciones IRPF', 'Resumen de facturas de junio'],
  },
  '9am': { rec: 1, emi: 1, extr: 1, inc: 0, concil: 60, asientos: 2, docs: ['Resumen de eventos (borrador)'] },
  lido: { rec: 0, emi: 0, extr: 0, inc: 0, concil: 0, asientos: 0, docs: [] },
  eventos: { rec: 0, emi: 0, extr: 0, inc: 0, concil: 0, asientos: 0, docs: [] },
};

export function getContabilidad(proyecto: ProyectoId, periodo: FiltroId) {
  const c = CONTA[proyecto];
  return {
    recibidasPendientes: scale(c.rec, periodo),
    emitidasPendientes: scale(c.emi, periodo),
    extractosPendientes: c.extr,
    incidencias: c.inc,
    conciliadoPct: c.concil,
    asientosBorrador: c.asientos,
    documentosGestoria: c.docs,
    diferido: getPanel(proyecto, periodo).diferido,
  };
}

// ── /presupuestos (Proyectos) ────────────────────────────────────────────────
type Detalle = { responsable: string; prioridad: string; salud: string; hitos: string[] };
const DETALLE: Record<ProyectoId, Detalle> = {
  todos: { responsable: 'Dirección', prioridad: 'Alta', salud: 'Buena', hitos: ['Consolidar líneas', 'Cierre mensual'] },
  clinica: { responsable: 'María Moreno', prioridad: 'Alta', salud: 'Buena', hitos: ['Cierre mensual de caja', 'Implantar bonos', 'Arqueo de caja diario'] },
  '9am': { responsable: 'Equipo 9AM', prioridad: 'Media', salud: 'En preparación', hitos: ['Definir agenda de eventos', 'Captación de comunidad'] },
  lido: { responsable: '—', prioridad: 'Baja', salud: 'Diferido', hitos: ['Pendiente de arranque', 'Definir producto'] },
  eventos: { responsable: '—', prioridad: 'Baja', salud: 'Diferido', hitos: ['Pendiente de arranque'] },
};

export function getProyectos() {
  return PROYECTOS_ESTADO.map((pe) => ({
    id: pe.id,
    label: pe.nombre,
    estado: pe.estado,
    margen: getPanel(pe.id, 'mes').rentabilidad.margenClinicaPct,
    ...DETALLE[pe.id],
  }));
}

// ── /configuracion ───────────────────────────────────────────────────────────
export function getConfiguracion() {
  return {
    sociedad: SOCIEDAD,
    proyectos: PROYECTOS_ESTADO,
    roles: ROLES,
    modulos: [
      { nombre: 'Panel de Dirección', activo: true },
      { nombre: 'Clínica / Agenda', activo: true },
      { nombre: 'Finanzas Operativas', activo: false },
      { nombre: 'Rentabilidad', activo: false },
      { nombre: 'Contabilidad y Gestoría', activo: false },
      { nombre: 'Proyectos', activo: false },
      { nombre: 'Facturación', activo: false },
      { nombre: 'Configuración', activo: true },
    ],
  };
}

// ── /facturas ────────────────────────────────────────────────────────────────
export type EstadoFactura = 'pendiente' | 'revisada' | 'pagada' | 'incidencia';
type Factura = { numero: string; contraparte: string; importe: number; estado: EstadoFactura };
type Pago = { ref: string; concepto: string; importe: number; medio: string };
type Incidencia = { ref: string; tipo: string; severidad: string };

const RECIBIDAS: Record<ProyectoId, Factura[]> = {
  todos: [
    { numero: 'R-2026-014', contraparte: 'Suministros Médicos SL', importe: 340.2, estado: 'pendiente' },
    { numero: 'R-2026-013', contraparte: 'Endesa', importe: 128.5, estado: 'revisada' },
    { numero: 'R-2026-012', contraparte: 'Limpiezas Sur', importe: 210.0, estado: 'pagada' },
    { numero: 'R-2026-011', contraparte: 'Datáfono Redsys', importe: 90.0, estado: 'incidencia' },
  ],
  clinica: [
    { numero: 'R-2026-014', contraparte: 'Suministros Médicos SL', importe: 340.2, estado: 'pendiente' },
    { numero: 'R-2026-013', contraparte: 'Endesa', importe: 128.5, estado: 'revisada' },
    { numero: 'R-2026-012', contraparte: 'Limpiezas Sur', importe: 210.0, estado: 'pagada' },
  ],
  '9am': [{ numero: 'R-2026-020', contraparte: 'Catering evento', importe: 220.0, estado: 'pendiente' }],
  lido: [],
  eventos: [],
};

const EMITIDAS: Record<ProyectoId, Factura[]> = {
  todos: [
    { numero: 'E-2026-008', contraparte: 'Mutua XYZ', importe: 640.0, estado: 'pendiente' },
    { numero: 'E-2026-007', contraparte: 'Paciente particular', importe: 45.0, estado: 'pagada' },
    { numero: 'E-2026-006', contraparte: 'Empresa convenio', importe: 300.0, estado: 'revisada' },
  ],
  clinica: [
    { numero: 'E-2026-008', contraparte: 'Mutua XYZ', importe: 640.0, estado: 'pendiente' },
    { numero: 'E-2026-007', contraparte: 'Paciente particular', importe: 45.0, estado: 'pagada' },
  ],
  '9am': [{ numero: 'E-2026-021', contraparte: 'Patrocinador', importe: 500.0, estado: 'pendiente' }],
  lido: [],
  eventos: [],
};

const PAGOS: Record<ProyectoId, Pago[]> = {
  todos: [
    { ref: 'P-031', concepto: 'Pago Endesa', importe: 128.5, medio: 'transferencia' },
    { ref: 'P-030', concepto: 'Cobro Mutua XYZ', importe: 640.0, medio: 'transferencia' },
    { ref: 'P-029', concepto: 'Cobro datáfono', importe: 45.0, medio: 'tarjeta' },
  ],
  clinica: [
    { ref: 'P-031', concepto: 'Pago Endesa', importe: 128.5, medio: 'transferencia' },
    { ref: 'P-029', concepto: 'Cobro datáfono', importe: 45.0, medio: 'tarjeta' },
  ],
  '9am': [{ ref: 'P-040', concepto: 'Cobro patrocinio', importe: 500.0, medio: 'transferencia' }],
  lido: [],
  eventos: [],
};

const INCIDENCIAS: Record<ProyectoId, Incidencia[]> = {
  todos: [
    { ref: 'R-2026-011', tipo: 'Importe no coincide', severidad: 'media' },
    { ref: 'E-2026-008', tipo: 'Falta justificante', severidad: 'baja' },
  ],
  clinica: [{ ref: 'R-2026-011', tipo: 'Importe no coincide', severidad: 'media' }],
  '9am': [],
  lido: [],
  eventos: [],
};

export function getFacturas(proyecto: ProyectoId) {
  return {
    recibidas: RECIBIDAS[proyecto],
    emitidas: EMITIDAS[proyecto],
    pagos: PAGOS[proyecto],
    incidencias: INCIDENCIAS[proyecto],
    diferido: getPanel(proyecto, 'mes').diferido,
  };
}
