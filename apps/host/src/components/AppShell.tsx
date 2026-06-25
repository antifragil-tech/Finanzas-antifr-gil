'use client';

import { useState, useEffect } from 'react';
import { BootScreen } from './BootScreen';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 2500);
    return () => clearTimeout(t);
  }, []);

  // Exponer token y logout para módulos embebidos vía window
  useEffect(() => {
    type W = Window & { alsariLogout?: () => void; alsariToken?: string };
    const win = window as W;

    win.alsariLogout = async () => {
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    };

    // Sincronizar token al cargar y en cada cambio de sesión
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) win.alsariToken = session.access_token;
      else delete win.alsariToken;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) win.alsariToken = session.access_token;
      else delete win.alsariToken;
    });
    return () => subscription.unsubscribe();
  }, [supabase.auth, router]);

  if (booting) return <BootScreen />;

  return (
    <div className="min-h-screen bg-zinc-900">
      <main className="min-h-screen overflow-auto">{children}</main>
    </div>
  );
}
