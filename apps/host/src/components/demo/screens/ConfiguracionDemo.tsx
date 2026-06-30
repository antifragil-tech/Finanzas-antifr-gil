'use client';

import { Settings, Building2, FolderKanban, Users, LayoutGrid } from 'lucide-react';
import { ScreenShell } from './ScreenShell';
import { Bloque, Fila, Tag } from '../panel/PanelKit';
import { getConfiguracion } from '../mock/demoData';
import { useDemoContext } from '../context/DemoContext';

const estadoTone: Record<string, string> = {
  Activo: 'text-emerald-400',
  'En preparación': 'text-amber-400',
  Diferido: 'text-zinc-500',
};

export function ConfiguracionDemo() {
  const { proyecto, rol } = useDemoContext();
  const C = getConfiguracion();

  return (
    <ScreenShell icon={Settings} titulo="Configuración" aviso="Configuración demo · no modifica permisos reales">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Bloque titulo="Sociedad" icon={Building2} tag={<Tag>demo</Tag>}>
          <Fila label="Sociedad actual" value={C.sociedad} />
          <Fila label="Proyectos configurados" value={C.proyectos.length} />
        </Bloque>

        <Bloque titulo="Proyectos" icon={FolderKanban} tag={<Tag>mock</Tag>}>
          {C.proyectos.map((p) => (
            <Fila
              key={p.id}
              label={p.id === proyecto ? `→ ${p.nombre}` : p.nombre}
              value={<span className={estadoTone[p.estado] ?? 'text-zinc-300'}>{p.estado}</span>}
            />
          ))}
        </Bloque>

        <Bloque titulo="Roles" icon={Users} tag={<Tag>demo</Tag>}>
          {C.roles.map((r) => (
            <Fila
              key={r.id}
              label={r.id === rol ? `→ ${r.label}` : r.label}
              value={r.id === rol ? <Tag tone="warn">activo</Tag> : <Tag>demo</Tag>}
            />
          ))}
          <p className="mt-1 text-2xs uppercase tracking-widest text-amber-400/80">no modifica permisos reales</p>
        </Bloque>

        <Bloque titulo="Módulos" icon={LayoutGrid} tag={<Tag>demo</Tag>}>
          {C.modulos.map((m) => (
            <Fila
              key={m.nombre}
              label={m.nombre}
              value={<span className={m.activo ? 'text-emerald-400' : 'text-zinc-500'}>{m.activo ? 'Activo' : 'Inactivo'}</span>}
            />
          ))}
        </Bloque>
      </div>
    </ScreenShell>
  );
}
