// Badge de estado del OS con tonos semánticos suaves (Quiet Luxury).

export type OSBadgeTone = 'neutral' | 'ok' | 'warn' | 'info' | 'danger';

const TONOS: Record<OSBadgeTone, string> = {
  neutral: 'border-white/10 bg-white/5 text-zinc-400',
  ok: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  warn: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  info: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
  danger: 'border-red-500/20 bg-red-500/10 text-red-300',
};

export function OSStatusBadge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: OSBadgeTone;
}) {
  return (
    <span
      className={`text-2xs inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 uppercase tracking-widest ${TONOS[tone]}`}
    >
      {children}
    </span>
  );
}
