import { useState, useEffect, useMemo } from 'react';
import { formatCurrency } from '@alsari/utils';
import type { ActivoPatrimonio, CategoriaActivo, PersonaPatrimonio, CapexActivo } from '@alsari/types';
import {
  getPersonas, getActivos, insertActivo, updateActivo, deleteActivo,
  getCapexByActivo, insertCapex, deleteCapex,
} from '../../lib/patrimonioImport';
import {
  Plus, Pencil, Trash2, RefreshCw, Building2, TrendingUp, BarChart2,
  Anchor, ChevronDown, ChevronUp, Check, X, AlertTriangle, Hammer,
} from 'lucide-react';

// ── Constantes ────────────────────────────────────────────────────────────────

const CATEGORIAS: { id: CategoriaActivo; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'inmobiliario', label: 'Inmobiliario',       icon: <Building2 size={15} />, color: 'text-blue-400 bg-blue-500/15 border-blue-500/20' },
  { id: 'fondo',        label: 'Fondos',             icon: <TrendingUp size={15} />, color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20' },
  { id: 'cotizado',     label: 'Cotizados',          icon: <BarChart2 size={15} />, color: 'text-violet-400 bg-violet-500/15 border-violet-500/20' },
  { id: 'bien_valor',   label: 'Bienes de Valor',    icon: <Anchor size={15} />, color: 'text-amber-400 bg-amber-500/15 border-amber-500/20' },
];

const SUBCATEGORIAS: Record<CategoriaActivo, string[]> = {
  inmobiliario: ['vivienda_habitual', 'segunda_residencia', 'local', 'suelo', 'nave', 'garaje', 'otro'],
  fondo:        ['indexado', 'gestion_activa', 'sicav', 'monetario', 'mixto', 'alternativo'],
  cotizado:     ['accion', 'etf', 'bono', 'warrant'],
  bien_valor:   ['embarcacion', 'vehiculo_coleccion', 'arte', 'maquinaria', 'joyeria', 'otro'],
};

const SUBCATEGORIA_LABELS: Record<string, string> = {
  vivienda_habitual: 'Vivienda habitual', segunda_residencia: '2ª residencia',
  local: 'Local comercial', suelo: 'Suelo', nave: 'Nave', garaje: 'Garaje',
  indexado: 'Indexado', gestion_activa: 'Gestión activa', sicav: 'SICAV',
  monetario: 'Monetario', mixto: 'Mixto', alternativo: 'Alternativo',
  accion: 'Acción', etf: 'ETF', bono: 'Bono', warrant: 'Warrant',
  embarcacion: 'Embarcación', vehiculo_coleccion: 'Vehículo colección',
  arte: 'Arte', maquinaria: 'Maquinaria', joyeria: 'Joyería', otro: 'Otro',
};

type TitularFilter = 'todos' | string; // string = persona.id o 'sociedades'

// ── Cálculos derivados ────────────────────────────────────────────────────────

// Calcula la deuda ajustada restando los meses transcurridos × cuota mensual
// desde la fecha de valoración. Si no hay cuota o fecha, devuelve deuda_viva tal cual.
function deudaAjustada(a: ActivoPatrimonio): number {
  const base = a.deuda_viva ?? 0;
  if (!base || !a.cuota_mensual || !a.fecha_valoracion) return base;
  const meses = Math.floor(
    (Date.now() - new Date(a.fecha_valoracion).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
  );
  if (meses <= 0) return base;
  return Math.max(0, base - a.cuota_mensual * meses);
}

function mesesDesdeValoracion(a: ActivoPatrimonio): number {
  if (!a.fecha_valoracion || !a.cuota_mensual || !(a.deuda_viva ?? 0)) return 0;
  return Math.max(0, Math.floor(
    (Date.now() - new Date(a.fecha_valoracion).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
  ));
}

function valorNeto(a: ActivoPatrimonio): number {
  return (a.valor_actual * a.porcentaje_propiedad / 100) - deudaAjustada(a);
}

function plusvaliaLatente(a: ActivoPatrimonio): number | null {
  if (a.valor_adquisicion == null) return null;
  if (a.categoria === 'cotizado' && a.num_unidades != null && a.precio_coste_medio != null) {
    return (a.valor_actual - a.precio_coste_medio) * a.num_unidades;
  }
  if (a.categoria === 'fondo' && a.num_unidades != null && a.precio_coste_medio != null) {
    return (a.valor_actual - a.precio_coste_medio) * a.num_unidades;
  }
  return a.valor_actual - a.valor_adquisicion;
}

function diasDesdeValoracion(fecha: string | null): number | null {
  if (!fecha) return null;
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
}

function capitalExpuesto(a: ActivoPatrimonio): number {
  return a.valor_actual * a.porcentaje_propiedad / 100;
}

function rendimientoBruto(a: ActivoPatrimonio): number | null {
  const ce = capitalExpuesto(a);
  if (ce <= 0 || !a.renta_mensual) return null;
  return (a.renta_mensual * 12 / ce) * 100;
}

function rendimientoNeto(a: ActivoPatrimonio): number | null {
  const ce = capitalExpuesto(a);
  if (ce <= 0 || !a.renta_mensual) return null;
  return ((a.renta_mensual * 12 - (a.coste_mantenimiento_anual ?? 0)) / ce) * 100;
}

function cashFlowMensual(a: ActivoPatrimonio): number | null {
  if (!a.renta_mensual) return null;
  return a.renta_mensual - (a.cuota_mensual ?? 0);
}

function plusvaliaPct(a: ActivoPatrimonio, pv: number | null): number | null {
  if (pv == null || !a.valor_adquisicion) return null;
  if (a.categoria === 'cotizado' || a.categoria === 'fondo') {
    const coste = (a.num_unidades ?? 0) * (a.precio_coste_medio ?? 0);
    return coste > 0 ? (pv / coste) * 100 : null;
  }
  return a.valor_adquisicion > 0 ? (pv / a.valor_adquisicion) * 100 : null;
}

function dividendoAnual(a: ActivoPatrimonio): number | null {
  if (!a.num_unidades || !a.dividendo_anual_por_unidad) return null;
  return a.num_unidades * a.dividendo_anual_por_unidad;
}

function rendimientoMensualTAE(a: ActivoPatrimonio): number | null {
  if (!a.tae_declarada || a.valor_actual <= 0) return null;
  return a.valor_actual * (a.tae_declarada / 100) / 12;
}

function roiAnual(a: ActivoPatrimonio): number | null {
  const costeBase = (a.num_unidades ?? 0) * (a.precio_coste_medio ?? 0);
  if (!costeBase || costeBase <= 0) return null;
  if (!a.fecha_inicio_inversion) return null;
  const años = (Date.now() - new Date(a.fecha_inicio_inversion).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (años < 0.05) return null; // menos de 18 días: no significativo
  return (Math.pow(a.valor_actual / costeBase, 1 / años) - 1) * 100;
}

function roiTotal(a: ActivoPatrimonio): number | null {
  const costeBase = (a.num_unidades ?? 0) * (a.precio_coste_medio ?? 0);
  if (!costeBase || costeBase <= 0) return null;
  return ((a.valor_actual / costeBase) - 1) * 100;
}

// ── Formulario de activo ──────────────────────────────────────────────────────

type FormState = Omit<ActivoPatrimonio, 'id' | 'created_at' | 'updated_at' | 'titular_nombre'>;

const EMPTY_FORM = (personas: PersonaPatrimonio[]): FormState => ({
  titular_tipo: 'persona',
  titular_persona_id: personas[0]?.id ?? null,
  titular_sociedad_id: null,
  categoria: 'inmobiliario',
  subcategoria: null,
  nombre: '',
  valor_adquisicion: null,
  valor_actual: 0,
  deuda_viva: 0,
  porcentaje_propiedad: 100,
  moneda: 'EUR',
  fecha_valoracion: new Date().toISOString().slice(0, 10),
  notas: null,
  cuota_mensual: null,
  renta_mensual: null,
  isin: null,
  ticker: null,
  gestora_broker: null,
  num_unidades: null,
  precio_coste_medio: null,
  dividendo_anual_por_unidad: null,
  fecha_inicio_inversion: null,
  tae_declarada: null,
  coste_mantenimiento_anual: null,
});

type ActivoFormProps = {
  initial: FormState;
  personas: PersonaPatrimonio[];
  sociedadOptions: { id: string; nombre: string }[];
  onSave: (data: FormState) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
};

function ActivoForm({ initial, personas, sociedadOptions, onSave, onCancel, saving }: ActivoFormProps) {
  const [form, setForm] = useState<FormState>(initial);
  const f = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));
  const fNum = (k: keyof FormState, v: string) => f(k, v === '' ? null : (parseFloat(v) as FormState[typeof k]));

  const cat = CATEGORIAS.find(c => c.id === form.categoria);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${cat?.color ?? ''}`}>{cat?.icon}</div>
            <h2 className="text-lg font-semibold text-white">{form.nombre || 'Nuevo Activo'}</h2>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Titular */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-widest mb-1">Titular</label>
              <select value={form.titular_tipo} onChange={e => {
                const tipo = e.target.value as 'persona' | 'sociedad';
                setForm(p => ({
                  ...p, titular_tipo: tipo,
                  titular_persona_id: tipo === 'persona' ? (personas[0]?.id ?? null) : null,
                  titular_sociedad_id: tipo === 'sociedad' ? (sociedadOptions[0]?.id ?? null) : null,
                }));
              }} className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors">
                <option value="persona">Persona física</option>
                <option value="sociedad">Sociedad</option>
              </select>
            </div>
            <div>
              <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-widest mb-1">
                {form.titular_tipo === 'persona' ? 'Persona' : 'Sociedad'}
              </label>
              {form.titular_tipo === 'persona' ? (
                <select value={form.titular_persona_id ?? ''} onChange={e => f('titular_persona_id', e.target.value || null)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors">
                  {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              ) : (
                <select value={form.titular_sociedad_id ?? ''} onChange={e => f('titular_sociedad_id', e.target.value || null)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors">
                  {sociedadOptions.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Categoría y subcategoría */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-widest mb-1">Categoría</label>
              <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value as CategoriaActivo, subcategoria: null }))}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors">
                {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-widest mb-1">Tipo</label>
              <select value={form.subcategoria ?? ''} onChange={e => f('subcategoria', e.target.value || null)}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors">
                <option value="">— sin especificar —</option>
                {SUBCATEGORIAS[form.categoria].map(s => <option key={s} value={s}>{SUBCATEGORIA_LABELS[s] ?? s}</option>)}
              </select>
            </div>
          </div>

          {/* Nombre — para financieros: entidad + producto en 2 columnas */}
          {(form.categoria === 'fondo' || form.categoria === 'cotizado') ? (
            <div className="grid grid-cols-2 gap-4">
              <Str
                label="Entidad bancaria / Broker *"
                value={form.gestora_broker}
                onChange={v => f('gestora_broker', v || null)}
                placeholder="BBVA, Vanguard, IBKR..."
              />
              <div>
                <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-widest mb-1">Nombre del producto *</label>
                <input value={form.nombre} onChange={e => f('nombre', e.target.value)}
                  placeholder='Ej: "Fondo Indexado Global Amundi", "Apple Inc."'
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-zinc-600" />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-widest mb-1">Nombre / Descripción *</label>
              <input value={form.nombre} onChange={e => f('nombre', e.target.value)} placeholder='Ej: "Piso Barcelona calle Mayor", "Lancha Sunseeker"'
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-zinc-600" />
            </div>
          )}

          {/* Valores */}
          <div className="grid grid-cols-2 gap-4">
            <Num label="Valor actual (€) *" value={form.valor_actual} onChange={v => fNum('valor_actual', v)} />
            <Num label="Valor adquisición (€)" value={form.valor_adquisicion} onChange={v => fNum('valor_adquisicion', v)} />
            <Num label="Deuda viva (€)" value={form.deuda_viva} onChange={v => fNum('deuda_viva', v)} />
            <Num label="% Propiedad" value={form.porcentaje_propiedad} onChange={v => fNum('porcentaje_propiedad', v)} />
          </div>

          {/* Fecha de valoración */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-widest mb-1">Fecha valoración</label>
              <input type="date" value={form.fecha_valoracion ?? ''} onChange={e => f('fecha_valoracion', e.target.value || null)}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors" />
            </div>
          </div>

          {/* Campos específicos por categoría */}
          {form.categoria === 'inmobiliario' && (
            <div className="space-y-3 border-t border-white/5 pt-4">
              <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Datos Inmobiliario</p>
              <div className="grid grid-cols-2 gap-4">
                <Num label="Cuota mensual hipoteca (€)" value={form.cuota_mensual} onChange={v => fNum('cuota_mensual', v)} />
                <Num label="Renta mensual (si alquilado €)" value={form.renta_mensual} onChange={v => fNum('renta_mensual', v)} />
              </div>
            </div>
          )}

          {(form.categoria === 'fondo' || form.categoria === 'cotizado') && (
            <div className="space-y-3 border-t border-white/5 pt-4">
              <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">
                {form.categoria === 'fondo' ? 'Datos Fondo' : 'Datos Instrumento Cotizado'}
              </p>
              <div className="grid grid-cols-2 gap-4">
                {form.categoria === 'cotizado' && <Str label="Ticker" value={form.ticker} onChange={v => f('ticker', v || null)} placeholder="AAPL, SAN.MC..." />}
                {form.categoria === 'fondo'    && <Str label="ISIN" value={form.isin} onChange={v => f('isin', v || null)} placeholder="IE00B4L5Y983" />}
                <Num label="Nº unidades / participaciones" value={form.num_unidades} onChange={v => fNum('num_unidades', v)} />
                <Num label="Coste medio por unidad (€)" value={form.precio_coste_medio} onChange={v => fNum('precio_coste_medio', v)} />
                {form.categoria === 'cotizado' && <Num label="Dividendo anual por título (€)" value={form.dividendo_anual_por_unidad} onChange={v => fNum('dividendo_anual_por_unidad', v)} />}
                <div>
                  <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-widest mb-1">
                    TAE declarada (%)
                  </label>
                  <input type="number" step="0.01" placeholder="Ej: 3.25"
                    value={form.tae_declarada ?? ''}
                    onChange={e => fNum('tae_declarada', e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors" />
                  <p className="text-2xs text-zinc-600 mt-1">TAE publicada por el fondo. Permite calcular rendimiento mensual.</p>
                </div>
                <div>
                  <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-widest mb-1">
                    Fecha inicio inversión
                  </label>
                  <input type="date" value={form.fecha_inicio_inversion ?? ''} onChange={e => f('fecha_inicio_inversion', e.target.value || null)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors" />
                  <p className="text-2xs text-zinc-600 mt-1">Para calcular CAGR (fondos de renta variable).</p>
                </div>
              </div>
            </div>
          )}

          {form.categoria === 'bien_valor' && (
            <div className="space-y-3 border-t border-white/5 pt-4">
              <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Datos Bien de Valor</p>
              <div className="grid grid-cols-2 gap-4">
                <Num label="Coste mantenimiento anual (€)" value={form.coste_mantenimiento_anual} onChange={v => fNum('coste_mantenimiento_anual', v)} />
              </div>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-widest mb-1">Notas</label>
            <textarea value={form.notas ?? ''} onChange={e => f('notas', e.target.value || null)} rows={2}
              placeholder="Referencia catastral, CNMV, matrícula, ubicación..."
              className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors resize-none placeholder:text-zinc-600" />
          </div>
        </div>

        <div className="p-6 border-t border-white/5 flex justify-end gap-3">
          <button onClick={onCancel} className="px-5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 text-sm font-medium hover:border-white/20 transition-all">
            Cancelar
          </button>
          <button onClick={() => { void onSave(form); }} disabled={saving || !form.nombre.trim()}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-all flex items-center gap-2">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: number | null; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-widest mb-1">{label}</label>
      <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value)}
        className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors" />
    </div>
  );
}

function Str({ label, value, onChange, placeholder }: { label: string; value: string | null; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-widest mb-1">{label}</label>
      <input value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-zinc-600" />
    </div>
  );
}

// ── Vista principal ───────────────────────────────────────────────────────────

type PatrimonioViewProps = {
  isPrivateMode: boolean;
  sociedadOptions: { id: string; nombre: string }[];
};

export function PatrimonioView({ isPrivateMode, sociedadOptions }: PatrimonioViewProps) {
  const [personas, setPersonas]   = useState<PersonaPatrimonio[]>([]);
  const [activos, setActivos]     = useState<ActivoPatrimonio[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const [filtro, setFiltro]       = useState<TitularFilter>('todos');
  const [collapsed, setCollapsed] = useState<Set<CategoriaActivo>>(new Set());

  const [formOpen, setFormOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState<ActivoPatrimonio | null>(null);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);

  const [expanded, setExpanded]         = useState<Set<string>>(new Set());
  const [capexByActivo, setCapexByActivo] = useState<Record<string, CapexActivo[]>>({});
  const [capexLoadedFor, setCapexLoadedFor] = useState<Set<string>>(new Set());
  const [capexLoading, setCapexLoading]   = useState<Set<string>>(new Set());
  const [capexForm, setCapexForm]         = useState<{ activoId: string; descripcion: string; importe: string; fecha: string } | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [p, a] = await Promise.all([getPersonas(), getActivos()]);
      setPersonas(p); setActivos(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  // Enriquecer con nombre de titular
  const activosEnriquecidos = useMemo<ActivoPatrimonio[]>(() => activos.map(a => ({
    ...a,
    titular_nombre: a.titular_tipo === 'persona'
      ? (personas.find(p => p.id === a.titular_persona_id)?.nombre ?? '—')
      : (sociedadOptions.find(s => s.id === a.titular_sociedad_id)?.nombre ?? a.titular_sociedad_id ?? '—'),
  })), [activos, personas, sociedadOptions]);

  // Filtrado por titular
  const activosFiltrados = useMemo(() => {
    if (filtro === 'todos') return activosEnriquecidos;
    const persona = personas.find(p => p.id === filtro);
    if (persona) return activosEnriquecidos.filter(a => a.titular_persona_id === filtro);
    if (filtro === 'sociedades') return activosEnriquecidos.filter(a => a.titular_tipo === 'sociedad');
    return activosEnriquecidos;
  }, [activosEnriquecidos, filtro, personas]);

  // KPIs consolidados
  const kpis = useMemo(() => {
    const neto  = activosFiltrados.reduce((s, a) => s + valorNeto(a), 0);
    const bruto = activosFiltrados.reduce((s, a) => s + a.valor_actual * a.porcentaje_propiedad / 100, 0);
    const deuda = activosFiltrados.reduce((s, a) => s + deudaAjustada(a), 0);
    const apalancamiento = bruto > 0 ? (deuda / bruto) * 100 : null;

    const rentaMensualTotal = activosFiltrados.reduce((s, a) => s + (a.renta_mensual ?? 0), 0);
    const cashFlowMensual   = activosFiltrados.reduce((s, a) =>
      s + (a.renta_mensual ? a.renta_mensual - (a.cuota_mensual ?? 0) : 0), 0);
    const costesAnuales     = activosFiltrados.filter(a => a.renta_mensual && a.renta_mensual > 0)
      .reduce((s, a) => s + (a.coste_mantenimiento_anual ?? 0), 0);
    const capitalConRenta   = activosFiltrados.filter(a => (a.renta_mensual ?? 0) > 0)
      .reduce((s, a) => s + capitalExpuesto(a), 0);
    const rentabilidadBruta = capitalConRenta > 0 ? (rentaMensualTotal * 12 / capitalConRenta) * 100 : null;
    const rentabilidadNeta  = capitalConRenta > 0 ? ((rentaMensualTotal * 12 - costesAnuales) / capitalConRenta) * 100 : null;

    const pvItems = activosFiltrados.map(a => plusvaliaLatente(a)).filter((p): p is number => p != null);
    const plusvaliaTotal = pvItems.length > 0 ? pvItems.reduce((s, p) => s + p, 0) : null;

    const dividendoTotal = activosFiltrados.reduce((s, a) => { const d = dividendoAnual(a); return d != null ? s + d : s; }, 0);

    const bycat = Object.fromEntries(CATEGORIAS.map(cat => {
      const items = activosFiltrados.filter(a => a.categoria === cat.id);
      const catNeto     = items.reduce((s, a) => s + valorNeto(a), 0);
      const catDeuda    = items.reduce((s, a) => s + deudaAjustada(a), 0);
      const catRenta    = items.reduce((s, a) => s + (a.renta_mensual ?? 0), 0);
      const catPvItems  = items.map(a => plusvaliaLatente(a)).filter((p): p is number => p != null);
      const catPv       = catPvItems.length > 0 ? catPvItems.reduce((s, p) => s + p, 0) : null;
      const catDiv      = items.reduce((s, a) => { const d = dividendoAnual(a); return d != null ? s + d : s; }, 0);
      return [cat.id, { neto: catNeto, deuda: catDeuda, renta: catRenta, plusvalia: catPv, dividendo: catDiv, count: items.length }];
    })) as Record<CategoriaActivo, { neto: number; deuda: number; renta: number; plusvalia: number | null; dividendo: number; count: number }>;

    const adquisicionItems = activosFiltrados.filter(a => a.valor_adquisicion != null);
    const valorAdquisicionTotal = adquisicionItems.length > 0
      ? adquisicionItems.reduce((s, a) => s + (a.valor_adquisicion ?? 0), 0)
      : null;

    return { neto, bruto, deuda, apalancamiento, rentaMensualTotal, cashFlowMensual, rentabilidadBruta, rentabilidadNeta, plusvaliaTotal, dividendoTotal, valorAdquisicionTotal, bycat };
  }, [activosFiltrados]);

  const v = (n: number) => isPrivateMode ? '****' : formatCurrency(n);

  const loadCapex = async (activoId: string) => {
    if (capexLoadedFor.has(activoId)) return;
    setCapexLoading(s => { const n = new Set(s); n.add(activoId); return n; });
    try {
      const items = await getCapexByActivo(activoId);
      setCapexByActivo(prev => ({ ...prev, [activoId]: items }));
      setCapexLoadedFor(s => { const n = new Set(s); n.add(activoId); return n; });
    } catch { /* silently */ }
    finally { setCapexLoading(s => { const n = new Set(s); n.delete(activoId); return n; }); }
  };

  const handleAddCapex = async (activoId: string) => {
    if (!capexForm || !capexForm.descripcion.trim() || !capexForm.importe) return;
    try {
      const item = await insertCapex({ activo_id: activoId, descripcion: capexForm.descripcion.trim(), importe: parseFloat(capexForm.importe), fecha: capexForm.fecha });
      setCapexByActivo(prev => ({ ...prev, [activoId]: [...(prev[activoId] ?? []), item] }));
      setCapexForm(null);
    } catch { /* silently */ }
  };

  const handleDeleteCapex = async (capexId: string, activoId: string) => {
    try {
      await deleteCapex(capexId);
      setCapexByActivo(prev => ({ ...prev, [activoId]: (prev[activoId] ?? []).filter(c => c.id !== capexId) }));
    } catch { /* silently */ }
  };

  const toggleExpand = (id: string) => {
    if (!expanded.has(id)) void loadCapex(id);
    setExpanded(s => { const n = new Set(s); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n; });
  };

  const handleSave = async (data: FormState) => {
    setSaving(true);
    try {
      if (editTarget) {
        await updateActivo(editTarget.id, data);
      } else {
        await insertActivo(data);
      }
      setFormOpen(false); setEditTarget(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este activo?')) return;
    setDeleting(id);
    try { await deleteActivo(id); await load(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Error al eliminar'); }
    finally { setDeleting(null); }
  };

  const toggleCollapse = (cat: CategoriaActivo) =>
    setCollapsed(s => {
      const n = new Set(s);
      if (n.has(cat)) { n.delete(cat); } else { n.add(cat); }
      return n;
    });

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-zinc-600">
      <RefreshCw size={32} className="animate-spin text-blue-500" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <AlertTriangle size={40} className="text-rose-500" />
      <p className="text-sm text-zinc-400">{error}</p>
      <button onClick={() => { void load(); }} className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-all">
        Reintentar
      </button>
    </div>
  );

  const formInitial = editTarget
    ? { ...editTarget }
    : EMPTY_FORM(personas);

  return (
    <div className="p-8 max-w-5xl space-y-8">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Patrimonio</h1>
          <p className="text-xs text-zinc-500 mt-1">Activos personales y societarios consolidados</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { void load(); }} className="p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20 transition-all">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => { setEditTarget(null); setFormOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all">
            <Plus size={16} /> Nuevo Activo
          </button>
        </div>
      </div>

      {/* Filtro por titular */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { id: 'todos', label: 'Todo el grupo' },
          ...personas.map(p => ({ id: p.id, label: p.nombre })),
          { id: 'sociedades', label: 'Sociedades' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setFiltro(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
              filtro === tab.id
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* KPIs globales */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Patrimonio Neto"
          value={v(kpis.neto)}
          sub={`Bruto ${v(kpis.bruto)}`}
          tooltip="Valor de mercado total de los activos menos todas las deudas vivas. Es la riqueza real del titular después de cancelar todos los préstamos."
        />

        <KpiCard
          label="Valor Adquisición"
          value={kpis.valorAdquisicionTotal != null ? v(kpis.valorAdquisicionTotal) : '—'}
          sub={kpis.valorAdquisicionTotal != null && kpis.bruto > 0
            ? `Revalorización +${((kpis.bruto / kpis.valorAdquisicionTotal - 1) * 100).toFixed(1)}%`
            : 'Sin precio de coste registrado'}
          tooltip="Suma del precio pagado en la adquisición de cada activo. Compara con el Bruto actual para ver la revalorización total de la cartera desde la compra."
          colorClass={kpis.valorAdquisicionTotal != null ? 'text-zinc-200' : 'text-zinc-600'}
        />

        <KpiCard
          label="Deuda Total"
          value={kpis.deuda > 0 ? v(kpis.deuda) : '—'}
          sub={kpis.apalancamiento != null && kpis.deuda > 0
            ? `Apalancamiento ${kpis.apalancamiento.toFixed(1)}% s/ bruto`
            : 'Sin deuda'}
          tooltip="Total de hipotecas y préstamos vinculados a activos del patrimonio. El apalancamiento mide qué porcentaje del valor bruto está financiado con deuda."
          colorClass={kpis.deuda > 0 ? 'text-rose-400' : 'text-zinc-600'}
          borderClass={kpis.deuda > 0 ? 'border-rose-500/15 bg-rose-500/[0.03]' : 'border-white/5 bg-white/[0.01]'}
        />

        <KpiCard
          label="Cash Flow"
          value={kpis.rentaMensualTotal > 0 ? `${v(kpis.cashFlowMensual)}/mes` : '—'}
          sub={kpis.rentaMensualTotal > 0
            ? `Renta ${v(kpis.rentaMensualTotal)} · ${v(kpis.rentaMensualTotal * 12)}/año`
            : 'Sin activos con renta'}
          tooltip="Renta mensual cobrada de todos los activos menos las cuotas hipotecarias. Representa el dinero real que entra cada mes después de pagar la deuda."
          colorClass={kpis.rentaMensualTotal > 0
            ? kpis.cashFlowMensual >= 0 ? 'text-blue-400' : 'text-rose-400'
            : 'text-zinc-600'}
          borderClass={kpis.rentaMensualTotal > 0
            ? kpis.cashFlowMensual >= 0 ? 'border-blue-500/15 bg-blue-500/[0.03]' : 'border-rose-500/15 bg-rose-500/[0.03]'
            : 'border-white/5 bg-white/[0.01] opacity-50'}
        />

        <KpiCard
          label="Rentabilidad"
          value={kpis.rentabilidadBruta != null ? `${kpis.rentabilidadBruta.toFixed(2)}%` : '—'}
          sub={kpis.rentabilidadBruta != null && kpis.rentabilidadNeta != null
            ? `bruta · ${kpis.rentabilidadNeta.toFixed(2)}% neta`
            : 'Sin activos con renta'}
          tooltip="Rentabilidad anual sobre el capital invertido en activos que generan renta. Bruta = ingresos / capital; Neta = (ingresos − gastos mantenimiento) / capital."
          colorClass={kpis.rentabilidadBruta != null ? 'text-emerald-400' : 'text-zinc-600'}
          borderClass={kpis.rentabilidadBruta != null ? 'border-emerald-500/15 bg-emerald-500/[0.03]' : 'border-white/5 bg-white/[0.01] opacity-50'}
        />

        <KpiCard
          label="Plusvalía Latente"
          value={kpis.plusvaliaTotal != null
            ? `${kpis.plusvaliaTotal >= 0 ? '+' : ''}${v(kpis.plusvaliaTotal)}`
            : '—'}
          sub={kpis.plusvaliaTotal != null && kpis.valorAdquisicionTotal != null && kpis.valorAdquisicionTotal > 0
            ? `${((kpis.plusvaliaTotal / kpis.valorAdquisicionTotal) * 100).toFixed(1)}% s/ adquisición`
            : kpis.plusvaliaTotal != null && kpis.bruto > 0
            ? `${((kpis.plusvaliaTotal / kpis.bruto) * 100).toFixed(1)}% s/ cartera`
            : 'Sin precio de coste'}
          tooltip="Ganancia no realizada entre el valor de mercado actual y el precio de adquisición. Solo se materializa al vender. Incluye fondos e inversiones cotizadas."
          colorClass={kpis.plusvaliaTotal != null
            ? kpis.plusvaliaTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'
            : 'text-zinc-600'}
          borderClass={kpis.plusvaliaTotal != null
            ? kpis.plusvaliaTotal >= 0 ? 'border-emerald-500/15 bg-emerald-500/[0.03]' : 'border-rose-500/15 bg-rose-500/[0.03]'
            : 'border-white/5 bg-white/[0.01] opacity-50'}
        />
      </div>

      {/* Activos por categoría */}
      {activosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-600">
          <Building2 size={40} className="text-zinc-700" />
          <p className="text-sm font-semibold uppercase tracking-widest">Sin activos registrados</p>
          <button onClick={() => { setEditTarget(null); setFormOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-all">
            <Plus size={14} /> Añadir primer activo
          </button>
        </div>
      ) : (
        CATEGORIAS.map(cat => {
          const items = activosFiltrados.filter(a => a.categoria === cat.id);
          if (!items.length) return null;
          const isCollapsed = collapsed.has(cat.id);
          return (
            <div key={cat.id} className="space-y-3">
              <button onClick={() => toggleCollapse(cat.id)}
                className="w-full flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl border ${cat.color}`}>{cat.icon}</div>
                  <span className="text-sm font-semibold text-white uppercase tracking-wide">{cat.label}</span>
                  <span className="text-xs text-zinc-600 font-mono">{items.length} activo{items.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors">
                  {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </div>
              </button>

              {!isCollapsed && (
                <div className="space-y-2">
                  {items.map(activo => {
                    const neto  = valorNeto(activo);
                    const dias  = diasDesdeValoracion(activo.fecha_valoracion);
                    const stale = dias != null && dias > 180;
                    const isOpen = expanded.has(activo.id);
                    const pv     = isOpen ? plusvaliaLatente(activo) : null;
                    const pvPct  = isOpen ? plusvaliaPct(activo, pv) : null;
                    const ce     = capitalExpuesto(activo);
                    const rb     = isOpen ? rendimientoBruto(activo) : null;
                    const rn     = isOpen ? rendimientoNeto(activo) : null;
                    const cf     = isOpen ? cashFlowMensual(activo) : null;
                    const divAnual   = isOpen ? dividendoAnual(activo) : null;
                    const roi        = isOpen ? roiAnual(activo) : null;
                    const roiTot     = isOpen ? roiTotal(activo) : null;
                    const rdtoMes    = isOpen ? rendimientoMensualTAE(activo) : null;
                    return (
                      <div key={activo.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                        {/* Fila cabecera */}
                        <div className="flex items-center gap-2 px-4 py-3 hover:bg-white/[0.02] transition-all">
                          <button onClick={() => toggleExpand(activo.id)} className="flex-1 flex items-center gap-2 flex-wrap min-w-0 text-left">
                            <span className="text-sm font-medium text-white truncate">{activo.nombre}</span>
                            {activo.subcategoria && (
                              <span className="text-2xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded-md bg-white/5 text-zinc-500 shrink-0">
                                {SUBCATEGORIA_LABELS[activo.subcategoria] ?? activo.subcategoria}
                              </span>
                            )}
                            {filtro === 'todos' && (
                              <span className="text-2xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 shrink-0">
                                {activo.titular_nombre}
                              </span>
                            )}
                            {stale && (
                              <span className="text-2xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 shrink-0">
                                Val. &gt;6m
                              </span>
                            )}
                            {activo.deuda_viva > 0 && !isOpen && (
                              <span className="text-2xs font-semibold text-rose-400/70 shrink-0">· Deuda {v(deudaAjustada(activo))}</span>
                            )}
                          </button>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="text-right mr-1">
                              <p className="text-sm font-semibold text-emerald-400">{v(neto)}</p>
                              <p className="text-2xs text-zinc-600">neto</p>
                            </div>
                            <button onClick={() => { setEditTarget(activo); setFormOpen(true); }}
                              className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-all">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => { void handleDelete(activo.id); }} disabled={deleting === activo.id}
                              className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                              {deleting === activo.id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            </button>
                            <button onClick={() => toggleExpand(activo.id)} className="p-1.5 text-zinc-600">
                              {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          </div>
                        </div>

                        {/* Área expandida */}
                        {isOpen && (
                          <div className="px-4 pb-4 pt-1 border-t border-white/[0.04]">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                              <Stat label="Valor actual" value={v(activo.valor_actual)}
                                tooltip="Precio de mercado estimado del activo en la fecha de valoración registrada." />
                              {activo.valor_adquisicion != null && (
                                <Stat label="Valor adquisición" value={v(activo.valor_adquisicion)}
                                  tooltip="Precio total pagado al adquirir el activo, incluyendo impuestos y costes de compra." />
                              )}
                              {activo.porcentaje_propiedad < 100 && (
                                <Stat label="Capital expuesto" value={v(ce)}
                                  tooltip="Parte del valor actual que corresponde a tu porcentaje de propiedad. Es tu exposición real al activo." />
                              )}
                              {activo.deuda_viva > 0 && (() => {
                                const dAdj  = deudaAjustada(activo);
                                const meses = mesesDesdeValoracion(activo);
                                const ajustado = meses > 0 && dAdj < activo.deuda_viva;
                                return (
                                  <Stat
                                    label={ajustado ? `Deuda viva (−${meses}m)` : 'Deuda viva'}
                                    value={v(dAdj)}
                                    negative
                                    tooltip={ajustado
                                      ? `Ajustada automáticamente: ${v(activo.deuda_viva)} registrada − ${meses} mes${meses > 1 ? 'es' : ''} × ${v(activo.cuota_mensual ?? 0)}/mes desde ${new Date(activo.fecha_valoracion!).toLocaleDateString('es-ES')}. Edita la ficha para registrar el saldo real.`
                                      : 'Saldo pendiente de hipoteca o préstamo. Se resta del valor bruto para obtener el patrimonio neto.'}
                                  />
                                );
                              })()}
                              {pv != null && (
                                <Stat label="Plusvalía latente" value={v(pv)} highlight={pv > 0} negative={pv < 0}
                                  tooltip="Diferencia entre el valor actual y el precio de adquisición. No está realizada — solo se materializa al vender." />
                              )}
                              {pvPct != null && (
                                <Stat label="Plusvalía %" value={`${pvPct.toFixed(1)}%`} highlight={pvPct > 0} negative={pvPct < 0}
                                  tooltip="Rendimiento sobre el precio de adquisición. Mide cuánto ha ganado o perdido el activo en términos porcentuales desde la compra." />
                              )}
                              {activo.categoria === 'inmobiliario' && activo.deuda_viva > 0 && activo.valor_actual > 0 && (
                                <Stat label="LTV" value={`${((deudaAjustada(activo) / activo.valor_actual) * 100).toFixed(1)}%`}
                                  tooltip="Loan-to-Value: ratio deuda/valor del inmueble. Por encima del 80% el activo está muy apalancado y tiene menos colchón ante bajadas de precio." />
                              )}
                              {rb != null && (
                                <Stat label="Rdto. bruto" value={`${rb.toFixed(2)}%`} highlight
                                  tooltip="Renta anual bruta dividida entre el capital expuesto. Sin descontar gastos de mantenimiento ni impuestos." />
                              )}
                              {rn != null && (
                                <Stat label="Rdto. neto" value={`${rn.toFixed(2)}%`} highlight={rn > 0} negative={rn < 0}
                                  tooltip="Renta anual menos gastos de mantenimiento anuales, dividido entre el capital expuesto. Más conservador y realista que el bruto." />
                              )}
                              {cf != null && (
                                <Stat label="Cash flow/mes" value={v(cf)} highlight={cf > 0} negative={cf < 0}
                                  tooltip="Renta mensual cobrada menos la cuota hipotecaria mensual. Dinero real que queda en bolsillo cada mes después de pagar la deuda." />
                              )}
                              {divAnual != null && (
                                <Stat label="Dividendo/año" value={v(divAnual)} highlight
                                  tooltip="Dividendo total anual estimado: número de títulos × dividendo por título. No incluye la revalorización del precio." />
                              )}
                              {activo.tae_declarada != null && (
                                <Stat
                                  label="TAE declarada"
                                  value={`${activo.tae_declarada.toFixed(2)}%`}
                                  highlight
                                  tooltip="Tasa Anual Equivalente publicada por el fondo. Refleja la rentabilidad anual que ofrece el producto actualmente."
                                />
                              )}
                              {rdtoMes != null && (
                                <Stat
                                  label="Rend. estimado/mes"
                                  value={`≈ ${v(rdtoMes)}`}
                                  highlight
                                  tooltip={`Rendimiento mensual estimado sobre el saldo actual: ${v(activo.valor_actual)} × ${activo.tae_declarada}% / 12. Vs tener el mismo saldo a 0% en cuenta corriente.`}
                                />
                              )}
                              {roi != null && (
                                <Stat
                                  label="ROI anual (CAGR)"
                                  value={`${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`}
                                  highlight={roi > 0} negative={roi < 0}
                                  tooltip={`Rentabilidad anualizada compuesta (CAGR) desde ${new Date(activo.fecha_inicio_inversion!).toLocaleDateString('es-ES')}. Fórmula: ((valor_actual / coste_base)^(1/años) − 1). Si has hecho retiradas parciales, el resultado puede estar ligeramente sobreestimado.`}
                                />
                              )}
                              {roiTot != null && (
                                <Stat
                                  label="ROI total"
                                  value={`${roiTot >= 0 ? '+' : ''}${roiTot.toFixed(1)}%`}
                                  highlight={roiTot > 0} negative={roiTot < 0}
                                  tooltip="Rentabilidad total acumulada desde la primera aportación: ((valor_actual / coste_base) − 1). Sin anualizar."
                                />
                              )}
                              {(activo.categoria === 'fondo' || activo.categoria === 'cotizado') && !activo.fecha_inicio_inversion && (
                                <div className="col-span-2 rounded-xl bg-amber-500/5 border border-amber-500/15 p-3">
                                  <p className="text-2xs text-amber-500/80 font-medium">
                                    Añade la fecha de inicio de inversión para calcular el ROI% anual
                                  </p>
                                </div>
                              )}
                              {activo.porcentaje_propiedad < 100 && (
                                <Stat label="% Propiedad" value={`${activo.porcentaje_propiedad}%`}
                                  tooltip="Porcentaje del activo que pertenece al titular registrado. El resto puede pertenecer a otros socios o copropietarios." />
                              )}
                              {activo.fecha_valoracion && (
                                <Stat label="Valorado" value={new Date(activo.fecha_valoracion).toLocaleDateString('es-ES')}
                                  tooltip="Fecha de la última valoración registrada. Si supera los 6 meses aparece el aviso 'Val. >6m' en la cabecera del activo." />
                              )}
                            </div>
                            {activo.notas && <p className="mt-2 text-xs text-zinc-600 italic">{activo.notas}</p>}

                            {/* CAPEX / Reformas */}
                            <div className="mt-3 pt-3 border-t border-white/[0.04]">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                                  <Hammer size={10} />
                                  CAPEX / Reformas
                                  {(capexByActivo[activo.id]?.length ?? 0) > 0 && (
                                    <span className="normal-case tracking-normal font-medium text-amber-400/70">
                                      · {v(capexByActivo[activo.id]!.reduce((s, c) => s + c.importe, 0))}
                                    </span>
                                  )}
                                </p>
                                {capexForm?.activoId !== activo.id && (
                                  <button
                                    onClick={() => setCapexForm({ activoId: activo.id, descripcion: '', importe: '', fecha: new Date().toISOString().split('T')[0] ?? '' })}
                                    className="flex items-center gap-1 text-2xs font-semibold text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-colors"
                                  >
                                    <Plus size={9} /> Añadir
                                  </button>
                                )}
                              </div>

                              {capexLoading.has(activo.id) && <p className="text-2xs text-zinc-600 py-1">Cargando...</p>}

                              {(capexByActivo[activo.id]?.length ?? 0) > 0 && (
                                <div className="space-y-1 mb-2">
                                  {capexByActivo[activo.id]!.map(cx => (
                                    <div key={cx.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-xs text-zinc-300 truncate">{cx.descripcion}</span>
                                        <span className="text-2xs text-zinc-600 shrink-0">{new Date(cx.fecha + 'T00:00:00').toLocaleDateString('es-ES')}</span>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs font-semibold text-amber-400">{v(cx.importe)}</span>
                                        <button
                                          onClick={() => void handleDeleteCapex(cx.id, activo.id)}
                                          className="p-1 text-zinc-600 hover:text-rose-400 transition-colors rounded-md hover:bg-rose-500/10"
                                        >
                                          <Trash2 size={10} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {capexForm?.activoId === activo.id && (
                                <div className="p-3 rounded-xl bg-zinc-900/50 border border-white/[0.06] space-y-2">
                                  <input
                                    type="text"
                                    placeholder="Descripción (ej. Reforma cocina)"
                                    value={capexForm.descripcion}
                                    onChange={e => setCapexForm({ ...capexForm, descripcion: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                                  />
                                  <div className="grid grid-cols-2 gap-2">
                                    <input
                                      type="number"
                                      placeholder="Importe €"
                                      min="0"
                                      step="0.01"
                                      value={capexForm.importe}
                                      onChange={e => setCapexForm({ ...capexForm, importe: e.target.value })}
                                      className="px-3 py-2 rounded-lg bg-zinc-900 border border-white/10 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                                    />
                                    <input
                                      type="date"
                                      value={capexForm.fecha}
                                      onChange={e => setCapexForm({ ...capexForm, fecha: e.target.value })}
                                      className="px-3 py-2 rounded-lg bg-zinc-900 border border-white/10 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/50 transition-colors"
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => void handleAddCapex(activo.id)}
                                      disabled={!capexForm.descripcion.trim() || !capexForm.importe}
                                      className="flex-1 py-2 rounded-lg bg-blue-600/30 border border-blue-500/30 text-blue-300 text-2xs font-semibold uppercase tracking-widest hover:bg-blue-600/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    >
                                      Guardar
                                    </button>
                                    <button
                                      onClick={() => setCapexForm(null)}
                                      className="px-4 py-2 rounded-lg bg-zinc-900 border border-white/10 text-zinc-500 text-2xs font-semibold hover:text-zinc-300 transition-all"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Modal de formulario */}
      {formOpen && (
        <ActivoForm
          initial={formInitial}
          personas={personas}
          sociedadOptions={sociedadOptions}
          onSave={handleSave}
          onCancel={() => { setFormOpen(false); setEditTarget(null); }}
          saving={saving}
        />
      )}
    </div>
  );
}

function Stat({ label, value, highlight, negative, tooltip }: {
  label: string; value: string; highlight?: boolean; negative?: boolean; tooltip?: string;
}) {
  return (
    <div className="group relative rounded-xl bg-white/[0.03] border border-white/[0.05] p-3 cursor-default">
      <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${negative ? 'text-rose-400' : highlight ? 'text-emerald-400' : 'text-zinc-200'}`}>{value}</p>
      {tooltip && (
        <div className="absolute bottom-full left-0 mb-1.5 w-56 bg-zinc-800 border border-white/[0.1] rounded-xl px-3 py-2 text-2xs text-zinc-300 leading-relaxed z-50 pointer-events-none shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {tooltip}
          <div className="absolute top-full left-4 w-2 h-2 bg-zinc-800 border-r border-b border-white/[0.1] rotate-45 -mt-1" />
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, tooltip, colorClass = 'text-white', borderClass = 'border-white/10 bg-white/[0.02]' }: {
  label: string;
  value: string;
  sub?: string;
  tooltip?: string;
  colorClass?: string;
  borderClass?: string;
}) {
  return (
    <div className={`group relative rounded-2xl border p-4 cursor-default ${borderClass}`}>
      <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest leading-tight">{label}</p>
      <p className={`text-lg font-semibold mt-1.5 leading-tight break-all ${colorClass}`}>{value}</p>
      {sub && <p className="text-2xs text-zinc-600 font-medium mt-1.5 leading-tight">{sub}</p>}
      {tooltip && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-zinc-800 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-zinc-300 leading-relaxed z-50 pointer-events-none shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {tooltip}
          <div className="absolute top-full left-5 w-2 h-2 bg-zinc-800 border-r border-b border-white/[0.1] rotate-45 -mt-1" />
        </div>
      )}
    </div>
  );
}
