import { formatCurrency } from '@alsari/utils';
import type { CuentaTesoreriaInfo } from '@/lib/datos/fuenteDatos';

// BANDA HÉROE de Tesorería: cuánto dinero hay. Saldo del periodo (cobros −
// pagos) como cifra dominante, y el reparto Caja / Banco al lado. Los cobros
// reales llegan con Salonized; hasta entonces el saldo es parcial (solo pagos)
// y se avisa de ello sin fingir una cifra.

export function SaldoTesoreria({
  saldoTotal,
  saldoCaja,
  saldoBanco,
  cuentas,
  real,
}: {
  saldoTotal: number;
  saldoCaja: number;
  saldoBanco: number;
  cuentas: CuentaTesoreriaInfo[];
  real: boolean;
}) {
  const positivo = saldoTotal >= 0;
  const nombresCuentas = cuentas.map((c) => c.nombre).join(' · ');

  return (
    <div className="px-8 pt-4">
      <div
        className={`glass-panel rounded-3xl bg-gradient-to-br to-transparent p-8 ${
          positivo ? 'from-emerald-500/[0.08]' : 'from-rose-500/[0.08]'
        }`}
      >
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-2xs uppercase tracking-widest text-zinc-500">Saldo de tesorería</p>
            <p
              className={`mt-3 text-4xl font-light tracking-tight sm:text-5xl ${
                positivo ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {formatCurrency(saldoTotal)}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              {real
                ? 'Saldo parcial: solo pagos. Los cobros reales llegan al importar Salonized.'
                : 'Cobros del periodo menos pagos del periodo.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:gap-12">
            <div>
              <p className="text-2xs uppercase tracking-widest text-zinc-500">Caja</p>
              <p className="mt-2 text-2xl font-light tracking-tight text-zinc-100 sm:text-3xl">
                {formatCurrency(saldoCaja)}
              </p>
              <p className="mt-1 text-xs text-zinc-600">efectivo</p>
            </div>
            <div>
              <p className="text-2xs uppercase tracking-widest text-zinc-500">Banco</p>
              <p className="mt-2 text-2xl font-light tracking-tight text-zinc-100 sm:text-3xl">
                {formatCurrency(saldoBanco)}
              </p>
              <p className="mt-1 text-xs text-zinc-600">tarjeta y transferencias</p>
            </div>
          </div>
        </div>

        {nombresCuentas ? (
          <p className="text-2xs mt-6 uppercase tracking-widest text-zinc-600">
            Cuentas: {nombresCuentas}
          </p>
        ) : null}
      </div>
    </div>
  );
}
