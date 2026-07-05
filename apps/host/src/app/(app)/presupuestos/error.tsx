'use client';

export default function PresupuestosError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="max-w-md px-6 text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Error en Presupuestos
        </p>
        <p className="mb-6 text-sm text-zinc-400">{error.message}</p>
        <button
          onClick={reset}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
