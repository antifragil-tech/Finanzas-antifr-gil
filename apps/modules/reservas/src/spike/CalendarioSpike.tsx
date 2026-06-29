import { useState, useEffect, useRef } from 'react';
import { DayPilotCalendar, DayPilot } from '@daypilot/daypilot-lite-react';
import {
  CalendarDays,
  CalendarRange,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertTriangle,
  Users,
  DoorOpen,
} from 'lucide-react';
import { Button, Badge } from '@alsari/ui';
import {
  PROFESIONALES,
  SALAS,
  PROF_COLOR,
  crearCitasMock,
  getProfesional,
  getServicio,
  type CitaMock,
  type EstadoCita,
  type CategoriaServicio,
} from './mockData';
import { ESTADO_META, PAGO_LABEL, PAGO_SIN_ABONAR } from './estados';
import { CitaModal, type AccionCita } from './CitaModal';
import { MonthResumen } from './MonthResumen';
import { repartirCarriles } from '../clinica/agenda/lanes';

type Vista = 'mes' | 'semana' | 'dia';
type DimDia = 'profesional' | 'sala';
type ServFiltro = CategoriaServicio | 'todos';

type DPId = string | number;
type DPDate = { toString: (fmt?: string) => string };
interface DPEvent {
  id: () => DPId;
}
interface ClickArgs {
  e: DPEvent;
}
interface MovedArgs {
  e: DPEvent;
  newStart: DPDate;
  newEnd: DPDate;
  newResource?: DPId;
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
const finDe = (inicioIso: string, mins: number) => {
  const f = new Date(new Date(inicioIso).getTime() + mins * 60000);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${inicioIso.slice(0, 10)}T${p(f.getHours())}:${p(f.getMinutes())}:00`;
};
const servicioPorRol = (rol?: string) =>
  rol === 'Entrenador personal' ? 'sv3' : rol === 'Nutricionista' ? 'sv4' : 'sv1';

export function CalendarioSpike({ vistaInicial = 'semana' }: { vistaInicial?: Vista } = {}) {
  const hoyStr = DayPilot.Date.today().toString('yyyy-MM-dd');
  const [startDate, setStartDate] = useState<string>(hoyStr);
  const [citas, setCitas] = useState<CitaMock[]>(() => crearCitasMock(hoyStr));
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const [dimDia, setDimDia] = useState<DimDia>('profesional');
  const [profVisibles, setProfVisibles] = useState<string[]>(PROFESIONALES.map((p) => p.id));
  const [servFiltro, setServFiltro] = useState<ServFiltro>('todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<
    { clearSelection: () => void; update: (cfg: Record<string, unknown>) => void } | undefined
  >();
  // Panel del calendario: lo usamos para reordenar en carriles las citas solapadas
  // tras cada render (DayPilot Lite expande el ancho y las monta; ver repartirCarriles).
  const panelRef = useRef<HTMLDivElement>(null);
  const repartoRaf = useRef<number | null>(null);

  const seleccionada = citas.find((c) => c.id === selectedId) ?? null;
  const profsOn = profVisibles.length ? profVisibles : PROFESIONALES.map((p) => p.id);

  const citasVisibles = citas.filter((c) => {
    const okProf = profsOn.includes(c.profesional_id);
    const cat = getServicio(c.servicio_id)?.categoria;
    const okServ = servFiltro === 'todos' || cat === servFiltro;
    return okProf && okServ;
  });

  // En la vista Día, columnas por profesional (estilo agenda de clínica) o por sala.
  const columns =
    vista !== 'dia'
      ? []
      : dimDia === 'profesional'
        ? PROFESIONALES.filter((p) => profsOn.includes(p.id)).map((p) => ({ name: p.nombre, id: p.id }))
        : SALAS.map((s) => ({ name: s.nombre, id: s.id }));

  const events = citasVisibles.map((c) => {
    const resource = dimDia === 'sala' ? c.sala_id : c.profesional_id;
    return {
      id: c.id,
      start: c.inicio,
      end: c.fin,
      text: c.cliente_nombre,
      ...(resource != null && { resource }),
    };
  });

  const sinAbonar = citas.filter(
    (c) =>
      (c.estado_cita === 'completada' || c.estado_cita === 'no_asiste') &&
      PAGO_SIN_ABONAR.includes(c.estado_pago),
  );

  const onBeforeEventRender = (args: RenderArgs) => {
    const c = citas.find((x) => x.id === String(args.data.id));
    if (!c) return;
    const m = ESTADO_META[c.estado_cita];
    const serv = getServicio(c.servicio_id);
    const prof = getProfesional(c.profesional_id);
    // Encoding visual contenido: barra = PROFESIONAL (color) · borde = SERVICIO
    // (forma/textura, vía cssClass) · estado = puntito · fondo neutro (sin mezcla).
    args.data.backColor = 'rgba(255,255,255,0.035)';
    args.data.borderColor = 'rgba(255,255,255,0.10)';
    args.data.barColor = PROF_COLOR[c.profesional_id] ?? '#71717a';
    args.data.fontColor = '#e8e8ea';
    const clases = [`dp-serv-${serv?.categoria ?? 'otro'}`];
    if (c.estado_cita === 'cancelada') clases.push('dp-cancelada');
    args.data.cssClass = clases.join(' ');
    if (vista === 'semana') {
      // Vista Semana = carriles estrechos con citas simultáneas. Tarjeta compacta
      // estilo Salonized: hora · cliente (truncado con ellipsis vía CSS) + punto de
      // estado, y debajo el servicio truncado. El pago y el resto van al modal.
      args.data.html = `
        <div class="dp-ev dp-ev--sm">
          <div class="dp-ev-cli">
            <span><span class="dp-ev-time">${hhmm(c.inicio)}</span> ${c.cliente_nombre}</span>
            <i class="dp-ev-estado" style="background:${m.bar}"></i>
          </div>
          <div class="dp-ev-sub">${serv?.nombre ?? ''}</div>
        </div>`;
    } else if (vista === 'dia') {
      const recur =
        c.estado_pago === 'incluido_bono' || c.estado_pago === 'incluido_programa' ? ' ↻' : '';
      args.data.html = `
        <div class="dp-ev">
          <div class="dp-ev-cli">
            <span><span class="dp-ev-time">${hhmm(c.inicio)}</span> · ${c.cliente_nombre}</span>
            <i class="dp-ev-estado" style="background:${m.bar}"></i>
          </div>
          <div class="dp-ev-sub">${serv?.nombre ?? ''} · ${prof?.nombre.split(' ')[0] ?? ''}</div>
          <div class="dp-ev-pago">${PAGO_LABEL[c.estado_pago]}${recur}</div>
        </div>`;
    }
  };

  const onEventClick = (args: ClickArgs) => setSelectedId(String(args.e.id()));

  const onEventMoved = (args: MovedArgs) => {
    const id = String(args.e.id());
    const ini = args.newStart.toString();
    const fin = args.newEnd.toString();
    const nuevoRec = args.newResource != null ? String(args.newResource) : undefined;
    setCitas((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const destino =
          vista === 'dia' && nuevoRec
            ? dimDia === 'sala'
              ? { sala_id: nuevoRec }
              : { profesional_id: nuevoRec }
            : {};
        return {
          ...c,
          ...destino,
          inicio: ini,
          fin,
          cambios: [...c.cambios, { ts: ahora(), accion: 'reprogramada', detalle: `Movida a ${ini.slice(0, 16).replace('T', ' ')}` }],
        };
      }),
    );
  };

  const onEventResized = (args: MovedArgs) => {
    const id = String(args.e.id());
    const ini = args.newStart.toString();
    const fin = args.newEnd.toString();
    setCitas((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, inicio: ini, fin, cambios: [...c.cambios, { ts: ahora(), accion: 'reprogramada', detalle: 'Duración ajustada' }] }
          : c,
      ),
    );
  };

  const crearCita = (inicio: string, fin: string, resource?: string) => {
    const profId = vista === 'dia' && dimDia === 'profesional' && resource ? resource : profsOn[0] ?? 'p1';
    const salaResource = vista === 'dia' && dimDia === 'sala' && resource ? resource : 's1';
    const servId = servicioPorRol(getProfesional(profId)?.rol);
    const esEntreno = getServicio(servId)?.categoria === 'entrenamiento_personal';
    const nueva: CitaMock = {
      id: `c${Date.now()}`,
      cliente_nombre: 'Nuevo cliente',
      profesional_id: profId,
      sala_id: esEntreno ? null : salaResource,
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

  const onCalRangeSelected = (args: RangeArgs) => {
    crearCita(args.start.toString(), args.end.toString(), args.resource != null ? String(args.resource) : undefined);
    calendar?.clearSelection();
  };

  const nuevaCitaBoton = () => {
    const inicio = `${startDate}T13:00:00`;
    crearCita(inicio, finDe(inicio, 50));
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
          ? { ...c, estado_cita: nuevoEstado, cambios: [...c.cambios, { ts: ahora(), accion: nuevoEstado, detalle: 'Cambio de estado (demo)' }] }
          : c,
      ),
    );
  };

  const shift = (dir: number) => {
    const d = new DayPilot.Date(startDate);
    const nd = vista === 'mes' ? d.addMonths(dir) : vista === 'semana' ? d.addDays(7 * dir) : d.addDays(dir);
    setStartDate(nd.toString('yyyy-MM-dd'));
  };

  const toggleProf = (id: string) =>
    setProfVisibles((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const fecha = new Date(`${startDate}T00:00:00`);
  const label =
    vista === 'mes'
      ? fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
      : vista === 'semana'
        ? `Semana del ${fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
        : fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  const vistas: { id: Vista; label: string; icon: typeof Calendar }[] = [
    { id: 'mes', label: 'Mes', icon: CalendarDays },
    { id: 'semana', label: 'Semana', icon: CalendarRange },
    { id: 'dia', label: 'Día', icon: Calendar },
  ];
  const filtrosServicio: { id: ServFiltro; label: string }[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'fisioterapia', label: 'Fisio' },
    { id: 'entrenamiento_personal', label: 'Entreno' },
    { id: 'nutricion', label: 'Nutrición' },
  ];
  const estadosLeyenda: EstadoCita[] = ['pendiente', 'confirmada', 'completada', 'no_asiste', 'cancelada'];

  const commonCal = { startDate, events, locale: 'es-es', onBeforeEventRender, onEventClick, onEventMoved };

  // En la vista Día fijamos el ANCHO de columna (cellWidth) imperativamente: DayPilot
  // renderiza más ancho que el panel y este hace scroll horizontal. Evita que las
  // columnas por profesional/sala se compriman y las tarjetas se solapen.
  useEffect(() => {
    if (!calendar) return;
    // dayBeginsHour/dayEndsHour SÍ recortan las horas visibles (7–22). cellWidth fija
    // el ancho de columna en la vista Día para que no se solapen.
    calendar.update({
      dayBeginsHour: 7,
      dayEndsHour: 22,
      ...(vista === 'dia'
        ? { cellWidthSpec: 'Fixed', cellWidth: 210 }
        : { cellWidthSpec: 'Auto' }),
    });
  }, [calendar, vista, dimDia, profVisibles, columns.length]);

  // Tras cada render, reparte en carriles las citas solapadas (DayPilot Lite las
  // monta; el algoritmo vive en clinica/agenda/lanes.ts, reutilizable por Semana y
  // Día). onAfterEventRender se llama una vez por cita → agrupamos en un solo
  // reparto por frame (rAF) cuando ya están todas en el DOM.
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

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Fila 1: Hoy + navegación + fecha + Crear cita */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => setStartDate(hoyStr)}>
            Hoy
          </Button>
          <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={() => shift(-1)} />
          <Button variant="ghost" size="sm" icon={ChevronRight} onClick={() => shift(1)} />
          <p className="ml-2 text-sm capitalize text-zinc-300">{label}</p>
        </div>
        <Button variant="primary" size="sm" icon={Plus} onClick={nuevaCitaBoton}>
          Crear cita
        </Button>
      </div>

      {/* Fila 2: vista + (en Día) columnas por profesional/sala */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex gap-1">
          {vistas.map((v) => (
            <Button key={v.id} variant={vista === v.id ? 'primary' : 'ghost'} size="sm" icon={v.icon} onClick={() => setVista(v.id)}>
              {v.label}
            </Button>
          ))}
        </div>
        {vista === 'dia' && (
          <div className="flex items-center gap-1">
            <Button variant={dimDia === 'profesional' ? 'secondary' : 'ghost'} size="sm" icon={Users} onClick={() => setDimDia('profesional')}>
              Profesionales
            </Button>
            <Button variant={dimDia === 'sala' ? 'secondary' : 'ghost'} size="sm" icon={DoorOpen} onClick={() => setDimDia('sala')}>
              Salas
            </Button>
          </div>
        )}
      </div>

      {/* Fila 3: filtro de profesionales ("Mostrar todos") + servicio */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-2xs uppercase tracking-widest text-zinc-600">Profesionales</span>
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
          {filtrosServicio.map((f) => (
            <Button key={f.id} variant={servFiltro === f.id ? 'secondary' : 'ghost'} size="sm" onClick={() => setServFiltro(f.id)}>
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {sinAbonar.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <AlertTriangle size={15} className="shrink-0" />
          <span>
            <strong>{sinAbonar.length}</strong> cita{sinAbonar.length > 1 ? 's' : ''} sin abonar:{' '}
            <span className="text-amber-300/80">{sinAbonar.map((c) => c.cliente_nombre).join(', ')}</span>
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {estadosLeyenda.map((e) => (
          <Badge key={e} tone={ESTADO_META[e].tone}>
            {ESTADO_META[e].label}
          </Badge>
        ))}
      </div>

      <div ref={panelRef} className="dp-quiet glass-panel min-h-0 flex-1 overflow-auto rounded-xl p-1.5">
        {vista === 'mes' ? (
          <MonthResumen
            citas={citasVisibles}
            startDate={startDate}
            onDayClick={(d) => {
              setStartDate(d);
              setVista('dia');
            }}
          />
        ) : (
          <div
            style={{
              minWidth:
                vista === 'dia' ? `${Math.max(columns.length, 1) * 200 + 64}px` : '1180px',
            }}
          >
            <DayPilotCalendar
              {...commonCal}
              viewType={vista === 'semana' ? 'Week' : 'Resources'}
              columns={columns}
              timeFormat="Clock24Hours"
              businessBeginsHour={7}
              businessEndsHour={22}
              heightSpec="BusinessHours"
              cellHeight={34}
              durationBarVisible={true}
              eventMoveHandling="Update"
              eventResizeHandling="Update"
              eventDeleteHandling="Disabled"
              timeRangeSelectedHandling="Enabled"
              onEventResized={onEventResized}
              onTimeRangeSelected={onCalRangeSelected}
              onAfterEventRender={programarReparto}
              controlRef={setCalendar}
            />
          </div>
        )}
      </div>

      <CitaModal cita={seleccionada} onClose={() => setSelectedId(null)} onAccion={onAccion} />
    </div>
  );
}
