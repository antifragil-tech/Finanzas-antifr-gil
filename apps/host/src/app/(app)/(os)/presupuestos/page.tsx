import { FolderKanban } from 'lucide-react';
import { ModulePlaceholder } from '@/components/os/ModulePlaceholder';

export default function PresupuestosPage() {
  return (
    <ModulePlaceholder
      titulo="Proyectos"
      descripcion="Módulo fuera del MVP actual. La gestión de proyectos/centros se integrará con el contexto global del OS."
      fuente="Pendiente de adaptación a Antifrágil OS — la versión heredada del holding se retiró del runtime."
      icon={FolderKanban}
    />
  );
}
