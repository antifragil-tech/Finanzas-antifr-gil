// Barra de acciones del OS: botones neutros consistentes con el shell.
// Los onClick llegan de componentes cliente; aquí solo estilo y layout.

export function OSActionBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function OSActionButton({
  children,
  variante = 'secundaria',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primaria' | 'secundaria';
}) {
  const estilos =
    variante === 'primaria'
      ? 'border-white/20 bg-white/10 text-zinc-100 hover:bg-white/15'
      : 'border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/10';
  return (
    <button
      type="button"
      className={`rounded-xl border px-3.5 py-1.5 text-xs font-medium transition-colors ${estilos}`}
      {...props}
    >
      {children}
    </button>
  );
}
