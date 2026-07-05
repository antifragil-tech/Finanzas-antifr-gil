import { formatCurrency, parseCurrency } from '@alsari/utils';
import {
  Search,
  FileDown,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  AlertCircle,
} from 'lucide-react';
import { useState } from 'react';
import type { DashboardData } from '@alsari/types';

type ContabilidadProps = {
  fichas: DashboardData['fichas'];
  selectedEntityName: string;
  isPrivateMode?: boolean;
};

export function Contabilidad({
  fichas,
  selectedEntityName,
  isPrivateMode = false,
}: ContabilidadProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const normalizedName = selectedEntityName?.toLowerCase().replace(/\s+/g, '_') ?? '';

  let fichaKey: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rawData: Record<string, any>[] = [];

  if (fichas?.[normalizedName]) {
    fichaKey = normalizedName;
    rawData = fichas[normalizedName];
  } else {
    const alternatives = [
      normalizedName.replace(/_/g, ''),
      normalizedName.split('_')[0] ?? '',
      'alsari',
    ];
    for (const key of alternatives) {
      if (fichas?.[key]) {
        fichaKey = key;
        rawData = fichas[key];
        break;
      }
    }
  }

  const data = rawData.map((row) => ({
    ...row,
    Debe: parseCurrency(row.Debe ?? row.DEBE),
    Haber: parseCurrency(row.Haber ?? row.HABER),
    Saldo: parseCurrency(row.Saldo ?? row.SALDO),
    Subcuenta: row.Subcuenta ?? row.SUBCUENTA ?? '',
    NombreSubcuenta:
      row['Nombre de la subcuenta'] ?? row.Nombre ?? row['NOMBRE DE LA SUBCUENTA'] ?? '',
  }));

  const filteredData = data.filter(
    (row) =>
      String(row.Subcuenta).includes(searchTerm) ||
      String(row.NombreSubcuenta).toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (data.length === 0) {
    const expectedFileName = `Ficha_${selectedEntityName.replace(/\s+/g, '_')}.csv`;
    return (
      <div className="glass-panel rounded-[2rem] border border-amber-500/20 bg-amber-950/10 p-12">
        <div className="flex flex-col items-center justify-center space-y-6 text-center">
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6">
            <AlertCircle size={48} className="text-amber-500" />
          </div>
          <div>
            <h3 className="mb-2 text-2xl font-semibold text-white">Sin datos contables</h3>
            <p className="max-w-md text-sm leading-relaxed text-zinc-400">
              No se ha encontrado el archivo{' '}
              <span className="font-mono text-amber-400">{expectedFileName}</span> para esta
              sociedad.
            </p>
          </div>
          <div className="font-mono text-xs text-zinc-600">
            Archivos disponibles: {Object.keys(fichas ?? {}).join(', ') || 'ninguno'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="mb-8 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div>
          <h3 className="flex items-center gap-3 text-xl font-semibold uppercase tracking-tight text-white">
            <Calculator className="text-blue-500" size={20} />
            Libro Mayor: <span className="text-blue-400">{selectedEntityName.toUpperCase()}</span>
          </h3>
          <p className="mt-1 text-xs font-medium text-zinc-500">
            Visualización detallada de subcuentas y movimientos contables.
          </p>
        </div>

        <div className="flex w-full items-center gap-4 md:w-auto">
          <div className="group relative flex-1 md:w-80">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-blue-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Buscar subcuenta o nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-white/5 bg-white/[0.03] py-3 pl-12 pr-4 text-sm font-medium text-zinc-200 transition-all placeholder:text-zinc-600 focus:border-blue-500/30 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-zinc-400 transition-all hover:bg-white/10 hover:text-white">
            <FileDown size={20} />
          </button>
        </div>
      </div>

      <div className="glass-panel overflow-hidden rounded-[2rem] border border-white/5 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="text-2xs px-8 py-5 font-semibold uppercase tracking-widest text-zinc-500">
                  Subcuenta
                </th>
                <th className="text-2xs px-8 py-5 font-semibold uppercase tracking-widest text-zinc-500">
                  Nombre de la Subcuenta
                </th>
                <th className="text-2xs px-8 py-5 text-right font-semibold uppercase tracking-widest text-emerald-500">
                  Debe
                </th>
                <th className="text-2xs px-8 py-5 text-right font-semibold uppercase tracking-widest text-rose-500">
                  Haber
                </th>
                <th className="text-2xs px-8 py-5 text-right font-semibold uppercase tracking-widest text-blue-400">
                  Saldo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filteredData.map((row, idx) => (
                <tr key={idx} className="group transition-colors hover:bg-white/[0.01]">
                  <td className="px-8 py-5 font-mono text-sm font-medium text-white/80 transition-colors group-hover:text-purple-400">
                    {row.Subcuenta}
                  </td>
                  <td className="px-8 py-5 text-sm font-medium text-zinc-400 transition-colors group-hover:text-zinc-200">
                    {row.NombreSubcuenta}
                  </td>
                  <td
                    className={`px-8 py-5 text-right font-mono text-sm text-zinc-400 ${isPrivateMode ? 'select-none blur-sm' : ''}`}
                  >
                    {row.Debe > 0 ? (
                      <div className="flex items-center justify-end gap-2 text-emerald-400">
                        {formatCurrency(row.Debe)}
                        <ArrowDownRight size={12} className="opacity-50" />
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td
                    className={`px-8 py-5 text-right font-mono text-sm text-zinc-400 ${isPrivateMode ? 'select-none blur-sm' : ''}`}
                  >
                    {row.Haber > 0 ? (
                      <div className="flex items-center justify-end gap-2 text-rose-400">
                        {formatCurrency(row.Haber)}
                        <ArrowUpRight size={12} className="opacity-50" />
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td
                    className={`px-8 py-5 text-right font-mono text-sm font-semibold ${row.Saldo >= 0 ? 'text-white' : 'text-rose-400'} ${isPrivateMode ? 'select-none blur-sm' : ''}`}
                  >
                    {formatCurrency(row.Saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-3xl border border-white/5 bg-white/[0.01] px-10 py-6 opacity-60">
        <span className="text-2xs font-medium uppercase tracking-[0.2em] text-zinc-500">
          Total registros: {filteredData.length}
        </span>
        <span className="text-2xs font-mono text-zinc-600">Ficha: {fichaKey ?? 'N/A'}</span>
      </div>
    </div>
  );
}
