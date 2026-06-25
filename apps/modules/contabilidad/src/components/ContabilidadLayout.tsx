import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { ContabilidadSidebar } from './ContabilidadSidebar';
import type { ContabilidadView } from './ContabilidadSidebar';

const VIEW_NAMES: Record<ContabilidadView, string> = {
  dashboard:          'Dashboard',
  movimientos:        'Movimientos Bancarios',
  facturas:           'Facturas Recibidas',
  facturas_emitidas:  'Facturas Emitidas',
  contactos:          'Contactos',
  diario:             'Diario Borrador',
  reconciliacion:     'Reconciliación',
  mis_empresas:       'Mis Empresas',
};

type Props = {
  selectedView: ContabilidadView;
  isPrivateMode: boolean;
  onViewChange: (v: ContabilidadView) => void;
  onTogglePrivacy: () => void;
  children: ReactNode;
};

export function ContabilidadLayout({
  selectedView, isPrivateMode, onViewChange, onTogglePrivacy, children,
}: Props) {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-900 text-zinc-100 font-sans">
      <ContabilidadSidebar
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
            <span className="text-zinc-400">Contabilidad</span>
            <ChevronRight size={10} className="text-zinc-700" />
            <span className="text-blue-400">{VIEW_NAMES[selectedView]}</span>
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
