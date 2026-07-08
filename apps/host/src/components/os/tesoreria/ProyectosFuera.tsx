import { formatCurrency } from '@alsari/utils';
import type { CuentaPorCobrar, GastoReal, ProyectoInfo } from '@/lib/datos/fuenteDatos';
import { OSStatusBadge, type OSBadgeTone } from '@/components/os/ui';

// "Proyectos fuera de la operativa": gastos imputados a proyectos que NO son
// la clínica (CENS, MENDRA, 9AM…). Se SEGREGAN de los KPIs de la clínica y se
// muestran aquí — nada se oculta. Para CENS se enseña al lado el 50 % que
// debe Felipe (cuentas_por_cobrar pendientes del proyecto).

const TONO_ESTADO: Record<string, OSBadgeTone> = {
  activo: 'info',
  cerrado: 'neutral',
  placeholder: 'neutral',
};

export function ProyectosFuera({
  gastosProyectos,
  proyectos,
  cuentasPorCobrar,
}: {
  gastosProyectos: GastoReal[];
  proyectos: ProyectoInfo[];
  cuentasPorCobrar: CuentaPorCobrar[];
}) {
  if (gastosProyectos.length === 0) {
    return (
      <p className="glass-panel rounded-2xl px-5 py-4 text-xs text-zinc-500">
        Sin gastos de proyectos externos en el periodo seleccionado.
      </p>
    );
  }

  const porProyecto = new Map<string, { total: number; n: number }>();
  for (const g of gastosProyectos) {
    const ref = g.proyectoIdRef ?? 'SIN-PROYECTO';
    const acc = porProyecto.get(ref) ?? { total: 0, n: 0 };
    acc.total += g.importe;
    acc.n += 1;
    porProyecto.set(ref, acc);
  }

  const pendientePorProyecto = new Map<string, number>();
  for (const c of cuentasPorCobrar) {
    if (c.estado !== 'pendiente' || !c.proyectoIdRef) continue;
    pendientePorProyecto.set(
      c.proyectoIdRef,
      (pendientePorProyecto.get(c.proyectoIdRef) ?? 0) + c.importe,
    );
  }

  const filas = [...porProyecto.entries()]
    .map(([ref, v]) => {
      const info = proyectos.find((p) => p.idRef === ref);
      return {
        ref,
        nombre: info?.nombre ?? ref,
        estado: info?.estado ?? 'activo',
        gastos: v.n,
        total: Math.round(v.total * 100) / 100,
        pendienteTerceros: pendientePorProyecto.get(ref) ?? 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <div className="glass-panel overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[760px] text-left text-xs">
        <thead className="text-2xs border-b border-white/5 uppercase tracking-widest text-zinc-500">
          <tr>
            {['Proyecto', 'Estado', 'Gastos', 'Gasto total', 'Pendiente de terceros'].map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.ref} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
              <td className="px-4 py-3 text-zinc-200">
                {f.nombre}
                <span className="text-2xs ml-2 font-mono uppercase text-zinc-600">{f.ref}</span>
              </td>
              <td className="px-4 py-3">
                <OSStatusBadge tone={TONO_ESTADO[f.estado] ?? 'neutral'}>{f.estado}</OSStatusBadge>
              </td>
              <td className="px-4 py-3 text-zinc-400">{f.gastos}</td>
              <td className="px-4 py-3 text-zinc-300">{formatCurrency(f.total)}</td>
              <td className="px-4 py-3">
                {f.pendienteTerceros > 0 ? (
                  <span className="text-amber-300">
                    {formatCurrency(f.pendienteTerceros)}
                    {f.ref === 'CENS' ? (
                      <span className="text-2xs ml-2 uppercase tracking-widest text-zinc-500">
                        50 % pendiente de Felipe
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
