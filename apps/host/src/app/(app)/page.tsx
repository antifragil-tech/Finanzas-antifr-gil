import Link from 'next/link';
import Image from 'next/image';
import { BarChart2, BookOpen, ChevronRight, Activity, FolderKanban } from 'lucide-react';

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
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="px-10 pb-10 pt-14">
        <p className="mb-8 text-xl font-light uppercase tracking-[0.35em] text-zinc-200 opacity-80">Antifrágil</p>
        <div className="text-2xs mb-3 flex items-center gap-2 font-medium uppercase tracking-widest text-zinc-600">
          <Activity size={10} />
          <span>Sistema Operativo</span>
        </div>
        <h1 className="mb-2 text-4xl font-light tracking-tighter text-white">
          Buenos días, Guille.
        </h1>
        <p className="text-sm font-medium text-zinc-500">
          Selecciona una herramienta para comenzar.
        </p>
      </header>

      {/* Module grid */}
      <main className="px-10 pb-16">
        <p className="text-2xs mb-5 font-semibold uppercase tracking-widest text-zinc-600">
          Módulos activos
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map(({ href, label, description, icon: Icon, color, bg, border, dot }) => (
            <Link
              key={href}
              href={href}
              className={`group relative flex flex-col gap-6 rounded-2xl border bg-zinc-900/40 p-7 ${border} transition-all duration-300 hover:scale-[1.01] hover:bg-zinc-900/70 hover:shadow-xl hover:shadow-black/30`}
            >
              {/* Status dot */}
              <div className="absolute right-5 top-5 flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${dot} animate-pulse`} />
                <span className="text-2xs font-medium uppercase tracking-widest text-zinc-600">
                  Activo
                </span>
              </div>

              {/* Icon */}
              <div className={`h-14 w-14 rounded-2xl ${bg} flex items-center justify-center`}>
                <Icon size={26} className={color} />
              </div>

              {/* Content */}
              <div className="space-y-2">
                <h2 className="text-lg font-semibold tracking-tight text-white">{label}</h2>
                <p className="text-sm leading-relaxed text-zinc-500">{description}</p>
              </div>

              {/* CTA */}
              <div className={`flex items-center gap-1.5 text-xs font-medium ${color} mt-auto`}>
                <span>Abrir módulo</span>
                <ChevronRight
                  size={13}
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
