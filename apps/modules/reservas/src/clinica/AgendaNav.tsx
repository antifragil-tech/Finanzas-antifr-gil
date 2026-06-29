import { Calendar, CalendarRange, CalendarDays, ListChecks, type LucideIcon } from 'lucide-react';
import { Button } from '@alsari/ui';

export type VistaAgenda = 'hoy' | 'semana' | 'mes' | 'pendientes';

const TABS: { id: VistaAgenda; label: string; icon: LucideIcon }[] = [
  { id: 'hoy', label: 'Hoy', icon: Calendar },
  { id: 'semana', label: 'Semana', icon: CalendarRange },
  { id: 'mes', label: 'Mes', icon: CalendarDays },
  { id: 'pendientes', label: 'Pendientes', icon: ListChecks },
];

// Sub-navegación de la Agenda (Clínica > Agenda). ANDAMIAJE de Fase 1: el componente
// queda listo; se cablea en ClinicaDashboard cuando exista la vista "Hoy" (commit 2).
export function AgendaNav({
  vista,
  onVista,
}: {
  vista: VistaAgenda;
  onVista: (v: VistaAgenda) => void;
}) {
  return (
    <div className="flex gap-1">
      {TABS.map(({ id, label, icon }) => (
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
  );
}
