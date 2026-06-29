'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { demoNav } from './demoNav';

// Sidebar persistente del DemoShell. Resalta la ruta activa.
// Sin interactividad compleja en Fase 1 (los filtros/selectores van en Fase 3).
export function DemoSidebar() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-white/5 bg-zinc-950">
      {/* Marca */}
      <div className="flex h-16 shrink-0 items-center border-b border-white/5 px-6">
        <span className="text-sm font-light uppercase tracking-[0.25em] text-brand">Antifrágil</span>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto p-3">
        <p className="px-3 pb-2 pt-2 text-2xs font-semibold uppercase tracking-widest text-zinc-600">
          Navegación
        </p>
        <div className="flex flex-col gap-1">
          {demoNav.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-zinc-800/60 text-white'
                    : 'text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300'
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-white/5 p-4">
        <p className="text-2xs uppercase tracking-widest text-zinc-700">Demo v0.2 · local</p>
      </div>
    </aside>
  );
}
