import { OSDashboard } from '@/components/os/dashboard/OSDashboard';

// /dashboard: panel operativo mock del OS. La home legacy (/) no se toca;
// cuando el shell sea la experiencia por defecto se decidirá la portada.

export default function DashboardPage() {
  return <OSDashboard />;
}
