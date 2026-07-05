'use client';

import dynamic from 'next/dynamic';
import '@alsari/reservas/styles'; // tema .dp-quiet de DayPilot — import único y controlado (solo esta ruta)

// DayPilot manipula el DOM directamente: sin SSR. El import dinámico además
// difiere su bundle (~180 kB gzip) a la visita real de /reservas.
const ClinicaDashboard = dynamic(() => import('@alsari/reservas').then((m) => m.ClinicaDashboard), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-zinc-500">
      Cargando agenda…
    </div>
  ),
});

export function ReservasClient() {
  // 'contained': el panel de cita se abre dentro del área de contenido del
  // shell; el modo 'fixed' (default standalone) taparía sidebar y topbar.
  return <ClinicaDashboard panelMode="contained" />;
}
