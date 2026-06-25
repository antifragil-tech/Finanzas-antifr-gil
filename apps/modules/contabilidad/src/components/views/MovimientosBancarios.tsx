import { useEffect, useState, useRef } from 'react';
import {
  Upload, X, CheckCircle, Loader2, AlertTriangle,
  Filter, RefreshCw, ChevronDown, ChevronUp, Edit2, Trash2, FileSpreadsheet, Undo2, Eye,
} from 'lucide-react';
import {
  getMovimientos, updateMovimiento, deleteMovimiento, getReglas,
  getCuentasBancarias, getExtractos, getHashesMovimientos, importarExtractoBancario,
  deshacerImportacionExtracto, type ExtractoImportPayload,
} from '../../lib/contabilidadApi';
import { parsearExtracto } from '../../lib/csvParsers';
import {
  prepararMovimientos, hashArchivo, xlsxToRows, rowsToCsv, rangoFechas,
  hayMovimientosSinSaldoNiReferencia, type MovimientoParaImportar,
} from '../../lib/extractoImport';
import { SelectField } from '../SelectField';
import type {
  MovimientoBancario, BancoOrigen, ReglaCategorizacion, CategoriaMovimiento,
  ExtractoBancario, EstadoExtracto, CuentaBancariaSociedad, ResultadoImportacion,
} from '@alsari/types';
import { ESTADO_EXTRACTO_LABEL } from '@alsari/types';

// ── Constantes ────────────────────────────────────────────────────────────────

const BANCOS: { value: BancoOrigen; label: string }[] = [
  { value: 'santander',  label: 'Santander' },
  { value: 'bbva',       label: 'BBVA' },
  { value: 'caixabank',  label: 'CaixaBank' },
  { value: 'caja_rural', label: 'Caja Rural' },
  { value: 'otro',       label: 'Otro (genérico)' },
];

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
].map((label, i) => ({ value: String(i + 1), label }));

const ANIOS = Array.from({ length: 6 }, (_, i) => {
  const y = new Date().getFullYear() - i;
  return { value: String(y), label: String(y) };
});

const CATEGORIAS: CategoriaMovimiento[] = [
  'intragrupo_salida', 'intragrupo_entrada', 'rentas_cobradas',
  'cobros_operacion_inmobiliaria', 'gastos_inmobiliarios', 'bancarios',
  'fiscal', 'notaria_legal', 'devoluciones', 'proveedores',
  'personal', 'dividendos', 'rendimientos_financieros', 'extraordinario',
];

const CATEGORIA_LABEL: Record<CategoriaMovimiento, string> = {
  intragrupo_salida:             'Intragrupo ↑',
  intragrupo_entrada:            'Intragrupo ↓',
  rentas_cobradas:               'Rentas',
  cobros_operacion_inmobiliaria: 'Cobros oper.',
  gastos_inmobiliarios:          'Inmobiliario',
  bancarios:                     'Bancarios',
  fiscal:                        'Fiscal',
  notaria_legal:                 'Notaría',
  devoluciones:                  'Devolución',
  proveedores:                   'Proveedores',
  personal:                      'Personal',
  dividendos:                    'Dividendos',
  rendimientos_financieros:      'Rendimientos',
  extraordinario:                'Extraordinario',
};

const CATEGORIA_COLOR: Record<CategoriaMovimiento, string> = {
  intragrupo_salida:             'bg-violet-500/20 text-violet-300',
  intragrupo_entrada:            'bg-violet-500/20 text-violet-300',
  rentas_cobradas:               'bg-emerald-500/20 text-emerald-300',
  cobros_operacion_inmobiliaria: 'bg-emerald-500/20 text-emerald-300',
  gastos_inmobiliarios:          'bg-orange-500/20 text-orange-300',
  bancarios:                     'bg-blue-500/20 text-blue-300',
  fiscal:                        'bg-rose-500/20 text-rose-300',
  notaria_legal:                 'bg-amber-500/20 text-amber-300',
  devoluciones:                  'bg-cyan-500/20 text-cyan-300',
  proveedores:                   'bg-zinc-500/20 text-zinc-300',
  personal:                      'bg-pink-500/20 text-pink-300',
  dividendos:                    'bg-indigo-500/20 text-indigo-300',
  rendimientos_financieros:      'bg-purple-500/20 text-purple-300',
  extraordinario:                'bg-zinc-700/40 text-zinc-400',
};

const ESTADO_EXTRACTO_COLOR: Record<EstadoExtracto, string> = {
  importado:          'bg-blue-500/15 text-blue-300 border-blue-500/20',
  pendiente_revision: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  listo_conciliacion: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  deshecho:           'bg-zinc-700/30 text-zinc-500 border-white/5',
};

const fmtEur = (n: number) => `${n >= 0 ? '+' : ''}${n.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function CategoriaBadge({ cat }: { cat: CategoriaMovimiento | null }) {
  if (!cat) return <span className="text-2xs font-medium px-2 py-0.5 rounded-full bg-zinc-700/40 text-zinc-500">—</span>;
  return (
    <span className={`text-2xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${CATEGORIA_COLOR[cat]}`}>
      {CATEGORIA_LABEL[cat]}
    </span>
  );
}

function readAsLatin1(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => resolve((ev.target?.result as string) ?? '');
    reader.onerror = () => reject(new Error('No se pudo leer el fichero'));
    reader.readAsText(file, 'latin1');
  });
}

// ── Panel de importación ──────────────────────────────────────────────────────

type ImportState = 'idle' | 'parsing' | 'preview' | 'importing' | 'done' | 'error';

type ImportPanelProps = {
  sociedades: { id: string; nombre: string }[];
  reglas: ReglaCategorizacion[];
  onClose: () => void;
  onDone: () => void;
};

function ImportPanel({ sociedades, reglas, onClose, onDone }: ImportPanelProps) {
  const now = new Date();
  const [banco, setBanco]       = useState<BancoOrigen>('santander');
  const [sociedad, setSociedad] = useState(sociedades[0]?.id ?? '');
  const [cuentas, setCuentas]   = useState<CuentaBancariaSociedad[]>([]);
  const [cuentaId, setCuentaId] = useState('');
  const [iban, setIban]         = useState('');
  const [mes, setMes]           = useState(String(now.getMonth() + 1));
  const [anio, setAnio]         = useState(String(now.getFullYear()));
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [formato, setFormato]   = useState<'csv' | 'xlsx'>('csv');
  const [archivoHash, setArchivoHash]     = useState('');
  const [preview, setPreview]   = useState<MovimientoParaImportar[]>([]);
  const [counts, setCounts]     = useState<{ total: number; nuevos: number; duplicados: number } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [state, setState]       = useState<ImportState>('idle');
  const [result, setResult]     = useState<ResultadoImportacion | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const fileRef                 = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sociedad) { setCuentas([]); return; }
    getCuentasBancarias(sociedad).then(setCuentas).catch(() => setCuentas([]));
  }, [sociedad]);

  function selectCuenta(id: string) {
    setCuentaId(id);
    const c = cuentas.find(x => x.id === id);
    if (c?.iban) setIban(c.iban.toUpperCase());
  }

  const locked = state === 'preview' || state === 'importing';
  const rango = rangoFechas(preview);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setState('parsing'); setError(null);
    try {
      const esXlsx = /\.(xlsx|xls)$/i.test(file.name);
      const fmt: 'csv' | 'xlsx' = esXlsx ? 'xlsx' : 'csv';
      let csv: string;
      let aHash: string;
      if (esXlsx) {
        const buf = await file.arrayBuffer();
        csv = rowsToCsv(await xlsxToRows(buf));
        aHash = await hashArchivo(buf);
      } else {
        csv = await readAsLatin1(file);
        aHash = await hashArchivo(csv);
      }
      const raws = parsearExtracto(csv, banco);
      const movs = await prepararMovimientos(raws, {
        sociedad_id_ref: sociedad, iban, banco, fuente: `${fmt}_${banco}`,
        cuenta_bancaria_id: cuentaId || null, reglas,
      });

      const [existentes, extractos] = await Promise.all([
        getHashesMovimientos(sociedad), getExtractos(sociedad),
      ]);
      const yaImportado = extractos.some(x => x.archivo_hash === aHash && x.estado !== 'deshecho');
      const set = new Set(existentes);
      const seen = new Set<string>();
      let nuevos = 0;
      for (const m of movs) {
        if (!yaImportado && !set.has(m.hash) && !seen.has(m.hash)) { nuevos++; seen.add(m.hash); }
      }
      const w: string[] = [];
      if (yaImportado) w.push('Este fichero ya se importó para esta sociedad. Si confirmas, no se duplicará nada.');
      if (movs.length === 0) w.push('No se detectaron movimientos. Revisa el banco o el formato del fichero.');
      else if (hayMovimientosSinSaldoNiReferencia(movs)) w.push('Algunos movimientos no tienen saldo ni referencia; la deduplicación puede ser menos precisa.');

      setFormato(fmt); setArchivoHash(aHash); setNombreArchivo(file.name);
      setPreview(movs); setCounts({ total: movs.length, nuevos, duplicados: movs.length - nuevos });
      setWarnings(w); setState('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el fichero.');
      setState('error');
    }
  }

  async function handleImport() {
    setState('importing'); setError(null);
    try {
      const payload: ExtractoImportPayload = {
        sociedad_id_ref: sociedad, cuenta_bancaria_id: cuentaId || null, banco, iban,
        anio: parseInt(anio, 10), mes: parseInt(mes, 10), nombre_archivo: nombreArchivo,
        formato, archivo_hash: archivoHash,
      };
      const r = await importarExtractoBancario(payload, preview);
      setResult(r); setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al importar.');
      setState('error');
    }
  }

  function resetFile() {
    setState('idle'); setPreview([]); setCounts(null); setWarnings([]);
    if (fileRef.current) fileRef.current.value = '';
  }

  const cuentaOptions = [
    { value: '', label: cuentas.length ? 'Sin cuenta (IBAN manual)' : 'No hay cuentas configuradas' },
    ...cuentas.map(c => ({ value: c.id, label: `${c.alias}${c.iban ? ` · ${c.iban}` : ''}` })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Importar extracto</h2>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {(state === 'idle' || state === 'parsing' || state === 'preview') && (
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Banco" value={banco} disabled={locked}
                onChange={v => setBanco(v as BancoOrigen)} options={BANCOS} />
              <SelectField label="Sociedad" value={sociedad} disabled={locked}
                onChange={v => { setSociedad(v); setCuentaId(''); }}
                options={sociedades.map(s => ({ value: s.id, label: s.nombre }))} />
              <SelectField label="Cuenta bancaria" value={cuentaId} disabled={locked}
                onChange={selectCuenta} options={cuentaOptions} />
              <div>
                <label className="field-label">IBAN</label>
                <input type="text" value={iban} onChange={e => setIban(e.target.value.toUpperCase())}
                  placeholder="ES00 0000 0000 0000 0000 0000" className="field-input font-mono" disabled={locked} />
              </div>
              <SelectField label="Mes" value={mes} disabled={locked} onChange={setMes} options={MESES} />
              <SelectField label="Año" value={anio} disabled={locked} onChange={setAnio} options={ANIOS} />
            </div>
          )}

          {state === 'idle' && (
            <div>
              <label className="field-label">Fichero del banco</label>
              <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" onChange={e => { void handleFile(e); }} className="hidden" />
              <button onClick={() => fileRef.current?.click()}
                className="w-full border border-dashed border-white/10 rounded-xl py-10 flex flex-col items-center gap-2 text-zinc-500 hover:text-zinc-300 hover:border-white/20 transition-all">
                <Upload size={24} />
                <span className="text-sm font-medium">Haz clic para seleccionar el extracto (CSV o XLSX)</span>
                <span className="text-xs text-zinc-600">Santander · BBVA · CaixaBank · Caja Rural · genérico</span>
              </button>
            </div>
          )}

          {state === 'parsing' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 size={24} className="animate-spin text-blue-400" />
              <p className="text-sm text-zinc-400">Leyendo y normalizando el fichero…</p>
            </div>
          )}

          {state === 'preview' && counts && (
            <div className="space-y-3">
              {/* Resumen */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-center">
                  <p className="text-lg font-light text-white tabular-nums">{counts.total}</p>
                  <p className="text-2xs uppercase tracking-widest text-zinc-500">Detectados</p>
                </div>
                <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/[0.05] px-3 py-2 text-center">
                  <p className="text-lg font-light text-emerald-300 tabular-nums">{counts.nuevos}</p>
                  <p className="text-2xs uppercase tracking-widest text-emerald-400/70">Nuevos</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-center">
                  <p className="text-lg font-light text-zinc-400 tabular-nums">{counts.duplicados}</p>
                  <p className="text-2xs uppercase tracking-widest text-zinc-500">Duplicados</p>
                </div>
              </div>
              {rango.min && (
                <p className="text-2xs text-zinc-500 text-center">Rango de fechas: {rango.min} → {rango.max}</p>
              )}
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
                  <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-2xs text-amber-300/90 leading-relaxed">{w}</p>
                </div>
              ))}

              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-300">{nombreArchivo}</p>
                <button onClick={resetFile} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Cambiar fichero</button>
              </div>
              <div className="rounded-xl border border-white/5 overflow-auto max-h-56">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5 bg-zinc-900/60 sticky top-0">
                      {['Fecha', 'Concepto', 'Categoría', 'Importe'].map(h => (
                        <th key={h} className={`text-2xs font-semibold text-zinc-500 uppercase tracking-widest px-3 py-2 ${h === 'Importe' ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {preview.slice(0, 50).map((m, i) => (
                      <tr key={i} className="hover:bg-white/[0.01]">
                        <td className="px-3 py-1.5 font-mono text-zinc-400">{m.fecha}</td>
                        <td className="px-3 py-1.5 text-zinc-200 max-w-xs truncate">{m.concepto}</td>
                        <td className="px-3 py-1.5"><CategoriaBadge cat={m.categoria} /></td>
                        <td className={`px-3 py-1.5 font-mono text-right font-medium ${m.importe >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtEur(m.importe)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.length > 50 && <p className="text-2xs text-zinc-600">Mostrando 50 de {preview.length}.</p>}
            </div>
          )}

          {state === 'importing' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 size={24} className="animate-spin text-blue-400" />
              <p className="text-sm text-zinc-400">Importando movimientos…</p>
            </div>
          )}

          {state === 'done' && result && (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle size={32} className="text-emerald-400" />
              <p className="text-sm font-medium text-white">
                {result.ya_importado ? 'El fichero ya estaba importado' : 'Importación completada'}
              </p>
              <p className="text-xs text-zinc-400">
                {result.importados} importados · {result.duplicados} duplicados
                {result.errores ? ` · ${result.errores} errores` : ''}
              </p>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <AlertTriangle size={32} className="text-rose-400" />
              <p className="text-sm text-zinc-400">{error ?? 'Error al importar.'}</p>
              <button onClick={resetFile} className="text-xs text-blue-400 hover:text-blue-300">Reintentar</button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5 bg-zinc-950">
          {state === 'done' ? (
            <button onClick={onDone} className="px-5 py-2 text-xs font-semibold uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors">Ver movimientos</button>
          ) : state === 'preview' ? (
            <>
              <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors">Cancelar</button>
              <button onClick={() => { void handleImport(); }} disabled={preview.length === 0}
                className="px-5 py-2 text-xs font-semibold uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-40">
                Importar {counts?.nuevos ?? 0} nuevos
              </button>
            </>
          ) : (state === 'idle' || state === 'error') ? (
            <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors">Cancelar</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Panel de extractos ────────────────────────────────────────────────────────

function ExtractosPanel({
  extractos, loading, onVerMovimientos, onDeshacer,
}: {
  extractos: ExtractoBancario[];
  loading: boolean;
  onVerMovimientos: (id: string) => void;
  onDeshacer: (id: string) => void;
}) {
  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={20} className="animate-spin text-zinc-600" /></div>;
  }
  if (extractos.length === 0) {
    return <div className="py-20 text-center text-zinc-600 text-sm">No hay extractos importados.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[760px]">
        <thead>
          <tr className="border-b border-white/5 bg-zinc-900/60">
            {['Periodo', 'Banco', 'Fichero', 'Movs.', 'Rango', 'Estado', ''].map(h => (
              <th key={h} className={`text-2xs font-semibold text-zinc-500 uppercase tracking-widest px-4 py-3 ${h === 'Movs.' ? 'text-center' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.03]">
          {extractos.map(e => (
            <tr key={e.id} className={`hover:bg-white/[0.02] transition-colors group ${e.estado === 'deshecho' ? 'opacity-50' : ''}`}>
              <td className="px-4 py-3 text-xs text-zinc-300 font-mono whitespace-nowrap">{String(e.mes).padStart(2, '0')}/{e.anio}</td>
              <td className="px-4 py-3 text-xs text-zinc-400">{e.banco ?? '—'}</td>
              <td className="px-4 py-3 text-xs text-zinc-400 max-w-[200px]">
                <span className="flex items-center gap-1.5 truncate">
                  <FileSpreadsheet size={11} className="shrink-0 text-zinc-600" />{e.nombre_archivo ?? '—'}
                </span>
              </td>
              <td className="px-4 py-3 text-center text-xs">
                <span className="text-zinc-200">{e.n_importados}</span>
                <span className="text-zinc-600"> / {e.n_movimientos}</span>
                {e.n_duplicados > 0 && <span className="text-2xs text-zinc-500 block">{e.n_duplicados} dup.</span>}
              </td>
              <td className="px-4 py-3 text-2xs text-zinc-500 whitespace-nowrap">
                {e.rango_fecha_min ? `${e.rango_fecha_min} → ${e.rango_fecha_max}` : '—'}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center text-2xs font-medium px-2 py-0.5 rounded-full border ${ESTADO_EXTRACTO_COLOR[e.estado]}`}>
                  {ESTADO_EXTRACTO_LABEL[e.estado]}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onVerMovimientos(e.id)} title="Ver movimientos del extracto"
                    className="p-1.5 text-zinc-600 hover:text-zinc-300 rounded-md hover:bg-white/5 transition-colors"><Eye size={12} /></button>
                  {e.estado !== 'deshecho' && (
                    <button onClick={() => onDeshacer(e.id)} title="Deshacer importación"
                      className="p-1.5 text-zinc-600 hover:text-rose-400 rounded-md hover:bg-white/5 transition-colors"><Undo2 size={12} /></button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Fila editable ─────────────────────────────────────────────────────────────

type MovRowProps = {
  m: MovimientoBancario;
  isPrivateMode: boolean;
  onToggleRevisado: (id: string, revisado: boolean) => void;
  onChangeCategoria: (id: string, cat: CategoriaMovimiento) => void;
  onDelete: (id: string) => void;
};

function MovRow({ m, isPrivateMode, onToggleRevisado, onChangeCategoria, onDelete }: MovRowProps) {
  const [editCat, setEditCat] = useState(false);

  return (
    <tr className="hover:bg-white/[0.02] transition-colors group">
      <td className="px-4 py-3 text-xs text-zinc-400 font-mono whitespace-nowrap">{m.fecha}</td>
      <td className="px-4 py-3 text-xs text-zinc-200 max-w-[260px]">
        <p className="truncate">{m.concepto}</p>
        {m.entidad_contraparte && <p className="text-2xs text-zinc-500 truncate">{m.entidad_contraparte}</p>}
      </td>
      <td className="px-4 py-3">
        {editCat ? (
          <select
            autoFocus
            value={m.categoria ?? ''}
            onBlur={() => setEditCat(false)}
            onChange={e => { onChangeCategoria(m.id, e.target.value as CategoriaMovimiento); setEditCat(false); }}
            className="bg-zinc-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none"
          >
            {CATEGORIAS.map(c => <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>)}
          </select>
        ) : (
          <button onClick={() => setEditCat(true)} className="flex items-center gap-1 group/cat">
            <CategoriaBadge cat={m.categoria} />
            <Edit2 size={10} className="text-zinc-700 opacity-0 group-hover/cat:opacity-100 transition-opacity" />
          </button>
        )}
      </td>
      <td className={`px-4 py-3 text-xs font-medium text-right font-mono whitespace-nowrap ${m.importe >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
        {isPrivateMode ? '****' : fmtEur(m.importe)}
      </td>
      <td className="px-4 py-3 text-center">
        <button onClick={() => onToggleRevisado(m.id, !m.revisado)} title={m.revisado ? 'Marcar sin revisar' : 'Marcar como revisado'}>
          <span className={`inline-block h-2.5 w-2.5 rounded-full border transition-all ${m.revisado ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600 hover:border-zinc-400'}`} />
        </button>
      </td>
      <td className="px-4 py-3 text-center">
        <button onClick={() => { if (confirm('¿Eliminar este movimiento?')) onDelete(m.id); }}
          className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-400 transition-all">
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type Props = {
  isPrivateMode: boolean;
  sociedades: { id: string; nombre: string }[];
  reglas: ReglaCategorizacion[];
};

type FiltroRevisado = '' | 'true' | 'false';

export function MovimientosBancarios({ isPrivateMode, sociedades, reglas: reglasProp }: Props) {
  const [vista, setVista]             = useState<'movimientos' | 'extractos'>('movimientos');
  const [movimientos, setMovimientos] = useState<MovimientoBancario[]>([]);
  const [extractos, setExtractos]     = useState<ExtractoBancario[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadingEx, setLoadingEx]     = useState(true);
  const [showImport, setShowImport]   = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [reglas, setReglas]           = useState<ReglaCategorizacion[]>(reglasProp);

  const [filtSociedad, setFiltSociedad]   = useState('');
  const [filtDesde, setFiltDesde]         = useState('');
  const [filtHasta, setFiltHasta]         = useState('');
  const [filtCategoria, setFiltCategoria] = useState('');
  const [filtRevisado, setFiltRevisado]   = useState<FiltroRevisado>('');
  const [filtExtracto, setFiltExtracto]   = useState('');

  const fetchMovimientos = async (extractoOverride?: string) => {
    setLoading(true);
    try {
      const params: Parameters<typeof getMovimientos>[0] = { limit: 200 };
      if (filtSociedad)  params.sociedad  = filtSociedad;
      if (filtDesde)     params.desde     = filtDesde;
      if (filtHasta)     params.hasta     = filtHasta;
      if (filtCategoria) params.categoria = filtCategoria;
      if (filtRevisado !== '') params.revisado = filtRevisado === 'true';
      const ex = extractoOverride !== undefined ? extractoOverride : filtExtracto;
      if (ex) params.extracto = ex;
      setMovimientos(await getMovimientos(params));
    } catch { /* silently fail */ }
    setLoading(false);
  };

  const fetchExtractos = async () => {
    setLoadingEx(true);
    try { setExtractos(await getExtractos(filtSociedad || undefined)); }
    catch { /* silently */ }
    setLoadingEx(false);
  };

  useEffect(() => {
    void fetchMovimientos();
    void fetchExtractos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reglasProp.length > 0) setReglas(reglasProp);
    else void getReglas().then(setReglas).catch(() => {});
  }, [reglasProp]);

  const handleToggleRevisado = (id: string, revisado: boolean) => {
    void updateMovimiento(id, { revisado });
    setMovimientos(prev => prev.map(m => m.id === id ? { ...m, revisado } : m));
  };
  const handleChangeCategoria = (id: string, cat: CategoriaMovimiento) => {
    void updateMovimiento(id, { categoria: cat });
    setMovimientos(prev => prev.map(m => m.id === id ? { ...m, categoria: cat } : m));
  };
  const handleDelete = (id: string) => {
    void deleteMovimiento(id);
    setMovimientos(prev => prev.filter(m => m.id !== id));
  };

  const handleVerMovimientos = (extractoId: string) => {
    setFiltExtracto(extractoId);
    setVista('movimientos');
    void fetchMovimientos(extractoId);
  };
  const handleDeshacer = async (extractoId: string) => {
    if (!confirm('¿Deshacer la importación? Se borrarán los movimientos de este extracto y quedará marcado como «deshecho».')) return;
    try {
      await deshacerImportacionExtracto(extractoId);
      await fetchExtractos();
      if (filtExtracto === extractoId) { setFiltExtracto(''); void fetchMovimientos(''); }
      else void fetchMovimientos();
    } catch { /* silently */ }
  };

  const totalImporte = movimientos.reduce((s, m) => s + m.importe, 0);
  const extractoActivo = filtExtracto ? extractos.find(e => e.id === filtExtracto) : null;

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/5">
        {(['movimientos', 'extractos'] as const).map(v => (
          <button key={v} onClick={() => setVista(v)}
            className={`px-4 py-2 text-xs font-medium transition-all border-b-2 -mb-px ${vista === v ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
            {v === 'movimientos' ? 'Movimientos' : 'Extractos'}
            {v === 'extractos' && extractos.length > 0 && <span className="ml-1.5 text-2xs text-zinc-600">{extractos.length}</span>}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors">
          <Upload size={14} />Importar extracto
        </button>
        {vista === 'movimientos' && (
          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl border transition-all ${showFilters ? 'bg-white/5 border-white/10 text-zinc-200' : 'border-white/5 text-zinc-500 hover:text-zinc-300'}`}>
            <Filter size={13} />Filtros{showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
        <button onClick={() => { void fetchMovimientos(); void fetchExtractos(); }} className="ml-auto text-zinc-600 hover:text-zinc-300 transition-colors" title="Recargar">
          <RefreshCw size={14} />
        </button>
        {vista === 'movimientos' && !isPrivateMode && movimientos.length > 0 && (
          <span className={`text-xs font-medium font-mono ${totalImporte >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            Saldo: {fmtEur(totalImporte)}
          </span>
        )}
      </div>

      {/* Chip de filtro por extracto */}
      {vista === 'movimientos' && extractoActivo && (
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1">
            Extracto {String(extractoActivo.mes).padStart(2, '0')}/{extractoActivo.anio} · {extractoActivo.nombre_archivo}
            <button onClick={() => { setFiltExtracto(''); void fetchMovimientos(''); }} className="text-zinc-500 hover:text-zinc-200"><X size={11} /></button>
          </span>
        </div>
      )}

      {/* Filters (solo movimientos) */}
      {vista === 'movimientos' && showFilters && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 rounded-2xl border border-white/5 bg-zinc-900/40 p-4">
          <SelectField label="Sociedad" value={filtSociedad} onChange={setFiltSociedad}
            options={[{ value: '', label: 'Todas' }, ...sociedades.map(s => ({ value: s.id, label: s.nombre }))]} />
          <SelectField label="Categoría" value={filtCategoria} onChange={setFiltCategoria}
            options={[{ value: '', label: 'Todas' }, ...CATEGORIAS.map(c => ({ value: c, label: CATEGORIA_LABEL[c] }))]} />
          <div>
            <label className="field-label">Desde</label>
            <input type="date" value={filtDesde} onChange={e => setFiltDesde(e.target.value)} className="field-input" />
          </div>
          <div>
            <label className="field-label">Hasta</label>
            <input type="date" value={filtHasta} onChange={e => setFiltHasta(e.target.value)} className="field-input" />
          </div>
          <SelectField label="Revisado" value={filtRevisado} onChange={v => setFiltRevisado(v as FiltroRevisado)}
            options={[{ value: '', label: 'Todos' }, { value: 'true', label: 'Revisados' }, { value: 'false', label: 'Sin revisar' }]} />
          <div className="flex items-end">
            <button onClick={() => { void fetchMovimientos(); void fetchExtractos(); }} className="w-full px-4 py-2 text-xs font-semibold uppercase tracking-widest bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors">
              Aplicar
            </button>
          </div>
        </div>
      )}

      {/* Contenido */}
      <div className="rounded-2xl border border-white/5 overflow-hidden">
        {vista === 'extractos' ? (
          <ExtractosPanel extractos={extractos} loading={loadingEx} onVerMovimientos={handleVerMovimientos} onDeshacer={(id) => { void handleDeshacer(id); }} />
        ) : loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={20} className="animate-spin text-zinc-600" /></div>
        ) : movimientos.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-zinc-600 text-sm mb-2">No hay movimientos</p>
            <button onClick={() => setShowImport(true)} className="text-blue-400 text-xs hover:text-blue-300 font-medium">Importar extracto →</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-white/5 bg-zinc-900/60">
                  {['Fecha', 'Concepto', 'Categoría', 'Importe', 'Rev.', ''].map(h => (
                    <th key={h} className={`text-2xs font-semibold text-zinc-500 uppercase tracking-widest px-4 py-3 ${h === 'Importe' ? 'text-right' : h === 'Rev.' ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {movimientos.map(m => (
                  <MovRow key={m.id} m={m} isPrivateMode={isPrivateMode}
                    onToggleRevisado={handleToggleRevisado} onChangeCategoria={handleChangeCategoria} onDelete={handleDelete} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {vista === 'movimientos' && (
        <p className="text-xs text-zinc-600 text-right">
          {movimientos.length} movimientos · {movimientos.filter(m => !m.revisado).length} sin revisar
        </p>
      )}

      {showImport && (
        <ImportPanel
          sociedades={sociedades}
          reglas={reglas}
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); void fetchMovimientos(); void fetchExtractos(); }}
        />
      )}
    </div>
  );
}
