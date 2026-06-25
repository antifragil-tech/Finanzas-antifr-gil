import { formatCurrency, parseCurrency } from '@alsari/utils';
import { Search, FileDown, ArrowUpRight, ArrowDownRight, Calculator, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import type { DashboardData } from '@alsari/types';

type ContabilidadProps = {
  fichas: DashboardData['fichas'];
  selectedEntityName: string;
  isPrivateMode?: boolean;
};

export function Contabilidad({ fichas, selectedEntityName, isPrivateMode = false }: ContabilidadProps) {
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

  const data = rawData.map(row => ({
    ...row,
    Debe: parseCurrency(row.Debe ?? row.DEBE),
    Haber: parseCurrency(row.Haber ?? row.HABER),
    Saldo: parseCurrency(row.Saldo ?? row.SALDO),
    Subcuenta: row.Subcuenta ?? row.SUBCUENTA ?? '',
    NombreSubcuenta: row['Nombre de la subcuenta'] ?? row.Nombre ?? row['NOMBRE DE LA SUBCUENTA'] ?? '',
  }));

  const filteredData = data.filter(row =>
    String(row.Subcuenta).includes(searchTerm) ||
    String(row.NombreSubcuenta).toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (data.length === 0) {
    const expectedFileName = `Ficha_${selectedEntityName.replace(/\s+/g, '_')}.csv`;
    return (
      <div className="glass-panel rounded-[2rem] border border-amber-500/20 bg-amber-950/10 p-12">
        <div className="flex flex-col items-center justify-center text-center space-y-6">
          <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <AlertCircle size={48} className="text-amber-500" />
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-white mb-2">Sin datos contables</h3>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-md">
              No se ha encontrado el archivo <span className="font-mono text-amber-400">{expectedFileName}</span> para esta sociedad.
            </p>
          </div>
          <div className="text-xs text-zinc-600 font-mono">
            Archivos disponibles: {Object.keys(fichas ?? {}).join(', ') || 'ninguno'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h3 className="text-xl font-semibold text-white uppercase tracking-tight flex items-center gap-3">
            <Calculator className="text-blue-500" size={20} />
            Libro Mayor: <span className="text-blue-400">{selectedEntityName.toUpperCase()}</span>
          </h3>
          <p className="text-xs text-zinc-500 mt-1 font-medium">Visualización detallada de subcuentas y movimientos contables.</p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-80 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-blue-400 transition-colors" size={16} />
            <input
              type="text"
              placeholder="Buscar subcuenta o nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/[0.03] border border-white/5 rounded-2xl text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/30 transition-all font-medium"
            />
          </div>
          <button className="p-3 bg-white/[0.03] border border-white/5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
            <FileDown size={20} />
          </button>
        </div>
      </div>

      <div className="glass-panel overflow-hidden rounded-[2rem] border border-white/5 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5">
                <th className="px-8 py-5 text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Subcuenta</th>
                <th className="px-8 py-5 text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Nombre de la Subcuenta</th>
                <th className="px-8 py-5 text-2xs font-semibold text-emerald-500 uppercase tracking-widest text-right">Debe</th>
                <th className="px-8 py-5 text-2xs font-semibold text-rose-500 uppercase tracking-widest text-right">Haber</th>
                <th className="px-8 py-5 text-2xs font-semibold text-blue-400 uppercase tracking-widest text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filteredData.map((row, idx) => (
                <tr key={idx} className="group hover:bg-white/[0.01] transition-colors">
                  <td className="px-8 py-5 font-mono text-sm text-white/80 font-medium group-hover:text-purple-400 transition-colors">
                    {row.Subcuenta}
                  </td>
                  <td className="px-8 py-5 text-sm text-zinc-400 font-medium group-hover:text-zinc-200 transition-colors">
                    {row.NombreSubcuenta}
                  </td>
                  <td className={`px-8 py-5 text-right font-mono text-sm text-zinc-400 ${isPrivateMode ? 'blur-sm select-none' : ''}`}>
                    {row.Debe > 0 ? (
                      <div className="flex items-center justify-end gap-2 text-emerald-400">
                        {formatCurrency(row.Debe)}
                        <ArrowDownRight size={12} className="opacity-50" />
                      </div>
                    ) : '-'}
                  </td>
                  <td className={`px-8 py-5 text-right font-mono text-sm text-zinc-400 ${isPrivateMode ? 'blur-sm select-none' : ''}`}>
                    {row.Haber > 0 ? (
                      <div className="flex items-center justify-end gap-2 text-rose-400">
                        {formatCurrency(row.Haber)}
                        <ArrowUpRight size={12} className="opacity-50" />
                      </div>
                    ) : '-'}
                  </td>
                  <td className={`px-8 py-5 text-right font-mono text-sm font-semibold ${row.Saldo >= 0 ? 'text-white' : 'text-rose-400'} ${isPrivateMode ? 'blur-sm select-none' : ''}`}>
                    {formatCurrency(row.Saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between items-center px-10 py-6 bg-white/[0.01] rounded-3xl border border-white/5 opacity-60">
        <span className="text-2xs font-medium text-zinc-500 uppercase tracking-[0.2em]">
          Total registros: {filteredData.length}
        </span>
        <span className="text-2xs font-mono text-zinc-600">
          Ficha: {fichaKey ?? 'N/A'}
        </span>
      </div>
    </div>
  );
}
