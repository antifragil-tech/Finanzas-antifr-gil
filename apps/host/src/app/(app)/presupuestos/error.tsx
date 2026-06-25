'use client';

export default function PresupuestosError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="text-center max-w-md px-6">
        <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-4">Error en Presupuestos</p>
        <p className="text-zinc-400 text-sm mb-6">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-semibold hover:bg-zinc-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
