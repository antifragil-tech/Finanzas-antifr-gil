import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

// Dropdown oscuro (dark mode) reutilizable: render del menú vía portal con z-index
// alto, fondo zinc-900, altura máxima con scroll interno y posicionamiento calculado
// sobre el botón. Evita el `<select>` nativo (que en dark mode abre una lista blanca
// del SO imposible de estilar). Compartido por el panel de factura y el modal de
// reglas de facturación (PR E.1).
export function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
  hint,
  searchable = false,
  labelClassName = 'text-2xs uppercase tracking-widest text-zinc-500 leading-none',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  hint?: string | undefined;
  searchable?: boolean;
  labelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';

  const filtered =
    searchable && q
      ? options.filter(
          (o) => o.label.toLowerCase().includes(q.toLowerCase()) || o.value.includes(q),
        )
      : options;

  function openMenu() {
    if (disabled || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const menuH = Math.min(filtered.length * 36 + (searchable ? 44 : 0) + 8, 320);
    const top = window.innerHeight - r.bottom < menuH ? r.top - menuH - 4 : r.bottom + 4;
    setPos({ top, left: r.left, width: r.width });
    setQ('');
    setOpen(true);
  }

  useEffect(() => {
    if (open && searchable) setTimeout(() => searchRef.current?.focus(), 10);
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', close, { capture: true });
  }, [open]);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className={labelClassName}>{label}</p>
        {hint && <span className="text-2xs tracking-wide text-blue-400/70">{hint}</span>}
      </div>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onMouseDown={(e) => {
          e.preventDefault();
          if (open) setOpen(false);
          else openMenu();
        }}
        className={`flex h-8 w-full items-center justify-between rounded-md px-2 text-sm font-medium transition-all duration-150 ${open ? 'bg-white/[0.04] ring-1 ring-white/15' : 'bg-transparent hover:bg-white/[0.02]'} ${disabled ? 'pointer-events-none opacity-40' : ''}`}
      >
        <span className={selectedLabel ? 'text-white' : 'text-zinc-600'}>
          {selectedLabel || '—'}
        </span>
        <ChevronDown size={11} className="ml-2 shrink-0 text-zinc-500" />
      </button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onMouseDown={() => setOpen(false)} />
            <div
              style={{ top: pos.top, left: pos.left, width: pos.width }}
              className="fixed z-[9999] flex max-h-[320px] flex-col rounded-lg border border-white/10 bg-zinc-900 shadow-2xl"
            >
              {searchable && (
                <div className="shrink-0 px-2 pb-1 pt-2">
                  <input
                    ref={searchRef}
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                    placeholder="Buscar..."
                    className="w-full rounded-md border border-white/[0.08] bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
                  />
                </div>
              )}
              <div className="flex-1 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-zinc-600">Sin resultados</p>
                ) : (
                  filtered.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        onChange(o.value);
                        setOpen(false);
                        setQ('');
                      }}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                        o.value === value
                          ? 'bg-white/[0.08] font-medium text-white'
                          : 'text-zinc-300 hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
