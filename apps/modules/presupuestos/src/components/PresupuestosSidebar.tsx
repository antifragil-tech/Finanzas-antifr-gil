import {
  LayoutDashboard,
  CalendarClock,
  FolderOpen,
  PlusCircle,
  Eye,
  EyeOff,
  Home,
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
        on: 'bg-emerald-600/10 border-emerald-500/30 text-emerald-200',
        ico: 'bg-emerald-600/20 text-emerald-400',
      },
      {
        id: 'calendario',
        label: 'Calendario de Pagos',
        icon: CalendarClock,
        on: 'bg-blue-600/10 border-blue-500/30 text-blue-200',
        ico: 'bg-blue-600/20 text-blue-400',
      },
      {
        id: 'lista',
        label: 'Mis Presupuestos',
        icon: FolderOpen,
        on: 'bg-violet-600/10 border-violet-500/30 text-violet-200',
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
        on: 'bg-amber-600/10 border-amber-500/30 text-amber-200',
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
  selectedView,
  isPrivateMode,
  onViewChange,
  onTogglePrivacy,
}: Props) {
  function handleHome() {
    window.location.href = '/';
  }

  return (
    <div className="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col overflow-hidden border-r border-white/[0.08] bg-zinc-900">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.08] px-4">
        <button
          onClick={handleHome}
          title="Volver al inicio"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.12] bg-zinc-800 text-zinc-400 transition-all hover:border-white/20 hover:text-white"
        >
          <Home size={13} />
        </button>
        <img
          src="/logo.png"
          alt="Antifrágil"
          className="h-6 w-auto cursor-pointer object-contain opacity-70 transition-opacity hover:opacity-90"
          onClick={handleHome}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="text-2xs mb-1.5 px-2 font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = selectedView === item.id;
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
                      className={`rounded-md p-1.5 transition-all ${active ? item.ico : 'text-zinc-500'}`}
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
      </nav>

      <div className="shrink-0 space-y-1 border-t border-white/[0.08] px-3 py-3">
        <button
          onClick={onTogglePrivacy}
          className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-sm font-medium transition-all ${
            isPrivateMode
              ? 'border-amber-500/20 bg-amber-500/10 text-amber-200'
              : 'border-transparent text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300'
          }`}
        >
          <div
            className={`rounded-md p-1.5 ${isPrivateMode ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500'}`}
          >
            {isPrivateMode ? <EyeOff size={13} /> : <Eye size={13} />}
          </div>
          Modo Privado
        </button>
        <div className="flex items-center justify-center gap-2 py-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          <p className="text-2xs font-mono uppercase tracking-[0.2em] text-zinc-600">
            System Online
          </p>
        </div>
      </div>
    </div>
  );
}
