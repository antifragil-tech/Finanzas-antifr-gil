import type { LucideIcon } from 'lucide-react';
import {
  BarChart2,
  BookOpen,
  CalendarDays,
  FileText,
  FolderKanban,
  HandCoins,
  Home,
  LayoutDashboard,
  Settings,
  TrendingUp,
  Wallet,
} from 'lucide-react';

// Mapa de navegación del shell Antifrágil OS.
// Cada entrada indica de qué PR/línea vendrá el módulo real cuando se integre.
// Los módulos `placeholder: true` renderizan <ModulePlaceholder>; el resto son
// rutas legacy heredadas de Alsari que siguen funcionando tal cual.

export type OSNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  placeholder?: boolean;
};

export type OSNavGroup = {
  titulo: string;
  items: OSNavItem[];
};

export const OS_NAV: OSNavGroup[] = [
  {
    titulo: 'Operativa',
    items: [
      { href: '/', label: 'Inicio', icon: Home, exact: true },
      { href: '/dashboard', label: 'Panel', icon: LayoutDashboard, placeholder: true },
      { href: '/reservas', label: 'Reservas', icon: CalendarDays, placeholder: true },
      { href: '/financiero', label: 'Finanzas', icon: BarChart2 },
      { href: '/facturas', label: 'Facturación', icon: FileText },
      { href: '/tesoreria', label: 'Tesorería', icon: Wallet, placeholder: true },
      { href: '/rentabilidad', label: 'Rentabilidad', icon: TrendingUp, placeholder: true },
      { href: '/liquidaciones', label: 'Liquidaciones', icon: HandCoins, placeholder: true },
    ],
  },
  {
    titulo: 'Heredado',
    items: [
      { href: '/contabilidad', label: 'Contabilidad', icon: BookOpen },
      { href: '/presupuestos', label: 'Proyectos', icon: FolderKanban },
    ],
  },
  {
    titulo: 'Sistema',
    items: [{ href: '/configuracion', label: 'Configuración', icon: Settings, placeholder: true }],
  },
];

export function tituloDeRuta(pathname: string): string {
  for (const grupo of OS_NAV) {
    for (const item of grupo.items) {
      if (
        item.exact ? pathname === item.href : item.href !== '/' && pathname.startsWith(item.href)
      ) {
        return item.label;
      }
    }
  }
  return 'Antifrágil OS';
}
