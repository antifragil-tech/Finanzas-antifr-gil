import { redirect } from 'next/navigation';
import { isDemoMode } from '@/lib/demo';
import { FacturasDemo } from '@/components/demo/screens/FacturasDemo';

export default function FacturasPage() {
  // En demo mode: pantalla demo de Facturación (mock, sin datos fiscales reales).
  // Fuera de demo: comportamiento intacto (redirige a /contabilidad).
  if (isDemoMode()) {
    return <FacturasDemo />;
  }
  redirect('/contabilidad');
}
