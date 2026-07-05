import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Save,
  X,
  Calendar,
  Pencil,
  Link2,
  Unlink,
  Search,
  Loader2,
  Star,
} from 'lucide-react';
import type {
  Presupuesto,
  PresupuestoCapitulo,
  PresupuestoPartida,
  PresupuestoPago,
  PresupuestoEstado,
} from '@alsari/types';
import {
  getPresupuesto,
  getCapitulos,
  getPartidas,
  getPagos,
  createCapitulo,
  createPartida,
  createPago,
  updatePresupuesto,
  updatePartida,
  updatePago,
  deleteCapitulo,
  deletePartida,
  deletePago,
  marcarPresupuestoMaestro,
} from '../../lib/presupuestosApi';
import {
  searchFacturasParaVincular,
  vincularPagoAFactura,
  desvincularPago,
  getFacturasMini,
  type FacturaParaVincular,
  type FacturaMini,
} from '../../lib/facturasLink';

function fmt(n: number, priv: boolean) {
  if (priv) return '•••• €';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtEur(n: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

// ── Modal vincular pago a factura recibida (Option A) ─────────────────────────

function ModalVincularFactura({
  pago,
  onVincular,
  onClose,
}: {
  pago: PresupuestoPago;
  onVincular: (facturaId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [facturas, setFacturas] = useState<FacturaParaVincular[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    searchFacturasParaVincular()
      .then(setFacturas)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return facturas;
    return facturas.filter(
      (f) =>
        f.proveedor_nombre.toLowerCase().includes(q) ||
        (f.numero_factura?.toLowerCase().includes(q) ?? false) ||
        (f.concepto?.toLowerCase().includes(q) ?? false),
    );
  }, [facturas, query]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-6 py-4">
          <Link2 size={16} className="text-blue-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Vincular factura recibida</p>
            <p className="text-xs text-zinc-500">
              Pago {pago.descripcion ?? 'sin descripción'} · {fmtEur(pago.importe)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 transition-colors hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="border-b border-white/[0.04] px-4 py-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por proveedor, Nº factura, concepto..."
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
              Sin facturas recibidas disponibles sin pago asignado
            </div>
          ) : (
            filtered.map((f) => (
              <button
                key={f.id}
                disabled={f.presupuesto_pago_id !== null}
                onClick={() => onVincular(f.id)}
                className={`flex w-full items-center gap-3 border-b border-white/[0.04] px-5 py-3.5 text-left transition-colors last:border-0 ${f.presupuesto_pago_id ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-white/[0.03]'}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-200">
                    {f.proveedor_nombre}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {f.numero_factura ? `Nº ${f.numero_factura} · ` : ''}
                    {f.fecha_factura}
                    {f.concepto ? ` · ${f.concepto}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-white">{fmtEur(f.total_a_pagar)}</p>
                  {f.presupuesto_pago_id && <p className="text-2xs text-zinc-600">ya vinculada</p>}
                </div>
                {!f.presupuesto_pago_id && (
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

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const ESTADO_STYLES: Record<PresupuestoEstado, string> = {
  borrador: 'bg-zinc-800 text-zinc-400',
  activo: 'bg-emerald-500/10 text-emerald-400',
  cerrado: 'bg-zinc-900 text-zinc-600',
};

const ESTADO_NEXT: Partial<Record<PresupuestoEstado, { to: PresupuestoEstado; label: string }>> = {
  borrador: { to: 'activo', label: 'Activar' },
  activo: { to: 'cerrado', label: 'Cerrar' },
};

type Props = {
  presupuestoId: string;
  isPrivateMode: boolean;
  onBack?: () => void;
};

type PartidaConPagos = PresupuestoPartida & { pagos: PresupuestoPago[] };
type CapituloConPartidas = PresupuestoCapitulo & { partidas: PartidaConPagos[] };

export function DetallePresupuesto({ presupuestoId, isPrivateMode, onBack }: Props) {
  const [presupuesto, setPresupuesto] = useState<Presupuesto | null>(null);
  const [capitulos, setCapitulos] = useState<CapituloConPartidas[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCaps, setExpandedCaps] = useState<Set<string>>(new Set());

  // Formularios inline
  const [newCapNombre, setNewCapNombre] = useState('');
  const [addingCap, setAddingCap] = useState(false);
  const [addingPartida, setAddingPartida] = useState<string | null>(null);
  const [newPartDesc, setNewPartDesc] = useState('');
  const [newPartImporte, setNewPartImporte] = useState('');
  const [newPartIva, setNewPartIva] = useState<0 | 4 | 10 | 21>(0);
  const [newPartProv, setNewPartProv] = useState('');
  const [newPartRecurrencia, setNewPartRecurrencia] = useState<
    'mensual' | 'trimestral' | 'semestral' | 'anual' | ''
  >('');
  const [newPartFechaInicio, setNewPartFechaInicio] = useState('');
  const [newPartFechaFin, setNewPartFechaFin] = useState('');
  const [addingPago, setAddingPago] = useState<string | null>(null); // partida_id
  const [newPagoDesc, setNewPagoDesc] = useState('');
  const [newPagoImporte, setNewPagoImporte] = useState('');
  const [newPagoFecha, setNewPagoFecha] = useState('');
  const [newPagoTipo, setNewPagoTipo] = useState<'gasto' | 'ingreso'>('gasto');
  const [newPagoIva, setNewPagoIva] = useState<0 | 4 | 10 | 21>(0);
  const [editingPartida, setEditingPartida] = useState<string | null>(null);
  const [editPartDesc, setEditPartDesc] = useState('');
  const [editPartImporte, setEditPartImporte] = useState('');
  const [editPartIva, setEditPartIva] = useState<0 | 4 | 10 | 21>(0);
  const [editPartProv, setEditPartProv] = useState('');
  const [editingPago, setEditingPago] = useState<string | null>(null); // pago_id
  const [editPagoDesc, setEditPagoDesc] = useState('');
  const [editPagoImporte, setEditPagoImporte] = useState('');
  const [editPagoIva, setEditPagoIva] = useState<0 | 4 | 10 | 21>(0);
  const [editPagoFecha, setEditPagoFecha] = useState('');
  const [editPagoTipo, setEditPagoTipo] = useState<'gasto' | 'ingreso'>('gasto');
  const [saving, setSaving] = useState(false);
  const [maestroError, setMaestroError] = useState('');
  const [editingNombre, setEditingNombre] = useState(false);
  const [nombreDraft, setNombreDraft] = useState('');
  const [modalVincularPago, setModalVincularPago] = useState<PresupuestoPago | null>(null);
  const [facturasMap, setFacturasMap] = useState<Map<string, FacturaMini>>(new Map());

  async function loadAll() {
    setLoading(true);
    try {
      const [p, caps, parts, allPagos] = await Promise.all([
        getPresupuesto(presupuestoId),
        getCapitulos(presupuestoId),
        getPartidas(presupuestoId),
        getPagos(presupuestoId),
      ]);
      setPresupuesto(p);
      const built: CapituloConPartidas[] = caps.map((c) => ({
        ...c,
        partidas: parts
          .filter((pp) => pp.capitulo_id === c.id)
          .map((pp) => ({ ...pp, pagos: allPagos.filter((pg) => pg.partida_id === pp.id) })),
      }));
      setCapitulos(built);
      setExpandedCaps(new Set(caps.map((c) => c.id)));
      // Cargar mini-fichas de facturas vinculadas
      const facturaIds = allPagos
        .map((pg) => pg.factura_recibida_id)
        .filter((id): id is string => id !== null);
      if (facturaIds.length > 0) {
        getFacturasMini(facturaIds)
          .then(setFacturasMap)
          .catch(() => {});
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presupuestoId]);

  // ── Estado presupuesto ────────────────────────────────────────────────────

  async function handleEstado(to: PresupuestoEstado) {
    if (!presupuesto) return;
    await updatePresupuesto(presupuestoId, { estado: to }).catch(() => {});
    setPresupuesto({ ...presupuesto, estado: to });
  }

  // ── Edición inline del nombre ─────────────────────────────────────────────

  function handleStartNombre() {
    if (!presupuesto) return;
    setNombreDraft(presupuesto.nombre);
    setEditingNombre(true);
  }

  async function handleSaveNombre() {
    if (!presupuesto || !nombreDraft.trim()) {
      setEditingNombre(false);
      return;
    }
    const nuevo = nombreDraft.trim();
    if (nuevo === presupuesto.nombre) {
      setEditingNombre(false);
      return;
    }
    await updatePresupuesto(presupuestoId, { nombre: nuevo }).catch(() => {});
    setPresupuesto({ ...presupuesto, nombre: nuevo });
    setEditingNombre(false);
  }

  // ── Presupuesto maestro ───────────────────────────────────────────────────

  async function handleMarcarMaestro() {
    if (!presupuesto || !presupuesto.proyecto_id_ref) return;
    const esMaestroActual = presupuesto.es_presupuesto_maestro;
    if (!esMaestroActual) {
      const ok = window.confirm(
        '¿Marcar este presupuesto como maestro del proyecto?\n\nSi ya existe otro presupuesto maestro, se reemplazará por este.',
      );
      if (!ok) return;
    }
    setMaestroError('');
    try {
      await marcarPresupuestoMaestro(presupuesto.proyecto_id_ref, presupuestoId);
      setPresupuesto({ ...presupuesto, es_presupuesto_maestro: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('42703') || msg.includes('es_presupuesto_maestro')) {
        setMaestroError(
          'Falta aplicar la migración de presupuesto maestro en Supabase (20260531000001).',
        );
      } else {
        setMaestroError('No se pudo marcar el presupuesto maestro: ' + msg.slice(0, 120));
      }
    }
  }

  // ── Capítulos ─────────────────────────────────────────────────────────────

  async function handleAddCapitulo() {
    if (!newCapNombre.trim()) return;
    setSaving(true);
    const orden = capitulos.length;
    const cap = await createCapitulo({
      presupuesto_id: presupuestoId,
      nombre: newCapNombre.trim(),
      orden,
    }).catch(() => null);
    if (cap) {
      setCapitulos((prev) => [...prev, { ...cap, partidas: [] }]);
      setExpandedCaps((prev) => new Set([...prev, cap.id]));
    }
    setNewCapNombre('');
    setAddingCap(false);
    setSaving(false);
  }

  async function handleDeleteCapitulo(id: string) {
    if (!confirm('¿Eliminar capítulo y todas sus partidas?')) return;
    await deleteCapitulo(id).catch(() => {});
    setCapitulos((prev) => prev.filter((c) => c.id !== id));
  }

  // ── Partidas ──────────────────────────────────────────────────────────────

  async function handleAddPartida(capituloId: string) {
    if (!newPartDesc.trim() || !newPartImporte) return;
    // Validar recurrencia: si se activa, necesita ambas fechas
    if (newPartRecurrencia && (!newPartFechaInicio || !newPartFechaFin)) return;
    setSaving(true);
    const p = await createPartida({
      presupuesto_id: presupuestoId,
      capitulo_id: capituloId,
      descripcion: newPartDesc.trim(),
      importe_presupuestado: parseFloat(newPartImporte.replace(',', '.')),
      tipo_iva: newPartIva,
      ...(newPartProv.trim() && { proveedor_esperado: newPartProv.trim() }),
      ...(newPartRecurrencia && { recurrencia: newPartRecurrencia }),
      ...(newPartFechaInicio && { fecha_inicio_recurrencia: newPartFechaInicio }),
      ...(newPartFechaFin && { fecha_fin_recurrencia: newPartFechaFin }),
      tipo_flujo_recurrencia: presupuesto?.categoria === 'ingreso' ? 'ingreso' : 'gasto',
    }).catch(() => null);
    if (p) {
      setCapitulos((prev) =>
        prev.map((c) =>
          c.id === capituloId ? { ...c, partidas: [...c.partidas, { ...p, pagos: [] }] } : c,
        ),
      );
    }
    setNewPartDesc('');
    setNewPartImporte('');
    setNewPartIva(0);
    setNewPartProv('');
    setNewPartRecurrencia('');
    setNewPartFechaInicio('');
    setNewPartFechaFin('');
    setAddingPartida(null);
    setSaving(false);
  }

  function startEditPartida(partida: PresupuestoPartida) {
    setEditingPartida(partida.id);
    setEditPartDesc(partida.descripcion);
    setEditPartImporte(String(partida.importe_presupuestado));
    setEditPartIva((Number(partida.tipo_iva) as 0 | 4 | 10 | 21) || 0);
    setEditPartProv(partida.proveedor_esperado ?? '');
    setAddingPago(null);
  }

  async function handleSavePartida(capituloId: string, partidaId: string) {
    if (!editPartDesc.trim() || !editPartImporte) return;
    setSaving(true);
    await updatePartida(partidaId, {
      descripcion: editPartDesc.trim(),
      importe_presupuestado: parseFloat(editPartImporte.replace(',', '.')),
      tipo_iva: editPartIva,
      proveedor_esperado: editPartProv.trim() || null,
    }).catch(() => {});
    setCapitulos((prev) =>
      prev.map((c) =>
        c.id === capituloId
          ? ({
              ...c,
              partidas: c.partidas.map((p) =>
                p.id === partidaId
                  ? {
                      ...p,
                      descripcion: editPartDesc.trim(),
                      importe_presupuestado: parseFloat(editPartImporte.replace(',', '.')),
                      tipo_iva: editPartIva,
                      proveedor_esperado: editPartProv.trim() || null,
                    }
                  : p,
              ),
            } as CapituloConPartidas)
          : c,
      ),
    );
    setEditingPartida(null);
    setSaving(false);
  }

  async function handleDeletePartida(capituloId: string, partidaId: string) {
    if (!confirm('¿Eliminar esta partida y sus pagos?')) return;
    await deletePartida(partidaId).catch(() => {});
    setCapitulos((prev) =>
      prev.map((c) =>
        c.id === capituloId
          ? ({
              ...c,
              partidas: c.partidas.filter((p) => p.id !== partidaId),
            } as CapituloConPartidas)
          : c,
      ),
    );
  }

  // ── Pagos ─────────────────────────────────────────────────────────────────

  async function handleAddPago(capituloId: string, partidaId: string) {
    if (!newPagoImporte || !newPagoFecha) return;
    setSaving(true);
    const pg = await createPago({
      presupuesto_id: presupuestoId,
      partida_id: partidaId,
      importe: parseFloat(newPagoImporte.replace(',', '.')),
      tipo_iva: newPagoIva,
      fecha_prevista: newPagoFecha,
      tipo_flujo: newPagoTipo,
      ...(newPagoDesc.trim() && { descripcion: newPagoDesc.trim() }),
    }).catch(() => null);
    if (pg) {
      setCapitulos((prev) =>
        prev.map((c) =>
          c.id === capituloId
            ? ({
                ...c,
                partidas: c.partidas.map((p) =>
                  p.id === partidaId ? { ...p, pagos: [...(p.pagos ?? []), pg] } : p,
                ),
              } as CapituloConPartidas)
            : c,
        ),
      );
    }
    setNewPagoDesc('');
    setNewPagoImporte('');
    setNewPagoFecha('');
    setNewPagoTipo('gasto');
    setNewPagoIva(0);
    setAddingPago(null);
    setSaving(false);
  }

  async function handleTogglePago(capituloId: string, partidaId: string, pago: PresupuestoPago) {
    const next = pago.estado === 'pagado' ? 'pendiente' : 'pagado';
    await updatePago(pago.id, { estado: next }).catch(() => {});
    setCapitulos((prev) =>
      prev.map((c) =>
        c.id === capituloId
          ? ({
              ...c,
              partidas: c.partidas.map((p) =>
                p.id === partidaId
                  ? {
                      ...p,
                      pagos: (p.pagos ?? []).map((pg) =>
                        pg.id === pago.id ? { ...pg, estado: next } : pg,
                      ),
                    }
                  : p,
              ),
            } as CapituloConPartidas)
          : c,
      ),
    );
  }

  function startEditPago(pago: PresupuestoPago) {
    setEditingPago(pago.id);
    setEditPagoDesc(pago.descripcion ?? '');
    setEditPagoImporte(String(pago.importe));
    setEditPagoIva((Number(pago.tipo_iva) as 0 | 4 | 10 | 21) || 0);
    setEditPagoFecha(pago.fecha_prevista);
    setEditPagoTipo(pago.tipo_flujo);
    setAddingPago(null);
  }

  async function handleSavePago(capituloId: string, partidaId: string, pagoId: string) {
    if (!editPagoImporte || !editPagoFecha) return;
    setSaving(true);
    const updates = {
      importe: parseFloat(editPagoImporte.replace(',', '.')),
      tipo_iva: editPagoIva,
      fecha_prevista: editPagoFecha,
      tipo_flujo: editPagoTipo,
      descripcion: editPagoDesc.trim() || null,
    };
    await updatePago(pagoId, updates).catch(() => {});
    setCapitulos((prev) =>
      prev.map((c) =>
        c.id === capituloId
          ? ({
              ...c,
              partidas: c.partidas.map((p) =>
                p.id === partidaId
                  ? {
                      ...p,
                      pagos: (p.pagos ?? []).map((pg) =>
                        pg.id === pagoId ? { ...pg, ...updates } : pg,
                      ),
                    }
                  : p,
              ),
            } as CapituloConPartidas)
          : c,
      ),
    );
    setEditingPago(null);
    setSaving(false);
  }

  async function handleDeletePago(capituloId: string, partidaId: string, pagoId: string) {
    await deletePago(pagoId).catch(() => {});
    setCapitulos((prev) =>
      prev.map((c) =>
        c.id === capituloId
          ? ({
              ...c,
              partidas: c.partidas.map((p) =>
                p.id === partidaId
                  ? { ...p, pagos: (p.pagos ?? []).filter((pg) => pg.id !== pagoId) }
                  : p,
              ),
            } as CapituloConPartidas)
          : c,
      ),
    );
  }

  // ── Vincular factura (Option A) ───────────────────────────────────────────

  async function handleVincularPago(pagoId: string, facturaId: string) {
    await vincularPagoAFactura(pagoId, facturaId).catch(() => {});
    setCapitulos((prev) =>
      prev.map((c) => ({
        ...c,
        partidas: c.partidas.map((p) => ({
          ...p,
          pagos: (p.pagos ?? []).map((pg) =>
            pg.id === pagoId ? { ...pg, factura_recibida_id: facturaId } : pg,
          ),
        })),
      })),
    );
    // Cargar mini-ficha de la nueva factura vinculada
    getFacturasMini([facturaId])
      .then((mini) => {
        setFacturasMap((prev) => new Map([...prev, ...mini]));
      })
      .catch(() => {});
    setModalVincularPago(null);
  }

  async function handleDesvincularPago(pagoId: string) {
    await desvincularPago(pagoId).catch(() => {});
    setCapitulos((prev) =>
      prev.map((c) => ({
        ...c,
        partidas: c.partidas.map((p) => ({
          ...p,
          pagos: (p.pagos ?? []).map((pg) =>
            pg.id === pagoId ? { ...pg, factura_recibida_id: null } : pg,
          ),
        })),
      })),
    );
  }

  // ── Totales globales ──────────────────────────────────────────────────────

  // Gasto REAL de un pago, en base imponible (comparable con las partidas):
  // 1) si tiene factura vinculada → la base imponible de la factura (el dato real)
  // 2) si está pagado sin factura → el importe del pago (real manual)
  // 3) pendiente sin factura → 0 (aún no incurrido)
  const realDePago = (pg: {
    tipo_flujo: string;
    estado: string;
    importe: number;
    factura_recibida_id: string | null;
  }): number => {
    if (pg.tipo_flujo !== 'gasto') return 0;
    if (pg.factura_recibida_id) {
      const f = facturasMap.get(pg.factura_recibida_id);
      if (f) return f.base_imponible ?? f.total_a_pagar;
    }
    return pg.estado === 'pagado' ? pg.importe : 0;
  };

  const allPartidas = capitulos.flatMap((c) => c.partidas);
  const allPagos = allPartidas.flatMap((p) => p.pagos ?? []);
  const totalPresupuestado = allPartidas.reduce((s, p) => s + p.importe_presupuestado, 0);
  const totalPagado = allPagos
    .filter((pg) => pg.estado === 'pagado' && pg.tipo_flujo === 'gasto')
    .reduce((s, pg) => s + pg.importe, 0);
  const totalReal = allPagos.reduce((s, pg) => s + realDePago(pg), 0);
  const desvGlobal = totalReal - totalPresupuestado;
  const pctGlobal = totalPresupuestado > 0 ? Math.round((totalReal / totalPresupuestado) * 100) : 0;

  if (loading || !presupuesto) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-zinc-600">Cargando...</div>
    );
  }

  const siguienteEstado = ESTADO_NEXT[presupuesto.estado];

  return (
    <div className="animate-fade-in space-y-6">
      {modalVincularPago && (
        <ModalVincularFactura
          pago={modalVincularPago}
          onVincular={(facturaId) => void handleVincularPago(modalVincularPago.id, facturaId)}
          onClose={() => setModalVincularPago(null)}
        />
      )}

      {/* Cabecera */}
      <div className="flex items-start gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="mt-1 shrink-0 rounded-lg p-1.5 text-zinc-500 transition-all hover:bg-zinc-800 hover:text-white"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {editingNombre ? (
              <input
                autoFocus
                className="w-full max-w-md border-b border-blue-500 bg-transparent text-xl font-semibold text-white outline-none"
                value={nombreDraft}
                onChange={(e) => setNombreDraft(e.target.value)}
                onBlur={() => void handleSaveNombre()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSaveNombre();
                  }
                  if (e.key === 'Escape') setEditingNombre(false);
                }}
              />
            ) : (
              <button
                onClick={handleStartNombre}
                className="group flex items-center gap-2 text-left text-xl font-semibold text-white transition-colors hover:text-zinc-300"
                title="Haz clic para editar el nombre"
              >
                {presupuesto.nombre}
                <Pencil
                  size={13}
                  className="shrink-0 text-zinc-700 transition-colors group-hover:text-zinc-500"
                />
              </button>
            )}
            <span
              className={`text-2xs rounded-full px-2 py-0.5 font-semibold uppercase tracking-widest ${ESTADO_STYLES[presupuesto.estado]}`}
            >
              {presupuesto.estado}
            </span>
            {presupuesto.es_presupuesto_maestro && (
              <span className="text-2xs flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-semibold uppercase tracking-widest text-amber-400">
                <Star size={9} className="fill-current" /> Maestro
              </span>
            )}
          </div>
          {presupuesto.proyecto_nombre && (
            <p className="mt-0.5 text-sm text-zinc-500">{presupuesto.proyecto_nombre}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {presupuesto.proyecto_id_ref && (
            <button
              onClick={() => void handleMarcarMaestro()}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                presupuesto.es_presupuesto_maestro
                  ? 'cursor-default border-amber-500/30 bg-amber-500/10 text-amber-400'
                  : 'border-white/10 text-zinc-400 hover:border-amber-500/30 hover:text-amber-400'
              }`}
              title={
                presupuesto.es_presupuesto_maestro
                  ? 'Presupuesto maestro activo'
                  : 'Marcar como presupuesto maestro'
              }
            >
              <Star
                size={11}
                className={presupuesto.es_presupuesto_maestro ? 'fill-current' : ''}
              />
              {presupuesto.es_presupuesto_maestro ? 'Maestro' : 'Marcar maestro'}
            </button>
          )}
          {siguienteEstado && (
            <button
              onClick={() => void handleEstado(siguienteEstado.to)}
              className="rounded-xl border border-emerald-500/30 bg-emerald-600/20 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-600/30"
            >
              {siguienteEstado.label}
            </button>
          )}
        </div>
      </div>

      {/* Error presupuesto maestro */}
      {maestroError && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-400">
          <span className="mt-0.5 shrink-0">⚠</span>
          <span>{maestroError}</span>
        </div>
      )}

      {/* Resumen global: presupuesto (estimación) vs real (facturas) vs caja (pagado) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-4">
          <p className="text-2xs mb-1 font-semibold uppercase tracking-widest text-zinc-500">
            Presupuestado
          </p>
          <p className="text-xl font-light tracking-tight text-white">
            {fmt(totalPresupuestado, isPrivateMode)}
          </p>
          <p className="text-2xs mt-1 text-zinc-600">Estimación previa (base imp.)</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-4">
          <p className="text-2xs mb-1 font-semibold uppercase tracking-widest text-zinc-500">
            Gasto real
          </p>
          <p className="text-xl font-light tracking-tight text-blue-300">
            {fmt(totalReal, isPrivateMode)}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full ${pctGlobal > 100 ? 'bg-rose-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(100, pctGlobal)}%` }}
            />
          </div>
          <p className="text-2xs mt-1 text-zinc-600">
            {pctGlobal}% del presupuesto · facturas + pagos
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-4">
          <p className="text-2xs mb-1 font-semibold uppercase tracking-widest text-zinc-500">
            Pagado
          </p>
          <p className="text-xl font-light tracking-tight text-emerald-400">
            {fmt(totalPagado, isPrivateMode)}
          </p>
          <p className="text-2xs mt-1 text-zinc-600">Salida de caja confirmada</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-4">
          <p className="text-2xs mb-1 font-semibold uppercase tracking-widest text-zinc-500">
            Desviación
          </p>
          <p
            className={`text-xl font-light tracking-tight ${totalReal === 0 ? 'text-zinc-600' : desvGlobal > 0 ? 'text-rose-400' : 'text-emerald-400'}`}
          >
            {totalReal === 0
              ? '—'
              : `${desvGlobal > 0 ? '+' : ''}${fmt(desvGlobal, isPrivateMode)}`}
          </p>
          <p className="text-2xs mt-1 text-zinc-600">
            {totalReal === 0
              ? 'Sin gasto real aún'
              : desvGlobal > 0
                ? 'Por encima del presupuesto'
                : 'Dentro del presupuesto'}
          </p>
        </div>
      </div>

      {/* Capítulos y partidas */}
      <div className="space-y-3">
        {capitulos.map((cap) => {
          const capTotal = cap.partidas.reduce((s, p) => s + p.importe_presupuestado, 0);
          const capReal = cap.partidas
            .flatMap((p) => p.pagos ?? [])
            .reduce((s, pg) => s + realDePago(pg), 0);
          const capDesv = capReal - capTotal;
          const capPct = capTotal > 0 ? Math.round((capReal / capTotal) * 100) : 0;
          const expanded = expandedCaps.has(cap.id);

          return (
            <div key={cap.id} className="overflow-hidden rounded-2xl border border-white/[0.06]">
              {/* Cabecera capítulo */}
              <div
                className="flex cursor-pointer items-center gap-3 bg-zinc-900/60 px-5 py-3.5 transition-colors hover:bg-zinc-900/80"
                onClick={() =>
                  setExpandedCaps((prev) => {
                    const next = new Set(prev);
                    if (expanded) {
                      next.delete(cap.id);
                    } else {
                      next.add(cap.id);
                    }
                    return next;
                  })
                }
              >
                {expanded ? (
                  <ChevronDown size={14} className="shrink-0 text-zinc-500" />
                ) : (
                  <ChevronRight size={14} className="shrink-0 text-zinc-500" />
                )}
                <span className="flex-1 text-sm font-medium text-white">{cap.nombre}</span>
                <span className="text-xs text-zinc-500">
                  Real <span className="text-blue-300">{fmt(capReal, isPrivateMode)}</span>
                  {' / '}
                  {fmt(capTotal, isPrivateMode)} · {capPct}%
                </span>
                {capReal > 0 && capDesv !== 0 && (
                  <span
                    className={`text-2xs rounded-full px-2 py-0.5 font-medium ${capDesv > 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}
                  >
                    {capDesv > 0 ? '+' : ''}
                    {fmt(capDesv, isPrivateMode)}
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDeleteCapitulo(cap.id);
                  }}
                  className="ml-2 rounded p-1 text-zinc-700 transition-colors hover:text-rose-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {expanded && (
                <div className="divide-y divide-white/[0.04]">
                  {/* Partidas */}
                  {cap.partidas.map((partida) => {
                    const pagosPagados = (partida.pagos ?? []).filter(
                      (pg) => pg.estado === 'pagado' && pg.tipo_flujo === 'gasto',
                    );
                    const pagado = pagosPagados.reduce((s, pg) => s + pg.importe, 0);
                    const real = (partida.pagos ?? []).reduce((s, pg) => s + realDePago(pg), 0);
                    const desv = real - partida.importe_presupuestado;

                    return (
                      <div key={partida.id} className="bg-zinc-950/20 px-5 py-4">
                        {/* Modo edición */}
                        {editingPartida === partida.id ? (
                          <div className="space-y-2 rounded-xl border border-blue-500/20 bg-zinc-900/80 p-3">
                            <div className="flex flex-wrap items-end gap-2">
                              <div>
                                <label className="field-label">Descripción</label>
                                <input
                                  className="field-input w-52"
                                  value={editPartDesc}
                                  onChange={(e) => setEditPartDesc(e.target.value)}
                                  autoFocus
                                />
                              </div>
                              <div>
                                <label className="field-label">Base imponible €</label>
                                <input
                                  className="field-input w-36"
                                  type="number"
                                  value={editPartImporte}
                                  onChange={(e) => setEditPartImporte(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="field-label">IVA</label>
                                <select
                                  className="field-input w-24"
                                  value={editPartIva}
                                  onChange={(e) =>
                                    setEditPartIva(Number(e.target.value) as 0 | 4 | 10 | 21)
                                  }
                                >
                                  <option value={0}>Sin IVA</option>
                                  <option value={4}>4%</option>
                                  <option value={10}>10%</option>
                                  <option value={21}>21%</option>
                                </select>
                              </div>
                              <div>
                                <label className="field-label">Proveedor esperado</label>
                                <input
                                  className="field-input w-40"
                                  placeholder="Opcional"
                                  value={editPartProv}
                                  onChange={(e) => setEditPartProv(e.target.value)}
                                />
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => void handleSavePartida(cap.id, partida.id)}
                                  disabled={saving}
                                  className="rounded-lg border border-blue-500/30 bg-blue-600/20 px-3 py-2 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-600/30"
                                >
                                  <Save size={12} />
                                </button>
                                <button
                                  onClick={() => setEditingPartida(null)}
                                  className="rounded-lg px-3 py-2 text-zinc-500 hover:text-white"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                            {editPartImporte && editPartIva > 0 && (
                              <div className="flex items-center gap-3 rounded border border-amber-500/15 bg-amber-500/5 px-3 py-1.5">
                                <span className="text-2xs text-zinc-500">Base:</span>
                                <span className="text-xs font-medium text-zinc-300">
                                  {fmt(parseFloat(editPartImporte || '0'), false)}
                                </span>
                                <span className="text-2xs text-zinc-500">IVA {editPartIva}%:</span>
                                <span className="text-xs font-medium text-amber-400">
                                  {fmt(
                                    (parseFloat(editPartImporte || '0') * editPartIva) / 100,
                                    false,
                                  )}
                                </span>
                                <span className="text-2xs text-zinc-500">Total:</span>
                                <span className="text-sm font-semibold text-white">
                                  {fmt(
                                    parseFloat(editPartImporte || '0') * (1 + editPartIva / 100),
                                    false,
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Modo vista */
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-zinc-200">
                                  {partida.descripcion}
                                </p>
                                {partida.proveedor_esperado && (
                                  <span className="text-2xs rounded-full bg-zinc-800/50 px-2 py-0.5 text-zinc-600">
                                    {partida.proveedor_esperado}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-4 text-xs text-zinc-500">
                                <span>
                                  Base {fmt(partida.importe_presupuestado, isPrivateMode)}
                                </span>
                                {Number(partida.tipo_iva) > 0 && (
                                  <span className="text-amber-400/80">
                                    +IVA {partida.tipo_iva}% ={' '}
                                    {fmt(
                                      partida.importe_presupuestado *
                                        (1 + Number(partida.tipo_iva) / 100),
                                      isPrivateMode,
                                    )}
                                  </span>
                                )}
                                {real > 0 && (
                                  <span className="text-blue-300">
                                    Real {fmt(real, isPrivateMode)}
                                  </span>
                                )}
                                <span className="text-emerald-400">
                                  Pagado {fmt(pagado, isPrivateMode)}
                                </span>
                                {real > 0 && desv !== 0 && (
                                  <span
                                    className={desv > 0 ? 'text-rose-400' : 'text-emerald-400'}
                                    title="Desviación: gasto real menos presupuestado"
                                  >
                                    {desv > 0 ? '+' : ''}
                                    {fmt(desv, isPrivateMode)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                onClick={() => startEditPartida(partida)}
                                className="rounded p-1.5 text-zinc-700 transition-colors hover:text-blue-400"
                                title="Editar partida"
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                onClick={() => {
                                  setAddingPago(partida.id);
                                  setNewPagoDesc('');
                                  setNewPagoImporte('');
                                  setNewPagoFecha('');
                                  setNewPagoIva((Number(partida.tipo_iva) as 0 | 4 | 10 | 21) || 0);
                                }}
                                className="flex items-center gap-1 rounded-lg border border-transparent px-2.5 py-1 text-xs font-medium text-zinc-500 transition-all hover:border-blue-500/20 hover:bg-blue-500/10 hover:text-blue-400"
                              >
                                <Calendar size={11} /> Pago
                              </button>
                              <button
                                onClick={() => void handleDeletePartida(cap.id, partida.id)}
                                className="rounded p-1 text-zinc-700 transition-colors hover:text-rose-400"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Pagos */}
                        {(partida.pagos ?? []).length > 0 && (
                          <div className="ml-3 mt-3 space-y-1.5">
                            {(partida.pagos ?? []).map((pago) => (
                              <div key={pago.id}>
                                {editingPago === pago.id ? (
                                  /* Modo edición pago */
                                  <div className="space-y-2 rounded-lg border border-blue-500/20 bg-zinc-900/80 p-3">
                                    <div className="flex flex-wrap items-end gap-2">
                                      <div>
                                        <label className="field-label">Descripción</label>
                                        <input
                                          className="field-input w-36"
                                          placeholder="Ej. Certificación 1"
                                          value={editPagoDesc}
                                          onChange={(e) => setEditPagoDesc(e.target.value)}
                                          autoFocus
                                        />
                                      </div>
                                      <div>
                                        <label className="field-label">Base €</label>
                                        <input
                                          className="field-input w-24"
                                          type="number"
                                          value={editPagoImporte}
                                          onChange={(e) => setEditPagoImporte(e.target.value)}
                                        />
                                      </div>
                                      <div>
                                        <label className="field-label">IVA</label>
                                        <select
                                          className="field-input w-20"
                                          value={editPagoIva}
                                          onChange={(e) =>
                                            setEditPagoIva(
                                              Number(e.target.value) as 0 | 4 | 10 | 21,
                                            )
                                          }
                                        >
                                          <option value={0}>Sin IVA</option>
                                          <option value={4}>4%</option>
                                          <option value={10}>10%</option>
                                          <option value={21}>21%</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="field-label">Fecha</label>
                                        <input
                                          className="field-input w-32"
                                          type="date"
                                          value={editPagoFecha}
                                          onChange={(e) => setEditPagoFecha(e.target.value)}
                                        />
                                      </div>
                                      <div>
                                        <label className="field-label">Tipo</label>
                                        <select
                                          className="field-input w-24"
                                          value={editPagoTipo}
                                          onChange={(e) =>
                                            setEditPagoTipo(e.target.value as 'gasto' | 'ingreso')
                                          }
                                        >
                                          <option value="gasto">Gasto</option>
                                          <option value="ingreso">Ingreso</option>
                                        </select>
                                      </div>
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() =>
                                            void handleSavePago(cap.id, partida.id, pago.id)
                                          }
                                          disabled={saving}
                                          className="rounded-lg border border-blue-500/30 bg-blue-600/20 px-3 py-2 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-600/30"
                                        >
                                          <Save size={12} />
                                        </button>
                                        <button
                                          onClick={() => setEditingPago(null)}
                                          className="rounded-lg px-3 py-2 text-zinc-500 hover:text-white"
                                        >
                                          <X size={12} />
                                        </button>
                                      </div>
                                    </div>
                                    {editPagoImporte && editPagoIva > 0 && (
                                      <div className="flex items-center gap-3 rounded border border-amber-500/15 bg-amber-500/5 px-3 py-1.5">
                                        <span className="text-2xs text-zinc-500">Base:</span>
                                        <span className="text-xs font-medium text-zinc-300">
                                          {fmt(parseFloat(editPagoImporte || '0'), false)}
                                        </span>
                                        <span className="text-2xs text-zinc-500">
                                          IVA {editPagoIva}%:
                                        </span>
                                        <span className="text-xs font-medium text-amber-400">
                                          {fmt(
                                            (parseFloat(editPagoImporte || '0') * editPagoIva) /
                                              100,
                                            false,
                                          )}
                                        </span>
                                        <span className="text-2xs text-zinc-500">Total caja:</span>
                                        <span className="text-sm font-semibold text-white">
                                          {fmt(
                                            parseFloat(editPagoImporte || '0') *
                                              (1 + editPagoIva / 100),
                                            false,
                                          )}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  /* Modo vista pago */
                                  <div
                                    className={`group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${pago.factura_recibida_id ? 'border border-blue-500/10 bg-blue-500/5' : 'bg-zinc-900/60'}`}
                                  >
                                    <button
                                      onClick={() =>
                                        void handleTogglePago(cap.id, partida.id, pago)
                                      }
                                      className={`shrink-0 transition-colors ${pago.estado === 'pagado' ? 'text-emerald-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                                    >
                                      <CheckCircle2 size={14} />
                                    </button>
                                    <div className="min-w-0 flex-1">
                                      <span
                                        className={`text-xs ${pago.estado === 'pagado' ? 'text-zinc-600 line-through' : 'text-zinc-300'}`}
                                      >
                                        {pago.descripcion ?? 'Pago'}
                                      </span>
                                      <span className="text-2xs ml-2 text-zinc-600">
                                        {fmtDate(pago.fecha_prevista)}
                                      </span>
                                      {pago.factura_recibida_id &&
                                        (() => {
                                          const f = facturasMap.get(pago.factura_recibida_id);
                                          return f ? (
                                            <span className="text-2xs ml-2 inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 font-medium text-blue-400/80">
                                              <Link2 size={8} />
                                              {f.proveedor_nombre}
                                              {f.numero_factura ? ` · ${f.numero_factura}` : ''}
                                              {' · '}
                                              {fmt(f.total_a_pagar, false)}
                                            </span>
                                          ) : (
                                            <span className="text-2xs ml-2 inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-1.5 py-0.5 font-medium text-blue-400/70">
                                              <Link2 size={8} /> factura
                                            </span>
                                          );
                                        })()}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                      {Number(pago.tipo_iva) > 0 && (
                                        <span className="text-2xs text-zinc-500">
                                          {fmt(pago.importe, isPrivateMode)} + IVA {pago.tipo_iva}%
                                        </span>
                                      )}
                                      {Number(pago.tipo_iva) > 0 && (
                                        <span className="text-2xs bg-amber-500/8 rounded border border-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-400/80">
                                          Total{' '}
                                          {fmt(
                                            pago.importe * (1 + Number(pago.tipo_iva) / 100),
                                            isPrivateMode,
                                          )}
                                        </span>
                                      )}
                                      <span
                                        className={`text-xs font-medium ${pago.tipo_flujo === 'ingreso' ? 'text-emerald-400' : 'text-white'}`}
                                      >
                                        {pago.tipo_flujo === 'ingreso' ? '+' : ''}
                                        {fmt(
                                          Number(pago.tipo_iva) > 0
                                            ? pago.importe * (1 + Number(pago.tipo_iva) / 100)
                                            : pago.importe,
                                          isPrivateMode,
                                        )}
                                      </span>
                                    </div>
                                    {pago.factura_recibida_id ? (
                                      <button
                                        onClick={() => void handleDesvincularPago(pago.id)}
                                        title="Desvincular factura"
                                        className="p-1 text-blue-500/60 opacity-0 transition-all hover:text-rose-400 group-hover:opacity-100"
                                      >
                                        <Unlink size={10} />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => setModalVincularPago(pago)}
                                        title="Vincular factura"
                                        className="p-1 text-zinc-600 opacity-0 transition-all hover:text-blue-400 group-hover:opacity-100"
                                      >
                                        <Link2 size={10} />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => startEditPago(pago)}
                                      className="p-1 text-zinc-600 opacity-0 transition-all hover:text-blue-400 group-hover:opacity-100"
                                    >
                                      <Pencil size={11} />
                                    </button>
                                    <button
                                      onClick={() =>
                                        void handleDeletePago(cap.id, partida.id, pago.id)
                                      }
                                      className="text-zinc-600 opacity-0 transition-all hover:text-rose-400 group-hover:opacity-100"
                                    >
                                      <X size={11} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Formulario nuevo pago */}
                        {addingPago === partida.id && (
                          <div className="ml-3 mt-3 space-y-3 rounded-xl border border-white/[0.06] bg-zinc-900/80 p-3">
                            <div className="flex flex-wrap items-end gap-2">
                              <div>
                                <label className="field-label">Descripción</label>
                                <input
                                  className="field-input w-40"
                                  placeholder="Ej. Certificación 1"
                                  value={newPagoDesc}
                                  onChange={(e) => setNewPagoDesc(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="field-label">Base imponible €</label>
                                <input
                                  className="field-input w-28"
                                  type="number"
                                  placeholder="0"
                                  value={newPagoImporte}
                                  onChange={(e) => setNewPagoImporte(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="field-label">IVA</label>
                                <select
                                  className="field-input w-24"
                                  value={newPagoIva}
                                  onChange={(e) =>
                                    setNewPagoIva(Number(e.target.value) as 0 | 4 | 10 | 21)
                                  }
                                >
                                  <option value={0}>Sin IVA</option>
                                  <option value={4}>4%</option>
                                  <option value={10}>10%</option>
                                  <option value={21}>21%</option>
                                </select>
                              </div>
                              <div>
                                <label className="field-label">Fecha</label>
                                <input
                                  className="field-input w-36"
                                  type="date"
                                  value={newPagoFecha}
                                  onChange={(e) => setNewPagoFecha(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="field-label">Tipo</label>
                                <select
                                  className="field-input w-28"
                                  value={newPagoTipo}
                                  onChange={(e) =>
                                    setNewPagoTipo(e.target.value as 'gasto' | 'ingreso')
                                  }
                                >
                                  <option value="gasto">Gasto</option>
                                  <option value="ingreso">Ingreso</option>
                                </select>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => void handleAddPago(cap.id, partida.id)}
                                  disabled={saving}
                                  className="rounded-lg border border-blue-500/30 bg-blue-600/20 px-3 py-2 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-600/30"
                                >
                                  <Save size={12} />
                                </button>
                                <button
                                  onClick={() => setAddingPago(null)}
                                  className="rounded-lg px-3 py-2 text-xs text-zinc-500 hover:text-white"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                            {/* Preview total con IVA */}
                            {newPagoImporte && newPagoIva > 0 && (
                              <div className="flex items-center gap-3 rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2">
                                <span className="text-2xs text-zinc-500">Base:</span>
                                <span className="text-xs font-medium text-zinc-300">
                                  {fmt(parseFloat(newPagoImporte || '0'), false)}
                                </span>
                                <span className="text-2xs text-zinc-500">IVA {newPagoIva}%:</span>
                                <span className="text-xs font-medium text-amber-400">
                                  {fmt(
                                    (parseFloat(newPagoImporte || '0') * newPagoIva) / 100,
                                    false,
                                  )}
                                </span>
                                <span className="text-2xs text-zinc-500">Total caja:</span>
                                <span className="text-sm font-semibold text-white">
                                  {fmt(
                                    parseFloat(newPagoImporte || '0') * (1 + newPagoIva / 100),
                                    false,
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Formulario nueva partida */}
                  {addingPartida === cap.id ? (
                    <div className="space-y-3 bg-zinc-950/30 px-5 py-4">
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <label className="field-label">Descripción</label>
                          <input
                            className="field-input w-52"
                            placeholder="Ej. Alquiler oficina"
                            value={newPartDesc}
                            onChange={(e) => setNewPartDesc(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="field-label">Importe total €</label>
                          <input
                            className="field-input w-36"
                            type="number"
                            placeholder="0"
                            value={newPartImporte}
                            onChange={(e) => setNewPartImporte(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="field-label">IVA</label>
                          <select
                            className="field-input w-24"
                            value={newPartIva}
                            onChange={(e) =>
                              setNewPartIva(Number(e.target.value) as 0 | 4 | 10 | 21)
                            }
                          >
                            <option value={0}>Sin IVA</option>
                            <option value={4}>4%</option>
                            <option value={10}>10%</option>
                            <option value={21}>21%</option>
                          </select>
                        </div>
                        <div>
                          <label className="field-label">Proveedor esperado</label>
                          <input
                            className="field-input w-40"
                            placeholder="Opcional"
                            value={newPartProv}
                            onChange={(e) => setNewPartProv(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => void handleAddPartida(cap.id)}
                            disabled={
                              saving ||
                              (!!newPartRecurrencia && (!newPartFechaInicio || !newPartFechaFin))
                            }
                            className="rounded-lg border border-emerald-500/30 bg-emerald-600/20 px-3 py-2 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Save size={12} />
                          </button>
                          <button
                            onClick={() => {
                              setAddingPartida(null);
                              setNewPartRecurrencia('');
                              setNewPartFechaInicio('');
                              setNewPartFechaFin('');
                            }}
                            className="rounded-lg px-3 py-2 text-zinc-500 hover:text-white"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Recurrencia */}
                      <div className="flex flex-wrap items-end gap-2 border-t border-white/[0.04] pt-1">
                        <div>
                          <label className="field-label">Pago recurrente</label>
                          <select
                            className="field-input w-36"
                            value={newPartRecurrencia}
                            onChange={(e) =>
                              setNewPartRecurrencia(e.target.value as typeof newPartRecurrencia)
                            }
                          >
                            <option value="">Pago único</option>
                            <option value="mensual">Mensual</option>
                            <option value="trimestral">Trimestral</option>
                            <option value="semestral">Semestral</option>
                            <option value="anual">Anual</option>
                          </select>
                        </div>
                        {newPartRecurrencia && (
                          <>
                            <div>
                              <label className="field-label">Primer pago</label>
                              <input
                                className="field-input w-36"
                                type="date"
                                value={newPartFechaInicio}
                                onChange={(e) => setNewPartFechaInicio(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="field-label">Último pago</label>
                              <input
                                className="field-input w-36"
                                type="date"
                                value={newPartFechaFin}
                                onChange={(e) => setNewPartFechaFin(e.target.value)}
                              />
                            </div>
                            {newPartImporte &&
                              newPartFechaInicio &&
                              newPartFechaFin &&
                              (() => {
                                const meses =
                                  { mensual: 1, trimestral: 3, semestral: 6, anual: 12 }[
                                    newPartRecurrencia
                                  ] ?? 1;
                                const d1 = new Date(newPartFechaInicio);
                                const d2 = new Date(newPartFechaFin);
                                const nPagos = Math.max(
                                  1,
                                  Math.round(
                                    ((d2.getFullYear() - d1.getFullYear()) * 12 +
                                      d2.getMonth() -
                                      d1.getMonth()) /
                                      meses,
                                  ) + 1,
                                );
                                const porPago = (parseFloat(newPartImporte) / nPagos).toFixed(2);
                                return (
                                  <div className="flex items-center gap-2 rounded border border-violet-500/15 bg-violet-500/5 px-3 py-1.5 text-xs">
                                    <span className="text-zinc-500">Se generarán</span>
                                    <span className="font-medium text-violet-300">
                                      {nPagos} pagos
                                    </span>
                                    <span className="text-zinc-500">de</span>
                                    <span className="font-medium text-violet-300">
                                      {fmtEur(parseFloat(porPago))}
                                    </span>
                                  </div>
                                );
                              })()}
                          </>
                        )}
                      </div>
                      {newPartImporte && newPartIva > 0 && (
                        <div className="flex items-center gap-3 rounded border border-amber-500/15 bg-amber-500/5 px-3 py-1.5">
                          <span className="text-2xs text-zinc-500">Base:</span>
                          <span className="text-xs font-medium text-zinc-300">
                            {fmt(parseFloat(newPartImporte || '0'), false)}
                          </span>
                          <span className="text-2xs text-zinc-500">IVA {newPartIva}%:</span>
                          <span className="text-xs font-medium text-amber-400">
                            {fmt((parseFloat(newPartImporte || '0') * newPartIva) / 100, false)}
                          </span>
                          <span className="text-2xs text-zinc-500">Total presupuesto con IVA:</span>
                          <span className="text-sm font-semibold text-white">
                            {fmt(parseFloat(newPartImporte || '0') * (1 + newPartIva / 100), false)}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-zinc-950/30 px-5 py-2.5">
                      <button
                        onClick={() => {
                          setAddingPartida(cap.id);
                          setAddingPago(null);
                        }}
                        className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:text-zinc-300"
                      >
                        <Plus size={12} /> Añadir partida
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Añadir capítulo */}
        {addingCap ? (
          <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-zinc-900/40 p-4">
            <input
              className="field-input flex-1"
              placeholder="Nombre del capítulo (ej. Estructura)"
              value={newCapNombre}
              onChange={(e) => setNewCapNombre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleAddCapitulo()}
              autoFocus
            />
            <button
              onClick={() => void handleAddCapitulo()}
              disabled={saving}
              className="rounded-lg border border-emerald-500/30 bg-emerald-600/20 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-600/30"
            >
              <Save size={14} />
            </button>
            <button
              onClick={() => {
                setAddingCap(false);
                setNewCapNombre('');
              }}
              className="rounded-lg px-3 py-2 text-zinc-500 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingCap(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 py-4 text-sm font-semibold text-zinc-600 transition-all hover:border-white/20 hover:text-zinc-300"
          >
            <Plus size={14} /> Añadir capítulo
          </button>
        )}
      </div>
    </div>
  );
}
