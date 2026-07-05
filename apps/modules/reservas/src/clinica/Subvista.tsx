import type { ReactNode } from 'react';

// Layout común de las sub-vistas del módulo (Pendientes, Cobros, Vivofácil,
// Clientes, Bonos): cabecera con título/acciones + área de contenido scrollable.
export function Subvista({
  titulo,
  subtitulo,
  acciones,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  acciones?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-light tracking-tight text-zinc-100">{titulo}</h2>
          {subtitulo ? <p className="text-xs text-zinc-500">{subtitulo}</p> : null}
        </div>
        {acciones}
      </div>
      <div className="min-h-0 flex-1 overflow-auto pr-1">{children}</div>
    </div>
  );
}
