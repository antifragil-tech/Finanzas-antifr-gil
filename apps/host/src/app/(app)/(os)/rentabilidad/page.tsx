import { TrendingUp } from 'lucide-react';
import { ModulePlaceholder } from '@/components/os/ModulePlaceholder';

export default function RentabilidadPage() {
  return (
    <ModulePlaceholder
      titulo="Rentabilidad"
      descripcion="Margen operativo por sesión, profesional, servicio, canal, centro y proyecto. Devengo por fecha de prestación, nunca por fecha de cobro."
      fuente="Diseño FOP-B2: docs/finanzas 09 (PR #15) · modelo operativo: PR #11."
      icon={TrendingUp}
    />
  );
}
