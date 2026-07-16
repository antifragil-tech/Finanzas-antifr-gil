import type { LucideIcon } from 'lucide-react';

// Métrica HÉROE del OS: el dato más importante de una pantalla, elevado por
// tamaño (text-4xl/5xl font-light) sobre los KPIs de apoyo. El color solo
// codifica significado (positivo/negativo/atención/informativo); nunca decora.
// Valor ya formateado: este componente es solo presentación.

export type HeroTono = 'neutral' | 'positivo' | 'negativo' | 'atencion' | 'info';

const COLOR_VALOR: Record<HeroTono, string> = {
  neutral: 'text-zinc-100',
  positivo: 'text-emerald-300',
  negativo: 'text-rose-300',
  atencion: 'text-amber-300',
  info: 'text-blue-300',
};

// Tinte muy tenue del panel según el tono — refuerza el significado sin ruido.
const TINTE_PANEL: Record<HeroTono, string> = {
  neutral: 'from-white/[0.04]',
  positivo: 'from-emerald-500/[0.07]',
  negativo: 'from-rose-500/[0.07]',
  atencion: 'from-amber-500/[0.07]',
  info: 'from-blue-500/[0.07]',
};

export function OSHeroMetric({
  label,
  valor,
  tono = 'neutral',
  hint,
  icon: Icon,
  bare = false,
  delta,
}: {
  label: string;
  valor: string;
  tono?: HeroTono;
  hint?: string | undefined;
  icon?: LucideIcon | undefined;
  /** Sin marco: para incrustar dentro de un panel ya existente. */
  bare?: boolean;
  /** Comparación con el mes anterior (p. ej. <OSDelta />) bajo la cifra. */
  delta?: React.ReactNode;
}) {
  const contenido = (
    <>
      <div className="flex items-center gap-2">
        {Icon ? <Icon size={15} className="text-zinc-500" /> : null}
        <p className="text-2xs uppercase tracking-widest text-zinc-500">{label}</p>
      </div>
      <p className={`mt-2 text-4xl font-light tracking-tight sm:text-5xl ${COLOR_VALOR[tono]}`}>
        {valor}
      </p>
      {delta ? <div className="mt-1.5">{delta}</div> : null}
      {hint ? <p className="mt-2 text-xs text-zinc-500">{hint}</p> : null}
    </>
  );

  if (bare) return <div>{contenido}</div>;

  return (
    <div
      className={`glass-panel rounded-2xl bg-gradient-to-br to-transparent p-6 sm:p-8 ${TINTE_PANEL[tono]}`}
    >
      {contenido}
    </div>
  );
}
