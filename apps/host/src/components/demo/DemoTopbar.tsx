import { Building2, Briefcase, UserCircle2 } from 'lucide-react';

// Barra de contexto del DemoShell. ESTÁTICA en Fase 1: sin dropdowns reales.
// Los selectores de sociedad / proyecto / rol se activan en Fase 3.
export function DemoTopbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/5 bg-zinc-950/80 px-6 backdrop-blur">
      <div className="flex items-center gap-2 text-sm">
        <Building2 size={15} className="text-zinc-500" />
        <span className="font-medium text-zinc-200">Grupo Empresarial Antifrágil</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-2xs font-medium text-zinc-400">
          Sociedad actual:&nbsp;<span className="text-zinc-100">Antifrágil S.C.</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-2xs font-medium text-zinc-400">
          <Briefcase size={12} className="text-zinc-500" />
          Proyecto:&nbsp;<span className="text-zinc-100">Todos</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-2xs font-medium text-zinc-400">
          <UserCircle2 size={12} className="text-zinc-500" />
          Rol:&nbsp;<span className="text-zinc-100">Dirección</span>
        </span>
      </div>
    </header>
  );
}
