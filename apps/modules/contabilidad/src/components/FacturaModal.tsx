import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Upload, FileText, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { FacturaReviewPanel } from './FacturaReviewPanel';
import { getFacturaPdfUrl, resolveFacturaPdfSource } from '../lib/contabilidadApi';
import type { FacturaRecibida, ConfiguracionContabilidad } from '@alsari/types';

type Props = {
  factura: FacturaRecibida;
  config: ConfiguracionContabilidad | null;
  userEmail: string | null;
  isPrivateMode: boolean;
  sessionPdfUrl?: string | undefined;
  sociedades?: { id: string; nombre: string }[] | undefined;
  onClose: () => void;
  onUpdate: (f: FacturaRecibida) => void;
};

export function FacturaModal({
  factura,
  config,
  userEmail,
  isPrivateMode,
  sessionPdfUrl,
  sociedades,
  onClose,
  onUpdate,
}: Props) {
  // localPdfUrl: URL arrastrada manualmente por el usuario (solo si no hay otra)
  const [localPdfUrl, setLocalPdfUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // PDF persistido en BD: bucket privado → signed URL async; o legado → directo.
  const [persistedUrl, setPersistedUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Limpiar ObjectURL manual al desmontar (el sessionPdfUrl lo gestiona el padre)
  useEffect(() => {
    return () => {
      if (localPdfUrl) URL.revokeObjectURL(localPdfUrl);
    };
  }, [localPdfUrl]);

  // Resolver el PDF persistido (firma una URL temporal si está en el bucket privado).
  const pdfStoragePath = factura.storage_path;
  const pdfArchivoUrl = factura.archivo_url;
  const loadPersistedPdf = useCallback(() => {
    const fuente = { storage_path: pdfStoragePath, archivo_url: pdfArchivoUrl };
    if (resolveFacturaPdfSource(fuente).kind === 'none') {
      setPersistedUrl(null);
      setLoadingPdf(false);
      setPdfError(false);
      return;
    }
    let cancelled = false;
    setLoadingPdf(true);
    setPdfError(false);
    getFacturaPdfUrl(fuente)
      .then((u) => {
        if (!cancelled) {
          setPersistedUrl(u);
          setLoadingPdf(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPdfError(true);
          setLoadingPdf(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pdfStoragePath, pdfArchivoUrl]);

  useEffect(() => loadPersistedPdf(), [loadPersistedPdf]);

  const handleFile = useCallback((file: File) => {
    setLocalPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  // Prioridad: PDF persistido en BD (firmado) > PDF de esta sesión > arrastrado a mano
  const hasPersistedPdf = resolveFacturaPdfSource(factura).kind !== 'none';
  const pdfUrl = persistedUrl ?? sessionPdfUrl ?? localPdfUrl;

  return (
    // Overlay full-screen
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
        {/* ── Barra superior ── */}
        <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] bg-zinc-900/80 px-5 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <FileText size={14} className="shrink-0 text-zinc-500" />
            <span className="truncate text-xs font-medium text-zinc-300">
              {factura.numero_factura
                ? `Factura ${factura.numero_factura}`
                : `Factura ${factura.id.slice(0, 8).toUpperCase()}`}
            </span>
            <span className="text-2xs text-zinc-600">·</span>
            <span className="text-2xs truncate text-zinc-500">{factura.proveedor_nombre}</span>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg border border-white/10 p-1.5 text-zinc-500 transition-colors hover:border-white/20 hover:text-white"
            title="Cerrar (Esc)"
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Cuerpo split ── */}
        <div className="flex min-h-0 flex-1">
          {/* ──── Panel izquierdo: visor PDF ──── */}
          <div className="flex min-w-0 flex-1 flex-col border-r border-white/[0.06] bg-zinc-950">
            {loadingPdf ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-zinc-500">
                <Loader2 size={28} className="animate-spin text-zinc-600" />
                <p className="text-xs">Cargando documento…</p>
              </div>
            ) : pdfError ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10">
                  <AlertCircle size={28} className="text-rose-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-300">
                    No se pudo cargar el documento
                  </p>
                  <p className="text-xs text-zinc-500">El enlace temporal no pudo generarse.</p>
                </div>
                <button
                  onClick={loadPersistedPdf}
                  className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-white/20 hover:text-white"
                >
                  <RefreshCw size={12} /> Reintentar
                </button>
              </div>
            ) : pdfUrl ? (
              <iframe
                src={`${pdfUrl}#navpanes=0&toolbar=0&view=FitH`}
                title="Documento original"
                className="h-full w-full border-0"
              />
            ) : (
              /* Zona de drop para ver el PDF localmente */
              <div
                className={`flex flex-1 cursor-pointer select-none flex-col items-center justify-center gap-5 transition-colors ${
                  dragging
                    ? 'm-4 rounded-xl border-2 border-dashed border-blue-500/40 bg-blue-500/5'
                    : 'hover:bg-white/[0.01]'
                }`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
                }}
                onDrop={handleDrop}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleInputChange}
                />

                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-zinc-900">
                  <FileText size={36} className="text-zinc-600" />
                </div>

                <div className="max-w-xs space-y-2 px-4 text-center">
                  <p className="text-sm font-medium text-zinc-300">
                    Arrastra aquí el PDF para verlo
                  </p>
                  <p className="text-xs leading-relaxed text-zinc-500">
                    Muestra el documento original junto al extracto del OCR para validar los datos.
                  </p>
                  <p className="text-2xs text-zinc-700">
                    El archivo no se sube — solo se visualiza localmente.
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-5 py-2.5 text-xs font-medium text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200">
                  <Upload size={12} />
                  Cargar PDF
                </div>
              </div>
            )}

            {/* Barra inferior — solo cuando el PDF no está en BD */}
            {!hasPersistedPdf && pdfUrl && (
              <div className="flex shrink-0 items-center gap-2 border-t border-white/[0.06] bg-zinc-900/60 px-4 py-2">
                <span className="text-2xs flex-1 text-zinc-600">
                  {sessionPdfUrl && !localPdfUrl
                    ? 'PDF de la sesión actual'
                    : 'Vista local — no persistida'}
                </span>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-2xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  Cambiar PDF
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleInputChange}
                />
              </div>
            )}
          </div>

          {/* ──── Panel derecho: FacturaReviewPanel ──── */}
          <div className="flex min-h-0 w-[480px] shrink-0 flex-col overflow-hidden">
            <FacturaReviewPanel
              factura={factura}
              config={config}
              userEmail={userEmail}
              isPrivateMode={isPrivateMode}
              sociedades={sociedades}
              onClose={onClose}
              onUpdate={onUpdate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
