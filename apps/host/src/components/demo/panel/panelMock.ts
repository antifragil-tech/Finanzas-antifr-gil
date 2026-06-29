// ─────────────────────────────────────────────────────────────────────────────
// DATOS DE DEMOSTRACIÓN del Panel de Dirección (Demo v0.2 · Fase 3).
//
// TODO es MOCK estático: NO hay Supabase, NO hay fetch, NO hay datos reales.
// Fuente ÚNICA y parametrizable por proyecto + periodo, para que las cifras sean
// coherentes entre bloques y entre selectores (no se duplican números sueltos).
// Cualquier parecido con la realidad es casualidad: son cifras ilustrativas.
// ─────────────────────────────────────────────────────────────────────────────

export const SOCIEDAD = 'Antifrágil S.C.';
export const PANEL_AVISO = 'Datos de demostración · sin conexión a backend';
export const ROL_AVISO = 'Vista demo por rol · no aplica permisos reales';

export type EstadoProyecto = 'Activo' | 'En preparación' | 'Diferido';
export type ProyectoId = 'todos' | 'clinica' | '9am' | 'lido' | 'eventos';
export type RolId = 'direccion' | 'responsable' | 'recepcion' | 'profesional';
export type FiltroId = 'hoy' | 'semana' | 'mes';
export type BloqueId =
  | 'hoy'
  | 'clinica'
  | 'tesoreria'
  | 'pendientes'
  | 'rentabilidad'
  | 'rentabilidadSimple'
  | 'proyectos'
  | 'accesos'
  | 'miActividad';

export const PROYECTOS: { id: ProyectoId; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'clinica', label: 'Clínica Antifrágil Playamar' },
  { id: '9am', label: '9 A.M.' },
  { id: 'lido', label: 'Lido Pro' },
  { id: 'eventos', label: 'Eventos' },
];

export const ROLES: { id: RolId; label: string }[] = [
  { id: 'direccion', label: 'Dirección' },
  { id: 'responsable', label: 'Responsable Clínica' },
  { id: 'recepcion', label: 'Recepción' },
  { id: 'profesional', label: 'Profesional' },
];

export const FILTROS: { id: FiltroId; label: string; factor: number }[] = [
  { id: 'hoy', label: 'Hoy', factor: 0.06 },
  { id: 'semana', label: 'Esta semana', factor: 0.28 },
  { id: 'mes', label: 'Este mes', factor: 1 },
];

// Qué bloques ve cada rol (simulación visual de permisos, NO permisos reales).
export const ROL_BLOQUES: Record<RolId, BloqueId[]> = {
  direccion: ['hoy', 'clinica', 'tesoreria', 'pendientes', 'rentabilidad', 'proyectos'],
  responsable: ['hoy', 'clinica', 'pendientes', 'rentabilidadSimple'],
  recepcion: ['hoy', 'clinica', 'pendientes', 'accesos'],
  profesional: ['hoy', 'miActividad'],
};

// Estado mock de cada proyecto (bloque Proyectos).
export const PROYECTOS_ESTADO: { id: ProyectoId; nombre: string; estado: EstadoProyecto }[] = [
  { id: 'clinica', nombre: 'Clínica Playamar', estado: 'Activo' },
  { id: '9am', nombre: '9 A.M.', estado: 'En preparación' },
  { id: 'lido', nombre: 'Lido Pro', estado: 'Diferido' },
  { id: 'eventos', nombre: 'Eventos', estado: 'Diferido' },
];

type Proxima = { hora: string; servicio: string; profesional: string } | null;

type ProyectoData = {
  contexto: string;
  diferido?: boolean;
  hoy: { citas: number; proxima: Proxima; completadas: number; pendientesConfirmar: number };
  clinica: { sesionesMes: number; ocupacionPct: number; servicios: string[] };
  tesoreria: { banco: number; caja: number; cobrosMes: number; pagosMes: number };
  pendientes: {
    cobrosMes: { importe: number; clientes: number };
    citasSinAbonarMes: number;
    vivofacil: string;
    facturasMes: number;
  };
  rentabilidad: {
    margenClinicaPct: number | null;
    porServicio: { servicio: string; margenPct: number }[];
    costeProfesionalSesion: number | null;
  };
};

// Valores base a escala MES. El periodo (hoy/semana) los escala en getPanel().
const DATA: Record<ProyectoId, ProyectoData> = {
  todos: {
    contexto: 'Visión global · todas las líneas',
    hoy: { citas: 8, proxima: { hora: '12:00', servicio: 'Nutrición', profesional: 'Sara' }, completadas: 3, pendientesConfirmar: 2 },
    clinica: { sesionesMes: 146, ocupacionPct: 72, servicios: ['Fisioterapia', 'Nutrición', 'Entrenamiento'] },
    tesoreria: { banco: 16800, caja: 1240, cobrosMes: 3080, pagosMes: 2660 },
    pendientes: { cobrosMes: { importe: 3080, clientes: 8 }, citasSinAbonarMes: 10, vivofacil: 'Pendiente de cierre', facturasMes: 4 },
    rentabilidad: {
      margenClinicaPct: 39,
      porServicio: [
        { servicio: 'Fisioterapia', margenPct: 43 },
        { servicio: 'Nutrición', margenPct: 36 },
        { servicio: 'Entrenamiento', margenPct: 29 },
      ],
      costeProfesionalSesion: 20,
    },
  },
  clinica: {
    contexto: 'Clínica · operativa',
    hoy: { citas: 7, proxima: { hora: '12:00', servicio: 'Fisioterapia', profesional: 'Lucía' }, completadas: 3, pendientesConfirmar: 2 },
    clinica: { sesionesMes: 128, ocupacionPct: 82, servicios: ['Fisioterapia', 'Nutrición', 'Entrenamiento'] },
    tesoreria: { banco: 14200, caja: 1240, cobrosMes: 2600, pagosMes: 1900 },
    pendientes: { cobrosMes: { importe: 2600, clientes: 6 }, citasSinAbonarMes: 9, vivofacil: 'Pendiente de cierre', facturasMes: 3 },
    rentabilidad: {
      margenClinicaPct: 41,
      porServicio: [
        { servicio: 'Fisioterapia', margenPct: 44 },
        { servicio: 'Nutrición', margenPct: 36 },
        { servicio: 'Entrenamiento', margenPct: 30 },
      ],
      costeProfesionalSesion: 20,
    },
  },
  '9am': {
    contexto: 'Comunidad y eventos',
    hoy: { citas: 1, proxima: { hora: '18:00', servicio: 'Evento comunidad', profesional: 'Equipo' }, completadas: 0, pendientesConfirmar: 1 },
    clinica: { sesionesMes: 18, ocupacionPct: 38, servicios: ['Comunidad', 'Eventos'] },
    tesoreria: { banco: 2600, caja: 0, cobrosMes: 480, pagosMes: 760 },
    pendientes: { cobrosMes: { importe: 480, clientes: 2 }, citasSinAbonarMes: 1, vivofacil: '—', facturasMes: 1 },
    rentabilidad: { margenClinicaPct: null, porServicio: [], costeProfesionalSesion: null },
  },
  lido: {
    contexto: 'En preparación · diferido',
    diferido: true,
    hoy: { citas: 0, proxima: null, completadas: 0, pendientesConfirmar: 0 },
    clinica: { sesionesMes: 0, ocupacionPct: 0, servicios: [] },
    tesoreria: { banco: 0, caja: 0, cobrosMes: 0, pagosMes: 0 },
    pendientes: { cobrosMes: { importe: 0, clientes: 0 }, citasSinAbonarMes: 0, vivofacil: '—', facturasMes: 0 },
    rentabilidad: { margenClinicaPct: null, porServicio: [], costeProfesionalSesion: null },
  },
  eventos: {
    contexto: 'Diferido',
    diferido: true,
    hoy: { citas: 0, proxima: null, completadas: 0, pendientesConfirmar: 0 },
    clinica: { sesionesMes: 0, ocupacionPct: 0, servicios: [] },
    tesoreria: { banco: 0, caja: 0, cobrosMes: 0, pagosMes: 0 },
    pendientes: { cobrosMes: { importe: 0, clientes: 0 }, citasSinAbonarMes: 0, vivofacil: '—', facturasMes: 0 },
    rentabilidad: { margenClinicaPct: null, porServicio: [], costeProfesionalSesion: null },
  },
};

export type PanelView = {
  contexto: string;
  diferido: boolean;
  filtroLabel: string;
  hoy: ProyectoData['hoy'];
  clinica: { sesiones: number; ocupacionPct: number; servicios: string[] };
  tesoreria: { banco: number; caja: number; cobros: number; pagos: number };
  pendientes: { cobros: { importe: number; clientes: number }; citasSinAbonar: number; vivofacil: string; facturas: number };
  rentabilidad: ProyectoData['rentabilidad'];
  miActividad: { sesionesHoy: number; proxima: Proxima; completadas: number };
};

// Selector puro (sin React, sin efectos): proyecto + periodo → vista del panel.
export function getPanel(proyecto: ProyectoId, filtro: FiltroId): PanelView {
  const d = DATA[proyecto];
  const f = FILTROS.find((x) => x.id === filtro);
  const factor = f ? f.factor : 1;
  const filtroLabel = f ? f.label : 'Este mes';
  const scale = (n: number) => Math.round(n * factor);
  return {
    contexto: d.contexto,
    diferido: Boolean(d.diferido),
    filtroLabel,
    hoy: d.hoy,
    clinica: { sesiones: scale(d.clinica.sesionesMes), ocupacionPct: d.clinica.ocupacionPct, servicios: d.clinica.servicios },
    tesoreria: { banco: d.tesoreria.banco, caja: d.tesoreria.caja, cobros: scale(d.tesoreria.cobrosMes), pagos: scale(d.tesoreria.pagosMes) },
    pendientes: {
      cobros: { importe: scale(d.pendientes.cobrosMes.importe), clientes: d.pendientes.cobrosMes.clientes },
      citasSinAbonar: scale(d.pendientes.citasSinAbonarMes),
      vivofacil: d.pendientes.vivofacil,
      facturas: scale(d.pendientes.facturasMes),
    },
    rentabilidad: d.rentabilidad,
    miActividad: { sesionesHoy: d.hoy.citas, proxima: d.hoy.proxima, completadas: d.hoy.completadas },
  };
}
