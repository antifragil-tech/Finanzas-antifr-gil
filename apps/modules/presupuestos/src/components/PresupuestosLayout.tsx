import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { PresupuestosSidebar } from './PresupuestosSidebar';
import type { PresupuestosView } from './PresupuestosSidebar';

const VIEW_NAMES: Record<PresupuestosView, string> = {
  dashboard: 'Panel de Control',
  calendario: 'Calendario de Pagos',
  lista: 'Mis Presupuestos',
  nuevo: 'Nuevo Presupuesto',
};

type Props = {
  selectedView: PresupuestosView;
  isPrivateMode: boolean;
  onViewChange: (v: PresupuestosView) => void;
  onTogglePrivacy: () => void;
  children: ReactNode;
};

export function PresupuestosLayout({
  selectedView,
  isPrivateMode,
  onViewChange,
  onTogglePrivacy,
  children,
}: Props) {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-900 font-sans text-zinc-100">
      <PresupuestosSidebar
        selectedView={selectedView}
        isPrivateMode={isPrivateMode}
        onViewChange={onViewChange}
        onTogglePrivacy={onTogglePrivacy}
      />
      <main className="relative ml-64 h-full flex-1 overflow-y-auto bg-zinc-900">
        <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-zinc-900/80 px-10 py-6 backdrop-blur-xl">
          <div className="text-2xs mb-1.5 flex items-center gap-2 font-medium uppercase tracking-widest text-zinc-500">
            <span>ALSARI CAPITAL</span>
            <ChevronRight size={10} className="text-zinc-700" />
            <span className="text-zinc-400">Presupuestos</span>
            <ChevronRight size={10} className="text-zinc-700" />
            <span className="text-emerald-400">{VIEW_NAMES[selectedView]}</span>
          </div>
          <h1 className="text-4xl font-light tracking-tighter text-white">
            {VIEW_NAMES[selectedView]}
          </h1>
        </header>
        <div className="px-10 py-8">{children}</div>
      </main>
    </div>
  );
}
