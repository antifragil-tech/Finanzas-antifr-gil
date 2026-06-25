import {
  Building2, Globe, Crown,
  Eye, EyeOff, Database, Wallet,
  TrendingUp, Calendar, Briefcase, ChevronDown,
  Users, Home, PanelLeftClose,
} from 'lucide-react';
import type { SocietyOption, ViewOption } from '@alsari/types';

type NavItemDef = {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  on: string;
  ico: string;
};

const SECTIONS: { label: string; items: NavItemDef[] }[] = [
  {
    label: 'GENERAL',
    items: [
      { id: 'entidades', label: 'Entidades',       icon: Users,      on: 'bg-blue-600/10 border-blue-500/30 text-blue-200',    ico: 'bg-blue-600/20 text-blue-400' },
      { id: 'map',       label: 'Mapa Corporativo', icon: Globe,      on: 'bg-blue-600/10 border-blue-500/30 text-blue-200',    ico: 'bg-blue-600/20 text-blue-400' },
    ],
  },
  {
    label: 'FINANZAS',
    items: [
      { id: 'cashflow',  label: 'Cashflow',   icon: TrendingUp, on: 'bg-violet-600/10 border-violet-500/30 text-violet-200', ico: 'bg-violet-600/20 text-violet-400' },
    ],
  },
  {
    label: 'PATRIMONIO',
    items: [
      { id: 'patrimonio',   label: 'Activos',       icon: Wallet,   on: 'bg-emerald-600/10 border-emerald-500/30 text-emerald-200', ico: 'bg-emerald-600/20 text-emerald-400' },
      { id: 'vencimientos', label: 'Vencimientos',  icon: Calendar, on: 'bg-amber-600/10 border-amber-500/30 text-amber-200',     ico: 'bg-amber-600/20 text-amber-400' },
    ],
  },
  {
    label: 'GESTIÓN',
    items: [
      { id: 'maestro', label: 'Datos Maestros', icon: Database, on: 'bg-zinc-800/60 border-zinc-700/40 text-zinc-200', ico: 'bg-zinc-700 text-zinc-400' },
    ],
  },
];

// Views that belong to a specific entity (show entity context in sidebar)
const ENTITY_VIEWS = new Set(['overview']);

type Props = {
  selectedSociety: SocietyOption;
  selectedView: string;
  availableViews: ViewOption[];   // overview + project IDs for current society
  isPrivateMode: boolean;
  isOpen: boolean;
  onViewChange: (viewId: string) => void;
  onTogglePrivacy: () => void;
  onToggleSidebar: () => void;
};

export function FinancialSidebar({
  selectedSociety,
  selectedView,
  availableViews,
  isPrivateMode,
  isOpen,
  onViewChange,
  onTogglePrivacy,
  onToggleSidebar,
}: Props) {
  const projects = availableViews.filter(v => v.id !== 'overview');
  const isEntityContext = ENTITY_VIEWS.has(selectedView) || projects.some(p => p.id === selectedView);

  const variantIcon = () => {
    if (selectedSociety.idRef === null) return <Globe size={13} />;
    if (selectedSociety.showCrown)      return <Crown size={13} />;
    return <Building2 size={13} />;
  };

  const variantColor = () => {
    if (selectedSociety.variant === 'primary')   return 'bg-amber-500/20 text-amber-400';
    if (selectedSociety.variant === 'secondary')  return 'bg-blue-500/20 text-blue-400';
    return 'bg-zinc-800 text-zinc-400';
  };

  return (
    <div className={`w-72 h-screen fixed left-0 top-0 bg-zinc-950 border-r border-white/5 flex flex-col z-50 overflow-hidden transition-all duration-200
      ${isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}`}>

      {/* Header: home + logo + cerrar */}
      <div className="h-14 flex items-center gap-2 px-3 border-b border-white/5 shrink-0">
        <button
          onClick={() => { window.location.href = '/'; }}
          title="Volver al inicio"
          className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-800 border border-white/[0.12] text-zinc-400 hover:text-white hover:border-white/20 transition-all shrink-0"
        >
          <Home size={13} />
        </button>
        <div className="flex-1 flex justify-center">
          <img src="/logo.png" alt="Alsari Capital" className="h-7 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
        <button
          onClick={onToggleSidebar}
          title="Ocultar panel"
          className="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04] transition-all shrink-0"
        >
          <PanelLeftClose size={13} />
        </button>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {SECTIONS.map(section => (
          <div key={section.label}>
            <p className="text-2xs font-semibold text-zinc-600 uppercase tracking-[0.2em] px-2 mb-1.5">{section.label}</p>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const active = selectedView === item.id
                  || (item.id === 'entidades' && isEntityContext);
                return (
                  <button
                    key={item.id}
                    onClick={() => onViewChange(item.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-all text-sm font-medium
                      ${active
                        ? `${item.on} border`
                        : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
                      }`}
                  >
                    <div className={`p-1.5 rounded-md transition-all ${active ? item.ico : 'text-zinc-600'}`}>
                      <item.icon size={13} />
                    </div>
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Entity context: shown when inside a society's overview or project */}
        {isEntityContext && (
          <div className="border-t border-white/[0.06] pt-4 space-y-2">
            <p className="text-2xs font-semibold text-zinc-600 uppercase tracking-[0.2em] px-2">Entidad activa</p>

            {/* Current entity */}
            <button
              onClick={() => onViewChange('overview')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-all
                ${selectedView === 'overview'
                  ? 'bg-blue-600/10 border-blue-500/20 text-blue-200'
                  : 'border-transparent text-zinc-400 hover:bg-white/[0.03]'
                }`}
            >
              <div className={`p-1.5 rounded-md shrink-0 ${variantColor()}`}>{variantIcon()}</div>
              <div className="min-w-0 text-left">
                <p className="text-xs font-semibold truncate">{selectedSociety.nombre}</p>
                {selectedSociety.badge && <p className="text-2xs text-zinc-600 uppercase tracking-tight font-semibold">{selectedSociety.badge}</p>}
              </div>
            </button>

            {/* Projects */}
            {projects.length > 0 && (
              <div className="space-y-0.5 pt-1">
                <p className="text-2xs font-semibold text-zinc-700 uppercase tracking-[0.2em] px-2 flex items-center gap-1.5">
                  <Briefcase size={9} /> Proyectos
                  <span className="ml-auto bg-zinc-800 text-zinc-600 text-2xs font-semibold px-1.5 py-0.5 rounded-full">{projects.length}</span>
                </p>
                {projects.map(p => {
                  const active = selectedView === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => onViewChange(p.id)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all text-xs font-medium
                        ${active
                          ? 'bg-blue-600/10 border-blue-500/20 text-blue-200'
                          : 'border-transparent text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.03]'
                        }`}
                    >
                      <ChevronDown size={10} className="rotate-[-90deg] shrink-0 opacity-50" />
                      <span className="truncate text-left">{p.nombre}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-white/5 shrink-0 space-y-1">
        <button
          onClick={onTogglePrivacy}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-all text-sm font-medium
            ${isPrivateMode
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-200'
              : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
            }`}
        >
          <div className={`p-1.5 rounded-md ${isPrivateMode ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-600'}`}>
            {isPrivateMode ? <EyeOff size={13} /> : <Eye size={13} />}
          </div>
          Modo Privado
        </button>
        <div className="flex items-center justify-center gap-2 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-2xs text-zinc-700 font-mono uppercase tracking-[0.2em]">System Online</p>
        </div>
      </div>
    </div>
  );
}
