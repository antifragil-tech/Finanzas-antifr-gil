import { ContabilidadDashboard } from '@/components/ContabilidadClient';
import { isDemoMode } from '@/lib/demo';
import { ContabilidadDemo } from '@/components/demo/screens/ContabilidadDemo';

export default function ContabilidadPage() {
  // En demo mode: pantalla demo de Contabilidad y Gestoría (mock).
  // Fuera de demo: dashboard legacy intacto.
  if (isDemoMode()) {
    return <ContabilidadDemo />;
  }
  return <ContabilidadDashboard />;
}
