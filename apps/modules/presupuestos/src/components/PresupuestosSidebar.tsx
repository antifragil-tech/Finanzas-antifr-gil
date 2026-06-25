import {
  LayoutDashboard, CalendarClock, FolderOpen, PlusCircle,
  Eye, EyeOff, Home,
} from 'lucide-react';

export type PresupuestosView = 'dashboard' | 'calendario' | 'lista' | 'nuevo';

type NavItem = {
  id: PresupuestosView;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  on: string;
  ico: string;
};

const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'PRESUPUESTOS',
    items: [
      {
        id: 'dashboard',
        label: 'Panel de Control',
        icon: LayoutDashboard,
        on:  'bg-emerald-600/10 border-emerald-500/30 text-emerald-200',
        ico: 'bg-emerald-600/20 text-emerald-400',
      },
      {
        id: 'calendario',
        label: 'Calendario de Pagos',
        icon: CalendarClock,
        on:  'bg-blue-600/10 border-blue-500/30 text-blue-200',
        ico: 'bg-blue-600/20 text-blue-400',
      },
      {
        id: 'lista',
        label: 'Mis Presupuestos',
        icon: FolderOpen,
        on:  'bg-violet-600/10 border-violet-500/30 text-violet-200',
        ico: 'bg-violet-600/20 text-violet-400',
      },
    ],
  },
  {
    label: 'ACCIONES',
    items: [
      {
        id: 'nuevo',
        label: 'Nuevo Presupuesto',
        icon: PlusCircle,
        on:  'bg-amber-600/10 border-amber-500/30 text-amber-200',
        ico: 'bg-amber-600/20 text-amber-400',
      },
    ],
  },
];

type Props = {
  selectedView: PresupuestosView;
  isPrivateMode: boolean;
  onViewChange: (v: PresupuestosView) => void;
  onTogglePrivacy: () => void;
};

export function PresupuestosSidebar({
  selectedView, isPrivateMode, onViewChange, onTogglePrivacy,
}: Props) {
  function handleHome() {
    window.location.href = '/';
  }

  return (
    <div className="w-64 h-screen fixed left-0 top-0 bg-zinc-900 border-r border-white/[0.08] flex flex-col z-50 overflow-hidden">

      <div className="h-14 flex items-center gap-3 px-4 border-b border-white/[0.08] shrink-0">
        <button
          onClick={handleHome}
          title="Volver al inicio"
          className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-800 border border-white/[0.12] text-zinc-400 hover:text-white hover:border-white/20 transition-all shrink-0"
        >
          <Home size={13} />
        </button>
        <img
          src="/logo.png" alt="Alsari Capital"
          className="h-6 w-auto object-contain opacity-70 hover:opacity-90 transition-opacity cursor-pointer"
          onClick={handleHome}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {SECTIONS.map(section => (
          <div key={section.label}>
            <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-[0.2em] px-2 mb-1.5">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const active = selectedView === item.id;
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
                    <div className={`p-1.5 rounded-md transition-all ${active ? item.ico : 'text-zinc-500'}`}>
                      <item.icon size={13} />
                    </div>
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-white/[0.08] shrink-0 space-y-1">
        <button
          onClick={onTogglePrivacy}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-all text-sm font-medium
            ${isPrivateMode
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-200'
              : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
            }`}
        >
          <div className={`p-1.5 rounded-md ${isPrivateMode ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500'}`}>
            {isPrivateMode ? <EyeOff size={13} /> : <Eye size={13} />}
          </div>
          Modo Privado
        </button>
        <div className="flex items-center justify-center gap-2 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-2xs text-zinc-600 font-mono uppercase tracking-[0.2em]">System Online</p>
        </div>
      </div>
    </div>
  );
}
