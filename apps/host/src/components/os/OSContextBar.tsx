'use client';

import { CENTROS, PERIODOS, ROLES } from './context/osGlobalOptions';
import type { CentroId, PeriodoId, RolId } from './context/osGlobalOptions';
import { useOSGlobalContext } from './context/useOSGlobalContext';

// Selectores del contexto global (centro/proyecto · periodo · rol) para el
// topbar del shell. El rol cambia la VISTA, no los permisos: es simulación de
// interfaz hasta que exista auth por rol real.

const selectClase =
  'rounded-lg border border-white/10 bg-zinc-900/80 px-2 py-1 text-xs text-zinc-300 outline-none transition-colors hover:border-white/20 focus:border-white/30';

export function OSContextBar() {
  const { centro, periodo, rol, setCentro, setPeriodo, setRol } = useOSGlobalContext();

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="os-centro">
        Centro o proyecto
      </label>
      <select
        id="os-centro"
        className={selectClase}
        value={centro}
        onChange={(e) => setCentro(e.target.value as CentroId)}
      >
        {CENTROS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="os-periodo">
        Periodo
      </label>
      <select
        id="os-periodo"
        className={selectClase}
        value={periodo}
        onChange={(e) => setPeriodo(e.target.value as PeriodoId)}
      >
        {PERIODOS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="os-rol">
        Rol operativo
      </label>
      <select
        id="os-rol"
        className={selectClase}
        value={rol}
        onChange={(e) => setRol(e.target.value as RolId)}
      >
        {ROLES.map((r) => (
          <option key={r.id} value={r.id}>
            Vista: {r.label}
          </option>
        ))}
      </select>
    </div>
  );
}
