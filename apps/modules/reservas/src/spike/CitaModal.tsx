import { Modal, Button, Badge } from '@alsari/ui';
import { Check, CheckCheck, UserX, XCircle, Clock, MapPin, User, Euro } from 'lucide-react';
import type { CitaMock } from './mockData';
import { getProfesional, getSala, getServicio } from './mockData';
import { ESTADO_META, PAGO_LABEL, PAGO_TONE } from './estados';

export type AccionCita = 'confirmar' | 'completar' | 'no_asiste' | 'cancelar';

interface Props {
  cita: CitaMock | null;
  onClose: () => void;
  onAccion: (accion: AccionCita) => void;
}

const hhmm = (iso: string) => iso.slice(11, 16);

// Fila de detalle (icono + contenido). Declarada a NIVEL DE MÓDULO (no dentro del
// render) para no recrear el componente en cada render (regla react-hooks).
function Fila({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-300">
      <Icon size={14} className="shrink-0 text-zinc-500" />
      {children}
    </div>
  );
}

// Modal PROPIO del OS (reutiliza @alsari/ui). NO se usa el modal nativo de
// DayPilot. Las acciones cambian de estado; nunca borran la cita.
export function CitaModal({ cita, onClose, onAccion }: Props) {
  if (!cita) return null;

  const prof = getProfesional(cita.profesional_id);
  const sala = getSala(cita.sala_id);
  const serv = getServicio(cita.servicio_id);
  const meta = ESTADO_META[cita.estado_cita];
  const esFinal = ['completada', 'cancelada', 'no_asiste'].includes(cita.estado_cita);

  return (
    <Modal open={!!cita} onClose={onClose} title={`Cita · ${cita.cliente_nombre}`}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <Badge tone={PAGO_TONE[cita.estado_pago]}>{PAGO_LABEL[cita.estado_pago]}</Badge>
        </div>

        <div className="space-y-2 rounded-xl border border-white/5 bg-zinc-950/40 p-3">
          <Fila icon={Clock}>
            {hhmm(cita.inicio)}–{hhmm(cita.fin)}
          </Fila>
          <Fila icon={User}>
            {serv?.nombre} · {prof?.nombre} <span className="text-zinc-500">({prof?.rol})</span>
          </Fila>
          <Fila icon={MapPin}>{sala?.nombre ?? 'Sin sala (no requiere)'}</Fila>
          <Fila icon={Euro}>{cita.precio_previsto.toFixed(0)} € (previsto)</Fila>
        </div>

        {cita.notas_internas && (
          <p className="rounded-lg bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400">
            {cita.notas_internas}
          </p>
        )}

        <div>
          <p className="mb-1.5 text-2xs uppercase tracking-widest text-zinc-500">
            Histórico de cambios
          </p>
          <ul className="space-y-1">
            {cita.cambios.map((c, i) => (
              <li key={i} className="flex gap-2 text-xs text-zinc-400">
                <span className="font-mono text-zinc-600">{c.ts}</span>
                <span className="text-zinc-300">{c.accion}</span>
                <span className="text-zinc-500">— {c.detalle}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-white/5 pt-3">
          {esFinal ? (
            <p className="text-xs text-zinc-500">
              Estado final. La cita permanece en el histórico (sin borrado físico).
            </p>
          ) : (
            <>
              {cita.estado_cita === 'pendiente' && (
                <Button variant="primary" size="sm" icon={Check} onClick={() => onAccion('confirmar')}>
                  Confirmar
                </Button>
              )}
              <Button variant="primary" size="sm" icon={CheckCheck} onClick={() => onAccion('completar')}>
                Completar
              </Button>
              <Button variant="secondary" size="sm" icon={UserX} onClick={() => onAccion('no_asiste')}>
                No-show
              </Button>
              <Button variant="danger" size="sm" icon={XCircle} onClick={() => onAccion('cancelar')}>
                Cancelar
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
