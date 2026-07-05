// Datos MOCK de bonos y programas (clientes ficticios). Un bono = paquete de
// sesiones sueltas; un programa = plan con seguimiento. Estado derivable de las
// sesiones, pero se guarda explícito para el mock.
export type EstadoBono = 'activo' | 'por_renovar' | 'agotado' | 'pausado';

export interface BonoMock {
  id: string;
  cliente_id: string; // enlaza con CLIENTES (mock/clientes.ts)
  cliente: string;
  tipo: 'bono' | 'programa';
  nombre: string;
  sesiones_contratadas: number;
  sesiones_usadas: number;
  inicio: string; // YYYY-MM-DD (mock)
  caducidad: string; // YYYY-MM-DD (mock)
  estado: EstadoBono;
}

export const BONOS: BonoMock[] = [
  {
    id: 'b1',
    cliente_id: 'cl1',
    cliente: 'María López',
    tipo: 'bono',
    nombre: 'Bono Fisio 5',
    sesiones_contratadas: 5,
    sesiones_usadas: 3,
    inicio: '2026-05-02',
    caducidad: '2026-09-30',
    estado: 'activo',
  },
  {
    id: 'b2',
    cliente_id: 'cl5',
    cliente: 'Inés Vega',
    tipo: 'programa',
    nombre: 'Programa Nutrición 12',
    sesiones_contratadas: 12,
    sesiones_usadas: 5,
    inicio: '2026-04-15',
    caducidad: '2026-12-31',
    estado: 'activo',
  },
  {
    id: 'b3',
    cliente_id: 'cl6',
    cliente: 'Lola Prieto',
    tipo: 'bono',
    nombre: 'Bono Fisio 10',
    sesiones_contratadas: 10,
    sesiones_usadas: 9,
    inicio: '2026-02-10',
    caducidad: '2026-07-15',
    estado: 'por_renovar',
  },
  {
    id: 'b4',
    cliente_id: 'cl10',
    cliente: 'Andrea Soler',
    tipo: 'bono',
    nombre: 'Bono Entreno 8',
    sesiones_contratadas: 8,
    sesiones_usadas: 8,
    inicio: '2026-03-01',
    caducidad: '2026-06-30',
    estado: 'agotado',
  },
  {
    id: 'b5',
    cliente_id: 'cl7',
    cliente: 'Sergio Mora',
    tipo: 'programa',
    nombre: 'Programa Activo 20',
    sesiones_contratadas: 20,
    sesiones_usadas: 7,
    inicio: '2026-05-20',
    caducidad: '2027-01-31',
    estado: 'activo',
  },
  {
    id: 'b6',
    cliente_id: 'cl3',
    cliente: 'Hugo Santos',
    tipo: 'bono',
    nombre: 'Bono Fisio 5',
    sesiones_contratadas: 5,
    sesiones_usadas: 1,
    inicio: '2026-06-05',
    caducidad: '2026-10-31',
    estado: 'activo',
  },
  {
    id: 'b7',
    cliente_id: 'cl12',
    cliente: 'Pablo Reyes',
    tipo: 'programa',
    nombre: 'Programa Fuerza 16',
    sesiones_contratadas: 16,
    sesiones_usadas: 6,
    inicio: '2026-04-01',
    caducidad: '2026-11-30',
    estado: 'pausado',
  },
];

export const restantes = (b: BonoMock) => Math.max(0, b.sesiones_contratadas - b.sesiones_usadas);
