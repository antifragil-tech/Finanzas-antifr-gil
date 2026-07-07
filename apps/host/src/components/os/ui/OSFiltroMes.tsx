import Link from 'next/link';

// Selector de periodo (server-safe, sin JS de cliente): un <form method="GET">
// con <input type="month"> que filtra la página por ?mes=YYYY-MM.

export function OSFiltroMes({ accion, mes }: { accion: string; mes?: string | undefined }) {
  return (
    <form method="GET" action={accion} className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="text-2xs mb-1 block uppercase tracking-widest text-zinc-500">Periodo</span>
        <input
          type="month"
          name="mes"
          defaultValue={mes}
          className="rounded-lg border border-white/10 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 focus:border-blue-500/50 focus:outline-none"
        />
      </label>
      <button
        type="submit"
        className="text-2xs rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 uppercase tracking-widest text-zinc-200 transition-colors hover:bg-white/10"
      >
        Filtrar
      </button>
      <Link
        href={accion}
        className="text-2xs px-1 py-2 uppercase tracking-widest text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-300 hover:underline"
      >
        Todo el histórico
      </Link>
    </form>
  );
}
