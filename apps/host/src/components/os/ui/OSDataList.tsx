// Lista de datos simple del OS: filas con texto principal, secundario,
// meta y badge opcional. Solo presentación, sin fetch.

export type OSDataListItem = {
  id: string;
  principal: string;
  secundario?: string;
  meta?: string;
  badge?: React.ReactNode;
};

export function OSDataList({ items, vacio }: { items: OSDataListItem[]; vacio?: string }) {
  if (items.length === 0) {
    return <p className="px-1 py-3 text-sm text-zinc-600">{vacio ?? 'Sin elementos.'}</p>;
  }
  return (
    <ul className="glass-panel divide-y divide-white/5 rounded-2xl">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-4 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-zinc-200">{item.principal}</p>
            {item.secundario ? (
              <p className="truncate text-xs text-zinc-600">{item.secundario}</p>
            ) : null}
          </div>
          {item.meta ? <span className="shrink-0 text-xs text-zinc-500">{item.meta}</span> : null}
          {item.badge ? <span className="shrink-0">{item.badge}</span> : null}
        </li>
      ))}
    </ul>
  );
}
