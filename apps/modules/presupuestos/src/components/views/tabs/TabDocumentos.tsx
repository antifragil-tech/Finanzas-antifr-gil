import { useState, useEffect, useRef } from 'react';
import { FileText, Upload, Trash2, Download, Loader2, AlertTriangle, Paperclip } from 'lucide-react';
import {
  getDocumentos, uploadDocumento, deleteDocumento, getDocumentoUrl,
  CATEGORIA_LABEL, type ProyectoDocumento, type CategoriaDocumento,
} from '../../../lib/documentosApi';

type Props = { proyectoId: string };

const CATEGORIAS: CategoriaDocumento[] = ['estudio_mercado', 'tasacion', 'renta', 'contrato', 'otro'];

const CAT_COLOR: Record<CategoriaDocumento, string> = {
  estudio_mercado: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
  tasacion:        'bg-violet-500/15 text-violet-300 border-violet-500/20',
  renta:           'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  contrato:        'bg-amber-500/15 text-amber-300 border-amber-500/20',
  otro:            'bg-zinc-700/40 text-zinc-300 border-white/10',
};

function fmtTamano(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function TabDocumentos({ proyectoId }: Props) {
  const [docs, setDocs]         = useState<ProyectoDocumento[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const [file, setFile]               = useState<File | null>(null);
  const [categoria, setCategoria]     = useState<CategoriaDocumento>('estudio_mercado');
  const [descripcion, setDescripcion] = useState('');
  const [uploading, setUploading]     = useState(false);
  const [confirmDel, setConfirmDel]   = useState<string | null>(null);
  const [abriendo, setAbriendo]       = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    getDocumentos(proyectoId)
      .then(setDocs)
      .catch(e => setError(e instanceof Error ? e.message : 'Error cargando documentos'))
      .finally(() => setLoading(false));
  }, [proyectoId]);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const nuevo = await uploadDocumento(proyectoId, file, categoria, descripcion);
      setDocs(prev => [nuevo, ...prev]);
      setFile(null);
      setDescripcion('');
      if (inputRef.current) inputRef.current.value = '';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir el documento');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: ProyectoDocumento) {
    setConfirmDel(null);
    try {
      await deleteDocumento(doc);
      setDocs(prev => prev.filter(d => d.id !== doc.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  // Abre el documento firmando una signed URL al clic (bucket privado; el enlace
  // caduca, así que se firma en el momento). Fallback a archivo_url legado.
  async function handleAbrir(doc: ProyectoDocumento) {
    setAbriendo(doc.id);
    setError('');
    try {
      const url = await getDocumentoUrl(doc);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      else setError('No se pudo obtener el enlace del documento.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir el documento.');
    } finally {
      setAbriendo(null);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <p className="text-xs text-zinc-500">
        Adjunta los documentos con los que se calcularon datos del proyecto — estudios de mercado (valor actual, renta),
        tasaciones oficiales, escrituras — para dejar trazable de dónde salió cada cifra.
      </p>

      {/* Zona de subida */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
        <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Adjuntar documento</p>

        <label
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
          className="flex items-center gap-3 border border-dashed border-white/10 rounded-xl px-4 py-3 cursor-pointer hover:border-blue-500/40 hover:bg-blue-500/[0.04] transition-all"
        >
          <Paperclip size={16} className="text-zinc-500 shrink-0" />
          <span className="text-sm text-zinc-400 truncate flex-1">
            {file ? file.name : 'Arrastra un archivo o haz clic para elegirlo (PDF, imagen, Excel, Word…)'}
          </span>
          {file && <span className="text-2xs text-zinc-600 shrink-0">{fmtTamano(file.size)}</span>}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.doc,.docx,.csv,.txt"
            className="hidden"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-widest mb-1">Categoría</label>
            <select
              value={categoria}
              onChange={e => setCategoria(e.target.value as CategoriaDocumento)}
              className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
            >
              {CATEGORIAS.map(c => <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-widest mb-1">Qué dato justifica (opcional)</label>
            <input
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Ej: valor actual 1.000.000 €, renta 8.300 €/mes…"
              className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-rose-400 flex items-start gap-2"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{error}</p>
        )}

        <div className="flex justify-end">
          <button
            onClick={() => void handleUpload()}
            disabled={!file || uploading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-200 text-sm font-medium hover:bg-blue-600/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Subiendo…' : 'Subir documento'}
          </button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm py-6"><Loader2 size={14} className="animate-spin" />Cargando documentos…</div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center py-10 gap-2 text-zinc-600">
          <FileText size={28} className="text-zinc-700" />
          <p className="text-xs font-medium uppercase tracking-widest">Sin documentos adjuntos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition-all">
              <FileText size={18} className="text-zinc-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-zinc-200 truncate">{doc.nombre}</span>
                  <span className={`text-2xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${CAT_COLOR[doc.categoria]}`}>
                    {CATEGORIA_LABEL[doc.categoria]}
                  </span>
                </div>
                <p className="text-2xs text-zinc-600 mt-0.5">
                  {doc.descripcion ? <span className="text-zinc-500">{doc.descripcion} · </span> : null}
                  {fmtFecha(doc.created_at)}{doc.tamano_bytes ? ` · ${fmtTamano(doc.tamano_bytes)}` : ''}
                </p>
              </div>
              <button
                onClick={() => void handleAbrir(doc)}
                disabled={abriendo === doc.id}
                title="Abrir / descargar"
                className="p-1.5 rounded-lg text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors shrink-0 disabled:opacity-50"
              >
                {abriendo === doc.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              </button>
              {confirmDel === doc.id ? (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => void handleDelete(doc)} className="px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-2xs font-semibold hover:bg-rose-500/25 transition-all">Borrar</button>
                  <button onClick={() => setConfirmDel(null)} className="px-2 py-1 rounded-lg text-zinc-500 hover:text-zinc-300 text-2xs font-medium transition-colors">Cancelar</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDel(doc.id)}
                  title="Eliminar documento"
                  className="p-1.5 rounded-lg text-zinc-700 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
