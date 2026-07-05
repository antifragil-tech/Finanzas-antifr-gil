'use client';

import { createContext, useMemo, useState } from 'react';
import type { CentroId, PeriodoId, RolId } from './osGlobalOptions';
import { CONTEXTO_INICIAL } from './osGlobalOptions';

// Contexto global seguro del OS: centro/proyecto activo, periodo y rol
// operativo. Estado local en memoria (sin localStorage: no existe aún un
// patrón de persistencia en el host), sin Supabase, sin variables de entorno.
// El rol es una VISTA de interfaz, no un permiso real: la seguridad de datos
// llegará con auth/RLS cuando los módulos reales se conecten.

export type OSGlobalContextValue = {
  centro: CentroId;
  periodo: PeriodoId;
  rol: RolId;
  setCentro: (c: CentroId) => void;
  setPeriodo: (p: PeriodoId) => void;
  setRol: (r: RolId) => void;
};

export const OSGlobalContext = createContext<OSGlobalContextValue | null>(null);

export function OSGlobalProvider({ children }: { children: React.ReactNode }) {
  const [centro, setCentro] = useState<CentroId>(CONTEXTO_INICIAL.centro);
  const [periodo, setPeriodo] = useState<PeriodoId>(CONTEXTO_INICIAL.periodo);
  const [rol, setRol] = useState<RolId>(CONTEXTO_INICIAL.rol);

  const value = useMemo(
    () => ({ centro, periodo, rol, setCentro, setPeriodo, setRol }),
    [centro, periodo, rol],
  );

  return <OSGlobalContext.Provider value={value}>{children}</OSGlobalContext.Provider>;
}
