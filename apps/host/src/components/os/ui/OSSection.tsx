// Sección titulada de una página del OS. Con `plegable`, envuelve el contenido
// en un <details> nativo (server-safe, sin JS) para que el detalle voluminoso
// no ahogue la vista de entrada.

export function OSSection({
  titulo,
  nota,
  plegable = false,
  abierta = false,
  children,
}: {
  titulo: string;
  nota?: string;
  /** Colapsable en un <details>. */
  plegable?: boolean;
  /** Si es plegable, si arranca abierta. */
  abierta?: boolean;
  children: React.ReactNode;
}) {
  if (plegable) {
    return (
      <section className="px-8 py-4">
        <details open={abierta} className="group">
          <summary className="mb-3 flex cursor-pointer list-none items-baseline justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <h3 className="text-2xs uppercase tracking-[0.25em] text-zinc-500 transition-colors hover:text-zinc-300">
              {titulo}
            </h3>
            <span className="text-2xs uppercase tracking-widest text-zinc-600">
              {nota ? `${nota} · ` : ''}ver detalle
            </span>
          </summary>
          <div className="pt-1">{children}</div>
        </details>
      </section>
    );
  }

  return (
    <section className="px-8 py-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-2xs uppercase tracking-[0.25em] text-zinc-600">{titulo}</h3>
        {nota ? <span className="text-2xs text-zinc-600">{nota}</span> : null}
      </div>
      {children}
    </section>
  );
}
