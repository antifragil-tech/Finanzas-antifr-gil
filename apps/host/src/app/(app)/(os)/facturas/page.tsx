import { FileText } from 'lucide-react';
import { ModulePlaceholder } from '@/components/os/ModulePlaceholder';

export default function FacturasPage() {
  return (
    <ModulePlaceholder
      titulo="Facturación"
      descripcion="Módulo fuera del MVP actual. La facturación operativa de Antifrágil se diseñó en docs/finanzas/02 y se construirá sobre cobros y bonos."
      fuente="Pendiente de adaptación a Antifrágil OS — la versión heredada del holding se retiró del runtime."
      icon={FileText}
    />
  );
}
