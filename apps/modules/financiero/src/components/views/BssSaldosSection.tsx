import { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, Table2 } from 'lucide-react';
import { getPeriodosBySociedad, getLineasBSS, fmtPeriodo } from '../../lib/sumasSaldosImport';
import type { PeriodoImportado, BalanceSumasSaldosRow } from '../../lib/sumasSaldosImport';

type Props = { societyIdRef: string | null };

function fmtEur(n: number): string {
  if (n === 0) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

// Componente de contenido puro (sin card wrapper) — se puede envolver en Card o en sección propia
export function BssSaldosSection({ societyIdRef }: Props) {
  const [periodos, setPeriodos]             = useState<PeriodoImportado[]>([]);
  const [selectedPeriodo, setSelectedPeriodo] = useState('');
  const [lines, setLines]                   = useState<BalanceSumasSaldosRow[]>([]);
  const [loadingPeriodos, setLoadingPeriodos] = useState(true);
  const [loadingLines, setLoadingLines]     = useState(false);
  const [errorMsg, setErrorMsg]             = useState<string | null>(null);

  useEffect(() => {
    if (!societyIdRef) { setLoadingPeriodos(false); return; }
    setLoadingPeriodos(true);
    setErrorMsg(null);
    setPeriodos([]);
    setLines([]);
    getPeriodosBySociedad(societyIdRef)
      .then(ps => {
        setPeriodos(ps);
        if (ps.length > 0) setSelectedPeriodo(ps[0]!.periodo);
        else setSelectedPeriodo('');
      })
      .catch(e => setErrorMsg(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingPeriodos(false));
  }, [societyIdRef]);

  useEffect(() => {
    if (!societyIdRef || !selectedPeriodo) { setLines([]); return; }
    setLoadingLines(true);
    getLineasBSS(societyIdRef, selectedPeriodo)
      .then(rows => setLines(rows.map(r => ({
        ...r,
        saldo_deudor:   Number(r.saldo_deudor),
        saldo_acreedor: Number(r.saldo_acreedor),
      }))))
      .catch(e => setErrorMsg(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingLines(false));
  }, [societyIdRef, selectedPeriodo]);

  const totalD = lines.reduce((s, l) => s + l.saldo_deudor, 0);
  const totalA = lines.reduce((s, l) => s + l.saldo_acreedor, 0);

  if (!societyIdRef) return null;

  if (errorMsg) {
    return (
      <div className="flex items-center gap-2 text-xs text-rose-400 px-1 py-3">
        <AlertTriangle size={13} className="shrink-0" />{errorMsg}
      </div>
    );
  }

  if (loadingPeriodos) {
    return (
      <div className="flex items-center gap-2 text-zinc-500 text-xs py-6">
        <RefreshCw size={13} className="animate-spin" />Cargando...
      </div>
    );
  }

  if (periodos.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 gap-2 text-zinc-700">
        <Table2 size={28} />
        <p className="text-xs font-medium uppercase tracking-widest">Sin datos importados</p>
        <p className="text-xs text-zinc-600">Sube el BSS desde Datos Maestros → Contabilidad</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selector de período */}
      <div className="flex items-center gap-3">
        <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest shrink-0">Período</p>
        <select
          value={selectedPeriodo}
          onChange={e => setSelectedPeriodo(e.target.value)}
          className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
        >
          {periodos.map(p => (
            <option key={p.periodo} value={p.periodo}>
              {fmtPeriodo(p.periodo)} · {p.lineas} cuentas
            </option>
          ))}
        </select>
        {loadingLines && <RefreshCw size={12} className="animate-spin text-zinc-500" />}
      </div>

      {/* Tabla */}
      {!loadingLines && lines.length > 0 && (
        <div className="rounded-xl border border-white/5 overflow-hidden">
          <div className="grid grid-cols-[110px_1fr_140px_140px] gap-3 px-4 py-2.5 bg-zinc-900/80 text-2xs font-semibold text-zinc-500 uppercase tracking-widest border-b border-white/5">
            <span>Cuenta</span>
            <span>Descripción</span>
            <span className="text-right">Saldo Deudor</span>
            <span className="text-right">Saldo Acreedor</span>
          </div>

          <div className="divide-y divide-white/[0.03] max-h-[520px] overflow-y-auto">
            {lines.map((l, i) => (
              <div
                key={l.cuenta}
                className={`grid grid-cols-[110px_1fr_140px_140px] gap-3 px-4 py-2 items-center text-xs ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
              >
                <span className="font-mono text-zinc-400 text-xs">{l.cuenta}</span>
                <span className="text-zinc-300 truncate" title={l.descripcion ?? ''}>{l.descripcion ?? '—'}</span>
                <span className="text-right font-mono text-xs text-zinc-300">
                  {l.saldo_deudor > 0 ? fmtEur(l.saldo_deudor) : <span className="text-zinc-700">—</span>}
                </span>
                <span className="text-right font-mono text-xs text-zinc-300">
                  {l.saldo_acreedor > 0 ? fmtEur(l.saldo_acreedor) : <span className="text-zinc-700">—</span>}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[110px_1fr_140px_140px] gap-3 px-4 py-3 bg-zinc-900/60 border-t border-white/10 text-xs font-semibold">
            <span className="col-span-2 text-zinc-500 uppercase tracking-widest text-2xs self-center">Total</span>
            <span className="text-right font-mono text-white">{fmtEur(totalD)}</span>
            <span className="text-right font-mono text-white">{fmtEur(totalA)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
