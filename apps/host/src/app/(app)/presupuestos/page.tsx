import { PresupuestosDashboard } from '@/components/PresupuestosClient';
import { isDemoMode } from '@/lib/demo';
import { ProyectosDemo } from '@/components/demo/screens/ProyectosDemo';

export default function PresupuestosPage() {
  // En demo mode: pantalla demo de Proyectos (mock).
  // Fuera de demo: dashboard legacy intacto.
  if (isDemoMode()) {
    return <ProyectosDemo />;
  }
  return <PresupuestosDashboard />;
}
