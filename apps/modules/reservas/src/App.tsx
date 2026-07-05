import { useState } from 'react';
import { CalendarioSpike } from './spike/CalendarioSpike';
import { AgendaHoy } from './clinica/agenda/AgendaHoy';
import { AgendaNav, type VistaAgenda } from './clinica/AgendaNav';
import { Pendientes } from './clinica/Pendientes';
import { Cobros } from './clinica/Cobros';
import { Vivofacil } from './clinica/Vivofacil';
import { Clientes } from './clinica/Clientes';
import { Bonos } from './clinica/Bonos';
import { CitasProvider, useCitasStore } from './clinica/CitasStore';
import type { CitaPanelMode } from './clinica/CitaPanel';

interface ClinicaDashboardProps {
  /**
   * Modo del panel de cita: 'fixed' (default, standalone) o 'contained' para
   * embeber el módulo en el host/demo sin que el panel tape toda la app.
   */
  panelMode?: CitaPanelMode;
}

// Raíz del módulo Clínica/Reservas. Clínica > Agenda con sub-navegación:
// Hoy (vista por profesional, núcleo de recepción) por defecto · Semana · Mes ·
// Pendientes · Gestión. El estado mock de citas vive en CitasProvider, compartido
// por todas las vistas. Mismo patrón de export que los demás módulos (src/index.ts).
export function ClinicaDashboard({ panelMode = 'fixed' }: ClinicaDashboardProps = {}) {
  return (
    <CitasProvider>
      <ClinicaShell panelMode={panelMode} />
    </CitasProvider>
  );
}

function ClinicaShell({ panelMode }: { panelMode: CitaPanelMode }) {
  const [vista, setVista] = useState<VistaAgenda>('hoy');
  const { setSelectedId } = useCitasStore();

  // Al cambiar de pestaña se cierra el panel de cita para que la selección
  // no "persiga" al usuario entre vistas.
  const cambiarVista = (v: VistaAgenda) => {
    setSelectedId(null);
    setVista(v);
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-zinc-950 text-zinc-100">
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
          <AgendaNav vista={vista} onVista={cambiarVista} />
        </div>
      </header>

      <main className="min-h-0 flex-1 px-6 py-4">
        {vista === 'hoy' && <AgendaHoy panelMode={panelMode} />}
        {vista === 'semana' && <CalendarioSpike vistaInicial="semana" />}
        {vista === 'mes' && <CalendarioSpike vistaInicial="mes" />}
        {vista === 'pendientes' && <Pendientes panelMode={panelMode} />}
        {vista === 'cobros' && <Cobros panelMode={panelMode} />}
        {vista === 'vivofacil' && <Vivofacil panelMode={panelMode} />}
        {vista === 'clientes' && <Clientes panelMode={panelMode} />}
        {vista === 'bonos' && <Bonos />}
      </main>
    </div>
  );
}
