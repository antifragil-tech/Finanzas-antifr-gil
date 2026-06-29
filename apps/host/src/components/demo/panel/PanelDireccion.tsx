'use client';

import { useState } from 'react';
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
  ROLES,
  FILTROS,
  PROYECTOS_ESTADO,
  ROL_BLOQUES,
  getPanel,
  SOCIEDAD,
  PANEL_AVISO,
  ROL_AVISO,
  type ProyectoId,
  type RolId,
  type FiltroId,
  type BloqueId,
  type EstadoProyecto,
} from './panelMock';
import { Bloque, Kpi, Fila, Tag, eur } from './PanelKit';

const estadoTone: Record<EstadoProyecto, string> = {
  Activo: 'text-emerald-400',
  'En preparación': 'text-amber-400',
  Diferido: 'text-zinc-500',
};

const selectCls =
  'appearance-none rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-200 transition-colors hover:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20';

// Panel de Dirección (Demo v0.2 · Fase 3). Interactivo y 100% mock: el estado
// (proyecto / rol / periodo) solo reordena datos mock; NO hay backend ni auth.
export function PanelDireccion() {
  const [proyecto, setProyecto] = useState<ProyectoId>('todos');
  const [rol, setRol] = useState<RolId>('direccion');
  const [filtro, setFiltro] = useState<FiltroId>('mes');

  const v = getPanel(proyecto, filtro);
  const visibles = ROL_BLOQUES[rol];
  const ve = (b: BloqueId) => visibles.includes(b);
  const proyectoLabel = PROYECTOS.find((p) => p.id === proyecto)?.label ?? 'Todos';

  return (
    <div className="px-8 py-8">
      {/* Cabecera + banner de demo */}
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-light tracking-tight text-white">Panel de Dirección</h1>
        <Tag tone="warn">Demo</Tag>
      </div>
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-2xs font-medium uppercase tracking-widest text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        {PANEL_AVISO}
      </div>

      {/* Barra de control (selectores mock) */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-400">
          Sociedad: <span className="text-zinc-100">{SOCIEDAD}</span>
        </span>

        <label className="flex items-center gap-2 text-2xs uppercase tracking-widest text-zinc-600">
          Proyecto
          <select className={selectCls} value={proyecto} onChange={(e) => setProyecto(e.target.value as ProyectoId)}>
            {PROYECTOS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-2xs uppercase tracking-widest text-zinc-600">
          Rol
          <select className={selectCls} value={rol} onChange={(e) => setRol(e.target.value as RolId)}>
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-1 rounded-lg border border-white/10 bg-zinc-900/60 p-1">
          {FILTROS.map((ft) => (
            <button
              key={ft.id}
              type="button"
              onClick={() => setFiltro(ft.id)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filtro === ft.id ? 'bg-zinc-700/70 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {ft.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contexto + aviso de rol */}
      <div className="mb-7 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs uppercase tracking-widest">
        <span className="text-zinc-500">
          {proyectoLabel} · {v.contexto}
        </span>
        {v.diferido ? <Tag>diferido</Tag> : null}
        <span className="text-amber-400/80">· {ROL_AVISO}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* HOY */}
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

        {/* CLÍNICA */}
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

        {/* TESORERÍA */}
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

        {/* PENDIENTES */}
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

        {/* RENTABILIDAD (completa) */}
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

        {/* RENTABILIDAD (clínica simplificada — rol Responsable) */}
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

        {/* PROYECTOS */}
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

        {/* ACCESOS OPERATIVOS (rol Recepción) */}
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

        {/* MI ACTIVIDAD (rol Profesional) */}
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
