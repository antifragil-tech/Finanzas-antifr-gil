import type { OrigenCita } from '../../spike/mockData';

// Datos MOCK de clientes. Nombres y contactos CLARAMENTE FICTICIOS (no reales,
// no pacientes reales): teléfonos 600 000 0XX y emails @demo.local.
// `registro_externo_url` es un puntero FICTICIO al sistema externo (Notion) donde
// vive la ficha completa del cliente. El OS solo guarda el enlace, nunca contenido.
export interface ClienteMock {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  origen: OrigenCita;
  servicio: 'Fisioterapia' | 'Entrenamiento' | 'Nutrición';
  ultima_cita: string; // YYYY-MM-DD (mock)
  proxima_cita: string | null;
  estado_pago: 'al_dia' | 'pendiente';
  bono?: string; // bono/programa activo (nombre)
  registro_externo_url: string; // enlace externo mock (no real)
}

const registro = (id: string) => `https://notion.demo.local/registro/${id}`;

export const CLIENTES: ClienteMock[] = [
  {
    id: 'cl1',
    nombre: 'Cliente Demo 01',
    telefono: '600 000 011',
    email: 'cliente01@demo.local',
    origen: 'directo',
    servicio: 'Fisioterapia',
    ultima_cita: '2026-06-22',
    proxima_cita: '2026-06-29',
    estado_pago: 'al_dia',
    bono: 'Bono Fisio 5',
    registro_externo_url: registro('cl1'),
  },
  {
    id: 'cl2',
    nombre: 'Cliente Demo 02',
    telefono: '600 000 012',
    email: 'cliente02@demo.local',
    origen: 'vivofacil',
    servicio: 'Fisioterapia',
    ultima_cita: '2026-06-24',
    proxima_cita: '2026-07-01',
    estado_pago: 'pendiente',
    registro_externo_url: registro('cl2'),
  },
  {
    id: 'cl3',
    nombre: 'Cliente Demo 03',
    telefono: '600 000 013',
    email: 'cliente03@demo.local',
    origen: 'directo',
    servicio: 'Fisioterapia',
    ultima_cita: '2026-06-25',
    proxima_cita: null,
    estado_pago: 'pendiente',
    bono: 'Bono Fisio 5',
    registro_externo_url: registro('cl3'),
  },
  {
    id: 'cl4',
    nombre: 'Cliente Demo 04',
    telefono: '600 000 014',
    email: 'cliente04@demo.local',
    origen: 'oasis',
    servicio: 'Fisioterapia',
    ultima_cita: '2026-06-20',
    proxima_cita: '2026-06-30',
    estado_pago: 'al_dia',
    registro_externo_url: registro('cl4'),
  },
  {
    id: 'cl5',
    nombre: 'Cliente Demo 05',
    telefono: '600 000 015',
    email: 'cliente05@demo.local',
    origen: 'vivofacil',
    servicio: 'Nutrición',
    ultima_cita: '2026-06-26',
    proxima_cita: '2026-07-03',
    estado_pago: 'al_dia',
    bono: 'Programa Nutrición 12',
    registro_externo_url: registro('cl5'),
  },
  {
    id: 'cl6',
    nombre: 'Cliente Demo 06',
    telefono: '600 000 016',
    email: 'cliente06@demo.local',
    origen: 'directo',
    servicio: 'Fisioterapia',
    ultima_cita: '2026-06-23',
    proxima_cita: '2026-06-29',
    estado_pago: 'al_dia',
    bono: 'Bono Fisio 10',
    registro_externo_url: registro('cl6'),
  },
  {
    id: 'cl7',
    nombre: 'Cliente Demo 07',
    telefono: '600 000 017',
    email: 'cliente07@demo.local',
    origen: 'lidomare',
    servicio: 'Entrenamiento',
    ultima_cita: '2026-06-19',
    proxima_cita: '2026-07-02',
    estado_pago: 'al_dia',
    bono: 'Programa Activo 20',
    registro_externo_url: registro('cl7'),
  },
  {
    id: 'cl8',
    nombre: 'Cliente Demo 09',
    telefono: '600 000 018',
    email: 'cliente08@demo.local',
    origen: 'directo',
    servicio: 'Nutrición',
    ultima_cita: '2026-06-18',
    proxima_cita: null,
    estado_pago: 'pendiente',
    registro_externo_url: registro('cl8'),
  },
  {
    id: 'cl9',
    nombre: 'Cliente Demo 10',
    telefono: '600 000 019',
    email: 'cliente09@demo.local',
    origen: 'otro',
    servicio: 'Entrenamiento',
    ultima_cita: '2026-06-17',
    proxima_cita: '2026-07-01',
    estado_pago: 'al_dia',
    registro_externo_url: registro('cl9'),
  },
  {
    id: 'cl10',
    nombre: 'Cliente Demo 11',
    telefono: '600 000 020',
    email: 'cliente10@demo.local',
    origen: 'directo',
    servicio: 'Entrenamiento',
    ultima_cita: '2026-06-24',
    proxima_cita: '2026-06-30',
    estado_pago: 'pendiente',
    bono: 'Bono Entreno 8',
    registro_externo_url: registro('cl10'),
  },
  {
    id: 'cl11',
    nombre: 'Cliente Demo 12',
    telefono: '600 000 021',
    email: 'cliente11@demo.local',
    origen: 'vivofacil',
    servicio: 'Fisioterapia',
    ultima_cita: '2026-06-25',
    proxima_cita: '2026-07-02',
    estado_pago: 'al_dia',
    registro_externo_url: registro('cl11'),
  },
  {
    id: 'cl12',
    nombre: 'Cliente Demo 14',
    telefono: '600 000 022',
    email: 'cliente12@demo.local',
    origen: 'directo',
    servicio: 'Fisioterapia',
    ultima_cita: '2026-06-21',
    proxima_cita: '2026-06-29',
    estado_pago: 'al_dia',
    registro_externo_url: registro('cl12'),
  },
];

export const getCliente = (id: string) => CLIENTES.find((c) => c.id === id);
export const getClientePorNombre = (nombre: string) => CLIENTES.find((c) => c.nombre === nombre);
