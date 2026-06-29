import { AppShell } from '@/components/AppShell';
import { DemoShell } from '@/components/demo/DemoShell';
import { isDemoMode } from '@/lib/demo';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // En demo mode envolvemos la experiencia con el cascarón operativo (sidebar +
  // topbar). Fuera de demo, el layout legacy queda EXACTAMENTE como estaba.
  if (isDemoMode()) {
    return <DemoShell>{children}</DemoShell>;
  }
  return <AppShell>{children}</AppShell>;
}
