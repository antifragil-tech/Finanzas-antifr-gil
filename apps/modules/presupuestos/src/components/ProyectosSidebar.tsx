import {
  LayoutGrid,
  FolderKanban,
  Target,
  ListTodo,
  Wallet,
  ChevronRight,
  BarChart3,
  CheckSquare,
  Home,
  TrendingUp,
  Plus,
  TrendingDown,
  Paperclip,
} from 'lucide-react';
import type { ProyectoRow } from '../lib/proyectosApi';

export type ProyectosView = 'global' | 'detalle' | 'tareas-global' | 'tesoreria' | 'nuevo-proyecto';
export type ProyectoTab =
  | 'objetivos'
  | 'tareas'
  | 'presupuesto-gasto'
  | 'presupuesto-ingreso'
  | 'numeros'
  | 'documentos';

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
  { id: 'objetivos', label: 'Objetivos', icon: Target },
  { id: 'tareas', label: 'Tareas', icon: ListTodo },
  { id: 'presupuesto-gasto', label: 'Presupuesto Gasto', icon: Wallet },
  { id: 'presupuesto-ingreso', label: 'Presupuesto Ingreso', icon: TrendingDown },
  { id: 'numeros', label: 'Números', icon: TrendingUp },
  { id: 'documentos', label: 'Documentos', icon: Paperclip },
];

function estadoColor(estado: string | null) {
  if (estado === 'activo') return 'bg-emerald-500/20 text-emerald-400';
  if (estado === 'cerrado') return 'bg-zinc-600/30 text-zinc-500';
  if (estado === 'pausado') return 'bg-amber-500/20 text-amber-400';
  return 'bg-zinc-700/30 text-zinc-500';
}

export function ProyectosSidebar({
  selectedView,
  selectedProyectoId,
  selectedTab,
  proyectos,
  onViewChange,
  onSelectProyecto,
  onTabChange,
}: Props) {
  const proyectoActivo = proyectos.find((p) => p.id_ref === selectedProyectoId);

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-white/[0.06] bg-zinc-950/60 backdrop-blur-sm">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
        <button
          onClick={() => {
            window.location.href = '/';
          }}
          title="Volver al inicio"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.12] bg-zinc-800 text-zinc-400 transition-all hover:border-white/20 hover:text-white"
        >
          <Home size={13} />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <FolderKanban size={14} className="shrink-0 text-blue-400" />
          <span className="truncate text-xs font-semibold uppercase tracking-widest text-white">
            Proyectos
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-2 py-3">
        {/* Vistas principales */}
        <div>
          <p className="text-2xs mb-1 px-2 font-semibold uppercase tracking-widest text-zinc-600">
            Vista
          </p>
          <div className="space-y-0.5">
            {(
              [
                { id: 'global' as ProyectosView, label: 'Proyectos', icon: LayoutGrid },
                { id: 'tareas-global' as ProyectosView, label: 'Cuadro tareas', icon: CheckSquare },
                { id: 'tesoreria' as ProyectosView, label: 'Tesorería', icon: BarChart3 },
              ] as { id: ProyectosView; label: string; icon: typeof LayoutGrid }[]
            ).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                    selectedView === item.id
                      ? 'border border-blue-500/20 bg-blue-600/15 text-blue-300'
                      : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
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
          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
            selectedView === 'nuevo-proyecto'
              ? 'border border-emerald-500/20 bg-emerald-600/15 text-emerald-300'
              : 'border border-transparent text-zinc-500 hover:bg-emerald-500/[0.06] hover:text-emerald-300'
          }`}
        >
          <Plus size={13} />
          Nuevo proyecto
        </button>

        {/* Tabs cuando hay proyecto seleccionado */}
        {selectedView === 'detalle' && proyectoActivo && (
          <div>
            <div className="mb-2 px-2">
              <p className="text-2xs mb-1 font-semibold uppercase tracking-widest text-zinc-600">
                Proyecto
              </p>
              <p className="truncate text-xs font-medium leading-tight text-white">
                {proyectoActivo.nombre}
              </p>
              <span
                className={`text-2xs mt-1 inline-block rounded px-1.5 py-0.5 font-semibold uppercase tracking-wider ${estadoColor(proyectoActivo.estado)}`}
              >
                {proyectoActivo.estado ?? 'sin estado'}
              </span>
            </div>
            <div className="space-y-0.5">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                      selectedTab === tab.id
                        ? 'border border-white/10 bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
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
          <p className="text-2xs mb-1 px-2 font-semibold uppercase tracking-widest text-zinc-600">
            Acceso rápido
          </p>
          <div className="space-y-0.5">
            {proyectos.slice(0, 10).map((p) => (
              <button
                key={p.id_ref}
                onClick={() => {
                  onSelectProyecto(p.id_ref);
                  onViewChange('detalle');
                }}
                className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-all ${
                  selectedProyectoId === p.id_ref && selectedView === 'detalle'
                    ? 'border border-white/[0.08] bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300'
                }`}
              >
                <span className="flex-1 truncate text-left font-medium">{p.nombre}</span>
                <ChevronRight
                  size={10}
                  className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
