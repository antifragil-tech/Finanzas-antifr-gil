import { notFound } from 'next/navigation';
import { isDemoMode } from '@/lib/demo';
import { RentabilidadDemo } from '@/components/demo/screens/RentabilidadDemo';

export default function RentabilidadPage() {
  // Ruta solo-demo: en demo muestra la pantalla mock; fuera de demo NO existe.
  if (!isDemoMode()) notFound();
  return <RentabilidadDemo />;
}
