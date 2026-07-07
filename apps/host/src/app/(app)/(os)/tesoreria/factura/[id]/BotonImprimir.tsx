'use client';

// Único JS de cliente de la vista imprimible: lanza el diálogo de impresión
// del navegador (Ctrl+P → guardar como PDF).

export function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="text-2xs rounded-lg border border-zinc-300 bg-white px-4 py-2 uppercase tracking-widest text-zinc-700 transition-colors hover:bg-zinc-100"
    >
      Imprimir
    </button>
  );
}
