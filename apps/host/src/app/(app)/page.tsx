import Link from 'next/link';
import Image from 'next/image';
import { BarChart2, BookOpen, ChevronRight, Activity, FolderKanban, CalendarDays } from 'lucide-react';

const modules = [
  {
    href: '/financiero',
    label: 'Financiero',
    description: 'KPIs del holding, proyectos, mapa corporativo, contabilidad y workspace semanal.',
    icon: BarChart2,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    dot: 'bg-blue-400',
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
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="px-10 pt-14 pb-10">
        <Image
          src="/logo.png"
          alt="Antifrágil"
          width={160}
          height={46}
          className="object-contain opacity-70 mb-8"
          priority
        />
        <div className="flex items-center gap-2 text-2xs text-zinc-600 font-medium uppercase tracking-widest mb-3">
          <Activity size={10} />
          <span>Sistema Operativo</span>
        </div>
        <h1 className="text-4xl font-light tracking-tighter text-white mb-2">
          Buenos días, Guille.
        </h1>
        <p className="text-zinc-500 text-sm font-medium">
          Selecciona una herramienta para comenzar.
        </p>
      </header>

      {/* Module grid */}
      <main className="px-10 pb-16">
        <p className="text-2xs font-semibold text-zinc-600 uppercase tracking-widest mb-5">
          Módulos activos
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {modules.map(({ href, label, description, icon: Icon, color, bg, border, dot }) => (
            <Link
              key={href}
              href={href}
              className={`group relative flex flex-col gap-6 p-7 rounded-2xl border bg-zinc-900/40 ${border} hover:bg-zinc-900/70 transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:shadow-black/30`}
            >
              {/* Status dot */}
              <div className="absolute top-5 right-5 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${dot} animate-pulse`} />
                <span className="text-2xs font-medium text-zinc-600 uppercase tracking-widest">Activo</span>
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
              <div className={`flex items-center gap-1.5 text-xs font-medium ${color} mt-auto`}>
                <span>Abrir módulo</span>
                <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform duration-200" />
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
