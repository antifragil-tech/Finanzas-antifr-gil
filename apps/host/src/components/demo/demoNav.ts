import { Home, CalendarDays, BarChart2, TrendingUp, BookOpen, FolderKanban, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Navegación principal del DemoShell (Demo v0.2).
// SOLO se usa en demo mode. No reintroduce dashboards legacy: cada destino es
// la ruta del host, que en demo renderiza su placeholder limpio o, en el caso
// de /reservas, la agenda funcional.
export type DemoNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

export const demoNav: DemoNavItem[] = [
  { href: '/', label: 'Inicio', icon: Home, exact: true },
  { href: '/reservas', label: 'Clínica / Agenda', icon: CalendarDays },
  { href: '/financiero', label: 'Finanzas Operativas', icon: BarChart2 },
  { href: '/rentabilidad', label: 'Rentabilidad', icon: TrendingUp },
  { href: '/contabilidad', label: 'Contabilidad y Gestoría', icon: BookOpen },
  { href: '/presupuestos', label: 'Proyectos', icon: FolderKanban },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
];
