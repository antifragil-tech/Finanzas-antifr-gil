import type { LucideIcon } from 'lucide-react';

// Tarjeta KPI del OS. Solo presentación: el valor llega ya formateado.

export function OSKpiCard({
  label,
  valor,
  hint,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  valor: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'neutral' | 'ok' | 'warn' | 'info';
}) {
  const tones: Record<string, string> = {
    neutral: 'text-zinc-100',
    ok: 'text-emerald-300',
    warn: 'text-amber-300',
    info: 'text-blue-300',
  };
  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-2xs uppercase tracking-widest text-zinc-500">{label}</p>
        {Icon ? <Icon size={16} className="text-zinc-600" /> : null}
      </div>
      <p className={`text-2xl font-light tracking-tight ${tones[tone]}`}>{valor}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-600">{hint}</p> : null}
    </div>
  );
}
