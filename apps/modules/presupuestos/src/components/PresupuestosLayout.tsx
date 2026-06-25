import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { PresupuestosSidebar } from './PresupuestosSidebar';
import type { PresupuestosView } from './PresupuestosSidebar';

const VIEW_NAMES: Record<PresupuestosView, string> = {
  dashboard:  'Panel de Control',
  calendario: 'Calendario de Pagos',
  lista:      'Mis Presupuestos',
  nuevo:      'Nuevo Presupuesto',
};

type Props = {
  selectedView: PresupuestosView;
  isPrivateMode: boolean;
  onViewChange: (v: PresupuestosView) => void;
  onTogglePrivacy: () => void;
  children: ReactNode;
};

export function PresupuestosLayout({
  selectedView, isPrivateMode, onViewChange, onTogglePrivacy, children,
}: Props) {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-900 text-zinc-100 font-sans">
      <PresupuestosSidebar
        selectedView={selectedView}
        isPrivateMode={isPrivateMode}
        onViewChange={onViewChange}
        onTogglePrivacy={onTogglePrivacy}
      />
      <main className="flex-1 ml-64 h-full overflow-y-auto relative bg-zinc-900">
        <header className="sticky top-0 z-40 bg-zinc-900/80 backdrop-blur-xl border-b border-white/[0.08] px-10 py-6">
          <div className="flex items-center gap-2 text-2xs text-zinc-500 font-medium uppercase tracking-widest mb-1.5">
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
