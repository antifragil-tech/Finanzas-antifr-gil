import { Settings } from 'lucide-react';
import { ModulePlaceholder } from '@/components/os/ModulePlaceholder';

export default function ConfiguracionPage() {
  return (
    <ModulePlaceholder
      titulo="Configuración"
      descripcion="Ajustes del sistema: usuarios, roles y permisos, centros y catálogos. Se definirá cuando existan los módulos operativos que configura."
      icon={Settings}
    />
  );
}
