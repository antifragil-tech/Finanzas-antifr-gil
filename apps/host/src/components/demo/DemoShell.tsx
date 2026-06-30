'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DemoSidebar } from './DemoSidebar';
import { DemoTopbar } from './DemoTopbar';
import { DemoProvider } from './context/DemoContext';

// Cascarón operativo de la Demo v0.2.
// Envuelve la experiencia EXISTENTE con sidebar + topbar persistentes.
// SOLO se monta cuando isDemoMode() (la decisión vive en (app)/layout.tsx,
// que es server component; aquí no se importa isDemoMode porque es server-only).
//
// · Sin splash / sin BootScreen: entrada directa al OS.
// · No renderiza dashboards legacy: los hijos son las páginas del host, que en
//   demo ya devuelven placeholders limpios (o la agenda en /reservas).
// · Replica el puente de token de AppShell para no alterar /reservas.
export function DemoShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();

  // Exponer token y logout para módulos embebidos vía window (igual que AppShell).
  useEffect(() => {
    type W = Window & { alsariLogout?: () => void; alsariToken?: string };
    const win = window as W;

    win.alsariLogout = async () => {
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    };

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

  return (
    <DemoProvider>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <DemoSidebar />
        <div className="pl-60">
          <DemoTopbar />
          <main className="min-h-[calc(100vh-4rem)] overflow-auto">{children}</main>
        </div>
      </div>
    </DemoProvider>
  );
}
