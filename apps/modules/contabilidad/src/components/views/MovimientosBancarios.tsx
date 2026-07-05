import { useEffect, useState, useRef } from 'react';
import {
  Upload,
  X,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  FileSpreadsheet,
  Undo2,
  Eye,
} from 'lucide-react';
import {
  getMovimientos,
  updateMovimiento,
  deleteMovimiento,
  getReglas,
  getCuentasBancarias,
  getExtractos,
  getHashesMovimientos,
  importarExtractoBancario,
  deshacerImportacionExtracto,
  type ExtractoImportPayload,
} from '../../lib/contabilidadApi';
import { parsearExtracto } from '../../lib/csvParsers';
import {
  prepararMovimientos,
  hashArchivo,
  xlsxToRows,
  rowsToCsv,
  rangoFechas,
  hayMovimientosSinSaldoNiReferencia,
  type MovimientoParaImportar,
} from '../../lib/extractoImport';
import { SelectField } from '../SelectField';
import type {
  MovimientoBancario,
  BancoOrigen,
  ReglaCategorizacion,
  CategoriaMovimiento,
  ExtractoBancario,
  EstadoExtracto,
  CuentaBancariaSociedad,
  ResultadoImportacion,
} from '@alsari/types';
import { ESTADO_EXTRACTO_LABEL } from '@alsari/types';

// ── Constantes ────────────────────────────────────────────────────────────────

const BANCOS: { value: BancoOrigen; label: string }[] = [
  { value: 'santander', label: 'Santander' },
  { value: 'bbva', label: 'BBVA' },
  { value: 'caixabank', label: 'CaixaBank' },
  { value: 'caja_rural', label: 'Caja Rural' },
  { value: 'otro', label: 'Otro (genérico)' },
];

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
].map((label, i) => ({ value: String(i + 1), label }));

const ANIOS = Array.from({ length: 6 }, (_, i) => {
  const y = new Date().getFullYear() - i;
  return { value: String(y), label: String(y) };
});

const CATEGORIAS: CategoriaMovimiento[] = [
  'intragrupo_salida',
  'intragrupo_entrada',
  'rentas_cobradas',
  'cobros_operacion_inmobiliaria',
  'gastos_inmobiliarios',
  'bancarios',
  'fiscal',
  'notaria_legal',
  'devoluciones',
  'proveedores',
  'personal',
  'dividendos',
  'rendimientos_financieros',
  'extraordinario',
];

const CATEGORIA_LABEL: Record<CategoriaMovimiento, string> = {
  intragrupo_salida: 'Intragrupo ↑',
  intragrupo_entrada: 'Intragrupo ↓',
  rentas_cobradas: 'Rentas',
  cobros_operacion_inmobiliaria: 'Cobros oper.',
  gastos_inmobiliarios: 'Inmobiliario',
  bancarios: 'Bancarios',
  fiscal: 'Fiscal',
  notaria_legal: 'Notaría',
  devoluciones: 'Devolución',
  proveedores: 'Proveedores',
  personal: 'Personal',
  dividendos: 'Dividendos',
  rendimientos_financieros: 'Rendimientos',
  extraordinario: 'Extraordinario',
};

const CATEGORIA_COLOR: Record<CategoriaMovimiento, string> = {
  intragrupo_salida: 'bg-violet-500/20 text-violet-300',
  intragrupo_entrada: 'bg-violet-500/20 text-violet-300',
  rentas_cobradas: 'bg-emerald-500/20 text-emerald-300',
  cobros_operacion_inmobiliaria: 'bg-emerald-500/20 text-emerald-300',
  gastos_inmobiliarios: 'bg-orange-500/20 text-orange-300',
  bancarios: 'bg-blue-500/20 text-blue-300',
  fiscal: 'bg-rose-500/20 text-rose-300',
  notaria_legal: 'bg-amber-500/20 text-amber-300',
  devoluciones: 'bg-cyan-500/20 text-cyan-300',
  proveedores: 'bg-zinc-500/20 text-zinc-300',
  personal: 'bg-pink-500/20 text-pink-300',
  dividendos: 'bg-indigo-500/20 text-indigo-300',
  rendimientos_financieros: 'bg-purple-500/20 text-purple-300',
  extraordinario: 'bg-zinc-700/40 text-zinc-400',
};

const ESTADO_EXTRACTO_COLOR: Record<EstadoExtracto, string> = {
  importado: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
  pendiente_revision: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  listo_conciliacion: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  deshecho: 'bg-zinc-700/30 text-zinc-500 border-white/5',
};

const fmtEur = (n: number) =>
  `${n >= 0 ? '+' : ''}${n.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function CategoriaBadge({ cat }: { cat: CategoriaMovimiento | null }) {
  if (!cat)
    return (
      <span className="text-2xs rounded-full bg-zinc-700/40 px-2 py-0.5 font-medium text-zinc-500">
        —
      </span>
    );
  return (
    <span
      className={`text-2xs whitespace-nowrap rounded-full px-2 py-0.5 font-medium ${CATEGORIA_COLOR[cat]}`}
    >
      {CATEGORIA_LABEL[cat]}
    </span>
  );
}

function readAsLatin1(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve((ev.target?.result as string) ?? '');
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
  const [banco, setBanco] = useState<BancoOrigen>('santander');
  const [sociedad, setSociedad] = useState(sociedades[0]?.id ?? '');
  const [cuentas, setCuentas] = useState<CuentaBancariaSociedad[]>([]);
  const [cuentaId, setCuentaId] = useState('');
  const [iban, setIban] = useState('');
  const [mes, setMes] = useState(String(now.getMonth() + 1));
  const [anio, setAnio] = useState(String(now.getFullYear()));
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [formato, setFormato] = useState<'csv' | 'xlsx'>('csv');
  const [archivoHash, setArchivoHash] = useState('');
  const [preview, setPreview] = useState<MovimientoParaImportar[]>([]);
  const [counts, setCounts] = useState<{
    total: number;
    nuevos: number;
    duplicados: number;
  } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [state, setState] = useState<ImportState>('idle');
  const [result, setResult] = useState<ResultadoImportacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sociedad) {
      setCuentas([]);
      return;
    }
    getCuentasBancarias(sociedad)
      .then(setCuentas)
      .catch(() => setCuentas([]));
  }, [sociedad]);

  function selectCuenta(id: string) {
    setCuentaId(id);
    const c = cuentas.find((x) => x.id === id);
    if (c?.iban) setIban(c.iban.toUpperCase());
  }

  const locked = state === 'preview' || state === 'importing';
  const rango = rangoFechas(preview);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setState('parsing');
    setError(null);
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
        sociedad_id_ref: sociedad,
        iban,
        banco,
        fuente: `${fmt}_${banco}`,
        cuenta_bancaria_id: cuentaId || null,
        reglas,
      });

      const [existentes, extractos] = await Promise.all([
        getHashesMovimientos(sociedad),
        getExtractos(sociedad),
      ]);
      const yaImportado = extractos.some(
        (x) => x.archivo_hash === aHash && x.estado !== 'deshecho',
      );
      const set = new Set(existentes);
      const seen = new Set<string>();
      let nuevos = 0;
      for (const m of movs) {
        if (!yaImportado && !set.has(m.hash) && !seen.has(m.hash)) {
          nuevos++;
          seen.add(m.hash);
        }
      }
      const w: string[] = [];
      if (yaImportado)
        w.push(
          'Este fichero ya se importó para esta sociedad. Si confirmas, no se duplicará nada.',
        );
      if (movs.length === 0)
        w.push('No se detectaron movimientos. Revisa el banco o el formato del fichero.');
      else if (hayMovimientosSinSaldoNiReferencia(movs))
        w.push(
          'Algunos movimientos no tienen saldo ni referencia; la deduplicación puede ser menos precisa.',
        );

      setFormato(fmt);
      setArchivoHash(aHash);
      setNombreArchivo(file.name);
      setPreview(movs);
      setCounts({ total: movs.length, nuevos, duplicados: movs.length - nuevos });
      setWarnings(w);
      setState('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el fichero.');
      setState('error');
    }
  }

  async function handleImport() {
    setState('importing');
    setError(null);
    try {
      const payload: ExtractoImportPayload = {
        sociedad_id_ref: sociedad,
        cuenta_bancaria_id: cuentaId || null,
        banco,
        iban,
        anio: parseInt(anio, 10),
        mes: parseInt(mes, 10),
        nombre_archivo: nombreArchivo,
        formato,
        archivo_hash: archivoHash,
      };
      const r = await importarExtractoBancario(payload, preview);
      setResult(r);
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al importar.');
      setState('error');
    }
  }

  function resetFile() {
    setState('idle');
    setPreview([]);
    setCounts(null);
    setWarnings([]);
    if (fileRef.current) fileRef.current.value = '';
  }

  const cuentaOptions = [
    {
      value: '',
      label: cuentas.length ? 'Sin cuenta (IBAN manual)' : 'No hay cuentas configuradas',
    },
    ...cuentas.map((c) => ({ value: c.id, label: `${c.alias}${c.iban ? ` · ${c.iban}` : ''}` })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-white">
            Importar extracto
          </h2>
          <button onClick={onClose} className="text-zinc-600 transition-colors hover:text-zinc-300">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[80vh] space-y-5 overflow-y-auto p-6">
          {(state === 'idle' || state === 'parsing' || state === 'preview') && (
            <div className="grid grid-cols-2 gap-4">
              <SelectField
                label="Banco"
                value={banco}
                disabled={locked}
                onChange={(v) => setBanco(v as BancoOrigen)}
                options={BANCOS}
              />
              <SelectField
                label="Sociedad"
                value={sociedad}
                disabled={locked}
                onChange={(v) => {
                  setSociedad(v);
                  setCuentaId('');
                }}
                options={sociedades.map((s) => ({ value: s.id, label: s.nombre }))}
              />
              <SelectField
                label="Cuenta bancaria"
                value={cuentaId}
                disabled={locked}
                onChange={selectCuenta}
                options={cuentaOptions}
              />
              <div>
                <label className="field-label">IBAN</label>
                <input
                  type="text"
                  value={iban}
                  onChange={(e) => setIban(e.target.value.toUpperCase())}
                  placeholder="ES00 0000 0000 0000 0000 0000"
                  className="field-input font-mono"
                  disabled={locked}
                />
              </div>
              <SelectField
                label="Mes"
                value={mes}
                disabled={locked}
                onChange={setMes}
                options={MESES}
              />
              <SelectField
                label="Año"
                value={anio}
                disabled={locked}
                onChange={setAnio}
                options={ANIOS}
              />
            </div>
          )}

          {state === 'idle' && (
            <div>
              <label className="field-label">Fichero del banco</label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,.xlsx,.xls"
                onChange={(e) => {
                  void handleFile(e);
                }}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 py-10 text-zinc-500 transition-all hover:border-white/20 hover:text-zinc-300"
              >
                <Upload size={24} />
                <span className="text-sm font-medium">
                  Haz clic para seleccionar el extracto (CSV o XLSX)
                </span>
                <span className="text-xs text-zinc-600">
                  Santander · BBVA · CaixaBank · Caja Rural · genérico
                </span>
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
                  <p className="text-lg font-light tabular-nums text-white">{counts.total}</p>
                  <p className="text-2xs uppercase tracking-widest text-zinc-500">Detectados</p>
                </div>
                <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/[0.05] px-3 py-2 text-center">
                  <p className="text-lg font-light tabular-nums text-emerald-300">
                    {counts.nuevos}
                  </p>
                  <p className="text-2xs uppercase tracking-widest text-emerald-400/70">Nuevos</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-center">
                  <p className="text-lg font-light tabular-nums text-zinc-400">
                    {counts.duplicados}
                  </p>
                  <p className="text-2xs uppercase tracking-widest text-zinc-500">Duplicados</p>
                </div>
              </div>
              {rango.min && (
                <p className="text-2xs text-center text-zinc-500">
                  Rango de fechas: {rango.min} → {rango.max}
                </p>
              )}
              {warnings.map((w, i) => (
                <div
                  key={i}
                  className="bg-amber-500/8 flex items-start gap-2 rounded-lg border border-amber-500/20 px-3 py-2"
                >
                  <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-400" />
                  <p className="text-2xs leading-relaxed text-amber-300/90">{w}</p>
                </div>
              ))}

              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-300">{nombreArchivo}</p>
                <button
                  onClick={resetFile}
                  className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  Cambiar fichero
                </button>
              </div>
              <div className="max-h-56 overflow-auto rounded-xl border border-white/5">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="sticky top-0 border-b border-white/5 bg-zinc-900/60">
                      {['Fecha', 'Concepto', 'Categoría', 'Importe'].map((h) => (
                        <th
                          key={h}
                          className={`text-2xs px-3 py-2 font-semibold uppercase tracking-widest text-zinc-500 ${h === 'Importe' ? 'text-right' : 'text-left'}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {preview.slice(0, 50).map((m, i) => (
                      <tr key={i} className="hover:bg-white/[0.01]">
                        <td className="px-3 py-1.5 font-mono text-zinc-400">{m.fecha}</td>
                        <td className="max-w-xs truncate px-3 py-1.5 text-zinc-200">
                          {m.concepto}
                        </td>
                        <td className="px-3 py-1.5">
                          <CategoriaBadge cat={m.categoria} />
                        </td>
                        <td
                          className={`px-3 py-1.5 text-right font-mono font-medium ${m.importe >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                        >
                          {fmtEur(m.importe)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.length > 50 && (
                <p className="text-2xs text-zinc-600">Mostrando 50 de {preview.length}.</p>
              )}
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
              <button onClick={resetFile} className="text-xs text-blue-400 hover:text-blue-300">
                Reintentar
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/5 bg-zinc-950 px-6 py-4">
          {state === 'done' ? (
            <button
              onClick={onDone}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-blue-500"
            >
              Ver movimientos
            </button>
          ) : state === 'preview' ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  void handleImport();
                }}
                disabled={preview.length === 0}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
              >
                Importar {counts?.nuevos ?? 0} nuevos
              </button>
            </>
          ) : state === 'idle' || state === 'error' ? (
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Panel de extractos ────────────────────────────────────────────────────────

function ExtractosPanel({
  extractos,
  loading,
  onVerMovimientos,
  onDeshacer,
}: {
  extractos: ExtractoBancario[];
  loading: boolean;
  onVerMovimientos: (id: string) => void;
  onDeshacer: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-zinc-600" />
      </div>
    );
  }
  if (extractos.length === 0) {
    return (
      <div className="py-20 text-center text-sm text-zinc-600">No hay extractos importados.</div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-white/5 bg-zinc-900/60">
            {['Periodo', 'Banco', 'Fichero', 'Movs.', 'Rango', 'Estado', ''].map((h) => (
              <th
                key={h}
                className={`text-2xs px-4 py-3 font-semibold uppercase tracking-widest text-zinc-500 ${h === 'Movs.' ? 'text-center' : 'text-left'}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.03]">
          {extractos.map((e) => (
            <tr
              key={e.id}
              className={`group transition-colors hover:bg-white/[0.02] ${e.estado === 'deshecho' ? 'opacity-50' : ''}`}
            >
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-300">
                {String(e.mes).padStart(2, '0')}/{e.anio}
              </td>
              <td className="px-4 py-3 text-xs text-zinc-400">{e.banco ?? '—'}</td>
              <td className="max-w-[200px] px-4 py-3 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 truncate">
                  <FileSpreadsheet size={11} className="shrink-0 text-zinc-600" />
                  {e.nombre_archivo ?? '—'}
                </span>
              </td>
              <td className="px-4 py-3 text-center text-xs">
                <span className="text-zinc-200">{e.n_importados}</span>
                <span className="text-zinc-600"> / {e.n_movimientos}</span>
                {e.n_duplicados > 0 && (
                  <span className="text-2xs block text-zinc-500">{e.n_duplicados} dup.</span>
                )}
              </td>
              <td className="text-2xs whitespace-nowrap px-4 py-3 text-zinc-500">
                {e.rango_fecha_min ? `${e.rango_fecha_min} → ${e.rango_fecha_max}` : '—'}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`text-2xs inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${ESTADO_EXTRACTO_COLOR[e.estado]}`}
                >
                  {ESTADO_EXTRACTO_LABEL[e.estado]}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => onVerMovimientos(e.id)}
                    title="Ver movimientos del extracto"
                    className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-300"
                  >
                    <Eye size={12} />
                  </button>
                  {e.estado !== 'deshecho' && (
                    <button
                      onClick={() => onDeshacer(e.id)}
                      title="Deshacer importación"
                      className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-white/5 hover:text-rose-400"
                    >
                      <Undo2 size={12} />
                    </button>
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
    <tr className="group transition-colors hover:bg-white/[0.02]">
      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-400">{m.fecha}</td>
      <td className="max-w-[260px] px-4 py-3 text-xs text-zinc-200">
        <p className="truncate">{m.concepto}</p>
        {m.entidad_contraparte && (
          <p className="text-2xs truncate text-zinc-500">{m.entidad_contraparte}</p>
        )}
      </td>
      <td className="px-4 py-3">
        {editCat ? (
          <select
            autoFocus
            value={m.categoria ?? ''}
            onBlur={() => setEditCat(false)}
            onChange={(e) => {
              onChangeCategoria(m.id, e.target.value as CategoriaMovimiento);
              setEditCat(false);
            }}
            className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-white outline-none"
          >
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_LABEL[c]}
              </option>
            ))}
          </select>
        ) : (
          <button onClick={() => setEditCat(true)} className="group/cat flex items-center gap-1">
            <CategoriaBadge cat={m.categoria} />
            <Edit2
              size={10}
              className="text-zinc-700 opacity-0 transition-opacity group-hover/cat:opacity-100"
            />
          </button>
        )}
      </td>
      <td
        className={`whitespace-nowrap px-4 py-3 text-right font-mono text-xs font-medium ${m.importe >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
      >
        {isPrivateMode ? '****' : fmtEur(m.importe)}
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => onToggleRevisado(m.id, !m.revisado)}
          title={m.revisado ? 'Marcar sin revisar' : 'Marcar como revisado'}
        >
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full border transition-all ${m.revisado ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-600 hover:border-zinc-400'}`}
          />
        </button>
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => {
            if (confirm('¿Eliminar este movimiento?')) onDelete(m.id);
          }}
          className="text-zinc-600 opacity-0 transition-all hover:text-rose-400 group-hover:opacity-100"
        >
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
  const [vista, setVista] = useState<'movimientos' | 'extractos'>('movimientos');
  const [movimientos, setMovimientos] = useState<MovimientoBancario[]>([]);
  const [extractos, setExtractos] = useState<ExtractoBancario[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEx, setLoadingEx] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [reglas, setReglas] = useState<ReglaCategorizacion[]>(reglasProp);

  const [filtSociedad, setFiltSociedad] = useState('');
  const [filtDesde, setFiltDesde] = useState('');
  const [filtHasta, setFiltHasta] = useState('');
  const [filtCategoria, setFiltCategoria] = useState('');
  const [filtRevisado, setFiltRevisado] = useState<FiltroRevisado>('');
  const [filtExtracto, setFiltExtracto] = useState('');

  const fetchMovimientos = async (extractoOverride?: string) => {
    setLoading(true);
    try {
      const params: Parameters<typeof getMovimientos>[0] = { limit: 200 };
      if (filtSociedad) params.sociedad = filtSociedad;
      if (filtDesde) params.desde = filtDesde;
      if (filtHasta) params.hasta = filtHasta;
      if (filtCategoria) params.categoria = filtCategoria;
      if (filtRevisado !== '') params.revisado = filtRevisado === 'true';
      const ex = extractoOverride !== undefined ? extractoOverride : filtExtracto;
      if (ex) params.extracto = ex;
      setMovimientos(await getMovimientos(params));
    } catch {
      /* silently fail */
    }
    setLoading(false);
  };

  const fetchExtractos = async () => {
    setLoadingEx(true);
    try {
      setExtractos(await getExtractos(filtSociedad || undefined));
    } catch {
      /* silently */
    }
    setLoadingEx(false);
  };

  useEffect(() => {
    void fetchMovimientos();
    void fetchExtractos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reglasProp.length > 0) setReglas(reglasProp);
    else
      void getReglas()
        .then(setReglas)
        .catch(() => {});
  }, [reglasProp]);

  const handleToggleRevisado = (id: string, revisado: boolean) => {
    void updateMovimiento(id, { revisado });
    setMovimientos((prev) => prev.map((m) => (m.id === id ? { ...m, revisado } : m)));
  };
  const handleChangeCategoria = (id: string, cat: CategoriaMovimiento) => {
    void updateMovimiento(id, { categoria: cat });
    setMovimientos((prev) => prev.map((m) => (m.id === id ? { ...m, categoria: cat } : m)));
  };
  const handleDelete = (id: string) => {
    void deleteMovimiento(id);
    setMovimientos((prev) => prev.filter((m) => m.id !== id));
  };

  const handleVerMovimientos = (extractoId: string) => {
    setFiltExtracto(extractoId);
    setVista('movimientos');
    void fetchMovimientos(extractoId);
  };
  const handleDeshacer = async (extractoId: string) => {
    if (
      !confirm(
        '¿Deshacer la importación? Se borrarán los movimientos de este extracto y quedará marcado como «deshecho».',
      )
    )
      return;
    try {
      await deshacerImportacionExtracto(extractoId);
      await fetchExtractos();
      if (filtExtracto === extractoId) {
        setFiltExtracto('');
        void fetchMovimientos('');
      } else void fetchMovimientos();
    } catch {
      /* silently */
    }
  };

  const totalImporte = movimientos.reduce((s, m) => s + m.importe, 0);
  const extractoActivo = filtExtracto ? extractos.find((e) => e.id === filtExtracto) : null;

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/5">
        {(['movimientos', 'extractos'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setVista(v)}
            className={`-mb-px border-b-2 px-4 py-2 text-xs font-medium transition-all ${vista === v ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
          >
            {v === 'movimientos' ? 'Movimientos' : 'Extractos'}
            {v === 'extractos' && extractos.length > 0 && (
              <span className="text-2xs ml-1.5 text-zinc-600">{extractos.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-blue-500"
        >
          <Upload size={14} />
          Importar extracto
        </button>
        {vista === 'movimientos' && (
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${showFilters ? 'border-white/10 bg-white/5 text-zinc-200' : 'border-white/5 text-zinc-500 hover:text-zinc-300'}`}
          >
            <Filter size={13} />
            Filtros{showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
        <button
          onClick={() => {
            void fetchMovimientos();
            void fetchExtractos();
          }}
          className="ml-auto text-zinc-600 transition-colors hover:text-zinc-300"
          title="Recargar"
        >
          <RefreshCw size={14} />
        </button>
        {vista === 'movimientos' && !isPrivateMode && movimientos.length > 0 && (
          <span
            className={`font-mono text-xs font-medium ${totalImporte >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
          >
            Saldo: {fmtEur(totalImporte)}
          </span>
        )}
      </div>

      {/* Chip de filtro por extracto */}
      {vista === 'movimientos' && extractoActivo && (
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
            Extracto {String(extractoActivo.mes).padStart(2, '0')}/{extractoActivo.anio} ·{' '}
            {extractoActivo.nombre_archivo}
            <button
              onClick={() => {
                setFiltExtracto('');
                void fetchMovimientos('');
              }}
              className="text-zinc-500 hover:text-zinc-200"
            >
              <X size={11} />
            </button>
          </span>
        </div>
      )}

      {/* Filters (solo movimientos) */}
      {vista === 'movimientos' && showFilters && (
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/5 bg-zinc-900/40 p-4 xl:grid-cols-4">
          <SelectField
            label="Sociedad"
            value={filtSociedad}
            onChange={setFiltSociedad}
            options={[
              { value: '', label: 'Todas' },
              ...sociedades.map((s) => ({ value: s.id, label: s.nombre })),
            ]}
          />
          <SelectField
            label="Categoría"
            value={filtCategoria}
            onChange={setFiltCategoria}
            options={[
              { value: '', label: 'Todas' },
              ...CATEGORIAS.map((c) => ({ value: c, label: CATEGORIA_LABEL[c] })),
            ]}
          />
          <div>
            <label className="field-label">Desde</label>
            <input
              type="date"
              value={filtDesde}
              onChange={(e) => setFiltDesde(e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">Hasta</label>
            <input
              type="date"
              value={filtHasta}
              onChange={(e) => setFiltHasta(e.target.value)}
              className="field-input"
            />
          </div>
          <SelectField
            label="Revisado"
            value={filtRevisado}
            onChange={(v) => setFiltRevisado(v as FiltroRevisado)}
            options={[
              { value: '', label: 'Todos' },
              { value: 'true', label: 'Revisados' },
              { value: 'false', label: 'Sin revisar' },
            ]}
          />
          <div className="flex items-end">
            <button
              onClick={() => {
                void fetchMovimientos();
                void fetchExtractos();
              }}
              className="w-full rounded-xl bg-zinc-800 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-zinc-700"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}

      {/* Contenido */}
      <div className="overflow-hidden rounded-2xl border border-white/5">
        {vista === 'extractos' ? (
          <ExtractosPanel
            extractos={extractos}
            loading={loadingEx}
            onVerMovimientos={handleVerMovimientos}
            onDeshacer={(id) => {
              void handleDeshacer(id);
            }}
          />
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={20} className="animate-spin text-zinc-600" />
          </div>
        ) : movimientos.length === 0 ? (
          <div className="py-20 text-center">
            <p className="mb-2 text-sm text-zinc-600">No hay movimientos</p>
            <button
              onClick={() => setShowImport(true)}
              className="text-xs font-medium text-blue-400 hover:text-blue-300"
            >
              Importar extracto →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-zinc-900/60">
                  {['Fecha', 'Concepto', 'Categoría', 'Importe', 'Rev.', ''].map((h) => (
                    <th
                      key={h}
                      className={`text-2xs px-4 py-3 font-semibold uppercase tracking-widest text-zinc-500 ${h === 'Importe' ? 'text-right' : h === 'Rev.' ? 'text-center' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {movimientos.map((m) => (
                  <MovRow
                    key={m.id}
                    m={m}
                    isPrivateMode={isPrivateMode}
                    onToggleRevisado={handleToggleRevisado}
                    onChangeCategoria={handleChangeCategoria}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {vista === 'movimientos' && (
        <p className="text-right text-xs text-zinc-600">
          {movimientos.length} movimientos · {movimientos.filter((m) => !m.revisado).length} sin
          revisar
        </p>
      )}

      {showImport && (
        <ImportPanel
          sociedades={sociedades}
          reglas={reglas}
          onClose={() => setShowImport(false)}
          onDone={() => {
            setShowImport(false);
            void fetchMovimientos();
            void fetchExtractos();
          }}
        />
      )}
    </div>
  );
}
