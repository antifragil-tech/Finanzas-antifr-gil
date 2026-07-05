import { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, Table2 } from 'lucide-react';
import { getPeriodosBySociedad, getLineasBSS, fmtPeriodo } from '../../lib/sumasSaldosImport';
import type { PeriodoImportado, BalanceSumasSaldosRow } from '../../lib/sumasSaldosImport';

type Props = { societyIdRef: string | null };

function fmtEur(n: number): string {
  if (n === 0) return '—';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

// Componente de contenido puro (sin card wrapper) — se puede envolver en Card o en sección propia
export function BssSaldosSection({ societyIdRef }: Props) {
  const [periodos, setPeriodos] = useState<PeriodoImportado[]>([]);
  const [selectedPeriodo, setSelectedPeriodo] = useState('');
  const [lines, setLines] = useState<BalanceSumasSaldosRow[]>([]);
  const [loadingPeriodos, setLoadingPeriodos] = useState(true);
  const [loadingLines, setLoadingLines] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!societyIdRef) {
      setLoadingPeriodos(false);
      return;
    }
    setLoadingPeriodos(true);
    setErrorMsg(null);
    setPeriodos([]);
    setLines([]);
    getPeriodosBySociedad(societyIdRef)
      .then((ps) => {
        setPeriodos(ps);
        if (ps.length > 0) setSelectedPeriodo(ps[0]!.periodo);
        else setSelectedPeriodo('');
      })
      .catch((e) => setErrorMsg(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingPeriodos(false));
  }, [societyIdRef]);

  useEffect(() => {
    if (!societyIdRef || !selectedPeriodo) {
      setLines([]);
      return;
    }
    setLoadingLines(true);
    getLineasBSS(societyIdRef, selectedPeriodo)
      .then((rows) =>
        setLines(
          rows.map((r) => ({
            ...r,
            saldo_deudor: Number(r.saldo_deudor),
            saldo_acreedor: Number(r.saldo_acreedor),
          })),
        ),
      )
      .catch((e) => setErrorMsg(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingLines(false));
  }, [societyIdRef, selectedPeriodo]);

  const totalD = lines.reduce((s, l) => s + l.saldo_deudor, 0);
  const totalA = lines.reduce((s, l) => s + l.saldo_acreedor, 0);

  if (!societyIdRef) return null;

  if (errorMsg) {
    return (
      <div className="flex items-center gap-2 px-1 py-3 text-xs text-rose-400">
        <AlertTriangle size={13} className="shrink-0" />
        {errorMsg}
      </div>
    );
  }

  if (loadingPeriodos) {
    return (
      <div className="flex items-center gap-2 py-6 text-xs text-zinc-500">
        <RefreshCw size={13} className="animate-spin" />
        Cargando...
      </div>
    );
  }

  if (periodos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-zinc-700">
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
        <p className="text-2xs shrink-0 font-semibold uppercase tracking-widest text-zinc-500">
          Período
        </p>
        <select
          value={selectedPeriodo}
          onChange={(e) => setSelectedPeriodo(e.target.value)}
          className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-white focus:border-blue-500/50 focus:outline-none"
        >
          {periodos.map((p) => (
            <option key={p.periodo} value={p.periodo}>
              {fmtPeriodo(p.periodo)} · {p.lineas} cuentas
            </option>
          ))}
        </select>
        {loadingLines && <RefreshCw size={12} className="animate-spin text-zinc-500" />}
      </div>

      {/* Tabla */}
      {!loadingLines && lines.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-white/5">
          <div className="text-2xs grid grid-cols-[110px_1fr_140px_140px] gap-3 border-b border-white/5 bg-zinc-900/80 px-4 py-2.5 font-semibold uppercase tracking-widest text-zinc-500">
            <span>Cuenta</span>
            <span>Descripción</span>
            <span className="text-right">Saldo Deudor</span>
            <span className="text-right">Saldo Acreedor</span>
          </div>

          <div className="max-h-[520px] divide-y divide-white/[0.03] overflow-y-auto">
            {lines.map((l, i) => (
              <div
                key={l.cuenta}
                className={`grid grid-cols-[110px_1fr_140px_140px] items-center gap-3 px-4 py-2 text-xs ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
              >
                <span className="font-mono text-xs text-zinc-400">{l.cuenta}</span>
                <span className="truncate text-zinc-300" title={l.descripcion ?? ''}>
                  {l.descripcion ?? '—'}
                </span>
                <span className="text-right font-mono text-xs text-zinc-300">
                  {l.saldo_deudor > 0 ? (
                    fmtEur(l.saldo_deudor)
                  ) : (
                    <span className="text-zinc-700">—</span>
                  )}
                </span>
                <span className="text-right font-mono text-xs text-zinc-300">
                  {l.saldo_acreedor > 0 ? (
                    fmtEur(l.saldo_acreedor)
                  ) : (
                    <span className="text-zinc-700">—</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[110px_1fr_140px_140px] gap-3 border-t border-white/10 bg-zinc-900/60 px-4 py-3 text-xs font-semibold">
            <span className="text-2xs col-span-2 self-center uppercase tracking-widest text-zinc-500">
              Total
            </span>
            <span className="text-right font-mono text-white">{fmtEur(totalD)}</span>
            <span className="text-right font-mono text-white">{fmtEur(totalA)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
