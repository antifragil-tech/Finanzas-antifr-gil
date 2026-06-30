import type { LucideIcon } from 'lucide-react';
import { Lock } from 'lucide-react';
import { Tag } from '../panel/PanelKit';

// Cabecera común de las pantallas demo (Fase 4): icono + título + badge Demo +
// banner de aviso. Server component estático, sin estado.
export function ScreenShell({
  icon: Icon,
  titulo,
  aviso,
  children,
}: {
  icon: LucideIcon;
  titulo: string;
  aviso: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-8 py-8">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <Icon size={22} className="text-zinc-300" />
        <h1 className="text-3xl font-light tracking-tight text-white">{titulo}</h1>
        <Tag tone="warn">Demo</Tag>
      </div>
      <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-2xs font-medium uppercase tracking-widest text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        {aviso}
      </div>
      {children}
    </div>
  );
}

// Tarjeta de "bloque oculto por rol". Deja CLARO que es simulación, no permisos.
export function RestriccionRol({ area, rolLabel }: { area: string; rolLabel: string }) {
  return (
    <div className="glass-panel flex min-h-[160px] flex-col items-center justify-center rounded-2xl p-8 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
        <Lock size={20} className="text-zinc-500" />
      </div>
      <p className="mb-1 text-sm font-medium text-zinc-200">{area} no disponible para el rol {rolLabel}</p>
      <p className="text-2xs uppercase tracking-widest text-amber-400/80">
        Vista demo por rol · no aplica permisos reales
      </p>
    </div>
  );
}
