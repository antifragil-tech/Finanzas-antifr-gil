import { useState, useEffect, useRef } from 'react';
import { DayPilotCalendar, DayPilot } from '@daypilot/daypilot-lite-react';
import { Plus } from 'lucide-react';
import { Button } from '@alsari/ui';
import {
  PROFESIONALES,
  PROF_COLOR,
  crearCitasMock,
  getServicio,
  getProfesional,
  type CitaMock,
  type EstadoCita,
} from '../../spike/mockData';
import { ESTADO_META, PAGO_SIN_ABONAR } from '../../spike/estados';
import { CitaModal, type AccionCita } from '../../spike/CitaModal';
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
const ahora = () => new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const servicioPorRol = (rol?: string) =>
  rol === 'Entrenador personal' ? 'sv3' : rol === 'Nutricionista' ? 'sv4' : 'sv1';

// Vista "Hoy" por profesional (Clínica > Agenda > Hoy). Núcleo de recepción:
// columnas = profesionales, filas = horas, lectura rápida de huecos y citas,
// línea de "ahora", KPIs del día y clic en hueco para cita rápida.
export function AgendaHoy() {
  const hoy = DayPilot.Date.today().toString('yyyy-MM-dd');
  const [citas, setCitas] = useState<CitaMock[]>(() =>
    crearCitasMock(hoy).filter((c) => c.inicio.startsWith(hoy)),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<
    { clearSelection: () => void; update: (cfg: Record<string, unknown>) => void } | undefined
  >();
  const panelRef = useRef<HTMLDivElement>(null);
  const repartoRaf = useRef<number | null>(null);

  const seleccionada = citas.find((c) => c.id === selectedId) ?? null;
  const columns = PROFESIONALES.map((p) => ({ name: p.nombre, id: p.id }));
  const events = citas.map((c) => ({
    id: c.id,
    start: c.inicio,
    end: c.fin,
    text: c.cliente_nombre,
    resource: c.profesional_id,
  }));

  // KPIs del día (lo que recepción necesita de un vistazo).
  const sinConfirmar = citas.filter((c) => c.estado_cita === 'pendiente').length;
  const noShow = citas.filter((c) => c.estado_cita === 'no_asiste').length;
  const sinAbonar = citas.filter(
    (c) =>
      (c.estado_cita === 'completada' || c.estado_cita === 'no_asiste') &&
      PAGO_SIN_ABONAR.includes(c.estado_pago),
  ).length;
  const kpis = [
    { label: 'Citas hoy', value: citas.length, tone: 'text-zinc-100' },
    { label: 'Sin confirmar', value: sinConfirmar, tone: 'text-amber-300' },
    { label: 'Sin abonar', value: sinAbonar, tone: 'text-amber-300' },
    { label: 'No-show', value: noShow, tone: 'text-rose-300' },
  ];

  const onBeforeEventRender = (args: RenderArgs) => {
    const c = citas.find((x) => x.id === String(args.data.id));
    if (!c) return;
    const m = ESTADO_META[c.estado_cita];
    const serv = getServicio(c.servicio_id);
    args.data.backColor = 'rgba(255,255,255,0.035)';
    args.data.borderColor = 'rgba(255,255,255,0.10)';
    args.data.barColor = PROF_COLOR[c.profesional_id] ?? '#71717a';
    args.data.fontColor = '#e8e8ea';
    const clases = [`dp-serv-${serv?.categoria ?? 'otro'}`];
    if (c.estado_cita === 'cancelada') clases.push('dp-cancelada');
    args.data.cssClass = clases.join(' ');
    args.data.html = `
      <div class="dp-ev">
        <div class="dp-ev-cli">
          <span><span class="dp-ev-time">${hhmm(c.inicio)}</span> ${c.cliente_nombre}</span>
          <i class="dp-ev-estado" style="background:${m.bar}"></i>
        </div>
        <div class="dp-ev-sub">${serv?.nombre ?? ''}</div>
      </div>`;
  };

  const onEventClick = (args: ClickArgs) => setSelectedId(String(args.e.id()));

  const crearCita = (inicio: string, fin: string, resource?: string) => {
    const profId = resource ?? PROFESIONALES[0]?.id ?? 'p1';
    const servId = servicioPorRol(getProfesional(profId)?.rol);
    const esEntreno = getServicio(servId)?.categoria === 'entrenamiento_personal';
    const nueva: CitaMock = {
      id: `c${Date.now()}`,
      cliente_nombre: 'Nuevo cliente',
      profesional_id: profId,
      sala_id: esEntreno ? null : 's1',
      servicio_id: servId,
      origen: 'directo',
      inicio,
      fin,
      estado_cita: 'pendiente',
      estado_pago: 'pendiente_pago',
      precio_previsto: getServicio(servId)?.precio ?? 0,
      cambios: [{ ts: ahora(), accion: 'creada', detalle: 'Alta demo' }],
    };
    setCitas((prev) => [...prev, nueva]);
    setSelectedId(nueva.id);
  };

  const onTimeRangeSelected = (args: RangeArgs) => {
    crearCita(
      args.start.toString(),
      args.end.toString(),
      args.resource != null ? String(args.resource) : undefined,
    );
    calendar?.clearSelection();
  };

  const onAccion = (accion: AccionCita) => {
    if (!seleccionada) return;
    const mapa: Record<AccionCita, EstadoCita> = {
      confirmar: 'confirmada',
      completar: 'completada',
      no_asiste: 'no_asiste',
      cancelar: 'cancelada',
    };
    const nuevoEstado = mapa[accion];
    setCitas((prev) =>
      prev.map((c) =>
        c.id === seleccionada.id
          ? {
              ...c,
              estado_cita: nuevoEstado,
              cambios: [...c.cambios, { ts: ahora(), accion: nuevoEstado, detalle: 'Cambio de estado (demo)' }],
            }
          : c,
      ),
    );
  };

  const nuevaCitaBoton = () => crearCita(`${hoy}T10:00:00`, `${hoy}T10:45:00`);

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

      <CitaModal cita={seleccionada} onClose={() => setSelectedId(null)} onAccion={onAccion} />
    </div>
  );
}
