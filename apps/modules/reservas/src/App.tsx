import { useState } from 'react';
import { CalendarioSpike } from './spike/CalendarioSpike';
import { AgendaHoy } from './clinica/agenda/AgendaHoy';
import { AgendaNav, type VistaAgenda } from './clinica/AgendaNav';

// Raíz del módulo Clínica/Reservas. Clínica > Agenda con sub-navegación:
// Hoy (vista por profesional, núcleo de recepción) por defecto · Semana · Mes ·
// Pendientes. Mismo patrón de export que los demás módulos (ver src/index.ts).
export function ClinicaDashboard() {
  const [vista, setVista] = useState<VistaAgenda>('hoy');

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <header className="glass-header shrink-0 px-6 py-4">
        <p className="text-2xs uppercase tracking-widest text-zinc-500">
          Antifrágil · Clínica Playamar
        </p>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-light tracking-tight text-zinc-100">Agenda</h1>
            <span className="rounded-full border border-white/10 bg-zinc-900 px-2 py-0.5 text-2xs uppercase tracking-wide text-zinc-400">
              recepción
            </span>
          </div>
          <AgendaNav vista={vista} onVista={setVista} />
        </div>
      </header>

      <main className="min-h-0 flex-1 px-6 py-4">
        {vista === 'hoy' && <AgendaHoy />}
        {vista === 'semana' && <CalendarioSpike vistaInicial="semana" />}
        {vista === 'mes' && <CalendarioSpike vistaInicial="mes" />}
        {vista === 'pendientes' && (
          <div className="flex h-full items-center justify-center">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-2xs uppercase tracking-widest text-zinc-500">
              Pendientes · próximamente
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
