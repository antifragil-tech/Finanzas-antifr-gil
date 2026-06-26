import { redirect } from 'next/navigation';
import { isDemoMode } from '@/lib/demo';
import { EnConstruccion } from '@/components/EnConstruccion';
import { FileText } from 'lucide-react';

export default function FacturasPage() {
  // En demo mode: placeholder Antifrágil (sin redirigir a legacy).
  // Fuera de demo: comportamiento intacto (redirige a /contabilidad).
  if (isDemoMode()) {
    return (
      <EnConstruccion
        titulo="Facturación"
        descripcion="Facturación emitida y precontabilidad de Antifrágil. En construcción."
        icon={FileText}
      />
    );
  }
  redirect('/contabilidad');
}
