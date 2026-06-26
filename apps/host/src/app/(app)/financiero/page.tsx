import { FinancieroDashboard } from '@/components/FinancieroDashboardClient';
import { isDemoMode } from '@/lib/demo';
import { EnConstruccion } from '@/components/EnConstruccion';
import { BarChart2 } from 'lucide-react';

export default function FinancieroPage() {
  // En demo mode no se muestra el dashboard legacy (Alsari/holding); fuera de
  // demo, comportamiento intacto.
  if (isDemoMode()) {
    return (
      <EnConstruccion
        titulo="Finanzas Operativas"
        descripcion="Cashflow, tesorería y rentabilidad por proyecto de Antifrágil. En construcción."
        icon={BarChart2}
      />
    );
  }
  return <FinancieroDashboard />;
}
