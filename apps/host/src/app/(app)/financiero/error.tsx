'use client';

export default function FinancieroError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="glass-panel max-w-md rounded-2xl p-8 text-center">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-400">
          Financiero
        </p>
        <p className="mb-1 font-medium text-white">El módulo no ha podido cargar</p>
        <p className="mb-6 text-sm text-zinc-500">{error.message}</p>
        <button
          onClick={reset}
          className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium uppercase tracking-widest text-zinc-400 transition-all hover:border-white/20 hover:text-white"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
