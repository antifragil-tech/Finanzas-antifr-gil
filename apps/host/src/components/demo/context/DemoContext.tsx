'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { PROYECTOS, ROLES, FILTROS, SOCIEDAD, type ProyectoId, type RolId, type FiltroId } from '../panel/panelMock';

// Contexto GLOBAL de la demo (Fase 5): sociedad / proyecto / rol / periodo.
// 100% mock y client-side. Nada de backend, fetch ni auth. La sociedad es fija.
type DemoContextValue = {
  sociedad: string;
  proyecto: ProyectoId;
  setProyecto: (p: ProyectoId) => void;
  rol: RolId;
  setRol: (r: RolId) => void;
  periodo: FiltroId;
  setPeriodo: (f: FiltroId) => void;
};

const DemoCtx = createContext<DemoContextValue | null>(null);

const STORAGE_KEY = 'antifragil.demo.contexto';

const isProyecto = (x: unknown): x is ProyectoId => PROYECTOS.some((p) => p.id === x);
const isRol = (x: unknown): x is RolId => ROLES.some((r) => r.id === x);
const isPeriodo = (x: unknown): x is FiltroId => FILTROS.some((f) => f.id === x);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  // Defaults deterministas → primer render (SSR y cliente) idéntico, sin hydration warnings.
  const [proyecto, setProyecto] = useState<ProyectoId>('todos');
  const [rol, setRol] = useState<RolId>('direccion');
  const [periodo, setPeriodo] = useState<FiltroId>('mes');

  // Cargar persistencia DESPUÉS de montar (no afecta al primer render).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Record<string, unknown>;
      if (isProyecto(s['proyecto'])) setProyecto(s['proyecto']);
      if (isRol(s['rol'])) setRol(s['rol']);
      if (isPeriodo(s['periodo'])) setPeriodo(s['periodo']);
    } catch {
      /* localStorage no disponible: se ignora */
    }
  }, []);

  // Persistir en cada cambio.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ proyecto, rol, periodo }));
    } catch {
      /* se ignora */
    }
  }, [proyecto, rol, periodo]);

  return (
    <DemoCtx.Provider value={{ sociedad: SOCIEDAD, proyecto, setProyecto, rol, setRol, periodo, setPeriodo }}>
      {children}
    </DemoCtx.Provider>
  );
}

export function useDemoContext(): DemoContextValue {
  const ctx = useContext(DemoCtx);
  if (!ctx) throw new Error('useDemoContext debe usarse dentro de <DemoProvider>');
  return ctx;
}
