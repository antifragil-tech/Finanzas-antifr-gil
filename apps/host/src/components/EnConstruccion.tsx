import type { LucideIcon } from 'lucide-react';

// Placeholder "en construcción" para el modo demo: sustituye a los dashboards
// legacy de Alsari sin tocar ni borrar su código. Estética Quiet Luxury del OS.
export function EnConstruccion({
  titulo,
  descripcion,
  icon: Icon,
}: {
  titulo: string;
  descripcion?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-8 text-zinc-100">
      <div className="glass-panel max-w-lg rounded-2xl p-10 text-center">
        {Icon ? (
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
            <Icon size={26} className="text-zinc-400" />
          </div>
        ) : null}
        <p className="mb-3 text-2xs uppercase tracking-[0.3em] text-zinc-600">Antifrágil OS</p>
        <h1 className="mb-2 text-2xl font-light tracking-tight text-white">{titulo}</h1>
        <p className="mb-6 text-sm leading-relaxed text-zinc-500">
          {descripcion ?? 'Este módulo está en construcción. Estará disponible en una próxima versión.'}
        </p>
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-2xs uppercase tracking-widest text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          En construcción
        </span>
      </div>
    </div>
  );
}
