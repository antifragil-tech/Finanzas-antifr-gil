import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Upload,
  Loader2,
  AlertTriangle,
  X,
  FileText,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  CreditCard,
  Plus,
  Bell,
  BellOff,
  Cloud,
} from 'lucide-react';
import {
  getFacturasRecibidas,
  procesarFacturaPdf,
  getConfiguracion,
  deleteFacturaRecibida,
  updateConfiguracion,
} from '../../lib/contabilidadApi';
import { FacturaModal } from '../FacturaModal';
import type {
  FacturaRecibida,
  EstadoFacturaRecibida,
  ConfiguracionContabilidad,
} from '@alsari/types';
import { ESTADO_FACTURA_RECIBIDA_LABEL } from '@alsari/types';

// ── Constantes ────────────────────────────────────────────────────────────────

// Solo estilo/icono por estado; el label visible viene de la fuente única
// ESTADO_FACTURA_RECIBIDA_LABEL en @alsari/types.
const ESTADO_META: Record<
  EstadoFacturaRecibida,
  {
    color: string;
    icon: React.ComponentType<{ size?: number }>;
  }
> = {
  borrador_ocr: {
    color: 'text-amber-300   bg-amber-500/15   border-amber-500/20',
    icon: AlertTriangle,
  },
  revision_javi: { color: 'text-blue-300    bg-blue-500/15    border-blue-500/20', icon: Clock },
  pendiente_pago: {
    color: 'text-violet-300  bg-violet-500/15  border-violet-500/20',
    icon: CreditCard,
  },
  pagada: { color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/20', icon: CheckCircle },
  rechazada: { color: 'text-rose-400     bg-rose-500/15     border-rose-500/20', icon: XCircle },
};

const FILTROS: Array<{ key: EstadoFacturaRecibida | 'todas'; label: string }> = [
  { key: 'todas', label: 'Todas' },
  { key: 'borrador_ocr', label: ESTADO_FACTURA_RECIBIDA_LABEL.borrador_ocr },
  { key: 'revision_javi', label: ESTADO_FACTURA_RECIBIDA_LABEL.revision_javi },
  { key: 'pendiente_pago', label: ESTADO_FACTURA_RECIBIDA_LABEL.pendiente_pago },
  { key: 'pagada', label: ESTADO_FACTURA_RECIBIDA_LABEL.pagada },
  { key: 'rechazada', label: ESTADO_FACTURA_RECIBIDA_LABEL.rechazada },
];

// ── UploadZone ────────────────────────────────────────────────────────────────

type QueueItem = {
  localId: string;
  file: File;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
};

function UploadZone({
  onCreated,
}: {
  // PR D.1: la sociedad la determina el OCR (NIF receptor) en la Edge Function;
  // el componente de subida ya no necesita la lista de sociedades.
  onCreated: (f: FacturaRecibida, file: File) => void;
}) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Procesamiento secuencial: un archivo a la vez
  useEffect(() => {
    const pending = queue.find((i) => i.status === 'pending');
    const processing = queue.some((i) => i.status === 'processing');
    if (!pending || processing) return;

    setQueue((q) =>
      q.map((i) => (i.localId === pending.localId ? { ...i, status: 'processing' } : i)),
    );

    // PR D.1: la sociedad la determina la Edge Function por el NIF receptor del OCR
    // (match único); NUNCA se pasa "la primera" sociedad por defecto.
    procesarFacturaPdf(pending.file, '')
      .then((factura) => {
        onCreated(factura, pending.file);
        setQueue((q) =>
          q.map((i) => (i.localId === pending.localId ? { ...i, status: 'done' } : i)),
        );
      })
      .catch((e) => {
        setQueue((q) =>
          q.map((i) =>
            i.localId === pending.localId
              ? { ...i, status: 'error', error: e instanceof Error ? e.message : 'Error OCR' }
              : i,
          ),
        );
      });
  }, [queue, onCreated]);

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => /\.(pdf|jpg|jpeg|png)$/i.test(f.name));
    if (!arr.length) return;
    setQueue((q) => [
      ...q,
      ...arr.map((file) => ({
        localId: `${Date.now()}-${Math.random()}`,
        file,
        status: 'pending' as const,
      })),
    ]);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const allFinished =
    queue.length > 0 && queue.every((i) => i.status === 'done' || i.status === 'error');
  const hasActive = queue.some((i) => i.status === 'pending' || i.status === 'processing');

  return (
    <div className="space-y-4 rounded-2xl border border-white/5 bg-zinc-900/40 p-5">
      <div className="flex items-center gap-3">
        <p className="text-2xs flex-1 font-semibold uppercase tracking-widest text-zinc-500">
          Subir facturas
        </p>
        {allFinished && (
          <button
            onClick={() => setQueue([])}
            className="text-2xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Limpiar
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        multiple
        onChange={handleFile}
        className="hidden"
      />

      {queue.length === 0 ? (
        // Zona vacía
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed py-8 transition-all ${dragging ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.01]'}`}
        >
          <Upload size={20} className="text-zinc-500" />
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-400">Arrastra los PDFs aquí o haz clic</p>
            <p className="mt-0.5 text-xs text-zinc-600">
              PDF, JPG o PNG · Puedes seleccionar varios a la vez
            </p>
          </div>
        </div>
      ) : (
        // Lista de cola
        <div className="space-y-1.5">
          {queue.map((item) => (
            <div
              key={item.localId}
              className="flex items-center gap-3 rounded-lg bg-zinc-800/50 px-3 py-2"
            >
              <div className="flex w-4 shrink-0 justify-center">
                {item.status === 'pending' && <Clock size={12} className="text-zinc-500" />}
                {item.status === 'processing' && (
                  <Loader2 size={12} className="animate-spin text-blue-400" />
                )}
                {item.status === 'done' && <CheckCircle size={12} className="text-emerald-400" />}
                {item.status === 'error' && <AlertTriangle size={12} className="text-rose-400" />}
              </div>
              <span className="flex-1 truncate text-xs text-zinc-300">{item.file.name}</span>
              <span
                className={`text-2xs shrink-0 ${
                  item.status === 'pending'
                    ? 'text-zinc-600'
                    : item.status === 'processing'
                      ? 'text-blue-400'
                      : item.status === 'done'
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                }`}
              >
                {item.status === 'pending' && 'En cola'}
                {item.status === 'processing' && 'Procesando…'}
                {item.status === 'done' && 'Lista'}
                {item.status === 'error' && (item.error?.slice(0, 35) ?? 'Error')}
              </span>
            </div>
          ))}

          {/* Añadir más mientras hay activos */}
          {hasActive && (
            <button
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-2 text-xs transition-all ${dragging ? 'border-blue-500/50 bg-blue-500/5 text-blue-400' : 'border-white/[0.07] text-zinc-600 hover:border-white/20 hover:text-zinc-400'}`}
            >
              <Plus size={11} />
              Añadir más
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── FacturaRow ────────────────────────────────────────────────────────────────

function FacturaRow({
  factura,
  isSelected,
  isPrivateMode,
  onClick,
  onDelete,
}: {
  factura: FacturaRecibida;
  isSelected: boolean;
  isPrivateMode: boolean;
  onClick: () => void;
  onDelete: (id: string) => void;
}) {
  const meta = ESTADO_META[factura.estado];
  const Icon = meta.icon;
  const fmt = (n: number) =>
    isPrivateMode ? '€ ****' : n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  return (
    <tr
      onClick={onClick}
      className={`group cursor-pointer transition-colors hover:bg-white/[0.02] ${isSelected ? 'bg-white/[0.04]' : ''}`}
    >
      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-400">
        {factura.fecha_factura}
      </td>
      <td className="max-w-[200px] px-4 py-3">
        <p className="truncate text-xs font-medium text-zinc-200">{factura.proveedor_nombre}</p>
        {factura.numero_factura && (
          <p className="text-2xs truncate text-zinc-500">{factura.numero_factura}</p>
        )}
      </td>
      <td className="max-w-[160px] px-4 py-3 text-xs text-zinc-400">
        <p className="truncate">{factura.concepto ?? '—'}</p>
      </td>
      <td className="px-4 py-3 text-right">
        <span
          className={`font-mono text-xs font-medium ${isPrivateMode ? 'text-zinc-500' : 'text-white'}`}
        >
          {fmt(factura.total)}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`text-2xs inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${meta.color}`}
          >
            <Icon size={9} />
            {ESTADO_FACTURA_RECIBIDA_LABEL[factura.estado]}
          </span>
          {factura.es_domiciliada && (
            <span className="text-2xs inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 font-medium text-blue-300">
              <Cloud size={9} />
              {factura.estado === 'pendiente_pago' ? 'Domic. · pend. cargo' : 'Domiciliada'}
            </span>
          )}
        </div>
      </td>
      <td className="w-8 px-4 py-3 text-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm('¿Eliminar esta factura?')) onDelete(factura.id);
          }}
          className="text-zinc-600 opacity-0 transition-all hover:text-rose-400 group-hover:opacity-100"
        >
          <X size={12} />
        </button>
      </td>
    </tr>
  );
}

// ── ConfigPanel ───────────────────────────────────────────────────────────────

function ConfigPanel({
  config,
  onSave,
}: {
  config: ConfiguracionContabilidad;
  onSave: (c: ConfiguracionContabilidad) => void;
}) {
  const [form, setForm] = useState(config);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof ConfiguracionContabilidad) => (v: string) =>
    setForm((f) => ({ ...f, [k]: k === 'umbral_aprobacion_javi' ? parseFloat(v) || 0 : v }));

  const save = async () => {
    setSaving(true);
    try {
      await updateConfiguracion({
        umbral_aprobacion_javi: form.umbral_aprobacion_javi,
        email_guille: form.email_guille,
        email_javi: form.email_javi,
        email_alicia: form.email_alicia,
      });
      onSave(form);
    } catch {
      /* silently */
    }
    setSaving(false);
  };

  const lbl = 'block text-2xs font-medium text-zinc-500 uppercase tracking-widest mb-1';
  const inp =
    'w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors [color-scheme:dark]';

  return (
    <div className="space-y-4 rounded-2xl border border-white/5 bg-zinc-900/40 p-5">
      <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
        Configuración del workflow
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Umbral aprobación Javi (€)</label>
          <input
            type="number"
            value={form.umbral_aprobacion_javi}
            onChange={(e) => set('umbral_aprobacion_javi')(e.target.value)}
            className={inp}
          />
        </div>
        <div />
        <div>
          <label className={lbl}>Email Guille</label>
          <input
            type="email"
            value={form.email_guille}
            onChange={(e) => set('email_guille')(e.target.value)}
            className={inp}
          />
        </div>
        <div>
          <label className={lbl}>Email Javi</label>
          <input
            type="email"
            value={form.email_javi}
            onChange={(e) => set('email_javi')(e.target.value)}
            className={inp}
          />
        </div>
        <div className="col-span-2">
          <label className={lbl}>Email Alicia</label>
          <input
            type="email"
            value={form.email_alicia}
            onChange={(e) => set('email_alicia')(e.target.value)}
            className={inp}
          />
        </div>
      </div>

      {/* Notificaciones — solo informativo. No se envía ningún email todavía. */}
      <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-zinc-500" />
        <span className="text-2xs text-zinc-400">
          Notificaciones:{' '}
          <span className="font-medium text-zinc-300">
            {config.notifications_enabled ? 'activadas' : 'desactivadas'}
          </span>
          <span className="text-zinc-600"> · no se envían emails a Javi/Alicia (fase futura)</span>
        </span>
      </div>
      <button
        onClick={() => {
          void save();
        }}
        disabled={saving}
        className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
        Guardar configuración
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type Props = {
  isPrivateMode: boolean;
  sociedades: { id: string; nombre: string }[];
  reglas: unknown[];
  userEmail: string | null;
};

export function Facturas({ isPrivateMode, sociedades, userEmail }: Props) {
  const [facturas, setFacturas] = useState<FacturaRecibida[]>([]);
  const [config, setConfig] = useState<ConfiguracionContabilidad | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<EstadoFacturaRecibida | 'todas' | 'domiciliadas'>('todas');
  const [selected, setSelected] = useState<FacturaRecibida | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showUpload, setShowUpload] = useState(true);
  // URLs locales de PDFs subidos en esta sesión (factura.id → objectURL)
  const [sessionPdfUrls, setSessionPdfUrls] = useState<Record<string, string>>({});
  // Cola de facturas recién procesadas por OCR pendientes de revisar
  const [reviewQueue, setReviewQueue] = useState<FacturaRecibida[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fs, cfg] = await Promise.allSettled([getFacturasRecibidas(), getConfiguracion()]);
      if (fs.status === 'fulfilled') setFacturas(fs.value);
      if (cfg.status === 'fulfilled') setConfig(cfg.value);
    } catch {
      /* silently */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-avance: cuando el modal se cierra y hay facturas en cola, abre la siguiente
  useEffect(() => {
    if (selected !== null || reviewQueue.length === 0) return;
    const [next, ...rest] = reviewQueue;
    setReviewQueue(rest);
    setSelected(next ?? null);
  }, [selected, reviewQueue]);

  // PR E: "domiciliadas pendientes de cargo" = domiciliada en pendiente_pago.
  const esDomiciliadaPendienteCargo = (f: FacturaRecibida) =>
    f.es_domiciliada && f.estado === 'pendiente_pago';
  const visible =
    filtro === 'todas'
      ? facturas
      : filtro === 'domiciliadas'
        ? facturas.filter(esDomiciliadaPendienteCargo)
        : facturas.filter((f) => f.estado === filtro);

  const counts = (
    ['borrador_ocr', 'revision_javi', 'pendiente_pago'] as EstadoFacturaRecibida[]
  ).reduce<Partial<Record<EstadoFacturaRecibida, number>>>((acc, e) => {
    acc[e] = facturas.filter((f) => f.estado === e).length;
    return acc;
  }, {});
  const domiciliadasPendientes = facturas.filter(esDomiciliadaPendienteCargo).length;

  const handleCreated = useCallback((f: FacturaRecibida, file: File) => {
    // Guardamos ObjectURL del PDF para mostrarlo en el modal sin volver a subirlo
    const objectUrl = URL.createObjectURL(file);
    setSessionPdfUrls((prev) => ({ ...prev, [f.id]: objectUrl }));
    setFacturas((prev) => [f, ...prev]);
    setFiltro('borrador_ocr');
    // Añadir a la cola de revisión; el useEffect auto-abrirá si el modal está cerrado
    setReviewQueue((prev) => [...prev, f]);
  }, []);

  const handleUpdate = (updated: FacturaRecibida) => {
    setFacturas((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    setSelected(updated);
  };

  const handleDelete = async (id: string) => {
    const factura = facturas.find((f) => f.id === id);
    try {
      await deleteFacturaRecibida(id, factura?.presupuesto_pago_id);
      setFacturas((prev) => prev.filter((f) => f.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch {
      /* silently */
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowUpload((v) => !v)}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-all ${showUpload ? 'border-blue-600 bg-blue-600 text-white' : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'}`}
        >
          <Upload size={13} />
          Subir PDF
        </button>

        {/* Badge de cola de revisión */}
        {reviewQueue.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
            <Clock size={12} className="shrink-0 text-amber-400" />
            <span className="text-xs font-medium text-amber-300">
              {reviewQueue.length} en cola para revisar
            </span>
          </div>
        )}
        <button
          onClick={() => setShowConfig((v) => !v)}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${showConfig ? 'border-white/10 bg-white/5 text-zinc-200' : 'border-white/5 text-zinc-500 hover:text-zinc-300'}`}
        >
          Configuración
        </button>

        {/* Indicador de notificaciones (solo lectura). Sin toggle: el flag se
            gestiona en BD. Aclara que no se envían emails a Javi/Alicia. */}
        {config && (
          <div
            title={
              config.notifications_enabled
                ? 'Las notificaciones externas están activas.'
                : 'Modo silencioso: no se envían emails a Javi ni a Alicia. Las tareas solo aparecen dentro de la app. Las notificaciones reales son una fase futura.'
            }
            className={`text-2xs ml-auto inline-flex select-none items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-medium ${
              config.notifications_enabled
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-300/90'
            }`}
          >
            {config.notifications_enabled ? (
              <>
                <Bell size={11} className="shrink-0" />
                Notificaciones activas
              </>
            ) : (
              <>
                <BellOff size={11} className="shrink-0" />
                Modo silencioso · sin emails automáticos
              </>
            )}
          </div>
        )}

        <button
          onClick={() => {
            void load();
          }}
          className={`${config ? '' : 'ml-auto'} text-zinc-600 transition-colors hover:text-zinc-300`}
          title="Recargar"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Upload zone */}
      {showUpload && <UploadZone onCreated={handleCreated} />}

      {/* Config panel */}
      {showConfig && config && (
        <ConfigPanel
          config={config}
          onSave={(c) => {
            setConfig(c);
            setShowConfig(false);
          }}
        />
      )}

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {FILTROS.map(({ key, label }) => {
          const count = key !== 'todas' ? counts[key as EstadoFacturaRecibida] : undefined;
          return (
            <button
              key={key}
              onClick={() => setFiltro(key)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${filtro === key ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300'}`}
            >
              {label}
              {count !== undefined && count > 0 && (
                <span className="text-2xs rounded-full bg-amber-500/20 px-1.5 py-0.5 font-semibold text-amber-300">
                  {count}
                </span>
              )}
            </button>
          );
        })}
        {/* PR E — Domiciliadas pendientes de cargo */}
        <button
          onClick={() => setFiltro('domiciliadas')}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${filtro === 'domiciliadas' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300'}`}
        >
          <Cloud size={12} />
          Domiciliadas
          {domiciliadasPendientes > 0 && (
            <span className="text-2xs rounded-full bg-blue-500/20 px-1.5 py-0.5 font-semibold text-blue-300">
              {domiciliadasPendientes}
            </span>
          )}
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={20} className="animate-spin text-zinc-600" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-zinc-600">
          <FileText size={32} className="opacity-30" />
          <p className="text-sm">
            {filtro === 'todas'
              ? 'No hay facturas. Sube un PDF para empezar.'
              : `Sin facturas en "${ESTADO_FACTURA_RECIBIDA_LABEL[filtro as EstadoFacturaRecibida] ?? filtro}".`}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-zinc-900/60">
                {['Fecha', 'Proveedor', 'Concepto', 'Total', 'Estado', ''].map((h) => (
                  <th
                    key={h}
                    className={`text-2xs px-4 py-3 font-semibold uppercase tracking-widest text-zinc-500 ${h === 'Total' ? 'text-right' : h === '' ? 'w-8 text-center' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {visible.map((f) => (
                <FacturaRow
                  key={f.id}
                  factura={f}
                  isSelected={selected?.id === f.id}
                  isPrivateMode={isPrivateMode}
                  onClick={() => setSelected((prev) => (prev?.id === f.id ? null : f))}
                  onDelete={(id) => {
                    void handleDelete(id);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-right text-xs text-zinc-600">{visible.length} facturas</p>

      {/* ── Modal full-screen (PDF + OCR) ── */}
      {selected && (
        <FacturaModal
          factura={selected}
          config={config}
          userEmail={userEmail}
          isPrivateMode={isPrivateMode}
          sessionPdfUrl={sessionPdfUrls[selected.id]}
          sociedades={sociedades}
          onClose={() => setSelected(null)}
          onUpdate={(updated) => {
            handleUpdate(updated);
            if (updated.estado === 'pagada' || updated.estado === 'rechazada') {
              setTimeout(() => setSelected(null), 1500);
            }
          }}
        />
      )}
    </div>
  );
}
