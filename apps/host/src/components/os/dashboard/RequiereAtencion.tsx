import type { Aviso, AvisoTono } from './panel';

// "Requiere atención": avisos reales derivados de los datos, cada uno con su
// tono semántico (ámbar = atención, rosa = problema, azul = informativo).

const ESTILO: Record<AvisoTono, { marco: string; punto: string; texto: string }> = {
  atencion: {
    marco: 'border-amber-400/20 bg-amber-400/5',
    punto: 'bg-amber-400',
    texto: 'text-amber-200',
  },
  problema: {
    marco: 'border-rose-400/20 bg-rose-400/5',
    punto: 'bg-rose-400',
    texto: 'text-rose-200',
  },
  info: { marco: 'border-blue-400/20 bg-blue-400/5', punto: 'bg-blue-400', texto: 'text-blue-200' },
};

export function RequiereAtencion({ avisos }: { avisos: Aviso[] }) {
  if (avisos.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-5 text-sm text-zinc-500">
        Nada requiere atención ahora mismo.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {avisos.map((a) => {
        const e = ESTILO[a.tono];
        return (
          <div
            key={a.id}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${e.marco}`}
          >
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${e.punto}`} />
            <span className={e.texto}>{a.texto}</span>
          </div>
        );
      })}
    </div>
  );
}
