import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Primitivos presentacionales del Panel de Dirección (Demo v0.2 · Fase 2).
// Sin estado, sin hooks: server components puros. Solo maquetan datos mock.

const eurFmt = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export function eur(n: number): string {
  return eurFmt.format(n);
}

// Etiqueta para marcar cifras como no reales: mock / estimado / demo / no real.
export function Tag({ children, tone = 'demo' }: { children: React.ReactNode; tone?: 'demo' | 'warn' }) {
  const cls =
    tone === 'warn'
      ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
      : 'border-white/10 bg-white/5 text-zinc-500';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium uppercase tracking-widest ${cls}`}>
      {children}
    </span>
  );
}

export function Bloque({
  titulo,
  icon: Icon,
  href,
  hrefLabel,
  tag,
  children,
}: {
  titulo: string;
  icon: LucideIcon;
  href?: string;
  hrefLabel?: string;
  tag?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-panel flex min-h-[200px] flex-col rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-zinc-400" />
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100">{titulo}</h2>
          {tag}
        </div>
        {href ? (
          <Link
            href={href}
            className="flex items-center gap-1 text-2xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
          >
            {hrefLabel ?? 'Ver'}
            <ChevronRight size={12} />
          </Link>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3">{children}</div>
    </section>
  );
}

export function Kpi({ label, value, tag }: { label: string; value: React.ReactNode; tag?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-light tracking-tight text-white">{value}</span>
        {tag}
      </div>
      <p className="text-2xs uppercase tracking-widest text-zinc-600">{label}</p>
    </div>
  );
}

export function Fila({ label, value, tag }: { label: string; value: React.ReactNode; tag?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2 last:border-0 last:pb-0">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className="flex items-center gap-2 text-right text-sm font-medium text-zinc-100">
        {value}
        {tag}
      </span>
    </div>
  );
}
