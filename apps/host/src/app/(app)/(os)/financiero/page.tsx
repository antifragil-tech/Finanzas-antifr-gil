import { BarChart2 } from 'lucide-react';
import { ModulePlaceholder } from '@/components/os/ModulePlaceholder';

export default function FinancieroPage() {
  return (
    <ModulePlaceholder
      titulo="Finanzas"
      descripcion="Módulo fuera del MVP actual. La analítica financiera de Antifrágil llegará con Rentabilidad y Tesorería operativas."
      fuente="Pendiente de adaptación a Antifrágil OS — la versión heredada del holding se retiró del runtime."
      icon={BarChart2}
    />
  );
}
