'use client';

import { BookOpen, FileStack, FolderClock, AlertCircle } from 'lucide-react';
import { ScreenShell } from './ScreenShell';
import { Bloque, Kpi, Fila, Tag } from '../panel/PanelKit';
import { getContabilidad } from '../mock/demoData';
import { useDemoContext } from '../context/DemoContext';

export function ContabilidadDemo() {
  const { proyecto, periodo } = useDemoContext();
  const C = getContabilidad(proyecto, periodo);

  return (
    <ScreenShell icon={BookOpen} titulo="Contabilidad y Gestoría" aviso="Precontabilidad demo · sin conexión a gestoría">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Bloque titulo="Facturas" icon={FileStack} tag={<Tag>mock</Tag>}>
          <Fila label="Recibidas pendientes" value={C.recibidasPendientes} />
          <Fila label="Emitidas pendientes" value={C.emitidasPendientes} />
          <Fila label="Incidencias" value={C.incidencias} tag={<Tag>demo</Tag>} />
        </Bloque>

        <Bloque titulo="Conciliación" icon={FolderClock} tag={<Tag>mock</Tag>}>
          <Kpi label="Conciliado este mes" value={`${C.conciliadoPct}%`} />
          <Fila label="Extractos pendientes" value={C.extractosPendientes} />
          <Fila label="Asientos en borrador" value={C.asientosBorrador} />
        </Bloque>

        <Bloque titulo="Documentos para gestoría" icon={BookOpen} tag={<Tag>demo</Tag>}>
          {C.documentosGestoria.length > 0 ? (
            <div className="flex flex-col gap-2">
              {C.documentosGestoria.map((d) => (
                <div key={d} className="flex items-center gap-2 text-sm text-zinc-300">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" />
                  {d}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs text-zinc-600">Sin documentos · proyecto en preparación</span>
          )}
        </Bloque>

        <Bloque titulo="Incidencias" icon={AlertCircle} tag={<Tag>demo</Tag>}>
          <Fila label="Total incidencias" value={C.incidencias} />
          <p className="mt-1 text-2xs uppercase tracking-widest text-zinc-600">Estado mensual: en revisión</p>
        </Bloque>
      </div>
      <p className="mt-6 text-2xs uppercase tracking-widest text-amber-400/80">Precontabilidad demo · sin datos fiscales reales</p>
    </ScreenShell>
  );
}
