// ─────────────────────────────────────────────────────────────────────────────
// DATOS DE DEMOSTRACIÓN de las rutas secundarias del OS (Demo v0.2 · Fase 4).
//
// TODO es MOCK estático: NO hay Supabase, NO hay fetch, NO hay datos reales.
// Reutiliza getPanel() del Panel de Dirección para que las cifras compartidas
// (tesorería, rentabilidad por proyecto, estados) sean COHERENTES y no se
// dupliquen contradiciéndose. Cifras ilustrativas, nunca fiscales/reales.
// ─────────────────────────────────────────────────────────────────────────────

import { getPanel, SOCIEDAD, ROLES, PROYECTOS_ESTADO, type ProyectoId } from '../panel/panelMock';

export { SOCIEDAD, ROLES, PROYECTOS_ESTADO };

// ── /financiero ──────────────────────────────────────────────────────────────
export type VencimientoTipo = 'pago' | 'cobro';

export const demoFinanciero = {
  tesoreria: getPanel('todos', 'mes').tesoreria, // banco / caja / cobros / pagos (global)
  vencimientos: [
    { concepto: 'Alquiler clínica', fecha: '05/07', importe: 1500, tipo: 'pago' as VencimientoTipo },
    { concepto: 'Cuota datáfono', fecha: '07/07', importe: 90, tipo: 'pago' as VencimientoTipo },
    { concepto: 'Cobro mutua', fecha: '10/07', importe: 640, tipo: 'cobro' as VencimientoTipo },
    { concepto: 'Seguro RC', fecha: '14/07', importe: 180, tipo: 'pago' as VencimientoTipo },
  ],
  alertas: [
    'Caja en efectivo sin arqueo desde hace 3 días',
    '2 cobros vencen esta semana',
    'Tesorería A1 (efectivo vs banco + arqueo) pendiente de implementar',
  ],
  a1: 'Tesorería A1 — separar efectivo y banco + arqueo de caja · pendiente (ver docs/finanzas/06)',
};

// ── /rentabilidad ────────────────────────────────────────────────────────────
function rp(id: ProyectoId, label: string, sesionesCompletadas: number, ingresoMedioSesion: number) {
  const r = getPanel(id, 'mes').rentabilidad;
  return {
    id,
    label,
    margen: r.margenClinicaPct,
    porServicio: r.porServicio,
    coste: r.costeProfesionalSesion,
    sesionesCompletadas,
    ingresoMedioSesion,
  };
}

export const demoRentabilidad = {
  proyectos: [
    rp('clinica', 'Clínica Antifrágil Playamar', 120, 42),
    rp('9am', '9 A.M.', 16, 18),
    rp('lido', 'Lido Pro', 0, 0),
    rp('eventos', 'Eventos', 0, 0),
  ],
  porServicio: getPanel('clinica', 'mes').rentabilidad.porServicio, // Fisio / Nutrición / Entreno
  sesionesCompletadas: 136,
  ingresoMedioSesion: 38,
  costeProfesionalSesion: getPanel('clinica', 'mes').rentabilidad.costeProfesionalSesion ?? 20,
};

// ── /contabilidad ────────────────────────────────────────────────────────────
export const demoContabilidad = {
  facturasRecibidasPendientes: 5,
  facturasEmitidasPendientes: 3,
  extractosPendientes: 2,
  incidencias: 2,
  estadoMensual: { mes: 'Junio 2026', conciliadoPct: 82, asientosBorrador: 7 },
  documentosGestoria: [
    'IVA 2T 2026 (borrador)',
    'Modelo 111 — retenciones IRPF',
    'Resumen de facturas de junio',
    'Extractos bancarios junio',
  ],
};

// ── /presupuestos (Proyectos) ────────────────────────────────────────────────
function pd(
  id: ProyectoId,
  label: string,
  responsable: string,
  prioridad: string,
  salud: string,
  hitos: string[],
) {
  return { id, label, responsable, prioridad, salud, margen: getPanel(id, 'mes').rentabilidad.margenClinicaPct, hitos };
}

export const demoProyectos = [
  pd('clinica', 'Clínica Antifrágil Playamar', 'María Moreno', 'Alta', 'Buena', [
    'Cierre mensual de caja',
    'Implantar bonos',
    'Arqueo de caja diario',
  ]),
  pd('9am', '9 A.M.', 'Equipo 9AM', 'Media', 'En preparación', ['Definir agenda de eventos', 'Captación de comunidad']),
  pd('lido', 'Lido Pro', '—', 'Baja', 'Diferido', ['Pendiente de arranque']),
  pd('eventos', 'Eventos', '—', 'Baja', 'Diferido', ['Pendiente de arranque']),
];

// ── /configuracion ───────────────────────────────────────────────────────────
export const demoConfiguracion = {
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

// ── /facturas ────────────────────────────────────────────────────────────────
export type EstadoFactura = 'pendiente' | 'revisada' | 'pagada' | 'incidencia';

export const demoFacturas = {
  recibidas: [
    { numero: 'R-2026-014', contraparte: 'Suministros Médicos SL', importe: 340.2, estado: 'pendiente' as EstadoFactura },
    { numero: 'R-2026-013', contraparte: 'Endesa', importe: 128.5, estado: 'revisada' as EstadoFactura },
    { numero: 'R-2026-012', contraparte: 'Limpiezas Sur', importe: 210.0, estado: 'pagada' as EstadoFactura },
    { numero: 'R-2026-011', contraparte: 'Datáfono Redsys', importe: 90.0, estado: 'incidencia' as EstadoFactura },
  ],
  emitidas: [
    { numero: 'E-2026-008', contraparte: 'Mutua XYZ', importe: 640.0, estado: 'pendiente' as EstadoFactura },
    { numero: 'E-2026-007', contraparte: 'Paciente particular', importe: 45.0, estado: 'pagada' as EstadoFactura },
    { numero: 'E-2026-006', contraparte: 'Empresa convenio', importe: 300.0, estado: 'revisada' as EstadoFactura },
  ],
  pagos: [
    { ref: 'P-031', concepto: 'Pago Endesa', importe: 128.5, medio: 'transferencia' },
    { ref: 'P-030', concepto: 'Cobro Mutua XYZ', importe: 640.0, medio: 'transferencia' },
    { ref: 'P-029', concepto: 'Cobro datáfono', importe: 45.0, medio: 'tarjeta' },
  ],
  incidencias: [
    { ref: 'R-2026-011', tipo: 'Importe no coincide', severidad: 'media' },
    { ref: 'E-2026-008', tipo: 'Falta justificante', severidad: 'baja' },
  ],
};
