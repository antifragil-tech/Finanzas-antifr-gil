'use client';

// Wrapper de cliente para montar el módulo Reservas (mock) embebido en el host.
// `ssr: false` es OBLIGATORIO: el calendario usa DayPilot, que accede al DOM
// (`window`) y rompería durante el render en servidor de Next.
import dynamic from 'next/dynamic';

export const ReservasDashboard = dynamic(
  () => import('@alsari/reservas').then((m) => m.ClinicaDashboard),
  { ssr: false },
);
