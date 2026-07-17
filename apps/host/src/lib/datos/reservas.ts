import { datosRealesDisponibles, rest } from './fuenteDatos';

/**
 * Capa de datos de RESERVAS (solo servidor): lee la agenda real de Supabase
 * (clinica_citas + catálogos clinica_*) y la mapea al vocabulario del módulo
 * @alsari/reservas (shape de CitaMock). Sin entorno → el módulo sigue en su
 * escenario demo, como el resto del OS.
 *
 * El mapeo de estados BD↔módulo es deliberadamente explícito: la BD tiene el
 * ciclo completo (reservada…liquidada, canceladas con matiz); la UI de
 * recepción trabaja con el vocabulario corto de la propuesta v0.2.
 */

// ── Tipos "wire" (estructuralmente idénticos a los del módulo) ──────────────

export type EstadoCitaAgenda =
  | 'pendiente'
  | 'confirmada'
  | 'completada'
  | 'cancelada'
  | 'no_asiste'
  | 'reprogramada';

export type EstadoPagoAgenda =
  | 'pendiente_pago'
  | 'pagado'
  | 'pago_parcial'
  | 'incluido_bono'
  | 'incluido_programa'
  | 'pendiente_revision'
  | 'devuelto'
  | 'no_requiere_pago';

export type OrigenCitaAgenda = 'directo' | 'vivofacil' | 'oasis' | 'lidomare' | 'otro';

export interface CitaAgenda {
  id: string;
  cliente_nombre: string;
  profesional_id: string;
  sala_id: string | null;
  servicio_id: string;
  etiqueta?: string;
  origen: OrigenCitaAgenda;
  inicio: string; // ISO local "YYYY-MM-DDTHH:mm:ss" (Europe/Madrid)
  fin: string;
  estado_cita: EstadoCitaAgenda;
  estado_pago: EstadoPagoAgenda;
  precio_previsto: number;
  cambios: { ts: string; accion: string; detalle: string }[];
}

export interface ProfesionalAgenda {
  id: string;
  nombre: string;
  rol: string;
}

export interface ServicioAgenda {
  id: string;
  nombre: string;
  categoria: 'fisioterapia' | 'entrenamiento_personal' | 'nutricion';
  duracion_minutos: number;
  precio: number;
}

export interface AgendaReal {
  profesionales: ProfesionalAgenda[];
  servicios: ServicioAgenda[];
  citas: CitaAgenda[];
}

// ── Filas PostgREST ─────────────────────────────────────────────────────────

type EstadoCitaBD =
  | 'reservada'
  | 'confirmada'
  | 'realizada'
  | 'validada'
  | 'liquidada'
  | 'cancelada_a_tiempo'
  | 'cancelada_tarde'
  | 'no_show';

interface FilaCita {
  id: string;
  cliente_id: string;
  profesional_id: string;
  servicio_id: string;
  canal_id: string | null;
  inicio: string;
  fin: string;
  estado: EstadoCitaBD;
  tipo_venta: string;
  precio_snapshot: number | null;
  notas_admin: string | null;
  clinica_clientes: { nombre: string; apellidos: string | null } | null;
}

interface FilaProfesional {
  id: string;
  nombre: string;
  rol_texto?: string | null;
  especialidad?: string | null;
  activo: boolean;
}

interface FilaServicio {
  id: string;
  nombre: string;
  categoria: string;
  duracion_minutos: number;
  precio_base: number | null;
  activo: boolean;
}

interface FilaCanal {
  id: string;
  nombre: string;
}

interface FilaCobroCita {
  origen_id: string | null;
  importe: number;
}

// ── Mapeos ──────────────────────────────────────────────────────────────────

export const ESTADO_BD_A_AGENDA: Record<EstadoCitaBD, EstadoCitaAgenda> = {
  reservada: 'pendiente',
  confirmada: 'confirmada',
  realizada: 'completada',
  validada: 'completada',
  liquidada: 'completada',
  cancelada_a_tiempo: 'cancelada',
  cancelada_tarde: 'cancelada',
  no_show: 'no_asiste',
};

export const ESTADO_AGENDA_A_BD: Record<Exclude<EstadoCitaAgenda, 'reprogramada'>, EstadoCitaBD> = {
  pendiente: 'reservada',
  confirmada: 'confirmada',
  completada: 'realizada',
  cancelada: 'cancelada_a_tiempo',
  no_asiste: 'no_show',
};

function categoriaServicio(cat: string): ServicioAgenda['categoria'] {
  const c = cat.toLowerCase();
  if (c.includes('entren')) return 'entrenamiento_personal';
  if (c.includes('nutri')) return 'nutricion';
  return 'fisioterapia';
}

function origenDesdeCanal(canalId: string | null, canales: Map<string, string>): OrigenCitaAgenda {
  if (!canalId) return 'directo';
  const nombre = (canales.get(canalId) ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (nombre.includes('vivofacil') || nombre.includes('vivo facil')) return 'vivofacil';
  if (nombre.includes('oasis')) return 'oasis';
  if (nombre.includes('lidomare')) return 'lidomare';
  if (nombre.includes('directo') || nombre.includes('organico')) return 'directo';
  return 'otro';
}

/** timestamptz de la BD → ISO local Europe/Madrid "YYYY-MM-DDTHH:mm:ss". */
export function aIsoLocal(ts: string): string {
  const d = new Date(ts);
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
  // sv-SE produce "YYYY-MM-DD HH:mm:ss" — solo cambia el separador.
  return partes.replace(' ', 'T');
}

function estadoPago(fila: FilaCita, cobradoPorCita: Map<string, number>): EstadoPagoAgenda {
  if (fila.tipo_venta === 'bono') return 'incluido_bono';
  if (fila.tipo_venta === 'programa') return 'incluido_programa';
  const cobrado = cobradoPorCita.get(fila.id) ?? 0;
  const precio = fila.precio_snapshot ?? 0;
  if (cobrado <= 0) return 'pendiente_pago';
  if (precio > 0 && cobrado < precio) return 'pago_parcial';
  return 'pagado';
}

// ── Carga ───────────────────────────────────────────────────────────────────

/**
 * Agenda real: citas desde el día 1 del MES ANTERIOR (así las vistas Semana/
 * Mes siempre tienen el mes en curso completo y el previo para consulta)
 * hasta 60 días vista. Volumen contenido: ~180 citas/mes. Devuelve null sin
 * entorno (el módulo cae al mock).
 */
export async function cargarAgendaReal(): Promise<AgendaReal | null> {
  if (!datosRealesDisponibles()) return null;

  const hoyMadrid = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(
    new Date(),
  ); // YYYY-MM-DD
  const [anio = 1970, mes = 1] = hoyMadrid.split('-').map(Number);
  const desde = mes === 1 ? `${anio - 1}-12-01` : `${anio}-${String(mes - 1).padStart(2, '0')}-01`;
  const hasta = new Date(Date.now() + 60 * 86400_000).toISOString();

  const [citas, profesionales, servicios, canales, cobros] = await Promise.all([
    rest<FilaCita>(
      `clinica_citas?select=id,cliente_id,profesional_id,servicio_id,canal_id,inicio,fin,estado,tipo_venta,precio_snapshot,notas_admin,clinica_clientes(nombre,apellidos)&inicio=gte.${desde}&inicio=lte.${hasta}&order=inicio.asc&limit=5000`,
    ),
    rest<FilaProfesional>(`clinica_profesionales?select=*&activo=is.true&order=nombre.asc`),
    rest<FilaServicio>(`clinica_servicios?select=*&activo=is.true&order=nombre.asc`),
    rest<FilaCanal>(`canales?select=id,nombre&limit=100`),
    rest<FilaCobroCita>(`cobros?select=origen_id,importe&origen_tipo=eq.cita&limit=5000`),
  ]);

  const mapaCanales = new Map(canales.map((c) => [c.id, c.nombre]));
  const cobradoPorCita = new Map<string, number>();
  for (const c of cobros) {
    if (c.origen_id) {
      cobradoPorCita.set(c.origen_id, (cobradoPorCita.get(c.origen_id) ?? 0) + c.importe);
    }
  }

  return {
    profesionales: profesionales.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      rol: p.rol_texto ?? p.especialidad ?? '',
    })),
    servicios: servicios.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      categoria: categoriaServicio(s.categoria),
      duracion_minutos: s.duracion_minutos,
      precio: s.precio_base ?? 0, // tarifario real sincronizado desde Salonized
    })),
    citas: citas.map((f) => ({
      id: f.id,
      cliente_nombre: f.clinica_clientes
        ? `${f.clinica_clientes.nombre}${f.clinica_clientes.apellidos ? ` ${f.clinica_clientes.apellidos}` : ''}`
        : 'Cliente',
      profesional_id: f.profesional_id,
      sala_id: null, // el recurso/sala se conectará con clinica_recursos más adelante
      servicio_id: f.servicio_id,
      origen: origenDesdeCanal(f.canal_id, mapaCanales),
      inicio: aIsoLocal(f.inicio),
      fin: aIsoLocal(f.fin),
      estado_cita: ESTADO_BD_A_AGENDA[f.estado],
      estado_pago: estadoPago(f, cobradoPorCita),
      precio_previsto: f.precio_snapshot ?? 0,
      cambios: [],
    })),
  };
}
