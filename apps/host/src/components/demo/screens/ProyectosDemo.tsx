'use client';

import { FolderKanban } from 'lucide-react';
import { ScreenShell } from './ScreenShell';
import { Bloque, Fila, Tag } from '../panel/PanelKit';
import { getProyectos } from '../mock/demoData';
import { useDemoContext } from '../context/DemoContext';

const saludTone: Record<string, string> = {
  Buena: 'text-emerald-400',
  'En preparación': 'text-amber-400',
  Diferido: 'text-zinc-500',
};

const prioridadTone: Record<string, string> = {
  Alta: 'text-rose-400',
  Media: 'text-amber-400',
  Baja: 'text-zinc-500',
};

export function ProyectosDemo() {
  const { proyecto } = useDemoContext();
  const proyectos = getProyectos();

  return (
    <ScreenShell icon={FolderKanban} titulo="Proyectos" aviso="Datos de demostración · sin conexión a backend">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {proyectos.map((p) => {
          const activo = p.id === proyecto;
          return (
            <Bloque
              key={p.id}
              titulo={activo ? `→ ${p.label}` : p.label}
              icon={FolderKanban}
              tag={activo ? <Tag tone="warn">seleccionado</Tag> : <Tag>mock</Tag>}
            >
              <Fila label="Estado / Salud" value={<span className={saludTone[p.salud] ?? 'text-zinc-300'}>{p.salud}</span>} />
              <Fila label="Responsable" value={p.responsable} />
              <Fila
                label="Prioridad"
                value={<span className={prioridadTone[p.prioridad] ?? 'text-zinc-300'}>{p.prioridad}</span>}
              />
              <Fila
                label="Margen estimado (finanzas)"
                value={p.margen !== null ? `${p.margen}%` : <span className="text-zinc-500">—</span>}
                tag={<Tag>estimado</Tag>}
              />
              <div>
                <p className="mb-2 text-2xs uppercase tracking-widest text-zinc-600">Próximos hitos</p>
                <div className="flex flex-col gap-1.5">
                  {p.hitos.map((h) => (
                    <div key={h} className="flex items-center gap-2 text-sm text-zinc-300">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" />
                      {h}
                    </div>
                  ))}
                </div>
              </div>
            </Bloque>
          );
        })}
      </div>
      <p className="mt-6 text-2xs uppercase tracking-widest text-amber-400/80">Mapa de proyectos demo · estados y métricas mock, no reales</p>
    </ScreenShell>
  );
}
