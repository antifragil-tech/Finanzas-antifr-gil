import { OSGlobalProvider } from '@/components/os/context';
import { OSShell } from '@/components/os/OSShell';

// Route group (os): las rutas nuevas del shell Antifrágil OS (reservas,
// tesorería, rentabilidad, liquidaciones, configuración) se envuelven con el
// shell visual (sidebar + topbar). Las rutas legacy de Alsari que viven
// directamente bajo (app) NO pasan por aquí y quedan exactamente como estaban.
// Este layout anida dentro de (app)/layout.tsx, así que el gate de auth y el
// AppShell existentes siguen aplicando sin cambios.

export default function OSLayout({ children }: { children: React.ReactNode }) {
  return (
    <OSGlobalProvider>
      <OSShell>{children}</OSShell>
    </OSGlobalProvider>
  );
}
