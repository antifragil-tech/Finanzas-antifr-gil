'use client';

export default function FinancieroError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="glass-panel rounded-2xl p-8 max-w-md text-center">
        <p className="text-zinc-400 text-xs uppercase tracking-widest font-medium mb-2">Financiero</p>
        <p className="text-white font-medium mb-1">El módulo no ha podido cargar</p>
        <p className="text-zinc-500 text-sm mb-6">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 text-xs font-medium uppercase tracking-widest border border-white/10 rounded-xl text-zinc-400 hover:text-white hover:border-white/20 transition-all"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
