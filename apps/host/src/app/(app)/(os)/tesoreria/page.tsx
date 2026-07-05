import { Wallet } from 'lucide-react';
import { ModulePlaceholder } from '@/components/os/ModulePlaceholder';

export default function TesoreriaPage() {
  return (
    <ModulePlaceholder
      titulo="Tesorería"
      descripcion="Caja y banco por separado, arqueo de caja diario y movimientos de tesorería. El modelo FOP-A1 tiene draft SQL en el PR #4 (NO APPLY: nada ejecutado en Supabase)."
      fuente="Diseño: docs/finanzas 06 (PR #11) · draft SQL: PR #4 — baseline + A1 Tesorería/Caja."
      icon={Wallet}
    />
  );
}
