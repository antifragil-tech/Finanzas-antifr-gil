import { ContabilidadDashboard } from '@/components/ContabilidadClient';
import { isDemoMode } from '@/lib/demo';
import { EnConstruccion } from '@/components/EnConstruccion';
import { BookOpen } from 'lucide-react';

export default function ContabilidadPage() {
  // En demo mode no se muestra el dashboard legacy; fuera de demo, intacto.
  if (isDemoMode()) {
    return (
      <EnConstruccion
        titulo="Contabilidad y Facturación"
        descripcion="Facturas, conciliación y precontabilidad de Antifrágil. En construcción."
        icon={BookOpen}
      />
    );
  }
  return <ContabilidadDashboard />;
}
