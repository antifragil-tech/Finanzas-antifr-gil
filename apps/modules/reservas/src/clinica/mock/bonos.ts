// Datos MOCK de bonos y programas (clientes ficticios). Un bono = paquete de
// sesiones sueltas; un programa = plan con seguimiento. Estado derivable de las
// sesiones, pero se guarda explícito para el mock.
export interface BonoMock {
  id: string;
  cliente: string;
  tipo: 'bono' | 'programa';
  nombre: string;
  sesiones_contratadas: number;
  sesiones_usadas: number;
  caducidad: string; // YYYY-MM-DD (mock)
  estado: 'activo' | 'por_renovar' | 'agotado';
}

export const BONOS: BonoMock[] = [
  { id: 'b1', cliente: 'María López', tipo: 'bono', nombre: 'Bono Fisio 5', sesiones_contratadas: 5, sesiones_usadas: 3, caducidad: '2026-09-30', estado: 'activo' },
  { id: 'b2', cliente: 'Inés Vega', tipo: 'programa', nombre: 'Programa Nutrición 12', sesiones_contratadas: 12, sesiones_usadas: 5, caducidad: '2026-12-31', estado: 'activo' },
  { id: 'b3', cliente: 'Lola Prieto', tipo: 'bono', nombre: 'Bono Fisio 10', sesiones_contratadas: 10, sesiones_usadas: 9, caducidad: '2026-07-15', estado: 'por_renovar' },
  { id: 'b4', cliente: 'Andrea Soler', tipo: 'bono', nombre: 'Bono Entreno 8', sesiones_contratadas: 8, sesiones_usadas: 8, caducidad: '2026-06-30', estado: 'agotado' },
  { id: 'b5', cliente: 'Sergio Mora', tipo: 'programa', nombre: 'Programa Readaptación', sesiones_contratadas: 20, sesiones_usadas: 7, caducidad: '2027-01-31', estado: 'activo' },
  { id: 'b6', cliente: 'Hugo Santos', tipo: 'bono', nombre: 'Bono Fisio 5', sesiones_contratadas: 5, sesiones_usadas: 1, caducidad: '2026-10-31', estado: 'activo' },
];

export const restantes = (b: BonoMock) => Math.max(0, b.sesiones_contratadas - b.sesiones_usadas);
