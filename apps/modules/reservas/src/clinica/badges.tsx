import type { ReactNode } from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  UserX,
  Euro,
  CreditCard,
  Gift,
  Repeat,
  Building2,
  type LucideIcon,
} from 'lucide-react';
import type { EstadoCita, EstadoPago, OrigenCita } from '../spike/mockData';
import { getOrigen } from '../spike/mockData';

// Badges de cita: SIEMPRE texto + icono (nunca solo color → accesible/daltónico).
type ChipTone = 'amber' | 'blue' | 'emerald' | 'rose' | 'violet' | 'zinc' | 'teal';

const TONE: Record<ChipTone, string> = {
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  blue: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  rose: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  violet: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  teal: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  zinc: 'border-white/10 bg-white/5 text-zinc-400',
};

function Chip({
  icon: Icon,
  tone,
  children,
}: {
  icon: LucideIcon;
  tone: ChipTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`text-2xs inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium uppercase tracking-wide ${TONE[tone]}`}
    >
      <Icon size={11} className="shrink-0" />
      {children}
    </span>
  );
}

const ESTADO_CHIP: Record<EstadoCita, { label: string; tone: ChipTone; icon: LucideIcon }> = {
  pendiente: { label: 'Pendiente', tone: 'amber', icon: Clock },
  confirmada: { label: 'Confirmada', tone: 'blue', icon: CheckCircle2 },
  completada: { label: 'Completada', tone: 'emerald', icon: CheckCircle2 },
  no_asiste: { label: 'No asistió', tone: 'rose', icon: UserX },
  cancelada: { label: 'Cancelada', tone: 'rose', icon: XCircle },
  reprogramada: { label: 'Reprogramada', tone: 'violet', icon: Repeat },
};

export function BadgeEstadoCita({ estado }: { estado: EstadoCita }) {
  const c = ESTADO_CHIP[estado];
  return (
    <Chip icon={c.icon} tone={c.tone}>
      {c.label}
    </Chip>
  );
}

const PAGO_CHIP: Record<EstadoPago, { label: string; tone: ChipTone; icon: LucideIcon }> = {
  pagado: { label: 'Pagado', tone: 'emerald', icon: Euro },
  pendiente_pago: { label: 'Pendiente', tone: 'amber', icon: CreditCard },
  pago_parcial: { label: 'Parcial', tone: 'amber', icon: CreditCard },
  incluido_bono: { label: 'Bono', tone: 'violet', icon: Gift },
  incluido_programa: { label: 'Programa', tone: 'violet', icon: Repeat },
  pendiente_revision: { label: 'Revisión', tone: 'amber', icon: CreditCard },
  devuelto: { label: 'Devuelto', tone: 'rose', icon: CreditCard },
  no_requiere_pago: { label: 'No requiere', tone: 'zinc', icon: CreditCard },
};

export function BadgePago({ estado }: { estado: EstadoPago }) {
  const c = PAGO_CHIP[estado];
  return (
    <Chip icon={c.icon} tone={c.tone}>
      {c.label}
    </Chip>
  );
}

export function BadgeOrigen({ origen }: { origen: OrigenCita }) {
  const o = getOrigen(origen);
  if (!o || origen === 'directo') return null; // cliente directo no necesita badge
  const tone: ChipTone = origen === 'vivofacil' ? 'teal' : 'zinc';
  return (
    <Chip icon={Building2} tone={tone}>
      {o.label}
    </Chip>
  );
}

// Conjunto de badges de una cita: estado + pago (+ bono/programa) + origen/partner.
export function CitaBadges({
  estado,
  pago,
  origen,
}: {
  estado: EstadoCita;
  pago: EstadoPago;
  origen: OrigenCita;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <BadgeEstadoCita estado={estado} />
      <BadgePago estado={pago} />
      <BadgeOrigen origen={origen} />
    </div>
  );
}
