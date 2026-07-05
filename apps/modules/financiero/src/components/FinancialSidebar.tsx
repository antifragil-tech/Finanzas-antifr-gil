import {
  Building2,
  Globe,
  Crown,
  Eye,
  EyeOff,
  Database,
  Wallet,
  TrendingUp,
  Calendar,
  Briefcase,
  ChevronDown,
  Users,
  Home,
  PanelLeftClose,
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
      {
        id: 'entidades',
        label: 'Entidades',
        icon: Users,
        on: 'bg-blue-600/10 border-blue-500/30 text-blue-200',
        ico: 'bg-blue-600/20 text-blue-400',
      },
      {
        id: 'map',
        label: 'Mapa Corporativo',
        icon: Globe,
        on: 'bg-blue-600/10 border-blue-500/30 text-blue-200',
        ico: 'bg-blue-600/20 text-blue-400',
      },
    ],
  },
  {
    label: 'FINANZAS',
    items: [
      {
        id: 'cashflow',
        label: 'Cashflow',
        icon: TrendingUp,
        on: 'bg-violet-600/10 border-violet-500/30 text-violet-200',
        ico: 'bg-violet-600/20 text-violet-400',
      },
    ],
  },
  {
    label: 'PATRIMONIO',
    items: [
      {
        id: 'patrimonio',
        label: 'Activos',
        icon: Wallet,
        on: 'bg-emerald-600/10 border-emerald-500/30 text-emerald-200',
        ico: 'bg-emerald-600/20 text-emerald-400',
      },
      {
        id: 'vencimientos',
        label: 'Vencimientos',
        icon: Calendar,
        on: 'bg-amber-600/10 border-amber-500/30 text-amber-200',
        ico: 'bg-amber-600/20 text-amber-400',
      },
    ],
  },
  {
    label: 'GESTIÓN',
    items: [
      {
        id: 'maestro',
        label: 'Datos Maestros',
        icon: Database,
        on: 'bg-zinc-800/60 border-zinc-700/40 text-zinc-200',
        ico: 'bg-zinc-700 text-zinc-400',
      },
    ],
  },
];

// Views that belong to a specific entity (show entity context in sidebar)
const ENTITY_VIEWS = new Set(['overview']);

type Props = {
  selectedSociety: SocietyOption;
  selectedView: string;
  availableViews: ViewOption[]; // overview + project IDs for current society
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
  const projects = availableViews.filter((v) => v.id !== 'overview');
  const isEntityContext =
    ENTITY_VIEWS.has(selectedView) || projects.some((p) => p.id === selectedView);

  const variantIcon = () => {
    if (selectedSociety.idRef === null) return <Globe size={13} />;
    if (selectedSociety.showCrown) return <Crown size={13} />;
    return <Building2 size={13} />;
  };

  const variantColor = () => {
    if (selectedSociety.variant === 'primary') return 'bg-amber-500/20 text-amber-400';
    if (selectedSociety.variant === 'secondary') return 'bg-blue-500/20 text-blue-400';
    return 'bg-zinc-800 text-zinc-400';
  };

  return (
    <div
      className={`fixed left-0 top-0 z-50 flex h-screen w-72 flex-col overflow-hidden border-r border-white/5 bg-zinc-950 transition-all duration-200 ${isOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-full opacity-0'}`}
    >
      {/* Header: home + logo + cerrar */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/5 px-3">
        <button
          onClick={() => {
            window.location.href = '/';
          }}
          title="Volver al inicio"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.12] bg-zinc-800 text-zinc-400 transition-all hover:border-white/20 hover:text-white"
        >
          <Home size={13} />
        </button>
        <div className="flex flex-1 justify-center">
          <img
            src="/logo.png"
            alt="Antifrágil"
            className="h-7 w-auto object-contain opacity-90 transition-opacity hover:opacity-100"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
        <button
          onClick={onToggleSidebar}
          title="Ocultar panel"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition-all hover:bg-white/[0.04] hover:text-zinc-300"
        >
          <PanelLeftClose size={13} />
        </button>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="text-2xs mb-1.5 px-2 font-semibold uppercase tracking-[0.2em] text-zinc-600">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  selectedView === item.id || (item.id === 'entidades' && isEntityContext);
                return (
                  <button
                    key={item.id}
                    onClick={() => onViewChange(item.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-sm font-medium transition-all ${
                      active
                        ? `${item.on} border`
                        : 'border-transparent text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300'
                    }`}
                  >
                    <div
                      className={`rounded-md p-1.5 transition-all ${active ? item.ico : 'text-zinc-600'}`}
                    >
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
          <div className="space-y-2 border-t border-white/[0.06] pt-4">
            <p className="text-2xs px-2 font-semibold uppercase tracking-[0.2em] text-zinc-600">
              Entidad activa
            </p>

            {/* Current entity */}
            <button
              onClick={() => onViewChange('overview')}
              className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-all ${
                selectedView === 'overview'
                  ? 'border-blue-500/20 bg-blue-600/10 text-blue-200'
                  : 'border-transparent text-zinc-400 hover:bg-white/[0.03]'
              }`}
            >
              <div className={`shrink-0 rounded-md p-1.5 ${variantColor()}`}>{variantIcon()}</div>
              <div className="min-w-0 text-left">
                <p className="truncate text-xs font-semibold">{selectedSociety.nombre}</p>
                {selectedSociety.badge && (
                  <p className="text-2xs font-semibold uppercase tracking-tight text-zinc-600">
                    {selectedSociety.badge}
                  </p>
                )}
              </div>
            </button>

            {/* Projects */}
            {projects.length > 0 && (
              <div className="space-y-0.5 pt-1">
                <p className="text-2xs flex items-center gap-1.5 px-2 font-semibold uppercase tracking-[0.2em] text-zinc-700">
                  <Briefcase size={9} /> Proyectos
                  <span className="text-2xs ml-auto rounded-full bg-zinc-800 px-1.5 py-0.5 font-semibold text-zinc-600">
                    {projects.length}
                  </span>
                </p>
                {projects.map((p) => {
                  const active = selectedView === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => onViewChange(p.id)}
                      className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                        active
                          ? 'border-blue-500/20 bg-blue-600/10 text-blue-200'
                          : 'border-transparent text-zinc-600 hover:bg-white/[0.03] hover:text-zinc-300'
                      }`}
                    >
                      <ChevronDown size={10} className="shrink-0 rotate-[-90deg] opacity-50" />
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
      <div className="shrink-0 space-y-1 border-t border-white/5 px-3 py-3">
        <button
          onClick={onTogglePrivacy}
          className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-sm font-medium transition-all ${
            isPrivateMode
              ? 'border-amber-500/20 bg-amber-500/10 text-amber-200'
              : 'border-transparent text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300'
          }`}
        >
          <div
            className={`rounded-md p-1.5 ${isPrivateMode ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-600'}`}
          >
            {isPrivateMode ? <EyeOff size={13} /> : <Eye size={13} />}
          </div>
          Modo Privado
        </button>
        <div className="flex items-center justify-center gap-2 py-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          <p className="text-2xs font-mono uppercase tracking-[0.2em] text-zinc-700">
            System Online
          </p>
        </div>
      </div>
    </div>
  );
}
