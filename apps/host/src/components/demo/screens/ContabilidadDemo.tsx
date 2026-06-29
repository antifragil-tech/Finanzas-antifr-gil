import { BookOpen, FileStack, FolderClock, AlertCircle } from 'lucide-react';
import { ScreenShell } from './ScreenShell';
import { Bloque, Kpi, Fila, Tag } from '../panel/PanelKit';
import { demoContabilidad } from '../mock/demoData';

const C = demoContabilidad;

export function ContabilidadDemo() {
  return (
    <ScreenShell icon={BookOpen} titulo="Contabilidad y Gestoría" aviso="Precontabilidad demo · sin conexión a gestoría">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Bloque titulo="Facturas" icon={FileStack} tag={<Tag>mock</Tag>}>
          <Fila label="Recibidas pendientes" value={C.facturasRecibidasPendientes} />
          <Fila label="Emitidas pendientes" value={C.facturasEmitidasPendientes} />
          <Fila label="Incidencias" value={C.incidencias} tag={<Tag>demo</Tag>} />
        </Bloque>

        <Bloque titulo="Conciliación" icon={FolderClock} tag={<Tag>mock</Tag>}>
          <Kpi label={`Conciliado · ${C.estadoMensual.mes}`} value={`${C.estadoMensual.conciliadoPct}%`} />
          <Fila label="Extractos pendientes" value={C.extractosPendientes} />
          <Fila label="Asientos en borrador" value={C.estadoMensual.asientosBorrador} />
        </Bloque>

        <Bloque titulo="Documentos para gestoría" icon={BookOpen} tag={<Tag>demo</Tag>}>
          <div className="flex flex-col gap-2">
            {C.documentosGestoria.map((d) => (
              <div key={d} className="flex items-center gap-2 text-sm text-zinc-300">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" />
                {d}
              </div>
            ))}
          </div>
        </Bloque>

        <Bloque titulo="Incidencias" icon={AlertCircle} tag={<Tag>demo</Tag>}>
          <Fila label="Sin justificante" value={1} />
          <Fila label="Importe no coincide" value={1} />
          <p className="mt-1 text-2xs uppercase tracking-widest text-zinc-600">Estado mensual: en revisión</p>
        </Bloque>
      </div>
      <p className="mt-6 text-2xs uppercase tracking-widest text-amber-400/80">
        Precontabilidad demo · sin datos fiscales reales
      </p>
    </ScreenShell>
  );
}
