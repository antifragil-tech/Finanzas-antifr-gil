import Link from 'next/link';
import { BarChart2, BookOpen, ChevronRight, Activity, FolderKanban, CalendarDays } from 'lucide-react';
import { isDemoMode } from '@/lib/demo';

type ModuleCard = {
  href: string;
  label: string;
  description: string;
  icon: typeof BarChart2;
  color: string;
  bg: string;
  border: string;
  dot: string;
  estado: string;
};

// Producción / legacy: los módulos reales del OS (comportamiento intacto).
const modulesLegacy: ModuleCard[] = [
  {
    href: '/financiero',
    label: 'Financiero',
    description: 'KPIs del holding, proyectos, mapa corporativo, contabilidad y workspace semanal.',
    icon: BarChart2,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    dot: 'bg-blue-400',
    estado: 'Activo',
  },
  {
    href: '/contabilidad',
    label: 'Contabilidad',
    description: 'Facturas con OCR, movimientos bancarios, asientos PGC y reconciliación.',
    icon: BookOpen,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    dot: 'bg-purple-400',
    estado: 'Activo',
  },
  {
    href: '/presupuestos',
    label: 'Proyectos',
    description: 'OKRs, kanban de tareas y presupuesto por proyecto. Vista global por sociedad.',
    icon: FolderKanban,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-400',
    estado: 'Activo',
  },
  {
    href: '/reservas',
    label: 'Reservas',
    description: 'Agenda de la clínica: calendario de profesionales y citas. Demo con datos mock.',
    icon: CalendarDays,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    dot: 'bg-amber-400',
    estado: 'Activo',
  },
];

// Bloques del Panel de Dirección. ANDAMIAJE (Fase 1): estructura visible sin
// contenido mock — los bloques se rellenan en Fase 2.
const panelBloques = ['Hoy', 'Clínica', 'Tesorería', 'Pendientes', 'Rentabilidad', 'Proyectos'] as const;

// Demo Antifrágil: Panel de Dirección dentro del DemoShell (sin doble cabecera).
function PanelDireccion() {
  return (
    <div className="px-8 py-8">
      <div className="mb-2 flex items-center gap-2 text-2xs font-medium uppercase tracking-widest text-zinc-600">
        <Activity size={10} />
        <span>Sistema Operativo</span>
      </div>
      <h1 className="mb-1 text-3xl font-light tracking-tight text-white">Panel de Dirección</h1>
      <p className="mb-8 text-sm font-medium text-zinc-500">
        Vista de Clínica, Finanzas, Rentabilidad y Proyectos. Andamiaje — los bloques llegan en la siguiente fase.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {panelBloques.map((titulo) => (
          <section key={titulo} className="glass-panel flex min-h-[160px] flex-col rounded-2xl p-6">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-200">{titulo}</h2>
            <div className="flex flex-1 items-center justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-2xs uppercase tracking-widest text-zinc-500">
                Próximamente · Fase 2
              </span>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// Legacy: landing de módulos a pantalla completa (comportamiento intacto).
function LegacyHome() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="px-10 pt-14 pb-10">
        <p className="mb-8 text-2xl font-light uppercase tracking-[0.25em] text-brand">Antifrágil</p>
        <div className="flex items-center gap-2 text-2xs text-zinc-600 font-medium uppercase tracking-widest mb-3">
          <Activity size={10} />
          <span>Sistema Operativo</span>
        </div>
        <h1 className="text-4xl font-light tracking-tighter text-white mb-2">Buenos días, Guille.</h1>
        <p className="text-zinc-500 text-sm font-medium">Selecciona una herramienta para comenzar.</p>
      </header>

      <main className="px-10 pb-16">
        <p className="text-2xs font-semibold text-zinc-600 uppercase tracking-widest mb-5">Módulos activos</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {modulesLegacy.map(({ href, label, description, icon: Icon, color, bg, border, dot, estado }) => {
            const funcional = estado === 'Activo' || estado === 'Funcional';
            return (
              <Link
                key={href}
                href={href}
                className={`group relative flex flex-col gap-6 p-7 rounded-2xl border bg-zinc-900/40 ${border} hover:bg-zinc-900/70 transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:shadow-black/30`}
              >
                <div className="absolute top-5 right-5 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${dot} ${funcional ? 'animate-pulse' : ''}`} />
                  <span className="text-2xs font-medium text-zinc-600 uppercase tracking-widest">{estado}</span>
                </div>

                <div className={`w-14 h-14 rounded-2xl ${bg} flex items-center justify-center`}>
                  <Icon size={26} className={color} />
                </div>

                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-white tracking-tight">{label}</h2>
                  <p className="text-sm text-zinc-500 leading-relaxed">{description}</p>
                </div>

                <div className={`flex items-center gap-1.5 text-xs font-medium ${funcional ? color : 'text-zinc-600'} mt-auto`}>
                  <span>{funcional ? 'Abrir módulo' : 'Ver detalle'}</span>
                  <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform duration-200" />
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default function HomePage() {
  // En demo: Panel de Dirección (andamiaje) dentro del DemoShell.
  // Fuera de demo: landing legacy intacta.
  if (isDemoMode()) return <PanelDireccion />;
  return <LegacyHome />;
}
