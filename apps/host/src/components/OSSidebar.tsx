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
      {expanded && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setExpanded(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen z-50 flex flex-col bg-zinc-950 border-r border-white/5 transition-all duration-300 ease-in-out overflow-hidden ${
          expanded ? 'w-56' : 'w-16'
        }`}
      >
        {/* Header / toggle */}
        <div className="h-14 flex items-center border-b border-white/5 shrink-0 overflow-hidden">
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-16 h-full flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
            title={expanded ? 'Colapsar menú' : 'Expandir menú'}
          >
            <ChevronRight
              size={16}
              className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
          {expanded && (
            <div className="flex-1 flex items-center pr-4">
              <Image
                src="/logo.png"
                alt="Alsari Capital"
                width={96}
                height={28}
                className="object-contain opacity-80"
                priority
              />
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-2 flex flex-col gap-1 pt-4">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all duration-200 whitespace-nowrap ${
                  active
                    ? 'bg-zinc-800/60 text-white'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60'
                }`}
              >
                <Icon size={18} className="shrink-0" />
                {expanded && (
                  <span className="text-sm font-semibold">{label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-2 border-t border-white/5 shrink-0">
          <button
            onClick={onLogout}
            className="flex items-center gap-3 py-2.5 px-3 rounded-xl w-full text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900/60 transition-all duration-200 whitespace-nowrap"
          >
            <LogOut size={18} className="shrink-0" />
            {expanded && (
              <span className="text-sm font-semibold">Salir</span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
