import { useState } from 'react';
import { formatCurrency } from '@alsari/utils';
import type { ReactNode } from 'react';
import {
  X,
  Check,
  CheckCheck,
  UserX,
  XCircle,
  Pencil,
  ArrowLeftRight,
  Euro,
  Gift,
  Repeat,
  Building2,
  MessageCircle,
  Copy,
  PhoneCall,
  User,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import type { CitaMock, EstadoPago, OrigenCita } from '../spike/mockData';
import { getProfesional, getSala, getServicio } from '../spike/mockData';
import type { AccionCita } from '../spike/CitaModal';
import { CitaBadges } from './badges';

const hhmm = (iso: string) => iso.slice(11, 16);

/**
 * 'fixed' (default): overlay sobre el viewport completo — módulo standalone.
 * 'contained': overlay limitado al contenedor posicionado (relative) más
 * cercano, para embeber el módulo en el host/demo sin tapar toda la app.
 */
export type CitaPanelMode = 'fixed' | 'contained';

interface Props {
  cita: CitaMock | null;
  onClose: () => void;
  onAccion: (accion: AccionCita) => void;
  onPago: (estado: EstadoPago) => void;
  onOrigen: (origen: OrigenCita) => void;
  mode?: CitaPanelMode;
}

// Panel lateral (slide-over) de una cita. Acciones mock/local, sin backend.
// Sin borrado físico: cancelar / no-show / completar son cambios de estado.
export function CitaPanel({ cita, onClose, onAccion, onPago, onOrigen, mode = 'fixed' }: Props) {
  const [aviso, setAviso] = useState<string | null>(null);
  if (!cita) return null;

  const prof = getProfesional(cita.profesional_id);
  const sala = getSala(cita.sala_id);
  const serv = getServicio(cita.servicio_id);
  const esFinal = ['completada', 'cancelada', 'no_asiste'].includes(cita.estado_cita);

  const flash = (msg: string) => {
    setAviso(msg);
    window.setTimeout(() => setAviso(null), 2500);
  };
  const copiar = () => {
    const txt = `${hhmm(cita.inicio)}–${hhmm(cita.fin)} · ${cita.cliente_nombre} · ${serv?.nombre ?? ''} · ${prof?.nombre ?? ''}`;
    navigator.clipboard?.writeText(txt).then(
      () => flash('Datos copiados'),
      () => flash('Datos copiados'),
    );
  };

  return (
    <div className={`${mode === 'fixed' ? 'fixed' : 'absolute'} inset-0 z-50 flex justify-end`}>
      <button
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-sm flex-col gap-4 overflow-auto border-l border-white/10 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-2xs uppercase tracking-widest text-zinc-500">
              {hhmm(cita.inicio)}–{hhmm(cita.fin)}
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
              {cita.cliente_nombre}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-500 hover:text-zinc-200">
            <X size={18} />
          </button>
        </div>

        <CitaBadges estado={cita.estado_cita} pago={cita.estado_pago} origen={cita.origen} />

        <div className="space-y-2 rounded-xl border border-white/5 bg-zinc-900/40 p-3 text-sm text-zinc-300">
          <Fila icon={User}>
            {serv?.nombre}
            {cita.etiqueta ? ` · ${cita.etiqueta}` : ''} · {prof?.nombre}
          </Fila>
          <Fila icon={MapPin}>{sala?.nombre ?? 'Sin sala (no requiere)'}</Fila>
          <Fila icon={Euro}>{formatCurrency(cita.precio_previsto)} (previsto)</Fila>
        </div>

        {aviso && (
          <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            {aviso}
          </p>
        )}

        <Seccion titulo="Cita">
          {cita.estado_cita === 'pendiente' && (
            <Accion icon={Check} onClick={() => onAccion('confirmar')}>
              Confirmar
            </Accion>
          )}
          {!esFinal && (
            <Accion icon={CheckCheck} onClick={() => onAccion('completar')}>
              Completada
            </Accion>
          )}
          {!esFinal && (
            <Accion icon={UserX} onClick={() => onAccion('no_asiste')}>
              No asistió
            </Accion>
          )}
          <Accion icon={Pencil} onClick={() => flash('Editar (demo)')}>
            Editar
          </Accion>
          <Accion icon={ArrowLeftRight} onClick={() => flash('Mover (demo)')}>
            Mover
          </Accion>
          {!esFinal && (
            <Accion icon={XCircle} onClick={() => onAccion('cancelar')} danger>
              Cancelar
            </Accion>
          )}
        </Seccion>

        <Seccion titulo="Pago">
          <Accion
            icon={Euro}
            onClick={() => {
              onPago('pagado');
              flash('Pago registrado');
            }}
          >
            Registrar pago
          </Accion>
          <Accion
            icon={Gift}
            onClick={() => {
              onPago('incluido_bono');
              flash('Bono asignado');
            }}
          >
            Asignar bono
          </Accion>
          <Accion
            icon={Repeat}
            onClick={() => {
              onPago('incluido_programa');
              flash('Programa asignado');
            }}
          >
            Asignar programa
          </Accion>
        </Seccion>

        <Seccion titulo="Origen / partner">
          <Accion
            icon={Building2}
            onClick={() => {
              onOrigen('vivofacil');
              flash('Origen: Vivofácil');
            }}
          >
            Marcar Vivofácil
          </Accion>
          <Accion
            icon={Building2}
            onClick={() => {
              onOrigen('directo');
              flash('Origen: Directo');
            }}
          >
            Marcar directo
          </Accion>
        </Seccion>

        <Seccion titulo="Comunicación">
          <Accion icon={MessageCircle} onClick={() => flash('WhatsApp / recordatorio (demo)')}>
            WhatsApp
          </Accion>
          <Accion icon={Copy} onClick={copiar}>
            Copiar datos
          </Accion>
          <Accion icon={PhoneCall} onClick={() => flash('Contacto realizado')}>
            Marcar contacto
          </Accion>
        </Seccion>

        <Seccion titulo="Cliente">
          <Accion icon={User} onClick={() => flash('Ficha de cliente (demo)')}>
            Ver cliente
          </Accion>
        </Seccion>

        <div>
          <p className="text-2xs mb-1.5 uppercase tracking-widest text-zinc-500">Histórico</p>
          <ul className="space-y-1">
            {cita.cambios.map((c, i) => (
              <li key={i} className="flex gap-2 text-xs text-zinc-400">
                <span className="font-mono text-zinc-500">{c.ts}</span>
                <span className="text-zinc-300">{c.accion}</span>
                <span className="text-zinc-500">— {c.detalle}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function Fila({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={14} className="shrink-0 text-zinc-500" />
      {children}
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-2xs mb-2 uppercase tracking-widest text-zinc-500">{titulo}</p>
      <div className="grid grid-cols-2 gap-1.5">{children}</div>
    </div>
  );
}

function Accion({
  icon: Icon,
  onClick,
  danger,
  children,
}: {
  icon: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors ${
        danger
          ? 'border-rose-500/20 text-rose-300 hover:bg-rose-500/10'
          : 'border-white/10 text-zinc-300 hover:bg-white/5'
      }`}
    >
      <Icon size={14} className="shrink-0" />
      <span className="truncate">{children}</span>
    </button>
  );
}
