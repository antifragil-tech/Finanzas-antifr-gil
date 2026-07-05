import { CalendarDays } from 'lucide-react';
import { ModulePlaceholder } from '@/components/os/ModulePlaceholder';

export default function ReservasPage() {
  return (
    <ModulePlaceholder
      titulo="Reservas"
      descripcion="Agenda de la clínica: citas, validación de asistencia y cobros de recepción. Reservas se integrará desde el PR #5 (versión canónica). No se incluye la copia antigua del demo."
      fuente="Módulo real: apps/modules/reservas · PR #5 — Agenda v0.2 operativa para recepción."
      icon={CalendarDays}
    />
  );
}
