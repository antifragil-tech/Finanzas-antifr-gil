import { createContext, useContext, useState, type ReactNode } from 'react';
import {
  crearCitasMock,
  type CitaMock,
  type EstadoCita,
  type EstadoPago,
  type OrigenCita,
} from '../spike/mockData';
import type { AccionCita } from '../spike/CitaModal';
import { useCatalogo } from './catalogo';

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

// ── Fuente real (inyectada por el host cuando hay entorno Supabase) ─────────

export interface AgendaInicial {
  /** Fecha local YYYY-MM-DD del "hoy" real. */
  hoy: string;
  citas: CitaMock[];
}

export type MedioPagoCobro = 'efectivo' | 'tarjeta' | 'bizum' | 'transferencia';

export interface RespuestaAgenda {
  ok: boolean;
  error?: string | undefined;
}

export interface AccionesRealesAgenda {
  crearCita(datos: {
    clienteNombre: string;
    profesionalId: string;
    servicioId: string;
    inicioIso: string;
    finIso: string;
    origen: OrigenCita;
    precio: number;
  }): Promise<RespuestaAgenda & { cita?: CitaMock | undefined }>;
  cambiarEstado(citaId: string, estado: EstadoCita): Promise<RespuestaAgenda>;
  /** Cobro real: importe y cliente se resuelven en el servidor desde la cita. */
  registrarCobro(citaId: string, medio: MedioPagoCobro): Promise<RespuestaAgenda>;
}

export interface CitasStore {
  /** Fecha local YYYY-MM-DD sobre la que trabaja la agenda. */
  hoy: string;
  /** true = citas reales de Supabase; false = escenario demo. */
  real: boolean;
  citas: CitaMock[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  seleccionada: CitaMock | null;
  /** Último aviso/error de escritura contra la base real (null si todo ok). */
  ultimoError: string | null;
  patch: (id: string, cambio: Partial<CitaMock>, accion: string, detalle: string) => void;
  onAccion: (accion: AccionCita) => void;
  onPago: (estado: EstadoPago) => void;
  onOrigen: (origen: OrigenCita) => void;
  confirmar: (id: string) => void;
  noAsistio: (id: string) => void;
  registrarPago: (id: string, estado?: EstadoPago) => void;
  /** Cobro con medio de pago: real → tesorería; demo → cambio local. */
  cobrar: (id: string, medio: MedioPagoCobro) => void;
  crearCita: (
    inicio: string,
    fin: string,
    profesional_id?: string,
    opts?: { clienteNombre?: string; servicioId?: string },
  ) => void;
  /** Alta de una cita ya construida (p. ej. Semana/Día con sala) y la selecciona. */
  agregarCita: (nueva: CitaMock) => void;
}

const Ctx = createContext<CitasStore | null>(null);

// Estado ÚNICO del módulo Reservas, compartido por todas las vistas (Hoy,
// Pendientes, Cobros, Vivofácil, Clientes). Sin props funciona 100% en mock
// (demo del OS y CI sin secrets); con `inicial` + `acciones` del host, las
// citas vienen de Supabase y los cambios de estado / altas se escriben en la
// base ANTES de reflejarse en la UI (si el servidor falla, se conserva el
// estado y queda el motivo en `ultimoError`). Nunca borra: cancelar/no-show/
// completar son cambios de estado con histórico.
export function CitasProvider({
  children,
  inicial,
  acciones,
}: {
  children: ReactNode;
  inicial?: AgendaInicial | undefined;
  acciones?: AccionesRealesAgenda | undefined;
}) {
  const { getProfesional, servicios, profesionales } = useCatalogo();
  const [hoy] = useState(() => inicial?.hoy ?? hoyLocal());
  const [citas, setCitas] = useState<CitaMock[]>(() => inicial?.citas ?? crearCitasMock(hoy));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ultimoError, setUltimoError] = useState<string | null>(null);
  const seleccionada = citas.find((c) => c.id === selectedId) ?? null;
  const real = Boolean(inicial);

  const patch = (id: string, cambio: Partial<CitaMock>, accion: string, detalle: string) =>
    setCitas((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, ...cambio, cambios: [...c.cambios, { ts: ahora(), accion, detalle }] }
          : c,
      ),
    );

  /** Aplica el patch local tras confirmar la escritura real (o directo en demo). */
  const patchEscribiendo = (
    id: string,
    cambio: Partial<CitaMock>,
    accion: string,
    detalle: string,
    escribir?: () => Promise<RespuestaAgenda>,
  ) => {
    if (!escribir) {
      patch(id, cambio, accion, detalle);
      return;
    }
    void escribir().then((r) => {
      if (r.ok) {
        setUltimoError(null);
        patch(id, cambio, accion, detalle);
      } else {
        setUltimoError(r.error ?? 'No se pudo guardar el cambio en la base');
      }
    });
  };

  const cambiarEstado = (id: string, estado: EstadoCita, detalle: string) =>
    patchEscribiendo(
      id,
      { estado_cita: estado },
      estado,
      detalle,
      acciones ? () => acciones.cambiarEstado(id, estado) : undefined,
    );

  const onAccion = (accion: AccionCita) => {
    if (!seleccionada) return;
    const mapa: Record<AccionCita, EstadoCita> = {
      confirmar: 'confirmada',
      completar: 'completada',
      no_asiste: 'no_asiste',
      cancelar: 'cancelada',
    };
    cambiarEstado(seleccionada.id, mapa[accion], 'Cambio de estado');
  };
  // El estado de pago/origen sigue siendo local también en modo real: el COBRO
  // real (importe + medio de pago → tesorería) llega en la siguiente iteración.
  const marcarPago = (id: string, estado: EstadoPago) => {
    patch(id, { estado_pago: estado }, 'pago', `Pago → ${estado}`);
    if (real) setUltimoError('Marcado en la agenda; el cobro real se registra en Tesorería.');
  };
  const onPago = (estado: EstadoPago) => {
    if (seleccionada) marcarPago(seleccionada.id, estado);
  };
  const onOrigen = (origen: OrigenCita) => {
    if (seleccionada) patch(seleccionada.id, { origen }, 'origen', `Origen → ${origen}`);
  };

  // Acciones por id (para listas, sin abrir panel).
  const confirmar = (id: string) => cambiarEstado(id, 'confirmada', 'Confirmada');
  const noAsistio = (id: string) => cambiarEstado(id, 'no_asiste', 'No asistió');
  const registrarPago = (id: string, estado: EstadoPago = 'pagado') => marcarPago(id, estado);

  // Cobro DE VERDAD: con acciones, el servidor registra el cobro en tesorería
  // (cuenta por tipo de medio) antes de marcar la cita como pagada.
  const cobrar = (id: string, medio: MedioPagoCobro) =>
    patchEscribiendo(
      id,
      { estado_pago: 'pagado' },
      'pago',
      `Cobrado (${medio})`,
      acciones ? () => acciones.registrarCobro(id, medio) : undefined,
    );

  const agregarCita = (nueva: CitaMock) => {
    setCitas((prev) => [...prev, nueva]);
    setSelectedId(nueva.id);
  };

  // El servicio del alta rápida se deduce del rol del profesional contra el
  // CATÁLOGO activo (mock o real) — nunca ids fijos.
  const servicioPorRol = (rol?: string) => {
    const r = (rol ?? '').toLowerCase();
    const cat = r.includes('entren')
      ? 'entrenamiento_personal'
      : r.includes('nutri')
        ? 'nutricion'
        : 'fisioterapia';
    return servicios.find((s) => s.categoria === cat) ?? servicios[0];
  };

  const crearCita = (
    inicio: string,
    fin: string,
    profesional_id?: string,
    opts?: { clienteNombre?: string; servicioId?: string },
  ) => {
    const profId = profesional_id ?? profesionales[0]?.id ?? '';
    const serv =
      (opts?.servicioId ? servicios.find((s) => s.id === opts.servicioId) : undefined) ??
      servicioPorRol(getProfesional(profId)?.rol);
    if (!serv) {
      setUltimoError('No hay servicios en el catálogo: siembra clinica_servicios.');
      return;
    }
    const esEntreno = serv.categoria === 'entrenamiento_personal';

    if (acciones) {
      void acciones
        .crearCita({
          clienteNombre: opts?.clienteNombre?.trim() || 'Nuevo cliente',
          profesionalId: profId,
          servicioId: serv.id,
          inicioIso: inicio,
          finIso: fin,
          origen: 'directo',
          precio: serv.precio,
        })
        .then((r) => {
          if (r.ok && r.cita) {
            setUltimoError(null);
            agregarCita({
              ...r.cita,
              cambios: [{ ts: ahora(), accion: 'creada', detalle: 'Alta desde agenda' }],
            });
          } else {
            setUltimoError(r.error ?? 'No se pudo crear la cita');
          }
        });
      return;
    }

    agregarCita({
      id: `c${Date.now()}`,
      cliente_nombre: opts?.clienteNombre?.trim() || 'Nuevo cliente',
      profesional_id: profId,
      sala_id: esEntreno ? null : 's1',
      servicio_id: serv.id,
      origen: 'directo',
      inicio,
      fin,
      estado_cita: 'pendiente',
      estado_pago: 'pendiente_pago',
      precio_previsto: serv.precio,
      cambios: [{ ts: ahora(), accion: 'creada', detalle: 'Alta demo' }],
    });
  };

  const store: CitasStore = {
    hoy,
    real,
    citas,
    selectedId,
    setSelectedId,
    seleccionada,
    ultimoError,
    patch,
    onAccion,
    onPago,
    onOrigen,
    confirmar,
    noAsistio,
    registrarPago,
    cobrar,
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
