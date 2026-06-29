import { FinancieroDashboard } from '@/components/FinancieroDashboardClient';
import { isDemoMode } from '@/lib/demo';
import { FinancieroDemo } from '@/components/demo/screens/FinancieroDemo';

export default function FinancieroPage() {
  // En demo mode: pantalla demo de Finanzas Operativas (mock, sin backend).
  // Fuera de demo: dashboard legacy intacto.
  if (isDemoMode()) {
    return <FinancieroDemo />;
  }
  return <FinancieroDashboard />;
}
