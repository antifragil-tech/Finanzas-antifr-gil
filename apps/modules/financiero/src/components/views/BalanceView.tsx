'use client';
import { useState, useCallback } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Database,
  Loader2,
} from 'lucide-react';
import { parseMayor } from '../../lib/mayorParser';
import { computeBalance } from '../../lib/pgcEngine';
import { saveImport } from '../../lib/supabaseImport';
import type { BalanceKPIs } from '../../lib/pgcEngine';
import type { ParsedMayor } from '../../lib/mayorParser';
import { formatCurrency } from '@alsari/utils';

type Phase = 'idle' | 'parsing' | 'parsed' | 'computed' | 'debug';
type SavePhase = 'idle' | 'saving' | 'saved' | 'error';

interface State {
  phase: Phase;
  parsed: ParsedMayor | null;
  kpis: BalanceKPIs | null;
  error: string | null;
  showUnclassified: boolean;
  savePhase: SavePhase;
  saveError: string | null;
  savedBatchId: string | null;
  batchAlreadyExisted: boolean;
}

export function BalanceView({
  entityId,
  entityName,
  onSaved,
}: { entityId?: string; entityName?: string; onSaved?: () => void } = {}) {
  const [state, setState] = useState<State>({
    phase: 'idle',
    parsed: null,
    kpis: null,
    error: null,
    showUnclassified: false,
    savePhase: 'idle',
    saveError: null,
    savedBatchId: null,
    batchAlreadyExisted: false,
  });

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setState((s) => ({ ...s, error: 'Solo se aceptan archivos Excel (.xlsx, .xls)' }));
      return;
    }
    setState((s) => ({ ...s, phase: 'parsing', error: null }));
    try {
      const parsed = await parseMayor(file);
      if (parsed.entries.length === 0) {
        setState((s) => ({ ...s, phase: 'debug', parsed }));
        return;
      }
      setState((s) => ({ ...s, phase: 'parsed', parsed }));
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: 'idle',
        error: String(err instanceof Error ? err.message : err),
      }));
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const handleCompute = () => {
    if (!state.parsed) return;
    const kpis = computeBalance(state.parsed.entries);
    setState((s) => ({ ...s, phase: 'computed', kpis }));
  };

  const handleReset = () => {
    setState({
      phase: 'idle',
      parsed: null,
      kpis: null,
      error: null,
      showUnclassified: false,
      savePhase: 'idle',
      saveError: null,
      savedBatchId: null,
      batchAlreadyExisted: false,
    });
  };

  const handleSave = useCallback(
    async (targetEntityId: string) => {
      if (!state.parsed) return;
      setState((s) => ({ ...s, savePhase: 'saving', saveError: null }));
      try {
        const result = await saveImport(state.parsed, targetEntityId, state.kpis ?? undefined);
        setState((s) => ({
          ...s,
          savePhase: 'saved',
          savedBatchId: result.batchId,
          batchAlreadyExisted: result.batchAlreadyExisted,
        }));
        onSaved?.();
      } catch (err) {
        setState((s) => ({
          ...s,
          savePhase: 'error',
          saveError: String(err instanceof Error ? err.message : err),
        }));
      }
    },
    [state.parsed, state.kpis, onSaved],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Balance desde Libro Mayor
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Sube el libro mayor exportado desde el software contable. El motor PGC clasifica las
          cuentas automáticamente.
        </p>
      </div>

      {/* Upload area — shown until computed or debug */}
      {state.phase !== 'computed' && state.phase !== 'debug' && (
        <UploadZone
          phase={state.phase}
          error={state.error}
          parsed={state.parsed}
          onDrop={handleDrop}
          onInputChange={handleInputChange}
          onCompute={handleCompute}
          onReset={handleReset}
        />
      )}

      {/* Debug panel — shown when parser finds 0 entries */}
      {state.phase === 'debug' && state.parsed && (
        <DebugPanel parsed={state.parsed} onReset={handleReset} />
      )}

      {/* Results */}
      {state.phase === 'computed' && state.kpis && state.parsed && (
        <>
          <Results
            kpis={state.kpis}
            parsed={state.parsed}
            showUnclassified={state.showUnclassified}
            onToggleUnclassified={() =>
              setState((s) => ({ ...s, showUnclassified: !s.showUnclassified }))
            }
            onReset={handleReset}
          />
          <SavePanel
            {...(entityId ? { entityId } : {})}
            {...(entityName ? { entityName } : {})}
            parsedEntityName={state.parsed.entityName}
            savePhase={state.savePhase}
            saveError={state.saveError}
            savedBatchId={state.savedBatchId}
            batchAlreadyExisted={state.batchAlreadyExisted}
            onSave={handleSave}
          />
        </>
      )}
    </div>
  );
}

function UploadZone({
  phase,
  error,
  parsed,
  onDrop,
  onInputChange,
  onCompute,
  onReset,
}: {
  phase: Phase;
  error: string | null;
  parsed: ParsedMayor | null;
  onDrop: (e: React.DragEvent) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCompute: () => void;
  onReset: () => void;
}) {
  const [dragging, setDragging] = useState(false);

  if (phase === 'parsed' && parsed) {
    return (
      <div className="glass-panel space-y-6 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-8">
        <div className="flex items-center gap-4">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
            <FileSpreadsheet size={24} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-lg font-semibold text-white">{parsed.entityName}</p>
            <p className="text-sm text-zinc-400">
              {parsed.periodStart} — {parsed.periodEnd} &nbsp;·&nbsp;
              <span className="font-medium text-emerald-400">
                {parsed.entries.length.toLocaleString('es-ES')} asientos
              </span>
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCompute}
            className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-medium text-white transition-all hover:bg-blue-500"
          >
            Calcular balance
          </button>
          <button
            onClick={onReset}
            className="rounded-xl border border-white/10 px-6 py-3 text-sm font-medium text-zinc-400 transition-all hover:border-white/20 hover:text-zinc-200"
          >
            Cambiar archivo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        className={`block cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
          dragging
            ? 'border-blue-400 bg-blue-950/20'
            : 'border-white/10 bg-white/[0.02] hover:border-white/20'
        }`}
      >
        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onInputChange} />
        {phase === 'parsing' ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500/30 border-t-blue-500" />
            <p className="font-medium text-zinc-400">Procesando libro mayor…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
              <Upload size={28} className="text-zinc-500" />
            </div>
            <div>
              <p className="font-medium text-zinc-300">Arrastra el libro mayor aquí</p>
              <p className="mt-1 text-sm text-zinc-600">
                o haz clic para seleccionar · .xlsx / .xls
              </p>
            </div>
          </div>
        )}
      </label>
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-950/20 px-4 py-3 text-sm text-rose-400">
          <AlertTriangle size={16} className="shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

function Results({
  kpis,
  parsed,
  showUnclassified,
  onToggleUnclassified,
  onReset,
}: {
  kpis: BalanceKPIs;
  parsed: ParsedMayor;
  showUnclassified: boolean;
  onToggleUnclassified: () => void;
  onReset: () => void;
}) {
  const balanced = Math.abs(kpis.balanceDiff) < 1;
  const fmt = (n: number) => formatCurrency(Math.abs(n));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-zinc-500">
            {parsed.periodStart} — {parsed.periodEnd}
          </p>
          <h3 className="text-xl font-semibold text-white">{parsed.entityName}</h3>
        </div>
        <button
          onClick={onReset}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-zinc-400 transition-all hover:text-zinc-200"
        >
          Nuevo archivo
        </button>
      </div>

      {/* Balance check */}
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
          balanced
            ? 'border-emerald-500/20 bg-emerald-950/20 text-emerald-400'
            : 'border-amber-500/20 bg-amber-950/20 text-amber-400'
        }`}
      >
        {balanced ? (
          <>
            <CheckCircle size={16} /> Balance cuadra — Activo = Pasivo + PN
          </>
        ) : (
          <>
            <AlertTriangle size={16} /> Diferencia de {fmt(kpis.balanceDiff)} — puede haber cuentas
            sin clasificar
          </>
        )}
      </div>

      {/* Main balance: two columns */}
      <div className="grid grid-cols-2 gap-4">
        <BalanceColumn title="ACTIVO" accent="blue">
          <BalanceLine label="Activo No Corriente" value={kpis.activoNoCorriente} />
          <BalanceLine label="Activo Corriente" value={kpis.activoCorriente} indent />
          <BalanceLine label="del que: Caja y Bancos" value={kpis.caja} indent small />
          <BalanceDivider />
          <BalanceLine label="Activo Total" value={kpis.activoTotal} bold />
        </BalanceColumn>

        <BalanceColumn title="PASIVO + PN" accent="purple">
          <BalanceLine
            label="Capital y Reservas"
            value={kpis.patrimonioNetoBase}
            negative={kpis.patrimonioNetoBase < 0}
          />
          <BalanceLine
            label="Resultado del Ejercicio (YTD)"
            value={kpis.resultadoEjercicio}
            indent
            signed
            negative={kpis.resultadoEjercicio < 0}
          />
          <BalanceLine
            label="Patrimonio Neto Total"
            value={kpis.patrimonioNeto}
            indent
            bold
            negative={kpis.patrimonioNeto < 0}
          />
          <BalanceDivider />
          <BalanceLine label="Pasivo No Corriente" value={kpis.pasivoNoCorriente} indent />
          <BalanceLine label="Pasivo Corriente" value={kpis.pasivoCorriente} indent />
          <BalanceDivider />
          <BalanceLine
            label="Pasivo Total + PN"
            value={kpis.pasivoTotal + kpis.patrimonioNeto}
            bold
          />
        </BalanceColumn>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Caja Disponible" value={kpis.caja} color="emerald" />
        <KpiCard label="Deuda Bancaria C/P" value={kpis.deudaBancariaCp} color="red" />
        <KpiCard label="Deuda Bancaria L/P" value={kpis.deudaBancariaLp} color="red" />
        <KpiCard label="Partes Vinculadas" value={kpis.deudaPartesVinculadas} color="orange" />
        <KpiCard
          label="Fondo de Maniobra"
          value={kpis.fondoManiobra}
          color={kpis.fondoManiobra >= 0 ? 'blue' : 'red'}
          signed
        />
      </div>

      {/* Deuda Financiera Neta */}
      <div className="glass-panel flex items-center justify-between rounded-xl border border-white/5 px-5 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            Deuda Financiera Neta
          </p>
          <p className="mt-0.5 text-sm text-zinc-500">
            Bancaria ({fmt(kpis.deudaBancaria)}) + Partes Vinculadas (
            {fmt(kpis.deudaPartesVinculadas)}) − Caja ({fmt(kpis.caja)})
          </p>
        </div>
        <p
          className={`text-2xl font-semibold tabular-nums ${kpis.deudaFinancieraNeta > 0 ? 'text-rose-400' : 'text-emerald-400'}`}
        >
          {kpis.deudaFinancieraNeta < 0 ? '-' : ''}
          {fmt(kpis.deudaFinancieraNeta)}
        </p>
      </div>

      {/* Unclassified accounts */}
      {kpis.sinClasificar.length > 0 && (
        <div className="glass-panel overflow-hidden rounded-xl border border-amber-500/10">
          <button
            onClick={onToggleUnclassified}
            className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle size={16} className="text-amber-500" />
              <span className="text-sm font-medium text-amber-400">
                {kpis.sinClasificar.length} cuentas sin clasificar
              </span>
              <span className="text-xs text-zinc-600">(revisar con la gestoría)</span>
            </div>
            {showUnclassified ? (
              <ChevronUp size={16} className="text-zinc-600" />
            ) : (
              <ChevronDown size={16} className="text-zinc-600" />
            )}
          </button>
          {showUnclassified && (
            <div className="overflow-x-auto border-t border-white/5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-5 py-2.5 text-left font-medium uppercase tracking-wider text-zinc-600">
                      Subcuenta
                    </th>
                    <th className="px-5 py-2.5 text-left font-medium uppercase tracking-wider text-zinc-600">
                      Nombre
                    </th>
                    <th className="px-5 py-2.5 text-right font-medium uppercase tracking-wider text-zinc-600">
                      Saldo Neto
                    </th>
                    <th className="px-5 py-2.5 text-right font-medium uppercase tracking-wider text-zinc-600">
                      Tipo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.sinClasificar.map((ac) => (
                    <tr
                      key={ac.subcuenta}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-2.5 font-mono text-zinc-400">{ac.subcuenta}</td>
                      <td className="px-5 py-2.5 text-zinc-500">{ac.subcuentaNombre}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-zinc-300">
                        {formatCurrency(ac.net)}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <span
                          className={`text-2xs rounded px-2 py-0.5 font-medium uppercase ${ac.net > 0 ? 'bg-blue-500/10 text-blue-400' : 'bg-rose-500/10 text-rose-400'}`}
                        >
                          {ac.net > 0 ? 'Deudor' : 'Acreedor'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SavePanel({
  entityId,
  entityName,
  parsedEntityName,
  savePhase,
  saveError,
  savedBatchId,
  batchAlreadyExisted,
  onSave,
}: {
  entityId?: string;
  entityName?: string;
  parsedEntityName: string;
  savePhase: SavePhase;
  saveError: string | null;
  savedBatchId: string | null;
  batchAlreadyExisted: boolean;
  onSave: (entityId: string) => void;
}) {
  const [customId, setCustomId] = useState(entityId ?? '');
  const effectiveId = customId.trim();

  if (savePhase === 'saved') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-400">
        <CheckCircle size={16} className="shrink-0" />
        <div>
          <span className="font-medium">
            {batchAlreadyExisted ? 'KPIs actualizados en el dashboard' : 'Guardado en Supabase'}
          </span>
          {batchAlreadyExisted ? (
            <p className="mt-0.5 text-xs text-zinc-500">
              Los asientos de este periodo ya estaban guardados — solo se han actualizado los KPIs.
            </p>
          ) : (
            <span className="ml-2 font-mono text-xs text-zinc-500">{savedBatchId}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel space-y-4 rounded-xl border border-white/5 p-5">
      <div className="flex items-center gap-3">
        <Database size={16} className="text-zinc-500" />
        <p className="text-sm font-medium text-zinc-300">Guardar en Supabase</p>
        <span className="text-xs text-zinc-600">
          Persiste los {'{'}826{'}'} asientos para consultas históricas
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-2xs mb-1.5 block font-medium uppercase tracking-widest text-zinc-600">
            ID de Sociedad{' '}
            <span className="font-normal normal-case text-zinc-700">(ej. S-001, S-003…)</span>
          </label>
          <input
            type="text"
            value={customId}
            onChange={(e) => setCustomId(e.target.value)}
            placeholder={entityName ?? parsedEntityName}
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 font-mono text-sm text-white placeholder-zinc-600 transition-colors focus:border-blue-500/50 focus:outline-none"
          />
        </div>
        <div className="pt-5">
          <button
            onClick={() => {
              if (effectiveId) onSave(effectiveId);
            }}
            disabled={!effectiveId || savePhase === 'saving'}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {savePhase === 'saving' ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Guardando…
              </>
            ) : (
              <>
                <Database size={14} />
                Guardar
              </>
            )}
          </button>
        </div>
      </div>

      {savePhase === 'error' && saveError && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-950/20 px-3 py-2.5 text-xs text-rose-400">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {saveError}
        </div>
      )}

      <p className="text-2xs text-zinc-700">
        El ID de sociedad debe coincidir con el ID-Ref del holding (columna ID-Ref en Alsari_DB). Si
        ya guardaste este periodo, el sistema lo rechazará para evitar duplicados.
      </p>
    </div>
  );
}

function DebugPanel({ parsed, onReset }: { parsed: ParsedMayor; onReset: () => void }) {
  const { _debug } = parsed;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-950/20 px-4 py-3 text-sm text-amber-400">
        <AlertTriangle size={16} className="shrink-0" />
        <span className="font-medium">No se encontraron asientos.</span>
        <span className="text-zinc-500">
          El parser leyó {_debug.totalRows} filas totales · inicio detectado en fila{' '}
          {_debug.detectedStartRow} · offset columnas: {_debug.colOffset}
        </span>
      </div>
      <div className="glass-panel space-y-3 rounded-xl border border-white/5 p-5">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          Primeras filas leídas por SheetJS (raw)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="border-b border-white/5 text-zinc-600">
                <th className="w-10 px-2 py-1.5 text-left">Fila</th>
                <th className="px-2 py-1.5 text-left">A (0)</th>
                <th className="px-2 py-1.5 text-left">B (1)</th>
                <th className="px-2 py-1.5 text-left">C (2)</th>
                <th className="px-2 py-1.5 text-left">D (3)</th>
                <th className="px-2 py-1.5 text-left">E (4)</th>
                <th className="px-2 py-1.5 text-left">F (5)</th>
              </tr>
            </thead>
            <tbody>
              {_debug.firstRows.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b border-white/[0.03] ${i === _debug.detectedStartRow ? 'bg-blue-500/10' : ''}`}
                >
                  <td className="px-2 py-1.5 text-zinc-600">{i}</td>
                  {[0, 1, 2, 3, 4, 5].map((col) => (
                    <td key={col} className="max-w-[140px] truncate px-2 py-1.5 text-zinc-400">
                      {row[col] === null ? (
                        <span className="text-zinc-700">null</span>
                      ) : row[col] === '' ? (
                        <span className="text-zinc-700">""</span>
                      ) : (
                        <span
                          className={
                            typeof row[col] === 'number' ? 'text-blue-400' : 'text-zinc-300'
                          }
                        >
                          {String(row[col])}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-2xs text-zinc-600">
          Fila resaltada en azul = inicio detectado. Copia esto y compártelo para depurar el parser.
        </p>
      </div>
      <button
        onClick={onReset}
        className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-medium text-zinc-400 transition-all hover:text-zinc-200"
      >
        Intentar con otro archivo
      </button>
    </div>
  );
}

function BalanceColumn({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  const border = accent === 'blue' ? 'border-blue-500/10' : 'border-purple-500/10';
  const label = accent === 'blue' ? 'text-blue-400' : 'text-purple-400';
  return (
    <div className={`glass-panel rounded-xl border ${border} space-y-2 p-5`}>
      <p className={`text-2xs mb-3 font-semibold uppercase tracking-widest ${label}`}>{title}</p>
      {children}
    </div>
  );
}

function BalanceLine({
  label,
  value,
  indent = false,
  small = false,
  bold = false,
  negative = false,
  signed = false,
}: {
  label: string;
  value: number;
  indent?: boolean;
  small?: boolean;
  bold?: boolean;
  negative?: boolean;
  signed?: boolean;
}) {
  const fmt = (n: number) => formatCurrency(Math.abs(n));
  const isNeg = negative || (signed && value < 0);
  return (
    <div className={`flex items-center justify-between ${indent ? 'pl-3' : ''}`}>
      <span
        className={`${small ? 'text-xs text-zinc-600' : bold ? 'text-sm font-semibold text-zinc-200' : 'text-sm text-zinc-400'}`}
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${small ? 'text-xs text-zinc-600' : bold ? 'text-sm font-semibold text-white' : 'text-sm font-semibold text-zinc-300'} ${isNeg ? 'text-rose-400' : ''}`}
      >
        {isNeg ? `(${fmt(value)})` : fmt(value)}
      </span>
    </div>
  );
}

function BalanceDivider() {
  return <div className="my-2 border-t border-white/5" />;
}

function KpiCard({
  label,
  value,
  color,
  signed = false,
}: {
  label: string;
  value: number;
  color: string;
  signed?: boolean;
}) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-400',
    red: 'text-rose-400',
    orange: 'text-orange-400',
    blue: 'text-blue-400',
  };
  const textColor = colors[color] ?? 'text-zinc-300';
  const fmt = (n: number) => formatCurrency(Math.abs(n));
  return (
    <div className="glass-panel rounded-xl border border-white/5 px-4 py-4">
      <p className="text-2xs mb-2 font-medium uppercase leading-tight tracking-wider text-zinc-600">
        {label}
      </p>
      <p className={`text-lg font-semibold tabular-nums ${textColor}`}>
        {signed && value < 0 ? `(${fmt(value)})` : fmt(value)}
      </p>
    </div>
  );
}
