import { notFound } from 'next/navigation';
import { isDemoMode } from '@/lib/demo';
import { EnConstruccion } from '@/components/EnConstruccion';
import { Settings } from 'lucide-react';

export default function ConfiguracionPage() {
  // Ruta nueva, solo-demo: en demo muestra placeholder; fuera de demo NO existe
  // (404), de modo que el legacy mantiene exactamente su superficie de rutas.
  if (!isDemoMode()) notFound();
  return (
    <EnConstruccion
      titulo="Configuración"
      descripcion="Ajustes del OS: sociedad, proyectos, roles y preferencias. En construcción."
      icon={Settings}
    />
  );
}
