import { useState } from 'react';
import {
  getProfesional,
  getServicio,
  type CitaMock,
  type EstadoCita,
  type EstadoPago,
  type OrigenCita,
} from '../spike/mockData';
import type { AccionCita } from '../spike/CitaModal';

const ahora = () => new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const servicioPorRol = (rol?: string) =>
  rol === 'Entrenador personal' ? 'sv3' : rol === 'Nutricionista' ? 'sv4' : 'sv1';

// Estado + acciones de citas compartido por las vistas del módulo (Agenda Hoy,
// Pendientes, Cobros...). Todo mock/local: cambia el estado en memoria, con
// histórico; nunca borra (cancelar/no-show/completar son cambios de estado).
export function useCitas(inicial: () => CitaMock[]) {
  const [citas, setCitas] = useState<CitaMock[]>(inicial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const seleccionada = citas.find((c) => c.id === selectedId) ?? null;

  const patch = (id: string, cambio: Partial<CitaMock>, accion: string, detalle: string) =>
    setCitas((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, ...cambio, cambios: [...c.cambios, { ts: ahora(), accion, detalle }] } : c,
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
  const confirmar = (id: string) => patch(id, { estado_cita: 'confirmada' }, 'confirmada', 'Confirmada (demo)');
  const noAsistio = (id: string) => patch(id, { estado_cita: 'no_asiste' }, 'no_asiste', 'No asistió (demo)');
  const registrarPago = (id: string, estado: EstadoPago = 'pagado') =>
    patch(id, { estado_pago: estado }, 'pago', `Pago → ${estado}`);

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
    setCitas((prev) => [...prev, nueva]);
    setSelectedId(nueva.id);
  };

  return {
    citas,
    selectedId,
    setSelectedId,
    seleccionada,
    onAccion,
    onPago,
    onOrigen,
    confirmar,
    noAsistio,
    registrarPago,
    crearCita,
  };
}
