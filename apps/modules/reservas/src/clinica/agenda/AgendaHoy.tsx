import { useState, useEffect, useRef } from 'react';
import { DayPilotCalendar } from '@daypilot/daypilot-lite-react';
import { Plus } from 'lucide-react';
import { Button } from '@alsari/ui';
import {
  PROFESIONALES,
  PROF_COLOR,
  SERVICIOS,
  ORIGENES,
  getServicio,
  type OrigenCita,
  type CategoriaServicio,
} from '../../spike/mockData';
import { ESTADO_META, PAGO_SIN_ABONAR } from '../../spike/estados';
import { CitaPanel, type CitaPanelMode } from '../CitaPanel';
import { useCitasStore } from '../CitasStore';
import { repartirCarriles } from './lanes';

type DPId = string | number;
type DPDate = { toString: (fmt?: string) => string };
interface DPEvent {
  id: () => DPId;
}
interface ClickArgs {
  e: DPEvent;
}
interface RangeArgs {
  start: DPDate;
  end: DPDate;
  resource?: DPId;
}
interface RenderArgs {
  data: {
    id: DPId;
    backColor?: string;
    borderColor?: string;
    barColor?: string;
    fontColor?: string;
    cssClass?: string;
    html?: string;
  };
}

const hhmm = (iso: string) => iso.slice(11, 16);

// Vista "Hoy" por profesional (Clínica > Agenda > Hoy). Núcleo de recepción:
// columnas = profesionales, filas = horas, lectura rápida de huecos y citas,
// línea de "ahora", KPIs del día y clic en hueco para cita rápida. Las citas
// viven en el store compartido del módulo (CitasStore); aquí solo se filtra hoy.
export function AgendaHoy({ panelMode = 'fixed' }: { panelMode?: CitaPanelMode } = {}) {
  const c = useCitasStore();
  const hoy = c.hoy;
  const citasHoy = c.citas.filter((x) => x.inicio.startsWith(hoy));
  const [calendar, setCalendar] = useState<
    { clearSelection: () => void; update: (cfg: Record<string, unknown>) => void } | undefined
  >();
  const panelRef = useRef<HTMLDivElement>(null);
  const repartoRaf = useRef<number | null>(null);
  const [profVisibles, setProfVisibles] = useState<string[]>(PROFESIONALES.map((p) => p.id));
  const [servFiltro, setServFiltro] = useState<CategoriaServicio | 'todos'>('todos');
  const [origenFiltro, setOrigenFiltro] = useState<OrigenCita | 'todos'>('todos');

  const profsOn = profVisibles.length ? profVisibles : PROFESIONALES.map((p) => p.id);
  const citasVisibles = citasHoy.filter(
    (x) =>
      profsOn.includes(x.profesional_id) &&
      (servFiltro === 'todos' || getServicio(x.servicio_id)?.categoria === servFiltro) &&
      (origenFiltro === 'todos' || x.origen === origenFiltro),
  );
  const columns = PROFESIONALES.filter((p) => profsOn.includes(p.id)).map((p) => ({ name: p.nombre, id: p.id }));
  const events = citasVisibles.map((x) => ({
    id: x.id,
    start: x.inicio,
    end: x.fin,
    text: x.cliente_nombre,
    resource: x.profesional_id,
  }));

  const toggleProf = (id: string) =>
    setProfVisibles((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // KPIs del día (lo que recepción necesita de un vistazo).
  const sinConfirmar = citasHoy.filter((x) => x.estado_cita === 'pendiente').length;
  const noShow = citasHoy.filter((x) => x.estado_cita === 'no_asiste').length;
  const sinAbonar = citasHoy.filter(
    (x) =>
      (x.estado_cita === 'completada' || x.estado_cita === 'no_asiste') &&
      PAGO_SIN_ABONAR.includes(x.estado_pago),
  ).length;
  const kpis = [
    { label: 'Citas hoy', value: citasHoy.length, tone: 'text-zinc-100' },
    { label: 'Sin confirmar', value: sinConfirmar, tone: 'text-amber-300' },
    { label: 'Sin abonar', value: sinAbonar, tone: 'text-amber-300' },
    { label: 'No-show', value: noShow, tone: 'text-rose-300' },
  ];

  const onBeforeEventRender = (args: RenderArgs) => {
    const cita = citasHoy.find((x) => x.id === String(args.data.id));
    if (!cita) return;
    const m = ESTADO_META[cita.estado_cita];
    const serv = getServicio(cita.servicio_id);
    args.data.backColor = 'rgba(255,255,255,0.035)';
    args.data.borderColor = 'rgba(255,255,255,0.10)';
    args.data.barColor = PROF_COLOR[cita.profesional_id] ?? '#71717a';
    args.data.fontColor = '#e8e8ea';
    const clases = [`dp-serv-${serv?.categoria ?? 'otro'}`];
    if (cita.estado_cita === 'cancelada') clases.push('dp-cancelada');
    args.data.cssClass = clases.join(' ');
    args.data.html = `
      <div class="dp-ev">
        <div class="dp-ev-cli">
          <span><span class="dp-ev-time">${hhmm(cita.inicio)}</span> ${cita.cliente_nombre}</span>
          <i class="dp-ev-estado" style="background:${m.bar}"></i>
        </div>
        <div class="dp-ev-sub">${serv?.nombre ?? ''}</div>
      </div>`;
  };

  const onEventClick = (args: ClickArgs) => c.setSelectedId(String(args.e.id()));

  const onTimeRangeSelected = (args: RangeArgs) => {
    c.crearCita(
      args.start.toString(),
      args.end.toString(),
      args.resource != null ? String(args.resource) : undefined,
    );
    calendar?.clearSelection();
  };

  const nuevaCitaBoton = () => c.crearCita(`${hoy}T10:00:00`, `${hoy}T10:45:00`);

  // Ancho de columna fijo para que las columnas por profesional no se compriman.
  useEffect(() => {
    if (!calendar) return;
    calendar.update({ dayBeginsHour: 7, dayEndsHour: 22, cellWidthSpec: 'Fixed', cellWidth: 200 });
  }, [calendar]);

  // Reparto en carriles tras cada render (citas simultáneas de un profesional).
  const programarReparto = () => {
    if (repartoRaf.current != null) cancelAnimationFrame(repartoRaf.current);
    repartoRaf.current = requestAnimationFrame(() => {
      repartoRaf.current = null;
      repartirCarriles(panelRef.current);
    });
  };
  useEffect(() => () => {
    if (repartoRaf.current != null) cancelAnimationFrame(repartoRaf.current);
  }, []);

  const fechaLabel = new Date(`${hoy}T00:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm capitalize text-zinc-300">{fechaLabel}</p>
        <Button variant="primary" size="sm" icon={Plus} onClick={nuevaCitaBoton}>
          Cita rápida
        </Button>
      </div>

      {/* KPIs del día */}
      <div className="flex flex-wrap gap-2">
        {kpis.map((k) => (
          <div key={k.label} className="glass-panel flex items-baseline gap-2 rounded-lg px-3 py-1.5">
            <span className={`text-base font-semibold ${k.tone}`}>{k.value}</span>
            <span className="text-2xs uppercase tracking-widest text-zinc-500">{k.label}</span>
          </div>
        ))}
      </div>

      {/* Filtros rápidos (profesional · servicio · origen) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-2xs uppercase tracking-widest text-zinc-600">Prof.</span>
          {PROFESIONALES.map((p) => {
            const on = profVisibles.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggleProf(p.id)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${
                  on ? 'border-white/10 bg-zinc-800 text-zinc-100' : 'border-white/5 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <i className="h-2 w-2 rounded-full" style={{ background: on ? PROF_COLOR[p.id] : '#3f3f46' }} />
                {p.nombre.split(' ')[0]}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-2xs uppercase tracking-widest text-zinc-600">Servicio</span>
          <Button variant={servFiltro === 'todos' ? 'secondary' : 'ghost'} size="sm" onClick={() => setServFiltro('todos')}>
            Todos
          </Button>
          {SERVICIOS.map((s) => (
            <Button
              key={s.id}
              variant={servFiltro === s.categoria ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setServFiltro(s.categoria)}
            >
              {s.nombre}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-2xs uppercase tracking-widest text-zinc-600">Origen</span>
          <Button variant={origenFiltro === 'todos' ? 'secondary' : 'ghost'} size="sm" onClick={() => setOrigenFiltro('todos')}>
            Todos
          </Button>
          {ORIGENES.map((o) => (
            <Button
              key={o.id}
              variant={origenFiltro === o.id ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setOrigenFiltro(o.id)}
            >
              {o.label}
            </Button>
          ))}
        </div>
      </div>

      <div ref={panelRef} className="dp-quiet glass-panel min-h-0 flex-1 overflow-auto rounded-xl p-1.5">
        <div style={{ minWidth: `${PROFESIONALES.length * 200 + 64}px` }}>
          <DayPilotCalendar
            startDate={hoy}
            events={events}
            locale="es-es"
            viewType="Resources"
            columns={columns}
            timeFormat="Clock24Hours"
            businessBeginsHour={7}
            businessEndsHour={22}
            heightSpec="BusinessHours"
            cellHeight={34}
            durationBarVisible={true}
            eventMoveHandling="Disabled"
            eventResizeHandling="Disabled"
            timeRangeSelectedHandling="Enabled"
            onBeforeEventRender={onBeforeEventRender}
            onEventClick={onEventClick}
            onTimeRangeSelected={onTimeRangeSelected}
            onAfterEventRender={programarReparto}
            controlRef={setCalendar}
          />
        </div>
      </div>

      <CitaPanel
        cita={c.seleccionada}
        onClose={() => c.setSelectedId(null)}
        onAccion={c.onAccion}
        onPago={c.onPago}
        onOrigen={c.onOrigen}
        mode={panelMode}
      />
    </div>
  );
}
