import { TrendingDown, TrendingUp } from 'lucide-react';

// Delta discreto de comparación con el mes anterior: ▲ +X% / ▼ −X%. El color
// codifica bien/mal según `mejorSiSube` (por defecto, subir es bueno). Si no
// hay base de comparación (pct null) no se pinta nada.

export function OSDelta({
  pct,
  mejorSiSube = true,
}: {
  pct: number | null | undefined;
  mejorSiSube?: boolean;
}) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null;

  const sube = pct >= 0;
  const bueno = sube === mejorSiSube;
  const Icon = sube ? TrendingUp : TrendingDown;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        bueno ? 'text-emerald-400' : 'text-rose-400'
      }`}
    >
      <Icon size={13} />
      {sube ? '+' : ''}
      {pct.toFixed(1)}% vs mes anterior
    </span>
  );
}
