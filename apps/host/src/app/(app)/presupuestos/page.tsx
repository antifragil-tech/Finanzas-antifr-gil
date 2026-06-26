import { PresupuestosDashboard } from '@/components/PresupuestosClient';
import { isDemoMode } from '@/lib/demo';
import { EnConstruccion } from '@/components/EnConstruccion';
import { FolderKanban } from 'lucide-react';

export default function PresupuestosPage() {
  // En demo mode no se muestra el dashboard legacy; fuera de demo, intacto.
  if (isDemoMode()) {
    return (
      <EnConstruccion
        titulo="Proyectos Antifrágil"
        descripcion="Proyectos, objetivos y presupuestos de Antifrágil. En construcción."
        icon={FolderKanban}
      />
    );
  }
  return <PresupuestosDashboard />;
}
