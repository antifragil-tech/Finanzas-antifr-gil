import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type KPICardColor = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';

type KPICardProps = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  secondaryValue?: string | number | undefined;
  secondaryTitle?: string | undefined;
  tooltip?: string | ReactNode | undefined;
  color?: KPICardColor;
};

const colorBorder: Record<KPICardColor, string> = {
  blue: 'border-blue-500/10 text-blue-400 group-hover:border-blue-500/30',
  emerald: 'border-emerald-500/10 text-emerald-400 group-hover:border-emerald-500/30',
  amber: 'border-amber-500/10 text-amber-400 group-hover:border-amber-500/30',
  rose: 'border-rose-500/10 text-rose-400 group-hover:border-rose-500/30',
  violet: 'border-violet-500/10 text-violet-400 group-hover:border-violet-500/30',
};

const colorGlow: Record<KPICardColor, string> = {
  blue: 'bg-blue-500/5 group-hover:bg-blue-500/10',
  emerald: 'bg-emerald-500/5 group-hover:bg-emerald-500/10',
  amber: 'bg-amber-500/5 group-hover:bg-amber-500/10',
  rose: 'bg-rose-500/5 group-hover:bg-rose-500/10',
  violet: 'bg-violet-500/5 group-hover:bg-violet-500/10',
};

export function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  trendUp,
  tooltip,
  color = 'blue',
  secondaryValue,
  secondaryTitle,
}: KPICardProps) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/40 p-6 backdrop-blur-md transition-colors duration-200 hover:bg-zinc-900/60 ${colorBorder[color]} `}
    >
      <div className="mb-6 flex items-start justify-between">
        <h3 className="text-2xs font-medium uppercase tracking-widest text-zinc-500">{title}</h3>
        <div className={`rounded-xl p-2.5 transition-colors duration-200 ${colorGlow[color]}`}>
          <Icon size={20} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-3xl font-light tracking-tight text-zinc-100 lg:text-4xl">
          {value}
        </span>
        {secondaryValue && (
          <div className="flex items-center gap-2 opacity-70">
            <span className="text-2xs font-medium uppercase tracking-widest text-zinc-500">
              {secondaryTitle ?? 'Total'}
            </span>
            <span className="font-mono text-sm text-zinc-300">{secondaryValue}</span>
          </div>
        )}
      </div>

      {trend && (
        <div
          className={`mt-4 flex items-center gap-2 text-xs font-medium ${trendUp ? 'text-emerald-500' : 'text-rose-500'}`}
        >
          <div
            className={`h-1.5 w-1.5 rounded-full ${trendUp ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse-subtle`}
          />
          {trend}
        </div>
      )}

      {tooltip && (
        <div className="pointer-events-none absolute inset-0 flex translate-y-2 items-center justify-center rounded-2xl border-t border-white/10 bg-zinc-950/90 p-6 opacity-0 backdrop-blur-2xl transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
          <div className="w-full text-xs leading-relaxed text-zinc-400">
            {typeof tooltip === 'string' ? <p className="text-center">{tooltip}</p> : tooltip}
          </div>
        </div>
      )}
    </div>
  );
}
