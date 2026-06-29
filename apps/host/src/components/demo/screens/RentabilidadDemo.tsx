import { TrendingUp, Activity, Users } from 'lucide-react';
import { ScreenShell } from './ScreenShell';
import { Bloque, Kpi, Fila, Tag, eur } from '../panel/PanelKit';
import { demoRentabilidad } from '../mock/demoData';

const R = demoRentabilidad;

export function RentabilidadDemo() {
  return (
    <ScreenShell icon={TrendingUp} titulo="Rentabilidad" aviso="Datos de demostración · sin conexión a backend">
      {/* KPIs globales */}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Bloque titulo="Sesiones completadas" icon={Activity} tag={<Tag>mock</Tag>}>
          <Kpi label="Este mes" value={R.sesionesCompletadas} />
        </Bloque>
        <Bloque titulo="Ingreso medio / sesión" icon={Users} tag={<Tag>estimado</Tag>}>
          <Kpi label="Estimado" value={eur(R.ingresoMedioSesion)} tag={<Tag>estimado</Tag>} />
        </Bloque>
        <Bloque titulo="Coste profesional / sesión" icon={Users} tag={<Tag>estimado</Tag>}>
          <Kpi label="Estimado" value={eur(R.costeProfesionalSesion)} tag={<Tag>estimado</Tag>} />
        </Bloque>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Bloque titulo="Margen por servicio" icon={TrendingUp} tag={<Tag>no real</Tag>}>
          {R.porServicio.map((s) => (
            <Fila key={s.servicio} label={s.servicio} value={`${s.margenPct}%`} />
          ))}
          <p className="mt-1 text-2xs font-medium uppercase tracking-widest text-amber-400/80">estimación mock, no real</p>
        </Bloque>

        <Bloque titulo="Margen por proyecto" icon={TrendingUp} tag={<Tag>no real</Tag>}>
          {R.proyectos.map((p) => (
            <Fila
              key={p.id}
              label={p.label}
              value={p.margen !== null ? `${p.margen}%` : <span className="text-zinc-500">—</span>}
              tag={p.sesionesCompletadas > 0 ? <Tag>{`${p.sesionesCompletadas} ses.`}</Tag> : undefined}
            />
          ))}
          <p className="mt-1 text-2xs font-medium uppercase tracking-widest text-amber-400/80">estimación mock, no real</p>
        </Bloque>
      </div>
    </ScreenShell>
  );
}
