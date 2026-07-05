'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Home, BarChart2, BookOpen, LogOut, ChevronRight, FolderKanban } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Inicio', icon: Home, exact: true },
  { href: '/financiero', label: 'Financiero', icon: BarChart2, exact: false },
  { href: '/contabilidad', label: 'Contabilidad', icon: BookOpen, exact: false },
  { href: '/presupuestos', label: 'Proyectos', icon: FolderKanban, exact: false },
] as const;

type OSSidebarProps = {
  onLogout: () => void;
};

export function OSSidebar({ onLogout }: OSSidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  // Collapse on navigation
  useEffect(() => {
    setExpanded(false);
  }, [pathname]);

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {/* Backdrop when expanded */}
      {expanded && <div className="fixed inset-0 z-40" onClick={() => setExpanded(false)} />}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen flex-col overflow-hidden border-r border-white/5 bg-zinc-950 transition-all duration-300 ease-in-out ${
          expanded ? 'w-56' : 'w-16'
        }`}
      >
        {/* Header / toggle */}
        <div className="flex h-14 shrink-0 items-center overflow-hidden border-b border-white/5">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex h-full w-16 shrink-0 items-center justify-center text-zinc-600 transition-colors hover:text-zinc-300"
            title={expanded ? 'Colapsar menú' : 'Expandir menú'}
          >
            <ChevronRight
              size={16}
              className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
          {expanded && (
            <div className="flex flex-1 items-center pr-4">
              <span className="text-sm font-light uppercase tracking-[0.3em] text-zinc-200">Antifrágil</span>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex flex-1 flex-col gap-1 p-2 pt-4">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 transition-all duration-200 ${
                  active
                    ? 'bg-zinc-800/60 text-white'
                    : 'text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300'
                }`}
              >
                <Icon size={18} className="shrink-0" />
                {expanded && <span className="text-sm font-semibold">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="shrink-0 border-t border-white/5 p-2">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-zinc-600 transition-all duration-200 hover:bg-zinc-900/60 hover:text-zinc-400"
          >
            <LogOut size={18} className="shrink-0" />
            {expanded && <span className="text-sm font-semibold">Salir</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
