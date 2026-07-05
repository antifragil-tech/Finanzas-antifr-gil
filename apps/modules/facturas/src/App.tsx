/// <reference types="vite/client" />
import { useState, useEffect, useMemo } from 'react';
import { formatCurrency } from '@alsari/utils';
import type { FacturaRecibida, EstadoFacturaRecibida } from '@alsari/types';
import {
  Receipt,
  RefreshCw,
  AlertTriangle,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
  Filter,
  FileText,
  Building2,
  Calendar,
  Link2,
  Unlink,
  Loader2,
  Copy,
} from 'lucide-react';
import {
  getFacturas,
  vincularFacturaAPago,
  desvincularFactura,
  searchPagosParaVincular,
  type PagoParaVincular,
} from './lib/facturasApi';
import { detectarDuplicados, MOTIVO_LABEL, type InfoDuplicado } from './lib/duplicados';

const STATUS_CONFIG: Record<
  EstadoFacturaRecibida,
  {
    label: string;
    badge: string;
    icon: typeof Clock;
  }
> = {
  borrador_ocr: {
    label: 'Validación',
    badge: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
    icon: Clock,
  },
  revision_javi: {
    label: 'Revisión',
    badge: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
    icon: Building2,
  },
  pendiente_pago: {
    label: 'Pend. pago',
    badge: 'bg-violet-500/15 border-violet-500/30 text-violet-400',
    icon: FileText,
  },
  pagada: {
    label: 'Pagada',
    badge: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
    icon: CheckCircle2,
  },
  rechazada: {
    label: 'Rechazada',
    badge: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
    icon: XCircle,
  },
};

const ALL_STATUSES: EstadoFacturaRecibida[] = [
  'borrador_ocr',
  'revision_javi',
  'pendiente_pago',
  'pagada',
  'rechazada',
];

function StatusBadge({ status }: { status: EstadoFacturaRecibida }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`text-2xs inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-semibold uppercase tracking-widest ${cfg.badge}`}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ── Modal vincular factura a pago de presupuesto ──────────────────────────────

function ModalVincular({
  factura,
  duplicado,
  onVincular,
  onClose,
}: {
  factura: FacturaRecibida;
  duplicado: InfoDuplicado | undefined;
  onVincular: (pagoId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [pagos, setPagos] = useState<PagoParaVincular[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    searchPagosParaVincular()
      .then(setPagos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return pagos;
    return pagos.filter(
      (p) =>
        p.presupuesto_nombre.toLowerCase().includes(q) ||
        (p.proyecto_nombre?.toLowerCase().includes(q) ?? false) ||
        (p.descripcion?.toLowerCase().includes(q) ?? false),
    );
  }, [pagos, query]);

  async function handleSelect(pagoId: string) {
    setSaving(true);
    await onVincular(pagoId).catch(() => {});
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-6 py-4">
          <Link2 size={16} className="text-blue-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Vincular a pago de presupuesto</p>
            <p className="text-xs text-zinc-500">
              {factura.proveedor_nombre} · {formatCurrency(factura.total_a_pagar)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 transition-colors hover:text-white"
          >
            <XCircle size={16} />
          </button>
        </div>

        {duplicado && (
          <div
            className={`flex items-start gap-2.5 border-b px-5 py-3 text-xs ${
              duplicado.algunaVinculada
                ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
            }`}
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              {duplicado.algunaVinculada ? (
                <>
                  <span className="font-semibold">
                    Posible duplicado YA imputado a un presupuesto.
                  </span>{' '}
                  Comprueba antes de vincular: imputarías el mismo gasto dos veces.
                </>
              ) : (
                <>
                  Esta factura tiene{' '}
                  {duplicado.otras.length === 1
                    ? 'un posible duplicado'
                    : `${duplicado.otras.length} posibles duplicados`}{' '}
                  ({MOTIVO_LABEL[duplicado.motivo]}).
                </>
              )}
            </span>
          </div>
        )}

        <div className="border-b border-white/[0.04] px-4 py-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar presupuesto o proyecto..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-white/[0.06] bg-zinc-800/60 py-2.5 pl-9 pr-4 text-sm text-zinc-200 transition-all placeholder:text-zinc-600 focus:border-blue-500/40 focus:outline-none"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-blue-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-600">
              Sin pagos pendientes sin factura asignada
            </div>
          ) : (
            filtered.map((pago) => (
              <button
                key={pago.id}
                disabled={saving || pago.factura_recibida_id !== null}
                onClick={() => void handleSelect(pago.id)}
                className={`flex w-full items-center gap-3 border-b border-white/[0.04] px-5 py-3.5 text-left transition-colors last:border-0 ${pago.factura_recibida_id ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-white/[0.03]'}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-200">
                    {pago.presupuesto_nombre}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {pago.descripcion ?? 'Sin descripción'} · {fmtDate(pago.fecha_prevista)}
                    {pago.proyecto_nombre ? ` · ${pago.proyecto_nombre}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-white">{formatCurrency(pago.importe)}</p>
                  {pago.factura_recibida_id && (
                    <p className="text-2xs text-zinc-600">ya vinculado</p>
                  )}
                </div>
                {saving ? (
                  <Loader2 size={14} className="shrink-0 animate-spin text-blue-400" />
                ) : (
                  <ChevronRight size={14} className="shrink-0 text-zinc-600" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function FacturasApp() {
  const [facturas, setFacturas] = useState<FacturaRecibida[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EstadoFacturaRecibida | 'all'>('all');
  const [selected, setSelected] = useState<FacturaRecibida | null>(null);
  const [modalVincular, setModalVincular] = useState<FacturaRecibida | null>(null);

  const fetchFacturas = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getFacturas();
      setFacturas(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchFacturas();
  }, []);

  const filtered = useMemo(
    () =>
      facturas.filter((f) => {
        const matchSearch =
          !search ||
          f.proveedor_nombre.toLowerCase().includes(search.toLowerCase()) ||
          (f.numero_factura?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
          (f.concepto?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
          (f.proyecto_id_ref?.toLowerCase().includes(search.toLowerCase()) ?? false);
        const matchStatus = statusFilter === 'all' || f.estado === statusFilter;
        return matchSearch && matchStatus;
      }),
    [facturas, search, statusFilter],
  );

  const summary = useMemo(
    () => ({
      total: facturas.length,
      pendientes: facturas.filter((f) =>
        ['borrador_ocr', 'revision_javi', 'pendiente_pago'].includes(f.estado),
      ).length,
      pagadas: facturas.filter((f) => f.estado === 'pagada').length,
      totalPendiente: facturas
        .filter((f) => ['borrador_ocr', 'revision_javi', 'pendiente_pago'].includes(f.estado))
        .reduce((s, f) => s + f.total_a_pagar, 0),
      vinculadas: facturas.filter((f) => f.presupuesto_pago_id !== null).length,
    }),
    [facturas],
  );

  const duplicados = useMemo(() => detectarDuplicados(facturas), [facturas]);

  async function handleVincular(facturaId: string, pagoId: string) {
    await vincularFacturaAPago(facturaId, pagoId);
    setFacturas((prev) =>
      prev.map((f) => (f.id === facturaId ? { ...f, presupuesto_pago_id: pagoId } : f)),
    );
    setSelected((prev) =>
      prev?.id === facturaId ? { ...prev, presupuesto_pago_id: pagoId } : prev,
    );
    setModalVincular(null);
  }

  async function handleDesvincular(factura: FacturaRecibida) {
    if (!factura.presupuesto_pago_id) return;
    await desvincularFactura(factura.id, factura.presupuesto_pago_id);
    setFacturas((prev) =>
      prev.map((f) => (f.id === factura.id ? { ...f, presupuesto_pago_id: null } : f)),
    );
    setSelected((prev) =>
      prev?.id === factura.id ? { ...prev, presupuesto_pago_id: null } : prev,
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <RefreshCw size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-8">
        <div className="space-y-4 text-center">
          <AlertTriangle size={48} className="mx-auto text-rose-500" />
          <p className="text-xl font-semibold text-white">Error de conexión</p>
          <p className="text-sm text-zinc-500">No se pudo cargar la lista de facturas.</p>
          <button
            onClick={() => {
              void fetchFacturas();
            }}
            className="mx-auto flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-medium text-white transition-all hover:bg-blue-700"
          >
            <RefreshCw size={16} /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {modalVincular && (
        <ModalVincular
          factura={modalVincular}
          duplicado={duplicados.get(modalVincular.id)}
          onVincular={(pagoId) => handleVincular(modalVincular.id, pagoId)}
          onClose={() => setModalVincular(null)}
        />
      )}

      <header className="sticky top-0 z-40 border-b border-white/5 bg-zinc-950/80 px-8 py-5 backdrop-blur-xl">
        <div className="text-2xs mb-1 flex items-center gap-2 font-medium uppercase tracking-widest text-zinc-500">
          <span>ANTIFRÁGIL</span>
          <ChevronRight size={10} />
          <span className="text-blue-400">Facturas</span>
        </div>
        <h1 className="flex items-center gap-3 text-3xl font-light tracking-tighter text-white">
          <Receipt size={24} className="text-blue-500" />
          Control de Facturas
        </h1>
      </header>

      <main className="space-y-8 px-8 py-8">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            {
              label: 'Total Facturas',
              value: String(summary.total),
              sub: 'en el sistema',
              color: 'text-white',
            },
            {
              label: 'Pendientes',
              value: String(summary.pendientes),
              sub: formatCurrency(summary.totalPendiente),
              color: 'text-amber-400',
            },
            {
              label: 'Pagadas',
              value: String(summary.pagadas),
              sub: 'completadas',
              color: 'text-emerald-400',
            },
            {
              label: 'Vinculadas a presupuesto',
              value: String(summary.vinculadas),
              sub: 'de ' + String(summary.total),
              color: 'text-blue-400',
            },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="glass-panel rounded-2xl p-5">
              <p className="text-2xs mb-2 font-semibold uppercase tracking-widest text-zinc-500">
                {label}
              </p>
              <p className={`text-xl font-semibold ${color}`}>{value}</p>
              <p className="mt-1 text-xs text-zinc-600">{sub}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por proveedor, concepto, proyecto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-zinc-900/60 py-3 pl-12 pr-4 text-sm font-medium text-zinc-200 transition-all placeholder:text-zinc-600 focus:border-blue-500/40 focus:outline-none"
            />
          </div>
          <div className="relative">
            <Filter
              size={14}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as EstadoFacturaRecibida | 'all')}
              className="cursor-pointer appearance-none rounded-2xl border border-white/10 bg-zinc-900/60 py-3 pl-9 pr-8 text-sm font-medium text-zinc-200 transition-all focus:border-blue-500/40 focus:outline-none"
            >
              <option value="all">Todos los estados</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_CONFIG[s].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Aviso de duplicados */}
        {duplicados.size > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3.5 text-amber-300">
            <Copy size={15} className="mt-0.5 shrink-0" />
            <p className="text-xs leading-snug">
              <span className="font-semibold uppercase tracking-widest">
                {duplicados.size} posibles facturas duplicadas.
              </span>{' '}
              Revísalas antes de imputarlas a presupuesto — están marcadas en la lista. Si una es un
              duplicado real, márcala como rechazada y dejará de avisar.
            </p>
          </div>
        )}

        {/* Invoice list */}
        {facturas.length === 0 ? (
          <div className="glass-panel rounded-2xl p-16 text-center">
            <Receipt size={48} className="mx-auto mb-4 text-zinc-700" />
            <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
              Sin facturas registradas
            </p>
            <p className="mt-2 text-xs text-zinc-700">
              Las facturas recibidas aparecerán aquí tras importarlas en Contabilidad.
            </p>
          </div>
        ) : (
          <div className="glass-panel overflow-hidden rounded-2xl border border-white/5">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    {[
                      'Fecha',
                      'Proveedor',
                      'Nº Factura',
                      'Proyecto',
                      'Total a pagar',
                      'Estado',
                      'Presupuesto',
                      '',
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-2xs whitespace-nowrap px-5 py-4 font-semibold uppercase tracking-widest text-zinc-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center font-medium text-zinc-600">
                        No se encontraron facturas con estos filtros
                      </td>
                    </tr>
                  ) : (
                    filtered.map((f) => (
                      <tr
                        key={f.id}
                        onClick={() => setSelected(f === selected ? null : f)}
                        className={`group cursor-pointer transition-colors ${selected?.id === f.id ? 'bg-blue-500/5' : 'hover:bg-white/[0.02]'}`}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 text-sm text-zinc-400">
                            <Calendar size={12} className="text-zinc-600" />
                            {fmtDate(f.fecha_factura)}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white transition-colors group-hover:text-blue-400">
                              {f.proveedor_nombre}
                            </span>
                            {duplicados.has(f.id) && (
                              <span
                                title={`Posible duplicado: ${MOTIVO_LABEL[duplicados.get(f.id)!.motivo]}`}
                                className={`text-2xs inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-semibold uppercase tracking-widest ${
                                  duplicados.get(f.id)!.algunaVinculada
                                    ? 'border-rose-500/30 bg-rose-500/15 text-rose-400'
                                    : 'border-amber-500/30 bg-amber-500/15 text-amber-400'
                                }`}
                              >
                                <Copy size={9} /> Duplicada
                              </span>
                            )}
                          </div>
                          {f.concepto && (
                            <p className="max-w-[200px] truncate text-xs text-zinc-600">
                              {f.concepto}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-zinc-500">
                          {f.numero_factura ?? '—'}
                        </td>
                        <td className="px-5 py-4 text-xs text-zinc-500">
                          {f.proyecto_id_ref ?? '—'}
                        </td>
                        <td className="px-5 py-4 font-mono text-sm font-semibold text-white">
                          {formatCurrency(f.total_a_pagar)}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={f.estado} />
                        </td>
                        <td className="px-5 py-4">
                          {f.presupuesto_pago_id ? (
                            <span className="text-2xs inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 font-medium text-blue-400">
                              <Link2 size={9} /> Vinculada
                            </span>
                          ) : (
                            <span className="text-2xs text-zinc-700">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <ChevronRight
                            size={16}
                            className={`transition-colors ${selected?.id === f.id ? 'rotate-90 text-blue-400' : 'text-zinc-700 group-hover:text-zinc-400'}`}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detail drawer */}
        {selected && (
          <div className="glass-panel space-y-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-2xs mb-1 font-semibold uppercase tracking-widest text-zinc-500">
                  Detalle Factura
                </p>
                <h3 className="text-lg font-semibold text-white">{selected.proveedor_nombre}</h3>
                {selected.proveedor_nif && (
                  <p className="font-mono text-xs text-zinc-500">{selected.proveedor_nif}</p>
                )}
                {selected.concepto && (
                  <p className="mt-0.5 text-sm text-zinc-400">{selected.concepto}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xs mb-0.5 uppercase tracking-widest text-zinc-600">
                  Total a pagar
                </p>
                <p className="text-2xl font-semibold text-white">
                  {formatCurrency(selected.total_a_pagar)}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Base {formatCurrency(selected.base_imponible)} + IVA {selected.tipo_iva}%
                </p>
                {selected.retencion_pct > 0 && (
                  <p className="text-xs text-amber-400">
                    − Retención {selected.retencion_pct}% ={' '}
                    {formatCurrency(selected.retencion_importe)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={selected.estado} />
              {selected.numero_factura && (
                <span className="font-mono text-xs text-zinc-600">
                  Nº {selected.numero_factura}
                </span>
              )}
              <span className="text-xs text-zinc-600">
                <Calendar size={11} className="mr-1 inline" />
                {fmtDate(selected.fecha_factura)}
              </span>
              {selected.fecha_vencimiento && (
                <span className="text-xs text-zinc-600">
                  Vence: {fmtDate(selected.fecha_vencimiento)}
                </span>
              )}
              {selected.archivo_url && (
                <a
                  href={selected.archivo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-400 transition-colors hover:text-blue-300"
                >
                  <FileText size={12} /> Ver documento
                </a>
              )}
            </div>

            {/* Posibles duplicados */}
            {duplicados.has(selected.id) &&
              (() => {
                const dup = duplicados.get(selected.id)!;
                return (
                  <div
                    className={`rounded-xl border p-4 ${dup.algunaVinculada ? 'border-rose-500/25 bg-rose-500/5' : 'border-amber-500/25 bg-amber-500/5'}`}
                  >
                    <p
                      className={`text-2xs mb-3 flex items-center gap-2 font-semibold uppercase tracking-widest ${dup.algunaVinculada ? 'text-rose-400' : 'text-amber-400'}`}
                    >
                      <Copy size={11} />
                      {dup.otras.length === 1
                        ? 'Posible duplicado'
                        : `${dup.otras.length} posibles duplicados`}{' '}
                      · {MOTIVO_LABEL[dup.motivo]}
                    </p>
                    <div className="space-y-2">
                      {dup.otras.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => setSelected(o)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 text-left transition-all hover:border-white/15"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm text-zinc-200">
                              {o.proveedor_nombre}
                              {o.numero_factura && (
                                <span className="ml-2 font-mono text-xs text-zinc-500">
                                  Nº {o.numero_factura}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {fmtDate(o.fecha_factura)} · {STATUS_CONFIG[o.estado].label}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-medium text-white">
                              {formatCurrency(o.total_a_pagar)}
                            </p>
                            {o.presupuesto_pago_id && (
                              <p className="text-2xs font-semibold uppercase tracking-wider text-rose-400">
                                Ya imputada
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                    {dup.algunaVinculada && (
                      <p className="mt-3 text-xs leading-snug text-rose-300/80">
                        Una de estas facturas ya está imputada a un presupuesto. Si esta es un
                        duplicado real, márcala como rechazada para no contar el gasto dos veces.
                      </p>
                    )}
                  </div>
                );
              })()}

            {/* Vinculación a presupuesto */}
            <div className="border-t border-white/[0.06] pt-3">
              <p className="text-2xs mb-2 font-semibold uppercase tracking-widest text-zinc-500">
                Vinculación a presupuesto
              </p>
              {selected.presupuesto_pago_id ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2">
                    <Link2 size={13} className="text-blue-400" />
                    <span className="text-sm font-medium text-blue-300">
                      Vinculada a pago de presupuesto
                    </span>
                  </div>
                  <button
                    onClick={() => void handleDesvincular(selected)}
                    className="flex items-center gap-1.5 rounded-xl border border-transparent px-3 py-2 text-xs font-medium text-zinc-500 transition-all hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    <Unlink size={12} /> Desvincular
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setModalVincular(selected)}
                  className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/20 px-4 py-2.5 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-600/30"
                >
                  <Link2 size={14} /> Asignar a pago de presupuesto
                </button>
              )}
            </div>

            {selected.notas && (
              <div className="rounded-xl border border-white/[0.04] bg-zinc-800/40 p-3">
                <p className="text-2xs mb-1 font-semibold uppercase tracking-widest text-zinc-500">
                  Notas
                </p>
                <p className="text-sm text-zinc-400">{selected.notas}</p>
              </div>
            )}
          </div>
        )}

        <div className="text-2xs pt-4 text-center font-mono text-zinc-700">
          Mostrando {filtered.length} de {facturas.length} facturas
        </div>
      </main>
    </div>
  );
}
