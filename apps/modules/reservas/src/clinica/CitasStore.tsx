import { createContext, useContext, useState, type ReactNode } from 'react';
import {
  crearCitasMock,
  getProfesional,
  getServicio,
  type CitaMock,
  type EstadoCita,
  type EstadoPago,
  type OrigenCita,
} from '../spike/mockData';
import type { AccionCita } from '../spike/CitaModal';

const pad = (x: number) => String(x).padStart(2, '0');
const hoyLocal = () => {
  const d = new Date();
  // Las citas mock se generan de lunes a viernes: en fin de semana anclamos
  // "hoy" al lunes siguiente para que la agenda de la demo nunca salga vacía.
  const dia = d.getDay();
  if (dia === 6) d.setDate(d.getDate() + 2);
  if (dia === 0) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const ahora = () => new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const servicioPorRol = (rol?: string) =>
  rol === 'Entrenador personal' ? 'sv3' : rol === 'Nutricionista' ? 'sv4' : 'sv1';

export interface CitasStore {
  /** Fecha local YYYY-MM-DD sobre la que se generó la semana mock. */
  hoy: string;
  /** Semana completa de citas mock: cada vista filtra lo que necesita. */
  citas: CitaMock[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  seleccionada: CitaMock | null;
  patch: (id: string, cambio: Partial<CitaMock>, accion: string, detalle: string) => void;
  onAccion: (accion: AccionCita) => void;
  onPago: (estado: EstadoPago) => void;
  onOrigen: (origen: OrigenCita) => void;
  confirmar: (id: string) => void;
  noAsistio: (id: string) => void;
  registrarPago: (id: string, estado?: EstadoPago) => void;
  crearCita: (inicio: string, fin: string, profesional_id?: string) => void;
  /** Alta de una cita ya construida (p. ej. Semana/Día con sala) y la selecciona. */
  agregarCita: (nueva: CitaMock) => void;
}

const Ctx = createContext<CitasStore | null>(null);

// Estado mock ÚNICO del módulo Reservas, compartido por todas las vistas
// (Hoy, Pendientes, Cobros, Vivofácil, Clientes): confirmar una cita en
// Pendientes se refleja en Hoy, cobrar en Cobros actualiza los KPIs, etc.
// Todo local/en memoria, sin backend; nunca borra (cancelar/no-show/completar
// son cambios de estado con histórico).
export function CitasProvider({ children }: { children: ReactNode }) {
  const [hoy] = useState(hoyLocal);
  const [citas, setCitas] = useState<CitaMock[]>(() => crearCitasMock(hoy));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const seleccionada = citas.find((c) => c.id === selectedId) ?? null;

  const patch = (id: string, cambio: Partial<CitaMock>, accion: string, detalle: string) =>
    setCitas((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, ...cambio, cambios: [...c.cambios, { ts: ahora(), accion, detalle }] }
          : c,
      ),
    );

  const onAccion = (accion: AccionCita) => {
    if (!seleccionada) return;
    const mapa: Record<AccionCita, EstadoCita> = {
      confirmar: 'confirmada',
      completar: 'completada',
      no_asiste: 'no_asiste',
      cancelar: 'cancelada',
    };
    patch(seleccionada.id, { estado_cita: mapa[accion] }, mapa[accion], 'Cambio de estado (demo)');
  };
  const onPago = (estado: EstadoPago) => {
    if (seleccionada) patch(seleccionada.id, { estado_pago: estado }, 'pago', `Pago → ${estado}`);
  };
  const onOrigen = (origen: OrigenCita) => {
    if (seleccionada) patch(seleccionada.id, { origen }, 'origen', `Origen → ${origen}`);
  };

  // Acciones por id (para listas, sin abrir panel).
  const confirmar = (id: string) =>
    patch(id, { estado_cita: 'confirmada' }, 'confirmada', 'Confirmada (demo)');
  const noAsistio = (id: string) =>
    patch(id, { estado_cita: 'no_asiste' }, 'no_asiste', 'No asistió (demo)');
  const registrarPago = (id: string, estado: EstadoPago = 'pagado') =>
    patch(id, { estado_pago: estado }, 'pago', `Pago → ${estado}`);

  const agregarCita = (nueva: CitaMock) => {
    setCitas((prev) => [...prev, nueva]);
    setSelectedId(nueva.id);
  };

  const crearCita = (inicio: string, fin: string, profesional_id?: string) => {
    const profId = profesional_id ?? 'p1';
    const servId = servicioPorRol(getProfesional(profId)?.rol);
    const esEntreno = getServicio(servId)?.categoria === 'entrenamiento_personal';
    const nueva: CitaMock = {
      id: `c${Date.now()}`,
      cliente_nombre: 'Nuevo cliente',
      profesional_id: profId,
      sala_id: esEntreno ? null : 's1',
      servicio_id: servId,
      origen: 'directo',
      inicio,
      fin,
      estado_cita: 'pendiente',
      estado_pago: 'pendiente_pago',
      precio_previsto: getServicio(servId)?.precio ?? 0,
      cambios: [{ ts: ahora(), accion: 'creada', detalle: 'Alta demo' }],
    };
    agregarCita(nueva);
  };

  const store: CitasStore = {
    hoy,
    citas,
    selectedId,
    setSelectedId,
    seleccionada,
    patch,
    onAccion,
    onPago,
    onOrigen,
    confirmar,
    noAsistio,
    registrarPago,
    crearCita,
    agregarCita,
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useCitasStore(): CitasStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCitasStore debe usarse dentro de <CitasProvider>');
  return ctx;
}
