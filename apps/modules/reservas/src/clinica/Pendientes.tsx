import { useState } from 'react';
import { DayPilot } from '@daypilot/daypilot-lite-react';
import {
  CheckCircle2,
  CreditCard,
  UserX,
  Building2,
  PhoneCall,
  AlertTriangle,
  Copy,
  CalendarX2,
  Gift,
  type LucideIcon,
} from 'lucide-react';
import { crearCitasMock, getServicio, getProfesional, type CitaMock } from '../spike/mockData';
import { PAGO_SIN_ABONAR } from '../spike/estados';
import { BONOS, restantes } from './mock/bonos';
import { Subvista } from './Subvista';
import { CitaPanel } from './CitaPanel';
import { useCitas } from './useCitas';

const hhmm = (iso: string) => iso.slice(11, 16);
const diaCorto = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });

const INCIDENCIAS_MOCK = [
  'Datáfono sin papel — reponer rollo',
  'Cliente pidió cambiar hora (llamar)',
  'Confirmar sala para la fisio de las 18:30',
];

interface Grupo {
  key: string;
  titulo: string;
  icon: LucideIcon;
  tone: string;
  items: CitaMock[];
  accion?: { label: string; run: (c: CitaMock) => void };
}

// Vista "Pendientes" (Clínica > Agenda > Pendientes): bandeja operativa de la
// semana. Agrupa lo que recepción debe resolver y permite acciones mock.
export function Pendientes() {
  const hoy = DayPilot.Date.today().toString('yyyy-MM-dd');
  const c = useCitas(() => crearCitasMock(hoy));
  const { citas } = c;
  const [aviso, setAviso] = useState<string | null>(null);
  const [resueltas, setResueltas] = useState<Set<number>>(new Set());

  const flash = (m: string) => {
    setAviso(m);
    window.setTimeout(() => setAviso(null), 2200);
  };
  const copiar = (cita: CitaMock) => {
    const txt = `${diaCorto(cita.inicio)} ${hhmm(cita.inicio)} · ${cita.cliente_nombre} · ${getServicio(cita.servicio_id)?.nombre ?? ''}`;
    navigator.clipboard?.writeText(txt).then(
      () => flash('Datos copiados'),
      () => flash('Datos copiados'),
    );
  };

  const sinConfirmar = citas.filter((x) => x.estado_cita === 'pendiente');
  const sinAbonar = citas.filter(
    (x) =>
      (x.estado_cita === 'completada' || x.estado_cita === 'no_asiste') &&
      PAGO_SIN_ABONAR.includes(x.estado_pago),
  );
  const noShow = citas.filter((x) => x.estado_cita === 'no_asiste');
  const canceladas = citas.filter((x) => x.estado_cita === 'cancelada');
  const vivofacilCerrar = citas.filter((x) => x.origen === 'vivofacil' && x.estado_cita === 'completada');
  const bonosRenovar = BONOS.filter((b) => b.estado === 'por_renovar' || b.estado === 'agotado');

  const grupos: Grupo[] = [
    {
      key: 'conf',
      titulo: 'Sin confirmar',
      icon: CheckCircle2,
      tone: 'text-blue-300',
      items: sinConfirmar,
      accion: { label: 'Confirmar', run: (x) => { c.confirmar(x.id); flash('Cita confirmada'); } },
    },
    {
      key: 'abonar',
      titulo: 'Sin abonar',
      icon: CreditCard,
      tone: 'text-amber-300',
      items: sinAbonar,
      accion: { label: 'Registrar pago', run: (x) => { c.registrarPago(x.id); flash('Pago registrado'); } },
    },
    {
      key: 'noshow',
      titulo: 'No asistidos',
      icon: UserX,
      tone: 'text-rose-300',
      items: noShow,
      accion: { label: 'Reagendar', run: () => flash('Reagendar (demo)') },
    },
    {
      key: 'cancel',
      titulo: 'Cancelaciones recientes',
      icon: CalendarX2,
      tone: 'text-rose-300',
      items: canceladas,
      accion: { label: 'Reagendar', run: () => flash('Reagendar (demo)') },
    },
    { key: 'vivo', titulo: 'Vivofácil por cerrar', icon: Building2, tone: 'text-teal-300', items: vivofacilCerrar },
    {
      key: 'contacto',
      titulo: 'Contactos pendientes',
      icon: PhoneCall,
      tone: 'text-zinc-300',
      items: sinConfirmar,
      accion: { label: 'Marcar contacto', run: () => flash('Contacto realizado') },
    },
  ];

  return (
    <Subvista
      titulo="Pendientes"
      subtitulo="Bandeja operativa de la semana — confirmar, cobrar, contactar y cerrar."
    >
      {aviso ? (
        <p className="mb-3 inline-block rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
          {aviso}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {grupos.map((g) => {
          const accion = g.accion;
          return (
            <section key={g.key} className="glass-panel flex flex-col rounded-2xl p-4">
              <div className="mb-3 flex items-center gap-2">
                <g.icon size={16} className={g.tone} />
                <h3 className="text-sm font-semibold text-zinc-200">{g.titulo}</h3>
                <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-2xs font-medium text-zinc-400">
                  {g.items.length}
                </span>
              </div>
              {g.items.length === 0 ? (
                <p className="py-3 text-center text-xs text-zinc-600">Nada pendiente</p>
              ) : (
                <ul className="space-y-1">
                  {g.items.slice(0, 6).map((x) => (
                    <li key={x.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5">
                      <button onClick={() => c.setSelectedId(x.id)} className="min-w-0 flex-1 text-left">
                        <p className="truncate text-xs text-zinc-200">
                          <span className="text-zinc-500">
                            {diaCorto(x.inicio)} {hhmm(x.inicio)}
                          </span>{' '}
                          · {x.cliente_nombre}
                        </p>
                        <p className="truncate text-2xs text-zinc-500">
                          {getServicio(x.servicio_id)?.nombre} · {getProfesional(x.profesional_id)?.nombre.split(' ')[0]}
                        </p>
                      </button>
                      <button
                        onClick={() => copiar(x)}
                        title="Copiar datos"
                        className="rounded p-1 text-zinc-600 opacity-0 transition-opacity hover:text-zinc-300 group-hover:opacity-100"
                      >
                        <Copy size={13} />
                      </button>
                      {accion ? (
                        <button
                          onClick={() => accion.run(x)}
                          className="rounded-md border border-white/10 px-2 py-1 text-2xs text-zinc-300 hover:bg-white/5"
                        >
                          {accion.label}
                        </button>
                      ) : null}
                    </li>
                  ))}
                  {g.items.length > 6 ? (
                    <li className="px-2 pt-1 text-2xs text-zinc-600">+{g.items.length - 6} más…</li>
                  ) : null}
                </ul>
              )}
            </section>
          );
        })}

        {/* Bonos / programas por renovar (mock) */}
        <section className="glass-panel flex flex-col rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2">
            <Gift size={16} className="text-violet-300" />
            <h3 className="text-sm font-semibold text-zinc-200">Bonos por renovar</h3>
            <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-2xs font-medium text-zinc-400">
              {bonosRenovar.length}
            </span>
          </div>
          {bonosRenovar.length === 0 ? (
            <p className="py-3 text-center text-xs text-zinc-600">Nada pendiente</p>
          ) : (
            <ul className="space-y-1">
              {bonosRenovar.map((b) => (
                <li key={b.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-zinc-200">{b.cliente}</p>
                    <p className="truncate text-2xs text-zinc-500">
                      {b.nombre} · {restantes(b)} restantes
                    </p>
                  </div>
                  <button
                    onClick={() => flash(`Renovación de ${b.nombre} anotada (demo)`)}
                    className="rounded-md border border-white/10 px-2 py-1 text-2xs text-zinc-300 hover:bg-white/5"
                  >
                    Renovar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Incidencias operativas (mock) */}
        <section className="glass-panel flex flex-col rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-300" />
            <h3 className="text-sm font-semibold text-zinc-200">Incidencias</h3>
            <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-2xs font-medium text-zinc-400">
              {INCIDENCIAS_MOCK.length - resueltas.size}
            </span>
          </div>
          {resueltas.size === INCIDENCIAS_MOCK.length ? (
            <p className="py-3 text-center text-xs text-zinc-600">Sin incidencias</p>
          ) : (
            <ul className="space-y-1">
              {INCIDENCIAS_MOCK.map((t, i) =>
                resueltas.has(i) ? null : (
                  <li key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5">
                    <span className="min-w-0 flex-1 text-xs text-zinc-300">{t}</span>
                    <button
                      onClick={() => setResueltas((p) => new Set(p).add(i))}
                      className="rounded-md border border-white/10 px-2 py-1 text-2xs text-zinc-300 hover:bg-white/5"
                    >
                      Resolver
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}
        </section>
      </div>

      <CitaPanel
        cita={c.seleccionada}
        onClose={() => c.setSelectedId(null)}
        onAccion={c.onAccion}
        onPago={c.onPago}
        onOrigen={c.onOrigen}
      />
    </Subvista>
  );
}
