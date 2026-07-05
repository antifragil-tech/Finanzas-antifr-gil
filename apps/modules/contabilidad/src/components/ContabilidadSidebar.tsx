import {
  LayoutDashboard,
  ArrowUpDown,
  FileText,
  Send,
  BookOpen,
  GitMerge,
  Eye,
  EyeOff,
  Home,
  Users,
  Building2,
} from 'lucide-react';

export type ContabilidadView =
  | 'dashboard'
  | 'movimientos'
  | 'facturas'
  | 'facturas_emitidas'
  | 'contactos'
  | 'diario'
  | 'reconciliacion'
  | 'mis_empresas';

type NavItem = {
  id: ContabilidadView;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  on: string;
  ico: string;
};

const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'CONTABILIDAD',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        on: 'bg-blue-600/10 border-blue-500/30 text-blue-200',
        ico: 'bg-blue-600/20 text-blue-400',
      },
      {
        id: 'movimientos',
        label: 'Movimientos',
        icon: ArrowUpDown,
        on: 'bg-violet-600/10 border-violet-500/30 text-violet-200',
        ico: 'bg-violet-600/20 text-violet-400',
      },
      {
        id: 'facturas',
        label: 'Fra. Recibidas',
        icon: FileText,
        on: 'bg-emerald-600/10 border-emerald-500/30 text-emerald-200',
        ico: 'bg-emerald-600/20 text-emerald-400',
      },
      {
        id: 'facturas_emitidas',
        label: 'Fra. Emitidas',
        icon: Send,
        on: 'bg-sky-600/10 border-sky-500/30 text-sky-200',
        ico: 'bg-sky-600/20 text-sky-400',
      },
      {
        id: 'contactos',
        label: 'Contactos',
        icon: Users,
        on: 'bg-pink-600/10 border-pink-500/30 text-pink-200',
        ico: 'bg-pink-600/20 text-pink-400',
      },
    ],
  },
  {
    label: 'LIBRO CONTABLE',
    items: [
      {
        id: 'diario',
        label: 'Diario Borrador',
        icon: BookOpen,
        on: 'bg-amber-600/10 border-amber-500/30 text-amber-200',
        ico: 'bg-amber-600/20 text-amber-400',
      },
      {
        id: 'reconciliacion',
        label: 'Reconciliación',
        icon: GitMerge,
        on: 'bg-rose-600/10 border-rose-500/30 text-rose-200',
        ico: 'bg-rose-600/20 text-rose-400',
      },
    ],
  },
  {
    label: 'CONFIGURACIÓN',
    items: [
      {
        id: 'mis_empresas',
        label: 'Mis Empresas',
        icon: Building2,
        on: 'bg-zinc-600/10 border-zinc-500/30 text-zinc-200',
        ico: 'bg-zinc-600/20 text-zinc-400',
      },
    ],
  },
];

type Props = {
  selectedView: ContabilidadView;
  isPrivateMode: boolean;
  onViewChange: (v: ContabilidadView) => void;
  onTogglePrivacy: () => void;
};

export function ContabilidadSidebar({
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
      {/* Home button + logo */}
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
          alt="Alsari Capital"
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
