// Datos MOCK del spike (no hay Supabase). Nombres de campos según la convención
// propuesta: dominio en español, técnico en inglés. NO es el schema real.

export type EstadoCita =
  | 'pendiente'
  | 'confirmada'
  | 'completada'
  | 'cancelada'
  | 'no_asiste'
  | 'reprogramada';

export type EstadoPago =
  | 'pendiente_pago'
  | 'pagado'
  | 'pago_parcial'
  | 'incluido_bono'
  | 'incluido_programa'
  | 'pendiente_revision'
  | 'devuelto'
  | 'no_requiere_pago';

// Servicios principales = 3. "Fisio deportiva" NO es servicio: es una etiqueta/
// contexto dentro de Fisioterapia (campo `etiqueta` en la cita).
export type CategoriaServicio = 'fisioterapia' | 'entrenamiento_personal' | 'nutricion';

// Origen / partner derivador de la cita. Vivofácil es el caso especial (factura
// mensual agrupada a 45 €/sesión completada → cobro pendiente B2B).
export type OrigenCita = 'directo' | 'vivofacil' | 'oasis' | 'lidomare' | 'otro';

export interface Origen {
  id: OrigenCita;
  label: string;
  partner: boolean; // true = derivador externo (no cliente directo)
}

export interface Profesional {
  id: string;
  nombre: string;
  rol: string;
}

export interface Sala {
  id: string;
  nombre: string;
}

export interface Servicio {
  id: string;
  nombre: string;
  categoria: CategoriaServicio;
  duracion_minutos: number;
  precio: number;
}

export interface CambioCita {
  ts: string;
  accion: string;
  detalle: string;
}

export interface CitaMock {
  id: string;
  cliente_nombre: string;
  profesional_id: string;
  sala_id: string | null; // opcional: entrenamiento normalmente sin sala
  servicio_id: string;
  etiqueta?: string; // contexto dentro del servicio (p. ej. "Deportiva" en fisio)
  origen: OrigenCita;
  inicio: string; // ISO local "YYYY-MM-DDTHH:mm:ss"
  fin: string;
  estado_cita: EstadoCita;
  estado_pago: EstadoPago;
  precio_previsto: number;
  notas_internas?: string;
  cambios: CambioCita[];
}

// 3 fisioterapeutas + 1 entrenador + 1 nutricionista
export const PROFESIONALES: Profesional[] = [
  { id: 'p1', nombre: 'Lucía Fernández', rol: 'Fisioterapeuta' },
  { id: 'p2', nombre: 'Marco Ruiz', rol: 'Fisioterapeuta' },
  { id: 'p3', nombre: 'Sara Gil', rol: 'Fisioterapeuta' },
  { id: 'p4', nombre: 'Diego Soto', rol: 'Entrenador personal' },
  { id: 'p5', nombre: 'Elena Vidal', rol: 'Nutricionista' },
];

// 2 salas (consultas) para todos. Nutrición usa consulta; entrenamiento, opcional.
export const SALAS: Sala[] = [
  { id: 's1', nombre: 'Consulta 1' },
  { id: 's2', nombre: 'Consulta 2' },
];

// Duraciones reales: fisio 45', nutrición 30', entrenamiento 60'. Precio = tarifa
// estándar (las tarifas Founder/VIP/especial se aplican por cliente/producto).
export const SERVICIOS: Servicio[] = [
  { id: 'sv1', nombre: 'Fisioterapia', categoria: 'fisioterapia', duracion_minutos: 45, precio: 55 },
  { id: 'sv3', nombre: 'Entrenamiento', categoria: 'entrenamiento_personal', duracion_minutos: 60, precio: 40 },
  { id: 'sv4', nombre: 'Nutrición', categoria: 'nutricion', duracion_minutos: 30, precio: 45 },
];

// Orígenes / partners. Vivofácil con lógica especial (ver VIVOFACIL_VALOR_SESION).
export const ORIGENES: Origen[] = [
  { id: 'directo', label: 'Directo', partner: false },
  { id: 'vivofacil', label: 'Vivofácil', partner: true },
  { id: 'oasis', label: 'Oasis', partner: true },
  { id: 'lidomare', label: 'Lidomare', partner: true },
  { id: 'otro', label: 'Otro derivador', partner: true },
];

// Vivofácil: cada sesión COMPLETADA devenga 45 €. Cierre/factura mensual agrupada
// al partner → cobro pendiente B2B hasta que paga.
export const VIVOFACIL_VALOR_SESION = 45;

// Color por profesional (acento visual: barra de la cita, punto en filtros y mes).
export const PROF_COLOR: Record<string, string> = {
  p1: '#34d399',
  p2: '#f43f5e',
  p3: '#e879f9',
  p4: '#60a5fa',
  p5: '#fbbf24',
};

export const getProfesional = (id: string) => PROFESIONALES.find((p) => p.id === id);
export const getSala = (id: string | null) => (id ? SALAS.find((s) => s.id === id) : undefined);
export const getServicio = (id: string) => SERVICIOS.find((s) => s.id === id);
export const getOrigen = (id: OrigenCita) => ORIGENES.find((o) => o.id === id);

const pad = (x: number) => String(x).padStart(2, '0');

/**
 * Citas mock REPARTIDAS de lunes a viernes de la semana que contiene `hoy`.
 * Cada día tiene varias citas en distintos profesionales/horas, con un bloque de
 * citas simultáneas (10:30) para validar el reparto en carriles, y variedad de
 * estados, pagos y orígenes/partners (incl. Vivofácil) para la agenda y los badges.
 */
export function crearCitasMock(hoy: string): CitaMock[] {
  const base = new Date(`${hoy}T00:00:00`);
  const monday = new Date(base);
  monday.setDate(base.getDate() - ((base.getDay() + 6) % 7));
  const fechaOffset = (off: number) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + off);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const nombres = [
    'María López', 'Carlos Vega', 'Hugo Santos', 'Marta Crespo', 'Inés Vega',
    'Lola Prieto', 'Sergio Mora', 'Diego Gallardo', 'Nuria Cano', 'Aitor Niño',
    'Andrea Soler', 'Elena Ríos', 'Javier Morán', 'Pablo Reyes', 'Toni Salas',
    'Rocío Peña', 'Clara Ortiz', 'Marcos Ferri', 'Sofía Cruz', 'Laura Padial',
    'Ana Belén Torres', 'Rafa Galindo', 'Luis García', 'Bea Romero', 'Paco Reyes',
  ];

  // Plantilla de un día: [hora, min, profesional, sala, servicio, etiqueta?]
  // "Deportiva" es etiqueta de contexto dentro de Fisioterapia (no un servicio).
  const tpl: [number, number, string, string | null, string, string?][] = [
    [8, 0, 'p1', 's1', 'sv1'],
    [9, 0, 'p4', null, 'sv3'],
    [9, 30, 'p2', 's2', 'sv1', 'Deportiva'],
    [10, 30, 'p1', 's1', 'sv1'],
    [10, 30, 'p3', 's2', 'sv1'],
    [10, 30, 'p4', null, 'sv3'],
    [12, 0, 'p5', 's1', 'sv4'],
    [16, 0, 'p4', null, 'sv3'],
    [17, 0, 'p2', 's2', 'sv1', 'Deportiva'],
    [18, 30, 'p3', 's1', 'sv1'],
  ];
  const estados: EstadoCita[] = [
    'confirmada', 'confirmada', 'completada', 'pendiente', 'confirmada',
    'no_asiste', 'confirmada', 'pendiente', 'cancelada',
  ];
  const pagos: EstadoPago[] = [
    'incluido_bono', 'pagado', 'pendiente_pago', 'pendiente_pago', 'pagado',
    'pendiente_pago', 'pagado', 'incluido_bono', 'devuelto',
  ];
  const origenes: OrigenCita[] = [
    'directo', 'vivofacil', 'directo', 'oasis', 'vivofacil',
    'directo', 'lidomare', 'vivofacil', 'directo', 'otro',
  ];

  const out: CitaMock[] = [];
  let n = 0;
  for (let off = 0; off <= 4; off++) {
    const dia = fechaOffset(off);
    tpl.forEach(([h, m, prof, sala, serv, etiqueta], i) => {
      const s = getServicio(serv)!;
      const fin = new Date(new Date(`${dia}T${pad(h)}:${pad(m)}:00`).getTime() + s.duracion_minutos * 60000);
      n += 1;
      out.push({
        id: `c${n}`,
        cliente_nombre: nombres[(i + off * 3) % nombres.length] ?? 'Cliente',
        profesional_id: prof,
        sala_id: sala,
        servicio_id: serv,
        ...(etiqueta ? { etiqueta } : {}),
        origen: origenes[i % origenes.length] ?? 'directo',
        inicio: `${dia}T${pad(h)}:${pad(m)}:00`,
        fin: `${dia}T${pad(fin.getHours())}:${pad(fin.getMinutes())}:00`,
        estado_cita: estados[(i + off) % estados.length] ?? 'confirmada',
        estado_pago: pagos[(i + off) % pagos.length] ?? 'pendiente_pago',
        precio_previsto: s.precio,
        cambios: [{ ts: '07:50', accion: 'creada', detalle: 'Alta por recepción' }],
      });
    });
  }
  return out;
}
