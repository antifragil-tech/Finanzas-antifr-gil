import type { OrigenCita } from '../../spike/mockData';

// Datos MOCK de clientes. Nombres y contactos CLARAMENTE FICTICIOS (no reales,
// no pacientes reales): teléfonos 600 000 0XX y emails @demo.local.
export interface ClienteMock {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  origen: OrigenCita;
  ultima_cita: string; // YYYY-MM-DD (mock)
  proxima_cita: string | null;
  estado_pago: 'al_dia' | 'pendiente';
  bono?: string; // bono/programa activo (nombre)
}

export const CLIENTES: ClienteMock[] = [
  { id: 'cl1', nombre: 'María López', telefono: '600 000 011', email: 'maria.lopez@demo.local', origen: 'directo', ultima_cita: '2026-06-22', proxima_cita: '2026-06-29', estado_pago: 'al_dia', bono: 'Bono Fisio 5' },
  { id: 'cl2', nombre: 'Carlos Vega', telefono: '600 000 012', email: 'carlos.vega@demo.local', origen: 'vivofacil', ultima_cita: '2026-06-24', proxima_cita: '2026-07-01', estado_pago: 'pendiente' },
  { id: 'cl3', nombre: 'Hugo Santos', telefono: '600 000 013', email: 'hugo.santos@demo.local', origen: 'directo', ultima_cita: '2026-06-25', proxima_cita: null, estado_pago: 'pendiente', bono: 'Bono Fisio 5' },
  { id: 'cl4', nombre: 'Marta Crespo', telefono: '600 000 014', email: 'marta.crespo@demo.local', origen: 'oasis', ultima_cita: '2026-06-20', proxima_cita: '2026-06-30', estado_pago: 'al_dia' },
  { id: 'cl5', nombre: 'Inés Vega', telefono: '600 000 015', email: 'ines.vega@demo.local', origen: 'vivofacil', ultima_cita: '2026-06-26', proxima_cita: '2026-07-03', estado_pago: 'al_dia', bono: 'Programa Nutrición 12' },
  { id: 'cl6', nombre: 'Lola Prieto', telefono: '600 000 016', email: 'lola.prieto@demo.local', origen: 'directo', ultima_cita: '2026-06-23', proxima_cita: '2026-06-29', estado_pago: 'al_dia', bono: 'Bono Fisio 10' },
  { id: 'cl7', nombre: 'Sergio Mora', telefono: '600 000 017', email: 'sergio.mora@demo.local', origen: 'lidomare', ultima_cita: '2026-06-19', proxima_cita: '2026-07-02', estado_pago: 'al_dia', bono: 'Programa Readaptación' },
  { id: 'cl8', nombre: 'Nuria Cano', telefono: '600 000 018', email: 'nuria.cano@demo.local', origen: 'directo', ultima_cita: '2026-06-18', proxima_cita: null, estado_pago: 'pendiente' },
  { id: 'cl9', nombre: 'Aitor Niño', telefono: '600 000 019', email: 'aitor.nino@demo.local', origen: 'otro', ultima_cita: '2026-06-17', proxima_cita: '2026-07-01', estado_pago: 'al_dia' },
  { id: 'cl10', nombre: 'Andrea Soler', telefono: '600 000 020', email: 'andrea.soler@demo.local', origen: 'directo', ultima_cita: '2026-06-24', proxima_cita: '2026-06-30', estado_pago: 'pendiente', bono: 'Bono Entreno 8' },
  { id: 'cl11', nombre: 'Elena Ríos', telefono: '600 000 021', email: 'elena.rios@demo.local', origen: 'vivofacil', ultima_cita: '2026-06-25', proxima_cita: '2026-07-02', estado_pago: 'al_dia' },
  { id: 'cl12', nombre: 'Pablo Reyes', telefono: '600 000 022', email: 'pablo.reyes@demo.local', origen: 'directo', ultima_cita: '2026-06-21', proxima_cita: '2026-06-29', estado_pago: 'al_dia' },
];

export const getCliente = (id: string) => CLIENTES.find((c) => c.id === id);
