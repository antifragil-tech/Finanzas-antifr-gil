import { formatCurrency } from '@alsari/utils';
import type { PuntoMes } from './panel';

// Mini-tendencia de 6 meses con barras de divs (sin librerías de charts):
// ingresos devengados vs gastos de la clínica. Alturas relativas al máximo.

export function TendenciaMensual({ puntos }: { puntos: PuntoMes[] }) {
  const max = Math.max(1, ...puntos.flatMap((p) => [p.ingresos, p.gastos]));

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-end justify-between gap-2">
        {puntos.map((p) => (
          <div key={p.mes} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-32 w-full items-end justify-center gap-1">
              <div
                className="w-2.5 rounded-t bg-emerald-400/80"
                style={{ height: `${(p.ingresos / max) * 100}%` }}
                title={`Ingresos ${formatCurrency(p.ingresos)}`}
              />
              <div
                className="w-2.5 rounded-t bg-zinc-600"
                style={{ height: `${(p.gastos / max) * 100}%` }}
                title={`Gastos clínica ${formatCurrency(p.gastos)}`}
              />
            </div>
            <span className="text-2xs uppercase tracking-wider text-zinc-600">{p.etiqueta}</span>
          </div>
        ))}
      </div>
      <div className="text-2xs mt-4 flex items-center gap-4 uppercase tracking-widest text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400/80" /> Ingresos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-zinc-600" /> Gastos clínica
        </span>
      </div>
    </div>
  );
}
