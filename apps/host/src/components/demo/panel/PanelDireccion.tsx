import { CalendarClock, Stethoscope, Wallet, AlertCircle, TrendingUp, FolderKanban } from 'lucide-react';
import { panelMock, PANEL_AVISO, type EstadoProyecto } from './panelMock';
import { Bloque, Kpi, Fila, Tag, eur } from './PanelKit';

const m = panelMock;

const estadoTone: Record<EstadoProyecto, string> = {
  Activo: 'text-emerald-400',
  'En preparación': 'text-amber-400',
  Diferido: 'text-zinc-500',
};

// Panel de Dirección (Demo v0.2 · Fase 2). Todo mock, server component estático.
export function PanelDireccion() {
  return (
    <div className="px-8 py-8">
      {/* Cabecera + banner de demo (que nada parezca dato real) */}
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-light tracking-tight text-white">Panel de Dirección</h1>
        <Tag tone="warn">Demo</Tag>
      </div>
      <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-2xs font-medium uppercase tracking-widest text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        {PANEL_AVISO}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* HOY */}
        <Bloque titulo="Hoy" icon={CalendarClock} href="/reservas" hrefLabel="Agenda">
          <Kpi label="Citas programadas hoy" value={m.hoy.citasHoy} />
          <Fila
            label="Próxima cita"
            value={`${m.hoy.proxima.hora} · ${m.hoy.proxima.servicio} · ${m.hoy.proxima.profesional}`}
          />
          <Fila label="Completadas" value={m.hoy.completadas} />
          <Fila label="Pendientes de confirmar" value={m.hoy.pendientesConfirmar} />
        </Bloque>

        {/* CLÍNICA */}
        <Bloque titulo="Clínica" icon={Stethoscope} href="/reservas" hrefLabel="Abrir Agenda">
          <Kpi label="Sesiones del mes" value={m.clinica.sesionesMes} />
          <Fila label="Ocupación estimada" value={`${m.clinica.ocupacionPct}%`} tag={<Tag>estimado</Tag>} />
          <div>
            <p className="mb-2 text-2xs uppercase tracking-widest text-zinc-600">Servicios principales</p>
            <div className="flex flex-wrap gap-1.5">
              {m.clinica.servicios.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </Bloque>

        {/* TESORERÍA */}
        <Bloque titulo="Tesorería" icon={Wallet}>
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Banco operativo" value={eur(m.tesoreria.bancoOperativo)} tag={<Tag>mock</Tag>} />
            <Kpi label="Caja efectivo" value={eur(m.tesoreria.cajaEfectivo)} tag={<Tag>mock</Tag>} />
          </div>
          <Fila label="Cobros pendientes" value={eur(m.tesoreria.cobrosPendientes)} tag={<Tag>mock</Tag>} />
          <Fila label="Pagos próximos" value={eur(m.tesoreria.pagosProximos)} tag={<Tag>mock</Tag>} />
        </Bloque>

        {/* PENDIENTES */}
        <Bloque titulo="Pendientes" icon={AlertCircle}>
          <Fila
            label="Cobros pendientes"
            value={`${eur(m.pendientes.cobrosPendientes.importe)} · ${m.pendientes.cobrosPendientes.clientes} clientes`}
            tag={<Tag>mock</Tag>}
          />
          <Fila label="Citas sin abonar" value={m.pendientes.citasSinAbonar} />
          <Fila label="Vivofácil" value={m.pendientes.vivofacil} />
          <Fila label="Facturas/pagos por revisar" value={m.pendientes.facturasPorRevisar} />
        </Bloque>

        {/* RENTABILIDAD */}
        <Bloque titulo="Rentabilidad" icon={TrendingUp}>
          <Kpi
            label="Margen estimado Clínica"
            value={`${m.rentabilidad.margenClinicaPct}%`}
            tag={<Tag tone="warn">estimado</Tag>}
          />
          <div className="flex flex-col gap-2">
            {m.rentabilidad.porServicio.map((s) => (
              <Fila key={s.servicio} label={s.servicio} value={`${s.margenPct}%`} />
            ))}
          </div>
          <Fila
            label="Coste profesional/sesión"
            value={eur(m.rentabilidad.costeProfesionalSesion)}
            tag={<Tag>estimado</Tag>}
          />
          <p className="mt-1 text-2xs font-medium uppercase tracking-widest text-amber-400/80">
            {m.rentabilidad.aviso}
          </p>
        </Bloque>

        {/* PROYECTOS */}
        <Bloque titulo="Proyectos" icon={FolderKanban} href="/presupuestos" hrefLabel="Ver">
          <div className="flex flex-col gap-2">
            {m.proyectos.map((p) => (
              <Fila
                key={p.nombre}
                label={p.nombre}
                value={<span className={estadoTone[p.estado]}>{p.estado}</span>}
              />
            ))}
          </div>
        </Bloque>
      </div>
    </div>
  );
}
