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

// Demo Antifrágil: Clínica funcional + resto "en construcción" (nada de Alsari).
const modulesDemo: ModuleCard[] = [
  {
    href: '/reservas',
    label: 'Clínica · Reservas',
    description: 'Agenda de la clínica: calendario de profesionales y citas. Datos de ejemplo.',
    icon: CalendarDays,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    dot: 'bg-amber-400',
    estado: 'Funcional',
  },
  {
    href: '/financiero',
    label: 'Finanzas Operativas',
    description: 'Cashflow, tesorería y rentabilidad por proyecto de Antifrágil.',
    icon: BarChart2,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-white/10',
    dot: 'bg-zinc-500',
    estado: 'En construcción',
  },
  {
    href: '/contabilidad',
    label: 'Contabilidad y Facturación',
    description: 'Facturas, conciliación y precontabilidad de la clínica.',
    icon: BookOpen,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-white/10',
    dot: 'bg-zinc-500',
    estado: 'En construcción',
  },
  {
    href: '/presupuestos',
    label: 'Proyectos Antifrágil',
    description: 'Proyectos, objetivos y presupuestos de Antifrágil.',
    icon: FolderKanban,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-white/10',
    dot: 'bg-zinc-500',
    estado: 'En construcción',
  },
];

export default function HomePage() {
  const demo = isDemoMode();
  const modules = demo ? modulesDemo : modulesLegacy;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="px-10 pt-14 pb-10">
        <p className="mb-8 text-2xl font-light uppercase tracking-[0.25em] text-brand">
          Antifrágil
        </p>
        <div className="flex items-center gap-2 text-2xs text-zinc-600 font-medium uppercase tracking-widest mb-3">
          <Activity size={10} />
          <span>Sistema Operativo</span>
        </div>
        <h1 className="text-4xl font-light tracking-tighter text-white mb-2">
          {demo ? 'Panel de Dirección' : 'Buenos días, Guille.'}
        </h1>
        <p className="text-zinc-500 text-sm font-medium">
          {demo
            ? 'Vista completa de Clínica, Finanzas, Rentabilidad y Proyectos.'
            : 'Selecciona una herramienta para comenzar.'}
        </p>
      </header>

      {/* Module grid */}
      <main className="px-10 pb-16">
        <p className="text-2xs font-semibold text-zinc-600 uppercase tracking-widest mb-5">
          {demo ? 'Módulos' : 'Módulos activos'}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {modules.map(({ href, label, description, icon: Icon, color, bg, border, dot, estado }) => {
            const funcional = estado === 'Activo' || estado === 'Funcional';
            return (
              <Link
                key={href}
                href={href}
                className={`group relative flex flex-col gap-6 p-7 rounded-2xl border bg-zinc-900/40 ${border} hover:bg-zinc-900/70 transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:shadow-black/30`}
              >
                {/* Status */}
                <div className="absolute top-5 right-5 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${dot} ${funcional ? 'animate-pulse' : ''}`} />
                  <span className="text-2xs font-medium text-zinc-600 uppercase tracking-widest">{estado}</span>
                </div>

                {/* Icon */}
                <div className={`w-14 h-14 rounded-2xl ${bg} flex items-center justify-center`}>
                  <Icon size={26} className={color} />
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-white tracking-tight">{label}</h2>
                  <p className="text-sm text-zinc-500 leading-relaxed">{description}</p>
                </div>

                {/* CTA */}
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
