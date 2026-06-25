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
      className={`
        relative group overflow-hidden rounded-2xl p-6
        bg-zinc-900/40 backdrop-blur-md border border-white/5
        transition-colors duration-200 hover:bg-zinc-900/60
        ${colorBorder[color]}
      `}
    >
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-2xs font-medium text-zinc-500 uppercase tracking-widest">
          {title}
        </h3>
        <div className={`p-2.5 rounded-xl transition-colors duration-200 ${colorGlow[color]}`}>
          <Icon size={20} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-3xl lg:text-4xl font-light text-zinc-100 tracking-tight">
          {value}
        </span>
        {secondaryValue && (
          <div className="flex items-center gap-2 opacity-70">
            <span className="text-2xs font-medium uppercase tracking-widest text-zinc-500">
              {secondaryTitle ?? 'Total'}
            </span>
            <span className="text-sm font-mono text-zinc-300">{secondaryValue}</span>
          </div>
        )}
      </div>

      {trend && (
        <div
          className={`mt-4 flex items-center gap-2 text-xs font-medium ${trendUp ? 'text-emerald-500' : 'text-rose-500'}`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${trendUp ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse-subtle`}
          />
          {trend}
        </div>
      )}

      {tooltip && (
        <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-2xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 flex items-center justify-center p-6 border-t border-white/10 rounded-2xl">
          <div className="text-xs text-zinc-400 leading-relaxed w-full">
            {typeof tooltip === 'string' ? (
              <p className="text-center">{tooltip}</p>
            ) : (
              tooltip
            )}
          </div>
        </div>
      )}
    </div>
  );
}
