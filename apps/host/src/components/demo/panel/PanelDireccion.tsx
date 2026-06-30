'use client';

import Link from 'next/link';
import {
  CalendarClock,
  Stethoscope,
  Wallet,
  AlertCircle,
  TrendingUp,
  FolderKanban,
  User,
  LayoutGrid,
  ChevronRight,
} from 'lucide-react';
import {
  PROYECTOS,
  PROYECTOS_ESTADO,
  ROL_BLOQUES,
  getPanel,
  ROL_AVISO,
  type BloqueId,
  type EstadoProyecto,
} from './panelMock';
import { Bloque, Kpi, Fila, Tag, eur } from './PanelKit';
import { useDemoContext } from '../context/DemoContext';

const estadoTone: Record<EstadoProyecto, string> = {
  Activo: 'text-emerald-400',
  'En preparación': 'text-amber-400',
  Diferido: 'text-zinc-500',
};

// Panel de Dirección (Demo v0.2 · Fase 5). Lee el CONTEXTO GLOBAL (proyecto /
// rol / periodo); los selectores viven en la topbar. 100% mock, sin backend.
export function PanelDireccion() {
  const { proyecto, rol, periodo } = useDemoContext();

  const v = getPanel(proyecto, periodo);
  const visibles = ROL_BLOQUES[rol];
  const ve = (b: BloqueId) => visibles.includes(b);
  const proyectoLabel = PROYECTOS.find((p) => p.id === proyecto)?.label ?? 'Todos';

  return (
    <div className="px-8 py-8">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-light tracking-tight text-white">Panel de Dirección</h1>
        <Tag tone="warn">Demo</Tag>
      </div>
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-2xs font-medium uppercase tracking-widest text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Datos de demostración · sin conexión a backend
      </div>

      <div className="mb-7 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs uppercase tracking-widest">
        <span className="text-zinc-500">
          {proyectoLabel} · {v.contexto} · {v.filtroLabel}
        </span>
        {v.diferido ? <Tag>diferido</Tag> : null}
        <span className="text-amber-400/80">· {ROL_AVISO}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ve('hoy') && (
          <Bloque titulo="Hoy" icon={CalendarClock} href="/reservas" hrefLabel="Agenda">
            <Kpi label={`Citas programadas · ${v.filtroLabel}`} value={v.hoy.citas} />
            <Fila
              label="Próxima cita"
              value={v.hoy.proxima ? `${v.hoy.proxima.hora} · ${v.hoy.proxima.servicio} · ${v.hoy.proxima.profesional}` : '—'}
            />
            <Fila label="Completadas" value={v.hoy.completadas} />
            <Fila label="Pendientes de confirmar" value={v.hoy.pendientesConfirmar} />
          </Bloque>
        )}

        {ve('clinica') && (
          <Bloque titulo="Clínica" icon={Stethoscope} href="/reservas" hrefLabel="Abrir Agenda">
            <Kpi label={`Sesiones · ${v.filtroLabel}`} value={v.clinica.sesiones} />
            <Fila
              label="Ocupación estimada"
              value={v.clinica.ocupacionPct > 0 ? `${v.clinica.ocupacionPct}%` : '—'}
              tag={<Tag>estimado</Tag>}
            />
            <div>
              <p className="mb-2 text-2xs uppercase tracking-widest text-zinc-600">Servicios principales</p>
              <div className="flex flex-wrap gap-1.5">
                {v.clinica.servicios.length > 0 ? (
                  v.clinica.servicios.map((s) => (
                    <span key={s} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300">
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-zinc-600">Sin actividad</span>
                )}
              </div>
            </div>
          </Bloque>
        )}

        {ve('tesoreria') && (
          <Bloque titulo="Tesorería" icon={Wallet} tag={<Tag>sin backend</Tag>}>
            <div className="grid grid-cols-2 gap-3">
              <Kpi label="Banco operativo" value={eur(v.tesoreria.banco)} tag={<Tag>mock</Tag>} />
              <Kpi label="Caja efectivo" value={eur(v.tesoreria.caja)} tag={<Tag>mock</Tag>} />
            </div>
            <Fila label={`Cobros pendientes · ${v.filtroLabel}`} value={eur(v.tesoreria.cobros)} tag={<Tag>mock</Tag>} />
            <Fila label={`Pagos próximos · ${v.filtroLabel}`} value={eur(v.tesoreria.pagos)} tag={<Tag>mock</Tag>} />
          </Bloque>
        )}

        {ve('pendientes') && (
          <Bloque titulo="Pendientes" icon={AlertCircle}>
            <Fila
              label="Cobros pendientes"
              value={`${eur(v.pendientes.cobros.importe)} · ${v.pendientes.cobros.clientes} clientes`}
              tag={<Tag>mock</Tag>}
            />
            <Fila label="Citas sin abonar" value={v.pendientes.citasSinAbonar} />
            <Fila label="Vivofácil" value={v.pendientes.vivofacil} />
            <Fila label="Facturas/pagos por revisar" value={v.pendientes.facturas} />
          </Bloque>
        )}

        {ve('rentabilidad') && (
          <Bloque titulo="Rentabilidad" icon={TrendingUp} tag={<Tag>no real</Tag>}>
            <Kpi
              label="Margen estimado Clínica"
              value={v.rentabilidad.margenClinicaPct !== null ? `${v.rentabilidad.margenClinicaPct}%` : '—'}
              tag={<Tag tone="warn">estimado</Tag>}
            />
            <div className="flex flex-col gap-2">
              {v.rentabilidad.porServicio.length > 0 ? (
                v.rentabilidad.porServicio.map((s) => <Fila key={s.servicio} label={s.servicio} value={`${s.margenPct}%`} />)
              ) : (
                <span className="text-xs text-zinc-600">Sin rentabilidad en preparación</span>
              )}
            </div>
            {v.rentabilidad.costeProfesionalSesion !== null && (
              <Fila label="Coste profesional/sesión" value={eur(v.rentabilidad.costeProfesionalSesion)} tag={<Tag>estimado</Tag>} />
            )}
            <p className="mt-1 text-2xs font-medium uppercase tracking-widest text-amber-400/80">estimación mock, no real</p>
          </Bloque>
        )}

        {ve('rentabilidadSimple') && (
          <Bloque titulo="Rentabilidad Clínica" icon={TrendingUp} tag={<Tag>no real</Tag>}>
            <Kpi
              label="Margen estimado Clínica"
              value={v.rentabilidad.margenClinicaPct !== null ? `${v.rentabilidad.margenClinicaPct}%` : '—'}
              tag={<Tag tone="warn">estimado</Tag>}
            />
            <div className="flex flex-col gap-2">
              {v.rentabilidad.porServicio.length > 0 ? (
                v.rentabilidad.porServicio.map((s) => <Fila key={s.servicio} label={s.servicio} value={`${s.margenPct}%`} />)
              ) : (
                <span className="text-xs text-zinc-600">Sin rentabilidad en preparación</span>
              )}
            </div>
            <p className="mt-1 text-2xs font-medium uppercase tracking-widest text-amber-400/80">vista simplificada · mock</p>
          </Bloque>
        )}

        {ve('proyectos') && (
          <Bloque titulo="Proyectos" icon={FolderKanban} href="/presupuestos" hrefLabel="Ver">
            <div className="flex flex-col gap-2">
              {PROYECTOS_ESTADO.map((p) => {
                const activo = p.id === proyecto;
                return (
                  <Fila
                    key={p.id}
                    label={activo ? `→ ${p.nombre}` : p.nombre}
                    value={<span className={estadoTone[p.estado]}>{p.estado}</span>}
                  />
                );
              })}
            </div>
          </Bloque>
        )}

        {ve('accesos') && (
          <Bloque titulo="Accesos operativos" icon={LayoutGrid}>
            <Link
              href="/reservas"
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/10"
            >
              Abrir Agenda
              <ChevronRight size={14} className="text-zinc-500" />
            </Link>
            <Link
              href="/reservas"
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/10"
            >
              Crear cita
              <ChevronRight size={14} className="text-zinc-500" />
            </Link>
            <p className="mt-1 text-2xs uppercase tracking-widest text-zinc-600">Accesos de ejemplo · demo</p>
          </Bloque>
        )}

        {ve('miActividad') && (
          <Bloque titulo="Mi actividad" icon={User} href="/reservas" hrefLabel="Agenda" tag={<Tag>demo</Tag>}>
            <Kpi label="Mis sesiones hoy" value={v.miActividad.sesionesHoy} />
            <Fila
              label="Próxima"
              value={v.miActividad.proxima ? `${v.miActividad.proxima.hora} · ${v.miActividad.proxima.servicio}` : '—'}
            />
            <Fila label="Completadas" value={v.miActividad.completadas} />
            <p className="mt-1 text-2xs uppercase tracking-widest text-zinc-600">Sin tesorería ni rentabilidad global</p>
          </Bloque>
        )}
      </div>
    </div>
  );
}
