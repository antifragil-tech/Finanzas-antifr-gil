'use client';

import { Building2 } from 'lucide-react';
import { useDemoContext } from './context/DemoContext';
import { PROYECTOS, ROLES, FILTROS, type ProyectoId, type RolId, type FiltroId } from './panel/panelMock';

// Barra de contexto del DemoShell (Fase 5): lee y ESCRIBE el contexto global
// (proyecto / rol / periodo). Sociedad fija. Todo mock, sin permisos reales.
const selectCls =
  'appearance-none rounded-lg border border-white/10 bg-zinc-900/70 px-2.5 py-1 text-xs text-zinc-200 transition-colors hover:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20';

export function DemoTopbar() {
  const { sociedad, proyecto, setProyecto, rol, setRol, periodo, setPeriodo } = useDemoContext();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-white/5 bg-zinc-950/80 px-6 backdrop-blur">
      <div className="hidden items-center gap-2 text-sm lg:flex">
        <Building2 size={15} className="text-zinc-500" />
        <span className="font-medium text-zinc-200">Grupo Empresarial Antifrágil</span>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-400 sm:inline-flex">
          Sociedad:&nbsp;<span className="text-zinc-100">{sociedad}</span>
        </span>

        <label className="flex items-center gap-1.5 text-2xs uppercase tracking-widest text-zinc-600">
          Proy.
          <select className={selectCls} value={proyecto} onChange={(e) => setProyecto(e.target.value as ProyectoId)}>
            {PROYECTOS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-2xs uppercase tracking-widest text-zinc-600">
          Rol
          <select className={selectCls} value={rol} onChange={(e) => setRol(e.target.value as RolId)}>
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-2xs uppercase tracking-widest text-zinc-600">
          Periodo
          <select className={selectCls} value={periodo} onChange={(e) => setPeriodo(e.target.value as FiltroId)}>
            {FILTROS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}
