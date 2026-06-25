import { Eye, EyeOff } from 'lucide-react';
import type { ProyectosView, ProyectoTab } from './ProyectosSidebar';
import { ProyectosSidebar } from './ProyectosSidebar';
import type { ProyectoRow } from '../lib/proyectosApi';

type Props = {
  children: React.ReactNode;
  selectedView: ProyectosView;
  selectedProyectoId: string | null;
  selectedTab: ProyectoTab;
  proyectos: ProyectoRow[];
  isPrivateMode: boolean;
  onViewChange: (v: ProyectosView) => void;
  onSelectProyecto: (id: string) => void;
  onTabChange: (t: ProyectoTab) => void;
  onTogglePrivacy: () => void;
};

export function ProyectosLayout({
  children, selectedView, selectedProyectoId, selectedTab,
  proyectos, isPrivateMode, onViewChange, onSelectProyecto, onTabChange, onTogglePrivacy,
}: Props) {
  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <ProyectosSidebar
        selectedView={selectedView}
        selectedProyectoId={selectedProyectoId}
        selectedTab={selectedTab}
        proyectos={proyectos}
        onViewChange={onViewChange}
        onSelectProyecto={onSelectProyecto}
        onTabChange={onTabChange}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <div className="h-12 border-b border-white/[0.06] flex items-center justify-end px-6 gap-3 shrink-0">
          <button
            onClick={onTogglePrivacy}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {isPrivateMode ? <EyeOff size={13} /> : <Eye size={13} />}
            {isPrivateMode ? 'Privado' : 'Visible'}
          </button>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
