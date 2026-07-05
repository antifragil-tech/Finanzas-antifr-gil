import { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Upload,
  Trash2,
  Download,
  Loader2,
  AlertTriangle,
  Paperclip,
} from 'lucide-react';
import {
  getDocumentos,
  uploadDocumento,
  deleteDocumento,
  getDocumentoUrl,
  CATEGORIA_LABEL,
  type ProyectoDocumento,
  type CategoriaDocumento,
} from '../../../lib/documentosApi';

type Props = { proyectoId: string };

const CATEGORIAS: CategoriaDocumento[] = [
  'estudio_mercado',
  'tasacion',
  'renta',
  'contrato',
  'otro',
];

const CAT_COLOR: Record<CategoriaDocumento, string> = {
  estudio_mercado: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
  tasacion: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
  renta: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  contrato: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  otro: 'bg-zinc-700/40 text-zinc-300 border-white/10',
};

function fmtTamano(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function TabDocumentos({ proyectoId }: Props) {
  const [docs, setDocs] = useState<ProyectoDocumento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [categoria, setCategoria] = useState<CategoriaDocumento>('estudio_mercado');
  const [descripcion, setDescripcion] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    getDocumentos(proyectoId)
      .then(setDocs)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error cargando documentos'))
      .finally(() => setLoading(false));
  }, [proyectoId]);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const nuevo = await uploadDocumento(proyectoId, file, categoria, descripcion);
      setDocs((prev) => [nuevo, ...prev]);
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
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
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
    <div className="animate-fade-in space-y-6">
      <p className="text-xs text-zinc-500">
        Adjunta los documentos con los que se calcularon datos del proyecto — estudios de mercado
        (valor actual, renta), tasaciones oficiales, escrituras — para dejar trazable de dónde salió
        cada cifra.
      </p>

      {/* Zona de subida */}
      <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
          Adjuntar documento
        </p>

        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) setFile(f);
          }}
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/10 px-4 py-3 transition-all hover:border-blue-500/40 hover:bg-blue-500/[0.04]"
        >
          <Paperclip size={16} className="shrink-0 text-zinc-500" />
          <span className="flex-1 truncate text-sm text-zinc-400">
            {file
              ? file.name
              : 'Arrastra un archivo o haz clic para elegirlo (PDF, imagen, Excel, Word…)'}
          </span>
          {file && <span className="text-2xs shrink-0 text-zinc-600">{fmtTamano(file.size)}</span>}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.doc,.docx,.csv,.txt"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="text-2xs mb-1 block font-medium uppercase tracking-widest text-zinc-500">
              Categoría
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaDocumento)}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500/50 focus:outline-none"
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIA_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-2xs mb-1 block font-medium uppercase tracking-widest text-zinc-500">
              Qué dato justifica (opcional)
            </label>
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: valor actual 1.000.000 €, renta 8.300 €/mes…"
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white transition-colors placeholder:text-zinc-600 focus:border-blue-500/50 focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <p className="flex items-start gap-2 text-xs text-rose-400">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <button
            onClick={() => void handleUpload()}
            disabled={!file || uploading}
            className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/20 px-4 py-2 text-sm font-medium text-blue-200 transition-colors hover:bg-blue-600/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Subiendo…' : 'Subir documento'}
          </button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-zinc-500">
          <Loader2 size={14} className="animate-spin" />
          Cargando documentos…
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-zinc-600">
          <FileText size={28} className="text-zinc-700" />
          <p className="text-xs font-medium uppercase tracking-widest">Sin documentos adjuntos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 transition-all hover:border-white/10"
            >
              <FileText size={18} className="shrink-0 text-zinc-500" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-zinc-200">{doc.nombre}</span>
                  <span
                    className={`text-2xs rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wider ${CAT_COLOR[doc.categoria]}`}
                  >
                    {CATEGORIA_LABEL[doc.categoria]}
                  </span>
                </div>
                <p className="text-2xs mt-0.5 text-zinc-600">
                  {doc.descripcion ? (
                    <span className="text-zinc-500">{doc.descripcion} · </span>
                  ) : null}
                  {fmtFecha(doc.created_at)}
                  {doc.tamano_bytes ? ` · ${fmtTamano(doc.tamano_bytes)}` : ''}
                </p>
              </div>
              <button
                onClick={() => void handleAbrir(doc)}
                disabled={abriendo === doc.id}
                title="Abrir / descargar"
                className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-blue-500/10 hover:text-blue-400 disabled:opacity-50"
              >
                {abriendo === doc.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
              </button>
              {confirmDel === doc.id ? (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => void handleDelete(doc)}
                    className="text-2xs rounded-lg border border-rose-500/30 bg-rose-500/15 px-2 py-1 font-semibold text-rose-300 transition-all hover:bg-rose-500/25"
                  >
                    Borrar
                  </button>
                  <button
                    onClick={() => setConfirmDel(null)}
                    className="text-2xs rounded-lg px-2 py-1 font-medium text-zinc-500 transition-colors hover:text-zinc-300"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDel(doc.id)}
                  title="Eliminar documento"
                  className="shrink-0 rounded-lg p-1.5 text-zinc-700 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
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
