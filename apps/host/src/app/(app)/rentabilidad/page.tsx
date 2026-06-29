import { notFound } from 'next/navigation';
import { isDemoMode } from '@/lib/demo';
import { EnConstruccion } from '@/components/EnConstruccion';
import { TrendingUp } from 'lucide-react';

export default function RentabilidadPage() {
  // Ruta nueva, solo-demo: en demo muestra placeholder; fuera de demo NO existe
  // (404), de modo que el legacy mantiene exactamente su superficie de rutas.
  if (!isDemoMode()) notFound();
  return (
    <EnConstruccion
      titulo="Rentabilidad"
      descripcion="Rentabilidad analítica por servicio, profesional y proyecto de Antifrágil. En construcción."
      icon={TrendingUp}
    />
  );
}
