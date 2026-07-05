// Cabecera estándar de página del OS: título, descripción y acciones.
// Server-safe: sin hooks, sin fetch, sin datos.

export function OSPageHeader({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 px-8 pb-2 pt-8">
      <div>
        <h2 className="text-xl font-light tracking-tight text-white">{titulo}</h2>
        {descripcion ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-500">{descripcion}</p>
        ) : null}
      </div>
      {acciones ? <div className="flex items-center gap-2">{acciones}</div> : null}
    </div>
  );
}
