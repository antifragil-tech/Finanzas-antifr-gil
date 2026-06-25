import { useState } from 'react';

export function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto max-w-7xl px-6 py-12">
        <header className="mb-12 animate-fade-in">
          <p className="mb-2 text-xs uppercase tracking-widest text-zinc-500">
            Alsari Capital · Módulo
          </p>
          <h1 className="text-4xl font-light tracking-tight text-zinc-100">
            [Nombre del Módulo]
          </h1>
          <p className="mt-3 text-zinc-400">
            Plantilla base. Reemplaza este contenido por la implementación real del módulo.
          </p>
        </header>

        <section className="glass-panel animate-fade-up p-8">
          <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Contador demo</p>
          <p className="mb-6 text-5xl font-light tracking-tight text-brand-cream">
            {count}
          </p>
          <button
            onClick={() => setCount((n) => n + 1)}
            className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
          >
            Incrementar
          </button>
        </section>
      </main>
    </div>
  );
}
