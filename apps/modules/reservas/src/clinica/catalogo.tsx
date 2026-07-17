import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  PROFESIONALES,
  PROF_COLOR,
  SALAS,
  SERVICIOS,
  type Profesional,
  type Sala,
  type Servicio,
} from '../spike/mockData';

// Catálogo de la agenda (profesionales, salas, servicios) como CONTEXTO en vez
// de constantes estáticas: por defecto sirve el mock del spike (demo intacta),
// y el host puede inyectar el catálogo REAL de Supabase sin que las vistas
// cambien. Las vistas consumen useCatalogo() y nunca importan el mock directo.

export interface Catalogo {
  profesionales: Profesional[];
  salas: Sala[];
  servicios: Servicio[];
  /** true si el catálogo viene de la base real (host con entorno). */
  real: boolean;
}

export interface CatalogoStore extends Catalogo {
  getProfesional: (id: string) => Profesional | undefined;
  getSala: (id: string | null) => Sala | undefined;
  getServicio: (id: string) => Servicio | undefined;
  /** Color de acento estable por profesional (barra de cita, filtros, mes). */
  colorProfesional: (id: string) => string;
}

// Paleta para catálogos reales (ids uuid): asignación estable por posición.
const PALETA = [
  '#34d399',
  '#f43f5e',
  '#e879f9',
  '#60a5fa',
  '#fbbf24',
  '#2dd4bf',
  '#fb923c',
  '#a3e635',
  '#c084fc',
  '#38bdf8',
];

function construir(c: Catalogo): CatalogoStore {
  const indice = new Map(c.profesionales.map((p, i) => [p.id, i]));
  return {
    ...c,
    getProfesional: (id) => c.profesionales.find((p) => p.id === id),
    getSala: (id) => (id ? c.salas.find((s) => s.id === id) : undefined),
    getServicio: (id) => c.servicios.find((s) => s.id === id),
    colorProfesional: (id) =>
      PROF_COLOR[id] ?? PALETA[(indice.get(id) ?? 0) % PALETA.length] ?? '#60a5fa',
  };
}

const DEFECTO = construir({
  profesionales: PROFESIONALES,
  salas: SALAS,
  servicios: SERVICIOS,
  real: false,
});

const Ctx = createContext<CatalogoStore>(DEFECTO);

export function CatalogoProvider({
  catalogo,
  children,
}: {
  catalogo?: Catalogo | undefined;
  children: ReactNode;
}) {
  const valor = useMemo(() => (catalogo ? construir(catalogo) : DEFECTO), [catalogo]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useCatalogo(): CatalogoStore {
  return useContext(Ctx);
}
