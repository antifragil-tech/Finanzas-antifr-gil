import { CalendarioSpike } from './spike/CalendarioSpike';

// Raíz del módulo Clínica/Reservas. En el spike solo monta el calendario.
// (Mismo patrón de export que los demás módulos: ver src/index.ts.)
export function ClinicaDashboard() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <header className="glass-header shrink-0 px-6 py-4">
        <p className="text-2xs uppercase tracking-widest text-zinc-500">
          Antifrágil · Clínica Playamar
        </p>
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-light tracking-tight text-zinc-100">Agenda</h1>
          <span className="rounded-full border border-white/10 bg-zinc-900 px-2 py-0.5 text-2xs uppercase tracking-wide text-zinc-400">
            spike · calendario
          </span>
        </div>
      </header>

      {/* Solo el calendario hace scroll; la cabecera y la barra quedan fijas. */}
      <main className="min-h-0 flex-1 px-6 py-4">
        <CalendarioSpike />
      </main>
    </div>
  );
}
