import { useState, useEffect, useMemo, useRef } from 'react';
import { formatCurrency } from '@alsari/utils';
import { Calendar, AlertTriangle, Clock, CheckCircle2, RefreshCw, Plus, X, ChevronDown, List, LayoutGrid, ArrowUp, ArrowDown, Pencil, Building2 } from 'lucide-react';
import {
  getVencimientos, insertVencimiento, updateVencimiento, deleteVencimiento,
  getVencimientoSociedades, setVencimientoSociedades,
} from '../../lib/vencimientosImport';
import type { Vencimiento, TipoVencimiento, EstadoVencimiento, VencimientoInput, VencimientoSociedad } from '../../lib/vencimientosImport';

type Props = {
  isPrivateMode: boolean;
  sociedadOptions: { id: string; nombre: string }[];
};

const TIPO_CONFIG: Record<TipoVencimiento, { label: string; color: string; bg: string }> = {
  seguro:     { label: 'Seguro',     color: 'text-blue-400',    bg: 'bg-blue-500/15 border-blue-500/20' },
  deuda:      { label: 'Deuda',      color: 'text-rose-400',    bg: 'bg-rose-500/15 border-rose-500/20' },
  prestamo:   { label: 'Préstamo',   color: 'text-orange-400',  bg: 'bg-orange-500/15 border-orange-500/20' },
  contrato:   { label: 'Contrato',   color: 'text-violet-400',  bg: 'bg-violet-500/15 border-violet-500/20' },
  impuesto:   { label: 'Impuesto',   color: 'text-amber-400',   bg: 'bg-amber-500/15 border-amber-500/20' },
  compromiso: { label: 'Compromiso', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/20' },
  otro:       { label: 'Otro',       color: 'text-zinc-400',    bg: 'bg-zinc-500/15 border-zinc-500/20' },
  pignorado:  { label: 'Pignorado',  color: 'text-teal-400',    bg: 'bg-teal-500/15 border-teal-500/20' },
};

const RECURRENCIA_LABELS: Record<string, string> = {
  anual: 'Anual', semestral: 'Semestral', trimestral: 'Trimestral', mensual: 'Mensual',
};

function diasHasta(fecha: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const d = new Date(fecha);
  return Math.round((d.getTime() - hoy.getTime()) / 86400000);
}

// Salidas: rojo si vencido, ámbar si urgente, verde si ok
function salidaStyle(dias: number, estado: EstadoVencimiento) {
  if (estado === 'gestionado') return { dot: 'bg-zinc-500', text: 'text-zinc-400' };
  if (dias < 0)   return { dot: 'bg-rose-500 animate-pulse',  text: 'text-rose-400' };
  if (dias <= 30) return { dot: 'bg-amber-500 animate-pulse', text: 'text-amber-400' };
  return { dot: 'bg-emerald-500', text: 'text-zinc-400' };
}

// Entradas: ámbar si vencido sin cobrar (seguimiento), verde si pendiente
function entradaStyle(dias: number, estado: EstadoVencimiento) {
  if (estado === 'gestionado') return { dot: 'bg-zinc-500', text: 'text-zinc-400' };
  if (dias < 0) return { dot: 'bg-amber-500 animate-pulse', text: 'text-amber-400' };
  return { dot: 'bg-emerald-500', text: 'text-emerald-400' };
}

function fmtMonth(yyyymm: string) {
  const [y, m] = yyyymm.split('-');
  const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${names[parseInt(m ?? '1') - 1] ?? m} ${y}`;
}

// ── Vista Calendario ──────────────────────────────────────────────────────────

function CalendarioVencimientos({
  items, isPrivateMode, sociedadOptions, socMap,
  onToggleEstado, onDelete, onEdit,
}: {
  items: Vencimiento[];
  isPrivateMode: boolean;
  sociedadOptions: { id: string; nombre: string }[];
  socMap: Map<string, VencimientoSociedad[]>;
  onToggleEstado: (item: Vencimiento) => void;
  onDelete: (id: string) => void;
  onEdit: (item: Vencimiento) => void;
}) {
  const activos = items.filter(i => i.estado !== 'gestionado');

  const byYear = useMemo(() => {
    const byMonth = new Map<string, Vencimiento[]>();
    activos.forEach(v => {
      const key = v.fecha_vencimiento.slice(0, 7);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(v);
    });
    const sorted = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b));
    const byYearMap = new Map<string, [string, Vencimiento[]][]>();
    sorted.forEach(([month, vs]) => {
      const year = month.slice(0, 4);
      if (!byYearMap.has(year)) byYearMap.set(year, []);
      byYearMap.get(year)!.push([month, vs]);
    });
    return Array.from(byYearMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [activos]);

  const totalPorPagar  = activos.filter(v => !v.es_entrada).reduce((s, v) => s + (v.importe ?? 0), 0);
  const totalPorCobrar = activos.filter(v => v.es_entrada).reduce((s, v) => s + (v.importe ?? 0), 0);

  return (
    <div className="space-y-8">
      {/* Resumen */}
      <div className="flex flex-wrap gap-4">
        <div className="rounded-2xl border border-rose-500/15 bg-rose-500/[0.04] px-5 py-3 flex items-center gap-3">
          <ArrowDown size={14} className="text-rose-400" />
          <div>
            <p className="text-2xs font-semibold text-rose-700 uppercase tracking-widest">Por pagar</p>
            <p className="text-lg font-semibold text-white">
              {isPrivateMode ? '••••' : formatCurrency(totalPorPagar)}
            </p>
          </div>
        </div>
        {totalPorCobrar > 0 && (
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] px-5 py-3 flex items-center gap-3">
            <ArrowUp size={14} className="text-emerald-400" />
            <div>
              <p className="text-2xs font-semibold text-emerald-700 uppercase tracking-widest">Por cobrar</p>
              <p className="text-lg font-semibold text-emerald-300">
                {isPrivateMode ? '••••' : formatCurrency(totalPorCobrar)}
              </p>
            </div>
          </div>
        )}
        <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/30 px-5 py-3 flex items-center gap-3">
          <Clock size={14} className="text-zinc-400" />
          <div>
            <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Vencimientos activos</p>
            <p className="text-lg font-semibold text-white">{activos.length}</p>
          </div>
        </div>
      </div>

      {/* Timeline por año */}
      {byYear.map(([year, months]) => {
        const yearItems    = months.flatMap(([, vs]) => vs);
        const yearPorPagar  = yearItems.filter(v => !v.es_entrada).reduce((s, v) => s + (v.importe ?? 0), 0);
        const yearPorCobrar = yearItems.filter(v => v.es_entrada).reduce((s, v) => s + (v.importe ?? 0), 0);
        return (
          <div key={year}>
            <div className="flex items-center gap-3 mb-4">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">{year}</p>
              <div className="flex-1 h-px bg-white/[0.05]" />
              <div className="flex items-center gap-3">
                {yearPorPagar > 0 && (
                  <span className="flex items-center gap-1 text-xs text-zinc-600">
                    <ArrowDown size={10} className="text-zinc-600" />
                    {isPrivateMode ? '••••' : formatCurrency(yearPorPagar)}
                  </span>
                )}
                {yearPorCobrar > 0 && (
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <ArrowUp size={10} />
                    {isPrivateMode ? '••••' : formatCurrency(yearPorCobrar)}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {months.map(([month, vencimientos]) => {
                const salidas   = vencimientos.filter(v => !v.es_entrada);
                const entradas  = vencimientos.filter(v => v.es_entrada);
                const totalSal  = salidas.reduce((s, v) => s + (v.importe ?? 0), 0);
                const totalEnt  = entradas.reduce((s, v) => s + (v.importe ?? 0), 0);
                const hoyStr    = new Date().toISOString().slice(0, 10);
                const vencido   = salidas.some(v => v.fecha_vencimiento < hoyStr);
                const urgente   = !vencido && salidas.some(v => diasHasta(v.fecha_vencimiento) <= 30);
                const soloEntra = salidas.length === 0;

                return (
                  <div key={month} className={`rounded-2xl border p-4 space-y-3 ${
                    soloEntra ? 'border-emerald-500/20 bg-emerald-500/[0.03]' :
                    vencido   ? 'border-rose-500/25 bg-rose-500/[0.04]' :
                    urgente   ? 'border-amber-500/25 bg-amber-500/[0.03]' :
                    'border-white/[0.06] bg-zinc-900/20'
                  }`}>
                    {/* Cabecera mes */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {!soloEntra && vencido && <AlertTriangle size={11} className="text-rose-400" />}
                        {!soloEntra && urgente && <Clock size={11} className="text-amber-400" />}
                        {soloEntra && <ArrowUp size={11} className="text-emerald-400" />}
                        <p className={`text-sm font-semibold ${
                          soloEntra ? 'text-emerald-300' :
                          vencido ? 'text-rose-300' : urgente ? 'text-amber-300' : 'text-white'
                        }`}>
                          {fmtMonth(month)}
                        </p>
                      </div>
                      <div className="text-right space-y-0.5">
                        {totalSal > 0 && (
                          <p className={`text-sm font-semibold ${vencido ? 'text-rose-400' : urgente ? 'text-amber-400' : 'text-zinc-300'}`}>
                            {isPrivateMode ? '••••' : formatCurrency(totalSal)}
                          </p>
                        )}
                        {totalEnt > 0 && (
                          <p className={`text-xs font-medium text-emerald-400 flex items-center gap-0.5 justify-end ${isPrivateMode ? 'blur-sm' : ''}`}>
                            <ArrowUp size={9} /> {isPrivateMode ? '••••' : formatCurrency(totalEnt)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Items del mes */}
                    <div className="space-y-2">
                      {vencimientos.map(v => {
                        const dias    = diasHasta(v.fecha_vencimiento);
                        const sty     = v.es_entrada ? entradaStyle(dias, v.estado) : salidaStyle(dias, v.estado);
                        const tipoCfg = TIPO_CONFIG[v.tipo];
                        return (
                          <div key={v.id} className="group flex items-start gap-2 py-1 rounded-lg hover:bg-white/[0.02] transition-colors px-1">
                            <div className={`w-2 h-2 rounded-full shrink-0 mt-1 ${sty.dot}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-zinc-200 truncate">{v.titulo}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className={`text-2xs font-semibold px-1.5 py-0.5 rounded-full border ${tipoCfg.bg} ${tipoCfg.color}`}>
                                  {tipoCfg.label}
                                </span>
                                {(socMap.get(v.id) ?? []).map(s => {
                                  const sNom = sociedadOptions.find(o => o.id === s.sociedad_id)?.nombre ?? s.sociedad_id;
                                  return (
                                    <span key={s.sociedad_id} className="flex items-center gap-0.5 text-2xs text-zinc-600">
                                      <Building2 size={8} />
                                      {sNom}{(socMap.get(v.id) ?? []).length > 1 ? ` ${Number(s.porcentaje).toFixed(0)}%` : ''}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {v.importe != null && (
                                <span className={`flex items-center gap-0.5 text-xs font-medium ${v.es_entrada ? 'text-emerald-400' : 'text-zinc-400'} ${isPrivateMode ? 'blur-sm' : ''}`}>
                                  {v.es_entrada
                                    ? <ArrowUp size={9} className="text-emerald-500" />
                                    : <ArrowDown size={9} className="text-zinc-600" />
                                  }
                                  {formatCurrency(v.importe)}
                                </span>
                              )}
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                <button onClick={() => onEdit(v)}
                                  className="p-1 rounded text-zinc-600 hover:text-amber-400 transition-colors"
                                  title="Editar">
                                  <Pencil size={11} />
                                </button>
                                <button onClick={() => onToggleEstado(v)}
                                  className="p-1 rounded text-zinc-600 hover:text-emerald-400 transition-colors">
                                  <CheckCircle2 size={11} />
                                </button>
                                <button onClick={() => onDelete(v.id)}
                                  className="p-1 rounded text-zinc-600 hover:text-rose-400 transition-colors">
                                  <X size={11} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {activos.length === 0 && (
        <div className="text-center py-8 text-zinc-600 text-sm">No hay vencimientos activos</div>
      )}
    </div>
  );
}

type SociedadPct = { sociedad_id: string; porcentaje: number };

const EMPTY_FORM: VencimientoInput = {
  titulo: '', tipo: 'seguro', fecha_vencimiento: '',
  importe: null, sociedad_id: null, notas: null,
  estado: 'pendiente', recurrencia: null, es_entrada: false,
};

function sumPct(rows: SociedadPct[]): number {
  return rows.reduce((s, r) => s + r.porcentaje, 0);
}

function formIsValid(form: VencimientoInput, socPcts: SociedadPct[]): boolean {
  if (!form.titulo || !form.fecha_vencimiento) return false;
  if (socPcts.length === 0) return false;
  if (socPcts.some(s => !s.sociedad_id)) return false;
  const sum = sumPct(socPcts);
  return sum >= 99 && sum <= 101;
}

function vencimientoToInput(v: Vencimiento): VencimientoInput {
  return {
    titulo: v.titulo, tipo: v.tipo, fecha_vencimiento: v.fecha_vencimiento,
    importe: v.importe, sociedad_id: v.sociedad_id, notas: v.notas,
    estado: v.estado, recurrencia: v.recurrencia, es_entrada: v.es_entrada,
  };
}

export function VencimientosView({ isPrivateMode, sociedadOptions }: Props) {
  const [items, setItems] = useState<Vencimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VencimientoInput>(EMPTY_FORM);
  const [socPcts, setSocPcts] = useState<SociedadPct[]>([]);
  // Map de vencimientoId → sus sociedades (para display en listas/calendario)
  const [socMap, setSocMap] = useState<Map<string, VencimientoSociedad[]>>(new Map());
  const [saving, setSaving] = useState(false);
  const [filterTipo, setFilterTipo] = useState<TipoVencimiento | 'todos'>('todos');
  const [vista, setVista] = useState<'lista' | 'calendario'>('calendario');
  const formRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const vencimientos = await getVencimientos();
      setItems(vencimientos);
      // Cargar todas las sociedades en paralelo
      const allSocs = await Promise.all(
        vencimientos.map(v => getVencimientoSociedades(v.id).then(socs => [v.id, socs] as [string, VencimientoSociedad[]]))
      );
      setSocMap(new Map(allSocs));
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() =>
    filterTipo === 'todos' ? items : items.filter(i => i.tipo === filterTipo),
  [items, filterTipo]);

  const upcoming = useMemo(() =>
    filtered.filter(i => i.estado !== 'gestionado' && !i.es_entrada && diasHasta(i.fecha_vencimiento) <= 90).length,
  [filtered]);

  const v = (n: number | null) => {
    if (n === null) return '—';
    return isPrivateMode ? '••••' : formatCurrency(n);
  };

  async function handleEdit(item: Vencimiento) {
    setEditingId(item.id);
    setForm(vencimientoToInput(item));
    // Abre el formulario inmediatamente con fallback; las sociedades llegan después
    setSocPcts(item.sociedad_id ? [{ sociedad_id: item.sociedad_id, porcentaje: 100 }] : []);
    setShowForm(true);
    // Scroll al formulario una vez que React lo haya pintado
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    // Carga las sociedades reales en paralelo y actualiza
    try {
      const socs = socMap.get(item.id)?.length
        ? socMap.get(item.id)!
        : await getVencimientoSociedades(item.id);
      if (socs.length > 0) {
        setSocPcts(socs.map(s => ({ sociedad_id: s.sociedad_id, porcentaje: Number(s.porcentaje) })));
      }
    } catch { /* fallback ya puesto arriba */ }
  }

  function handleCancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSocPcts([]);
  }

  const handleSave = async () => {
    if (!formIsValid(form, socPcts)) return;
    setSaving(true);
    try {
      // sociedad_id principal = la de mayor porcentaje (para backward compat)
      const primaria = [...socPcts].sort((a, b) => b.porcentaje - a.porcentaje)[0];
      const payload = { ...form, sociedad_id: primaria?.sociedad_id || null };

      let id: string;
      if (editingId) {
        await updateVencimiento(editingId, payload);
        id = editingId;
      } else {
        const nuevo = await insertVencimiento(payload);
        id = nuevo.id;
      }
      await setVencimientoSociedades(id, socPcts);

      setForm(EMPTY_FORM);
      setSocPcts([]);
      setEditingId(null);
      setShowForm(false);
      void load();
    } finally { setSaving(false); }
  };

  const handleToggleEstado = async (item: Vencimiento) => {
    const nuevoEstado: EstadoVencimiento = item.estado === 'gestionado' ? 'pendiente' : 'gestionado';
    await updateVencimiento(item.id, { estado: nuevoEstado });
    void load();
  };

  const handleDelete = async (id: string) => {
    await deleteVencimiento(id);
    void load();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white uppercase tracking-tight flex items-center gap-3">
            <Calendar className="text-amber-400" size={22} />
            Vencimientos y Compromisos
          </h2>
          <p className="text-xs text-zinc-500 mt-1">Seguros, deuda, contratos, impuestos, compromisos y fondos pignorados</p>
        </div>
        <div className="flex items-center gap-2">
          {upcoming > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-widest">
              <AlertTriangle size={11} /> {upcoming} próximos
            </span>
          )}
          <div className="flex gap-0.5 p-0.5 bg-zinc-900 border border-white/10 rounded-lg">
            <button onClick={() => setVista('calendario')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${vista === 'calendario' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <LayoutGrid size={12} /> Calendario
            </button>
            <button onClick={() => setVista('lista')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${vista === 'lista' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <List size={12} /> Lista
            </button>
          </div>
          <button onClick={() => { void load(); }} className="p-2 rounded-xl bg-zinc-900 border border-white/10 text-zinc-500 hover:text-zinc-300 transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(!showForm); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600/20 border border-amber-500/30 text-amber-300 text-xs font-medium hover:bg-amber-600/30 transition-all"
          >
            <Plus size={13} /> Añadir
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div ref={formRef} className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-amber-300 uppercase tracking-widest">
              {editingId ? 'Editar Vencimiento' : 'Nuevo Vencimiento'}
            </p>
            <button onClick={handleCancelForm} className="text-zinc-600 hover:text-zinc-400"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Título</label>
              <input type="text" placeholder="Ej: Seguro multirriesgo Nave Industrial" value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                className="w-full mt-1.5 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50" />
            </div>
            {/* Flujo entrada/salida */}
            <div className="col-span-2">
              <label className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Flujo de caja</label>
              <div className="flex gap-1 p-1 bg-zinc-900 border border-white/10 rounded-xl mt-1.5">
                <button type="button" onClick={() => setForm(f => ({ ...f, es_entrada: false }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                    !form.es_entrada
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/25'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}>
                  <ArrowDown size={12} /> Salida (pago)
                </button>
                <button type="button" onClick={() => setForm(f => ({ ...f, es_entrada: true }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                    form.es_entrada
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}>
                  <ArrowUp size={12} /> Entrada (cobro)
                </button>
              </div>
            </div>
            <div>
              <label className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Tipo</label>
              <div className="relative mt-1.5">
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoVencimiento }))}
                  className="w-full appearance-none bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 pr-8">
                  {Object.entries(TIPO_CONFIG).map(([k, cfg]) => <option key={k} value={k}>{cfg.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Fecha de vencimiento</label>
              <input type="date" value={form.fecha_vencimiento}
                onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))}
                className="w-full mt-1.5 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Importe (€, opcional)</label>
              <input type="number" placeholder="0" value={form.importe ?? ''}
                onChange={e => setForm(f => ({ ...f, importe: e.target.value ? parseFloat(e.target.value) : null }))}
                className="w-full mt-1.5 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50" />
            </div>
            {/* Editor multi-sociedad */}
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">
                  Sociedades <span className="text-rose-400">*</span>
                </label>
                {socPcts.length > 0 && (
                  <span className={`text-2xs font-semibold ${Math.abs(sumPct(socPcts) - 100) < 1 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {sumPct(socPcts).toFixed(0)}% asignado
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {socPcts.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <select
                        value={row.sociedad_id}
                        onChange={e => setSocPcts(prev => prev.map((r, i) => i === idx ? { ...r, sociedad_id: e.target.value } : r))}
                        className="w-full appearance-none bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50 pr-8"
                      >
                        <option value="">— Sociedad —</option>
                        {sociedadOptions.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min={1} max={100} step={1}
                        value={row.porcentaje}
                        onChange={e => setSocPcts(prev => prev.map((r, i) => i === idx ? { ...r, porcentaje: Math.min(100, Math.max(1, Number(e.target.value))) } : r))}
                        className="w-16 bg-zinc-900 border border-white/10 rounded-xl px-2 py-2 text-sm text-white text-right focus:outline-none focus:border-amber-500/50"
                      />
                      <span className="text-xs text-zinc-500">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSocPcts(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setSocPcts(prev => [...prev, { sociedad_id: '', porcentaje: 100 - sumPct(prev) > 0 ? 100 - sumPct(prev) : 0 }])}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-amber-300 transition-colors font-semibold"
                >
                  <Plus size={12} /> Añadir sociedad
                </button>
              </div>
              {socPcts.length > 0 && Math.abs(sumPct(socPcts) - 100) >= 1 && (
                <p className="text-2xs text-amber-500/80 mt-1.5">
                  Los porcentajes deben sumar 100% (ahora: {sumPct(socPcts).toFixed(0)}%)
                </p>
              )}
              {socPcts.length === 0 && (
                <p className="text-2xs text-amber-500/80 mt-1">Añade al menos una sociedad</p>
              )}
            </div>
            <div>
              <label className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Recurrencia (opcional)</label>
              <div className="relative mt-1.5">
                <select value={form.recurrencia ?? ''} onChange={e => setForm(f => ({ ...f, recurrencia: (e.target.value || null) as typeof form.recurrencia }))}
                  className="w-full appearance-none bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 pr-8">
                  <option value="">Sin recurrencia</option>
                  {Object.entries(RECURRENCIA_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Notas (opcional)</label>
              <textarea placeholder="Detalles adicionales..." value={form.notas ?? ''}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value || null }))}
                rows={2}
                className="w-full mt-1.5 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 resize-none" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={handleCancelForm} className="px-4 py-2 rounded-xl border border-white/10 text-zinc-400 text-sm font-medium hover:border-white/20 transition-all">Cancelar</button>
            <button onClick={() => { void handleSave(); }} disabled={saving || !formIsValid(form, socPcts)}
              className="px-6 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-rose-500/20 bg-rose-500/[0.03] text-rose-400 text-sm">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Vista Calendario */}
      {!loading && vista === 'calendario' && (
        items.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center space-y-3">
            <Calendar size={36} className="text-zinc-700 mx-auto" />
            <p className="text-sm font-semibold uppercase tracking-widest text-zinc-600">Sin vencimientos registrados</p>
          </div>
        ) : (
          <CalendarioVencimientos
            items={items}
            isPrivateMode={isPrivateMode}
            sociedadOptions={sociedadOptions}
            socMap={socMap}
            onToggleEstado={item => { void handleToggleEstado(item); }}
            onDelete={id => { void handleDelete(id); }}
            onEdit={item => { void handleEdit(item); }}
          />
        )
      )}

      {/* Vista Lista */}
      {!loading && vista === 'lista' && (
        <>
          {items.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {(['todos', ...Object.keys(TIPO_CONFIG)] as (TipoVencimiento | 'todos')[]).map(t => (
                <button key={t} onClick={() => setFilterTipo(t)}
                  className={`text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all
                    ${filterTipo === t
                      ? t === 'todos' ? 'bg-white/10 border-white/20 text-white' : `${TIPO_CONFIG[t as TipoVencimiento].bg} ${TIPO_CONFIG[t as TipoVencimiento].color}`
                      : 'border-white/5 text-zinc-600 hover:text-zinc-400'
                    }`}>
                  {t === 'todos' ? 'Todos' : TIPO_CONFIG[t as TipoVencimiento].label}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center space-y-3">
              <Calendar size={36} className="text-zinc-700 mx-auto" />
              <p className="text-sm font-semibold uppercase tracking-widest text-zinc-600">Sin vencimientos registrados</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(item => {
                const dias     = diasHasta(item.fecha_vencimiento);
                const sty      = item.es_entrada ? entradaStyle(dias, item.estado) : salidaStyle(dias, item.estado);
                const tipoCfg  = TIPO_CONFIG[item.tipo];
                const itemSocs = socMap.get(item.id) ?? [];
                return (
                  <div key={item.id}
                    className={`rounded-xl border bg-white/[0.02] px-5 py-4 flex items-center gap-4 group transition-all hover:bg-white/[0.03]
                      ${item.estado === 'gestionado' ? 'border-white/[0.04] opacity-60' : 'border-white/[0.07]'}`}>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${sty.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${item.estado === 'gestionado' ? 'text-zinc-500 line-through' : 'text-white'}`}>{item.titulo}</span>
                        <span className={`text-2xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border ${tipoCfg.bg} ${tipoCfg.color}`}>{tipoCfg.label}</span>
                        {item.recurrencia && <span className="text-2xs font-semibold uppercase tracking-widest text-zinc-600">{RECURRENCIA_LABELS[item.recurrencia]}</span>}
                        {itemSocs.map(s => {
                          const sNom = sociedadOptions.find(o => o.id === s.sociedad_id)?.nombre ?? s.sociedad_id;
                          return (
                            <span key={s.sociedad_id} className="flex items-center gap-0.5 text-2xs text-zinc-500 bg-zinc-800/50 px-1.5 py-0.5 rounded-full">
                              <Building2 size={8} />
                              {sNom}{itemSocs.length > 1 ? ` ${Number(s.porcentaje).toFixed(0)}%` : ''}
                            </span>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs font-medium ${sty.text}`}>
                          {item.estado === 'gestionado'
                            ? (item.es_entrada ? 'Cobrado' : 'Pagado')
                            : item.es_entrada
                              ? (dias < 0 ? `Por cobrar — ${Math.abs(dias)} días de retraso` : dias === 0 ? 'Cobro previsto hoy' : `Cobro en ${dias} días`)
                              : (dias < 0 ? `Vencido hace ${Math.abs(dias)} días` : dias === 0 ? 'Vence hoy' : `${dias} días`)
                          }
                        </span>
                        <span className="text-xs text-zinc-600">{formatDate(item.fecha_vencimiento)}</span>
                        {item.notas && <span className="text-xs text-zinc-700 truncate max-w-[200px]">{item.notas}</span>}
                      </div>
                    </div>
                    {item.importe !== null && (
                      <p className={`text-sm font-semibold shrink-0 flex items-center gap-1 ${item.es_entrada ? 'text-emerald-300' : 'text-zinc-300'} ${isPrivateMode ? 'blur-sm' : ''}`}>
                        {item.es_entrada ? <ArrowUp size={13} className="text-emerald-500" /> : <ArrowDown size={13} className="text-zinc-600" />}
                        {v(item.importe)}
                      </p>
                    )}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => { void handleEdit(item); }}
                        className="p-1.5 rounded-lg bg-zinc-800 text-zinc-500 hover:text-amber-400 transition-all"
                        title="Editar">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => { void handleToggleEstado(item); }}
                        className={`p-1.5 rounded-lg transition-all ${item.estado === 'gestionado' ? 'text-zinc-500 hover:text-amber-400 bg-zinc-800' : 'text-zinc-500 hover:text-emerald-400 bg-zinc-800'}`}>
                        {item.estado === 'gestionado' ? <Clock size={13} /> : <CheckCircle2 size={13} />}
                      </button>
                      <button onClick={() => { void handleDelete(item.id); }} className="p-1.5 rounded-lg bg-zinc-800 text-zinc-500 hover:text-rose-400 transition-all">
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
