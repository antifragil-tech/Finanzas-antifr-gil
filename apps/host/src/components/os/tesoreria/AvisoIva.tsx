import { formatCurrency } from '@alsari/utils';
import type { IngresoOperativo } from '@antifragil/operativa';

// Aviso fiscal: líneas de ingreso de Salonized marcadas en el ETL con
// '⚠ IVA 21% aplicado por error de configuración'. La clínica es exenta
// (art. 20.Uno.3º Ley 37/1992): ese IVA cobrado de más hay que regularizarlo.

const MARCA_IVA = '⚠ IVA';

/** IVA incluido en un importe cobrado con 21 % aplicado por error. */
function ivaIncluido(importe: number): number {
  return Math.round((importe - importe / 1.21) * 100) / 100;
}

export function AvisoIva({ ingresos }: { ingresos: IngresoOperativo[] }) {
  const marcadas = ingresos.filter((i) => i.concepto.includes(MARCA_IVA));
  if (marcadas.length === 0) return null;

  const totalIva =
    Math.round(marcadas.reduce((s, i) => s + ivaIncluido(i.importeDevengado), 0) * 100) / 100;

  return (
    <div className="px-8 pt-4">
      <details className="rounded-xl border border-amber-400/20 bg-amber-400/5">
        <summary className="cursor-pointer select-none px-4 py-2.5 text-xs text-amber-300">
          {marcadas.length} línea{marcadas.length === 1 ? '' : 's'} con IVA a regularizar ·{' '}
          {formatCurrency(totalIva)} de IVA incluido por error de configuración
          <span className="text-2xs ml-2 uppercase tracking-widest text-amber-300/60">
            servicios sanitarios exentos — revisar con gestoría
          </span>
        </summary>
        <div className="overflow-x-auto border-t border-amber-400/10 px-4 py-3">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-2xs uppercase tracking-widest text-zinc-500">
              <tr>
                {['Fecha', 'Concepto', 'Importe cobrado', 'IVA incluido (21 %)'].map((h) => (
                  <th key={h} className="px-2 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {marcadas.map((i) => (
                <tr key={i.id} className="border-t border-white/5">
                  <td className="px-2 py-1.5 text-zinc-500">{i.fecha}</td>
                  <td className="max-w-[380px] truncate px-2 py-1.5 text-zinc-300">
                    {(i.concepto.split(`· ${MARCA_IVA}`)[0] ?? i.concepto).trim()}
                  </td>
                  <td className="px-2 py-1.5 text-zinc-300">
                    {formatCurrency(i.importeDevengado)}
                  </td>
                  <td className="px-2 py-1.5 text-amber-300">
                    {formatCurrency(ivaIncluido(i.importeDevengado))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
