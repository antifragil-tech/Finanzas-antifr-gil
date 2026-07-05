import type { LucideIcon } from 'lucide-react';

// Estado vacío estándar del OS.

export function OSEmptyState({
  titulo,
  descripcion,
  icon: Icon,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  icon?: LucideIcon;
  accion?: React.ReactNode;
}) {
  return (
    <div className="glass-panel flex flex-col items-center rounded-2xl px-8 py-12 text-center">
      {Icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
          <Icon size={22} className="text-zinc-500" />
        </div>
      ) : null}
      <p className="text-sm font-medium text-zinc-300">{titulo}</p>
      {descripcion ? (
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-zinc-600">{descripcion}</p>
      ) : null}
      {accion ? <div className="mt-4">{accion}</div> : null}
    </div>
  );
}
