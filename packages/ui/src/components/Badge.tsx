import type { ReactNode } from 'react';

// Semántica de color del OS (ver skill ui-quiet-luxury):
//   blue = acción/info · emerald = positivo · rose = negativo ·
//   amber = aviso · violet = previsto/simulado · zinc = neutro
type BadgeTone = 'blue' | 'emerald' | 'rose' | 'amber' | 'violet' | 'zinc';

type BadgeProps = {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
};

const tones: Record<BadgeTone, string> = {
  blue: 'text-blue-300 bg-blue-500/15 border-blue-500/20',
  emerald: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/20',
  rose: 'text-rose-400 bg-rose-500/15 border-rose-500/20',
  amber: 'text-amber-300 bg-amber-500/15 border-amber-500/20',
  violet: 'text-violet-300 bg-violet-500/15 border-violet-500/20',
  zinc: 'text-zinc-400 bg-zinc-800/60 border-white/10',
};

export function Badge({ tone = 'zinc', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border
        text-2xs font-medium uppercase tracking-wide ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
