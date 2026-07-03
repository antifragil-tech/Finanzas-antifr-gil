import {
  Calendar,
  CalendarRange,
  CalendarDays,
  ListChecks,
  Wallet,
  Building2,
  Users,
  Gift,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@alsari/ui';

export type VistaAgenda =
  | 'hoy'
  | 'semana'
  | 'mes'
  | 'pendientes'
  | 'cobros'
  | 'vivofacil'
  | 'clientes'
  | 'bonos';

type Tab = { id: VistaAgenda; label: string; icon: LucideIcon };

// Navegación del módulo Clínica, agrupada (Agenda · Gestión) para no saturar con
// 8 pestañas. Prioridad escritorio/tablet; envuelve limpio en pantallas estrechas.
const GRUPOS: { grupo: string; tabs: Tab[] }[] = [
  {
    grupo: 'Agenda',
    tabs: [
      { id: 'hoy', label: 'Hoy', icon: Calendar },
      { id: 'semana', label: 'Semana', icon: CalendarRange },
      { id: 'mes', label: 'Mes', icon: CalendarDays },
      { id: 'pendientes', label: 'Pendientes', icon: ListChecks },
    ],
  },
  {
    grupo: 'Gestión',
    tabs: [
      { id: 'cobros', label: 'Cobros', icon: Wallet },
      { id: 'vivofacil', label: 'Vivofácil', icon: Building2 },
      { id: 'clientes', label: 'Clientes', icon: Users },
      { id: 'bonos', label: 'Bonos', icon: Gift },
    ],
  },
];

export function AgendaNav({
  vista,
  onVista,
}: {
  vista: VistaAgenda;
  onVista: (v: VistaAgenda) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {GRUPOS.map((g, gi) => (
        <div key={g.grupo} className="flex items-center gap-2">
          {gi > 0 ? <span className="hidden h-4 w-px bg-white/10 sm:block" /> : null}
          <span className="hidden text-2xs uppercase tracking-widest text-zinc-600 lg:inline">
            {g.grupo}
          </span>
          <div className="flex flex-wrap gap-1">
            {g.tabs.map(({ id, label, icon }) => (
              <Button
                key={id}
                variant={vista === id ? 'primary' : 'ghost'}
                size="sm"
                icon={icon}
                onClick={() => onVista(id)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
