'use client';

import dynamic from 'next/dynamic';
import type { AgendaInicial, Catalogo } from '@alsari/reservas';
import {
  buscarClientesReal,
  cambiarEstadoCitaReal,
  crearCitaReal,
  registrarCobroCitaReal,
} from '@/lib/datos/accionesReservas';
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

// Escrituras reales de la agenda: server actions del host inyectadas al
// módulo. Solo se pasan cuando hay agenda real (con entorno Supabase).
const ACCIONES = {
  crearCita: crearCitaReal,
  cambiarEstado: cambiarEstadoCitaReal,
  registrarCobro: registrarCobroCitaReal,
  buscarClientes: buscarClientesReal,
};

export function ReservasClient({
  catalogo,
  agenda,
}: {
  catalogo?: Catalogo;
  agenda?: AgendaInicial;
} = {}) {
  // 'contained': el panel de cita se abre dentro del área de contenido del
  // shell; el modo 'fixed' (default standalone) taparía sidebar y topbar.
  return (
    <ClinicaDashboard
      panelMode="contained"
      catalogo={catalogo}
      agenda={agenda}
      acciones={agenda ? ACCIONES : undefined}
    />
  );
}
