import { formatCurrency } from '@alsari/utils';
import { etiquetaMes } from '@/lib/datos/periodo';
import { OSDelta } from '@/components/os/ui';
import type { PanelResumen } from './panel';

// BANDA HÉROE del Panel: el "Resultado del mes" de la clínica ocupa el mayor
// peso visual (verde si positivo, rosa si negativo); al lado, dos cifras héroe
// secundarias algo menores (facturado y caja). Solo presentación.

export function DashboardHero({
  resumen,
  real,
  deltaResultado,
  deltaFacturado,
}: {
  resumen: PanelResumen;
  real: boolean;
  deltaResultado: number | null;
  deltaFacturado: number | null;
}) {
  const positivo = resumen.resultado >= 0;

  return (
    <div className="px-8 pt-6">
      <div
        className={`glass-panel rounded-3xl bg-gradient-to-br to-transparent p-8 sm:p-10 ${
          positivo ? 'from-emerald-500/[0.08]' : 'from-rose-500/[0.08]'
        }`}
      >
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-2xs uppercase tracking-widest text-zinc-500">
              Resultado del mes · Clínica
            </p>
            <p
              className={`mt-3 text-5xl font-light tracking-tight sm:text-6xl ${
                positivo ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {formatCurrency(resumen.resultado)}
            </p>
            <div className="mt-2">
              <OSDelta pct={deltaResultado} />
            </div>
            <p className="mt-2 text-sm text-zinc-500">
              Ingresos {formatCurrency(resumen.facturado)} − gastos de la clínica{' '}
              {formatCurrency(resumen.gastosClinica)} · {etiquetaMes(resumen.mes)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:gap-12">
            <div>
              <p className="text-2xs uppercase tracking-widest text-zinc-500">Facturado del mes</p>
              <p className="mt-2 text-3xl font-light tracking-tight text-zinc-100 sm:text-4xl">
                {formatCurrency(resumen.facturado)}
              </p>
              <div className="mt-1">
                <OSDelta pct={deltaFacturado} />
              </div>
            </div>
            <div>
              <p className="text-2xs uppercase tracking-widest text-zinc-500">Caja disponible</p>
              <p className="mt-2 text-3xl font-light tracking-tight text-zinc-100 sm:text-4xl">
                {formatCurrency(resumen.caja)}
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                {real ? 'cobros por importar (Salonized)' : 'cobrado en el periodo'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
