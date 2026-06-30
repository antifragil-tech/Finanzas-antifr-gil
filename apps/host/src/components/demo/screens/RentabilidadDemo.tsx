'use client';

import { TrendingUp, Activity, Users } from 'lucide-react';
import { ScreenShell, RestriccionRol } from './ScreenShell';
import { Bloque, Kpi, Fila, Tag, eur } from '../panel/PanelKit';
import { getRentabilidad, acceso, rolLabel } from '../mock/demoData';
import { useDemoContext } from '../context/DemoContext';

export function RentabilidadDemo() {
  const { proyecto, periodo, rol } = useDemoContext();

  if (!acceso.rentabilidad(rol)) {
    return (
      <ScreenShell icon={TrendingUp} titulo="Rentabilidad" aviso="Datos de demostración · sin conexión a backend">
        <RestriccionRol area="Rentabilidad global" rolLabel={rolLabel(rol)} />
      </ScreenShell>
    );
  }

  const R = getRentabilidad(proyecto, periodo);

  return (
    <ScreenShell icon={TrendingUp} titulo="Rentabilidad" aviso="Datos de demostración · sin conexión a backend">
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Bloque titulo="Sesiones completadas" icon={Activity} tag={<Tag>mock</Tag>}>
          <Kpi label="En el periodo" value={R.sesionesCompletadas} />
        </Bloque>
        <Bloque titulo="Ingreso medio / sesión" icon={Users} tag={<Tag>estimado</Tag>}>
          <Kpi label="Estimado" value={eur(R.ingresoMedioSesion)} tag={<Tag>estimado</Tag>} />
        </Bloque>
        <Bloque titulo="Coste profesional / sesión" icon={Users} tag={<Tag>estimado</Tag>}>
          <Kpi
            label="Estimado"
            value={R.costeProfesionalSesion !== null ? eur(R.costeProfesionalSesion) : '—'}
            tag={<Tag>estimado</Tag>}
          />
        </Bloque>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Bloque titulo="Margen por servicio" icon={TrendingUp} tag={<Tag>no real</Tag>}>
          {R.porServicio.length > 0 ? (
            R.porServicio.map((s) => <Fila key={s.servicio} label={s.servicio} value={`${s.margenPct}%`} />)
          ) : (
            <span className="text-xs text-zinc-600">Sin desglose por servicio · proyecto en preparación</span>
          )}
          <p className="mt-1 text-2xs font-medium uppercase tracking-widest text-amber-400/80">estimación mock, no real</p>
        </Bloque>

        <Bloque titulo="Margen por proyecto" icon={TrendingUp} tag={<Tag>no real</Tag>}>
          {R.proyectos.map((p) => (
            <Fila
              key={p.id}
              label={p.id === proyecto ? `→ ${p.label}` : p.label}
              value={p.margen !== null ? `${p.margen}%` : <span className="text-zinc-500">—</span>}
              tag={p.sesiones > 0 ? <Tag>{`${p.sesiones} ses.`}</Tag> : undefined}
            />
          ))}
          <p className="mt-1 text-2xs font-medium uppercase tracking-widest text-amber-400/80">estimación mock, no real</p>
        </Bloque>
      </div>
    </ScreenShell>
  );
}
