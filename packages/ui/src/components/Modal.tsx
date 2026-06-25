import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Ancho máximo del panel. Por defecto max-w-lg (spec). */
  maxWidth?: string;
};

// Modal canónico del OS: backdrop bg-black/60 + blur, z-50, panel glass.
// Cierra con Escape y con click en el backdrop.
export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} bg-zinc-900 border border-white/10 rounded-2xl shadow-xl overflow-hidden`}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="text-zinc-500 hover:text-zinc-200 transition-colors rounded-md p-1 hover:bg-white/5"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
