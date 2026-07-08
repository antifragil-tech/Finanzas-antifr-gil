import { formatCurrency } from '@alsari/utils';
import { registrarCobroCxc } from '@/lib/datos/acciones';
import {
  totalesCxc,
  type CuentaPorCobrar,
  type CuentaTesoreriaInfo,
} from '@/lib/datos/fuenteDatos';
import { OSStatusBadge, type OSBadgeTone } from '@/components/os/ui';

// Cuentas por cobrar: deudas vivas a favor de la clínica (p. ej. el 50 % de
// los pagos CENS que debe Felipe). Server component puro; el cobro se registra
// con una server action con guard anti doble-cobro.

const TONO_CXC: Record<CuentaPorCobrar['estado'], OSBadgeTone> = {
  pendiente: 'warn',
  cobrada: 'ok',
  cancelada: 'neutral',
};

const MEDIOS_PAGO = ['transferencia', 'efectivo', 'bizum', 'tarjeta', 'domiciliacion', 'otro'];

export function CuentasPorCobrarSeccion({
  cuentas,
  cuentasTesoreria,
  mes,
}: {
  cuentas: CuentaPorCobrar[];
  cuentasTesoreria: CuentaTesoreriaInfo[];
  mes?: string | undefined;
}) {
  const t = totalesCxc(cuentas);
  const hoy = new Date().toISOString().slice(0, 10);
  const sinCuentas = cuentasTesoreria.length === 0;

  return (
    <div>
      <div className="glass-panel mb-4 flex flex-wrap items-end justify-between gap-4 rounded-2xl px-5 py-4">
        <div>
          <p className="text-2xs uppercase tracking-widest text-zinc-500">Total pendiente</p>
          <p className="mt-1 text-3xl font-light tracking-tight text-amber-300">
            {formatCurrency(t.pendiente)}
          </p>
        </div>
        <div className="text-right text-xs text-zinc-500">
          {t.porDeudor.map((d) => (
            <p key={d.deudor}>
              {d.deudor}: <span className="text-zinc-300">{formatCurrency(d.pendiente)}</span> ·{' '}
              {d.partidas} partida{d.partidas === 1 ? '' : 's'}
            </p>
          ))}
          {t.cobrada > 0 ? (
            <p className="mt-1 text-emerald-300/80">
              Cobrado histórico: {formatCurrency(t.cobrada)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="glass-panel overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[960px] text-left text-xs">
          <thead className="text-2xs border-b border-white/5 uppercase tracking-widest text-zinc-500">
            <tr>
              {['Deudor', 'Concepto', 'Fecha', 'Importe', 'Estado', 'Registrar cobro'].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cuentas.map((c) => (
              <tr
                key={c.id}
                className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
              >
                <td className="px-4 py-2.5 text-zinc-200">{c.deudor}</td>
                <td
                  className="max-w-[280px] truncate px-4 py-2.5 text-zinc-400"
                  title={c.notas ?? ''}
                >
                  {c.concepto}
                  {c.proyectoIdRef ? (
                    <span className="text-2xs ml-2 font-mono uppercase text-zinc-600">
                      {c.proyectoIdRef}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-zinc-500">{c.fechaOrigen}</td>
                <td className="px-4 py-2.5 text-zinc-300">{formatCurrency(c.importe)}</td>
                <td className="px-4 py-2.5">
                  <OSStatusBadge tone={TONO_CXC[c.estado]}>{c.estado}</OSStatusBadge>
                </td>
                <td className="px-4 py-2.5">
                  {c.estado !== 'pendiente' ? (
                    <span className="text-zinc-600">—</span>
                  ) : sinCuentas ? (
                    <span className="text-2xs uppercase tracking-widest text-zinc-600">
                      sin cuenta de tesorería activa
                    </span>
                  ) : (
                    <form action={registrarCobroCxc} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="cxc_id" value={c.id} />
                      <input type="hidden" name="_mes" value={mes ?? ''} />
                      <input
                        type="date"
                        name="fecha"
                        defaultValue={hoy}
                        required
                        className="rounded-lg border border-white/10 bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
                      />
                      <select
                        name="medio_pago"
                        className="rounded-lg border border-white/10 bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
                      >
                        {MEDIOS_PAGO.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <select
                        name="cuenta_tesoreria_id"
                        className="rounded-lg border border-white/10 bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
                      >
                        {cuentasTesoreria.map((ct) => (
                          <option key={ct.id} value={ct.id}>
                            {ct.nombre} ({ct.tipo})
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="text-2xs rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 uppercase tracking-widest text-zinc-200 transition-colors hover:bg-white/10"
                      >
                        Cobrar
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
