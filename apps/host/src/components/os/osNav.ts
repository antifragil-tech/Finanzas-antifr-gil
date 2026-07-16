import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  HandCoins,
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
  /** En preparación: la ruta existe con contenido provisional. */
  placeholder?: boolean;
  /** Módulo heredado en adaptación a Antifrágil OS. */
  heredado?: boolean;
};

export type OSNavGroup = {
  titulo: string;
  items: OSNavItem[];
};

// Orden por lógica de decisión: de lo ejecutivo (¿cómo vamos?) a lo operativo
// (¿qué hago hoy?) y, al fondo, los ajustes del sistema. Guille abre el Panel,
// baja al Dinero (tesorería → rentabilidad → liquidaciones) y solo entra en
// Operación/Sistema cuando lo necesita.
export const OS_NAV: OSNavGroup[] = [
  {
    titulo: 'Dirección',
    items: [{ href: '/dashboard', label: 'Panel', icon: LayoutDashboard }],
  },
  {
    titulo: 'Dinero',
    items: [
      { href: '/tesoreria', label: 'Tesorería', icon: Wallet },
      { href: '/rentabilidad', label: 'Rentabilidad', icon: TrendingUp },
      { href: '/liquidaciones', label: 'Liquidaciones', icon: HandCoins },
    ],
  },
  {
    titulo: 'Operación',
    items: [{ href: '/reservas', label: 'Reservas', icon: CalendarDays }],
  },
  {
    titulo: 'Sistema',
    items: [{ href: '/configuracion', label: 'Configuración', icon: Settings, placeholder: true }],
  },
];
// Los módulos heredados del holding (financiero, facturas, contabilidad,
// proyectos) quedaron FUERA del menú y del runtime del MVP (cirugía
// 2026-07-05): sus URLs sirven un placeholder limpio bajo el shell del OS.
// Clientes, Cobros y Bonos viven como pestañas dentro de Reservas.

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
