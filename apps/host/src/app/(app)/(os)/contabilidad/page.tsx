import { BookOpen } from 'lucide-react';
import { ModulePlaceholder } from '@/components/os/ModulePlaceholder';

export default function ContabilidadPage() {
  return (
    <ModulePlaceholder
      titulo="Contabilidad"
      descripcion="Módulo fuera del MVP actual. La precontabilidad operativa llegará tras el vertical MVP."
      fuente="Pendiente de adaptación a Antifrágil OS — la versión heredada del holding se retiró del runtime."
      icon={BookOpen}
    />
  );
}
