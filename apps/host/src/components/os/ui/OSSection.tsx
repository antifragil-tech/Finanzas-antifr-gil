// Sección titulada de una página del OS.

export function OSSection({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
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
