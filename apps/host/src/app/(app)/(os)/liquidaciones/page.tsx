import { HandCoins } from 'lucide-react';
import { ModulePlaceholder } from '@/components/os/ModulePlaceholder';

export default function LiquidacionesPage() {
  return (
    <ModulePlaceholder
      titulo="Liquidaciones"
      descripcion="Equipo y pagos a profesionales: nóminas, autónomos por sesión, planes mensuales, validación, pago y documentos privados por rol."
      fuente="Diseño FOP-B1: docs/finanzas 08 (PR #13)."
      icon={HandCoins}
    />
  );
}
