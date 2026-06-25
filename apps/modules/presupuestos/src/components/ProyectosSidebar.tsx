import { LayoutGrid, FolderKanban, Target, ListTodo, Wallet, ChevronRight, BarChart3, CheckSquare, Home, TrendingUp, Plus, TrendingDown, Paperclip } from 'lucide-react';
import type { ProyectoRow } from '../lib/proyectosApi';

export type ProyectosView = 'global' | 'detalle' | 'tareas-global' | 'tesoreria' | 'nuevo-proyecto';
export type ProyectoTab   = 'objetivos' | 'tareas' | 'presupuesto-gasto' | 'presupuesto-ingreso' | 'numeros' | 'documentos';

type Props = {
  selectedView: ProyectosView;
  selectedProyectoId: string | null;
  selectedTab: ProyectoTab;
  proyectos: ProyectoRow[];
  onViewChange: (v: ProyectosView) => void;
  onSelectProyecto: (id: string) => void;
  onTabChange: (t: ProyectoTab) => void;
};

const TABS: { id: ProyectoTab; label: string; icon: typeof Target }[] = [
  { id: 'objetivos',           label: 'Objetivos',          icon: Target },
  { id: 'tareas',              label: 'Tareas',             icon: ListTodo },
  { id: 'presupuesto-gasto',   label: 'Presupuesto Gasto',  icon: Wallet },
  { id: 'presupuesto-ingreso', label: 'Presupuesto Ingreso', icon: TrendingDown },
  { id: 'numeros',             label: 'Números',            icon: TrendingUp },
  { id: 'documentos',          label: 'Documentos',         icon: Paperclip },
];

function estadoColor(estado: string | null) {
  if (estado === 'activo')   return 'bg-emerald-500/20 text-emerald-400';
  if (estado === 'cerrado')  return 'bg-zinc-600/30 text-zinc-500';
  if (estado === 'pausado')  return 'bg-amber-500/20 text-amber-400';
  return 'bg-zinc-700/30 text-zinc-500';
}

export function ProyectosSidebar({
  selectedView, selectedProyectoId, selectedTab,
  proyectos, onViewChange, onSelectProyecto, onTabChange,
}: Props) {
  const proyectoActivo = proyectos.find(p => p.id_ref === selectedProyectoId);

  return (
    <aside className="w-56 shrink-0 flex flex-col h-full border-r border-white/[0.06] bg-zinc-950/60 backdrop-blur-sm">
      {/* Header */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-white/[0.06] shrink-0">
        <button
          onClick={() => { window.location.href = '/'; }}
          title="Volver al inicio"
          className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-800 border border-white/[0.12] text-zinc-400 hover:text-white hover:border-white/20 transition-all shrink-0"
        >
          <Home size={13} />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <FolderKanban size={14} className="text-blue-400 shrink-0" />
          <span className="text-xs font-semibold text-white uppercase tracking-widest truncate">Proyectos</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-6">

        {/* Vistas principales */}
        <div>
          <p className="px-2 mb-1 text-2xs font-semibold text-zinc-600 uppercase tracking-widest">Vista</p>
          <div className="space-y-0.5">
            {([
              { id: 'global' as ProyectosView,       label: 'Proyectos',    icon: LayoutGrid   },
              { id: 'tareas-global' as ProyectosView, label: 'Cuadro tareas', icon: CheckSquare },
              { id: 'tesoreria' as ProyectosView,     label: 'Tesorería',    icon: BarChart3    },
            ] as { id: ProyectosView; label: string; icon: typeof LayoutGrid }[]).map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    selectedView === item.id
                      ? 'bg-blue-600/15 border border-blue-500/20 text-blue-300'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon size={13} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Nuevo proyecto */}
        <button
          onClick={() => onViewChange('nuevo-proyecto')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
            selectedView === 'nuevo-proyecto'
              ? 'bg-emerald-600/15 border border-emerald-500/20 text-emerald-300'
              : 'text-zinc-500 hover:text-emerald-300 hover:bg-emerald-500/[0.06] border border-transparent'
          }`}
        >
          <Plus size={13} />
          Nuevo proyecto
        </button>

        {/* Tabs cuando hay proyecto seleccionado */}
        {selectedView === 'detalle' && proyectoActivo && (
          <div>
            <div className="px-2 mb-2">
              <p className="text-2xs font-semibold text-zinc-600 uppercase tracking-widest mb-1">Proyecto</p>
              <p className="text-xs font-medium text-white truncate leading-tight">{proyectoActivo.nombre}</p>
              <span className={`inline-block mt-1 text-2xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${estadoColor(proyectoActivo.estado)}`}>
                {proyectoActivo.estado ?? 'sin estado'}
              </span>
            </div>
            <div className="space-y-0.5">
              {TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      selectedTab === tab.id
                        ? 'bg-zinc-800 border border-white/10 text-white'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon size={13} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Lista de proyectos */}
        <div>
          <p className="px-2 mb-1 text-2xs font-semibold text-zinc-600 uppercase tracking-widest">Acceso rápido</p>
          <div className="space-y-0.5">
            {proyectos.slice(0, 10).map(p => (
              <button
                key={p.id_ref}
                onClick={() => { onSelectProyecto(p.id_ref); onViewChange('detalle'); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all group ${
                  selectedProyectoId === p.id_ref && selectedView === 'detalle'
                    ? 'bg-zinc-800 border border-white/[0.08] text-white'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
                }`}
              >
                <span className="flex-1 text-left truncate font-medium">{p.nombre}</span>
                <ChevronRight size={10} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
