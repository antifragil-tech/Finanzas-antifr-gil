import { notFound } from 'next/navigation';
import { isDemoMode } from '@/lib/demo';
import { ConfiguracionDemo } from '@/components/demo/screens/ConfiguracionDemo';

export default function ConfiguracionPage() {
  // Ruta solo-demo: en demo muestra la pantalla mock; fuera de demo NO existe.
  if (!isDemoMode()) notFound();
  return <ConfiguracionDemo />;
}
