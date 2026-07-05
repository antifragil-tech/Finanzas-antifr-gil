'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { OSContextBar } from './OSContextBar';
import { OS_NAV, tituloDeRuta } from './osNav';

// Shell visual de Antifrágil OS: sidebar de navegación + topbar + área de
// contenido. Sin backend, sin Supabase, sin datos: solo estructura y estética
// Quiet Luxury. Envuelve únicamente las rutas placeholder del route group
// (app)/(os); las rutas legacy de Alsari no pasan por aquí.

export function OSShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-white/5 bg-zinc-950">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/5 px-5">
          <span className="h-2 w-2 rounded-full bg-[#F5F0E1]" />
          <span className="text-sm font-semibold tracking-tight text-zinc-100">Antifrágil OS</span>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          {OS_NAV.map((grupo) => (
            <div key={grupo.titulo} className="mb-5">
              <p className="text-2xs mb-2 px-3 uppercase tracking-[0.25em] text-zinc-600">
                {grupo.titulo}
              </p>
              <div className="flex flex-col gap-1">
                {grupo.items.map(({ href, label, icon: Icon, exact, placeholder }) => {
                  const active = exact ? pathname === href : pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-colors duration-200 ${
                        active
                          ? 'bg-zinc-800/60 text-white'
                          : 'text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300'
                      }`}
                    >
                      <Icon size={17} className="shrink-0" />
                      <span className="flex-1 text-sm font-medium">{label}</span>
                      {placeholder && (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-amber-400/70"
                          title="En construcción"
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/5 p-4">
          <p className="text-2xs leading-relaxed text-zinc-600">
            Shell v0.1 · sin backend
            <br />
            Los puntos ámbar son módulos en construcción.
          </p>
        </div>
      </aside>

      {/* Topbar + contenido */}
      <div className="pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/5 bg-zinc-950/80 px-6 backdrop-blur">
          <h1 className="text-sm font-medium tracking-tight text-zinc-300">
            {tituloDeRuta(pathname)}
          </h1>
          <div className="flex items-center gap-3">
            <OSContextBar />
            <span className="text-2xs inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 uppercase tracking-widest text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Draft — shell sin módulos
            </span>
          </div>
        </header>
        <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
      </div>
    </div>
  );
}
