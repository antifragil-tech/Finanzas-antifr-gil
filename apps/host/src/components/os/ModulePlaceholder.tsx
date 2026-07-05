import type { LucideIcon } from 'lucide-react';

// Placeholder de módulo para el shell Antifrágil OS. Explica qué módulo
// representa la ruta y de qué PR/línea vendrá la implementación real.
// Sin backend, sin Supabase, sin datos reales ni clínicos.

export function ModulePlaceholder({
  titulo,
  descripcion,
  fuente,
  icon: Icon,
}: {
  titulo: string;
  descripcion: string;
  fuente?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-8">
      <div className="glass-panel max-w-lg rounded-2xl p-10 text-center">
        {Icon ? (
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
            <Icon size={26} className="text-zinc-400" />
          </div>
        ) : null}
        <p className="text-2xs mb-3 uppercase tracking-[0.3em] text-zinc-600">Antifrágil OS</p>
        <h2 className="mb-2 text-2xl font-light tracking-tight text-white">{titulo}</h2>
        <p className="mb-6 text-sm leading-relaxed text-zinc-500">{descripcion}</p>
        {fuente ? <p className="mb-6 text-xs leading-relaxed text-zinc-600">{fuente}</p> : null}
        <span className="text-2xs inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 uppercase tracking-widest text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          En construcción
        </span>
      </div>
    </div>
  );
}
