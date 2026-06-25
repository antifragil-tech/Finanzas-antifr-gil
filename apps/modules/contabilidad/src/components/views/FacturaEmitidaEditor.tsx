import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, BookOpen, Eye, SlidersHorizontal, Save, Lock, ChevronDown,
  ChevronLeft, ChevronRight, Search, Trash2, Plus, GripVertical, X, Check,
  Loader2, Bold, Italic, Underline, List, ListOrdered, AlignLeft,
  AlignCenter, AlignRight, Info, FolderOpen, AlertCircle, CreditCard,
} from 'lucide-react';
import type { FacturaEmitida, LineaFactura, Contacto, EstadoFacturaEmitida, SociedadContabilidad, CuentaBancariaSociedad } from '@alsari/types';
import { insertFacturaEmitida, updateFacturaEmitida, getCuentasBancarias, createCuentaBancaria } from '../../lib/contabilidadApi';

// ── Tax catalog ───────────────────────────────────────────────────────────────

type TaxType = 'iva' | 'retencion' | 'rec';
type Impuesto = { id: string; nombre: string; porcentaje: number; tipo: TaxType };

const IMPUESTOS_CAT: { grupo: string; items: Impuesto[] }[] = [
  { grupo: 'IVA', items: [
    { id: 'iva_21',      nombre: 'IVA 21%',                       porcentaje: 21,   tipo: 'iva' },
    { id: 'iva_10',      nombre: 'IVA 10%',                       porcentaje: 10,   tipo: 'iva' },
    { id: 'iva_7_5',     nombre: 'IVA 7,5%',                      porcentaje: 7.5,  tipo: 'iva' },
    { id: 'iva_5',       nombre: 'IVA 5%',                        porcentaje: 5,    tipo: 'iva' },
    { id: 'iva_4',       nombre: 'IVA 4%',                        porcentaje: 4,    tipo: 'iva' },
    { id: 'iva_0',       nombre: 'Exenta',                        porcentaje: 0,    tipo: 'iva' },
    { id: 'iva_ns',      nombre: 'No sujeto',                     porcentaje: 0,    tipo: 'iva' },
    { id: 'iva_intra_b', nombre: 'IVA Intracomunitario Bienes',   porcentaje: 0,    tipo: 'iva' },
    { id: 'iva_intra_s', nombre: 'IVA Intracomunitario Servicio', porcentaje: 0,    tipo: 'iva' },
  ] },
  { grupo: 'Retención', items: [
    { id: 'ret_19', nombre: 'Retención 19%',              porcentaje: -19, tipo: 'retencion' },
    { id: 'ret_15', nombre: 'Retención 15%',              porcentaje: -15, tipo: 'retencion' },
    { id: 'ret_7',  nombre: 'Retención 7%',               porcentaje: -7,  tipo: 'retencion' },
    { id: 'ret_5',  nombre: 'Retención 5% garantía obra', porcentaje: -5,  tipo: 'retencion' },
  ] },
  { grupo: 'Rec. de eq.', items: [
    { id: 'rec_5_2',  nombre: 'REC 5,2%',  porcentaje: 5.2,  tipo: 'rec' },
    { id: 'rec_1_75', nombre: 'REC 1,75%', porcentaje: 1.75, tipo: 'rec' },
    { id: 'rec_1_4',  nombre: 'REC 1,4%',  porcentaje: 1.4,  tipo: 'rec' },
    { id: 'rec_1',    nombre: 'REC 1%',    porcentaje: 1,    tipo: 'rec' },
    { id: 'rec_0_62', nombre: 'REC 0,62%', porcentaje: 0.62, tipo: 'rec' },
    { id: 'rec_0_5',  nombre: 'REC 0,5%',  porcentaje: 0.5,  tipo: 'rec' },
    { id: 'rec_0_26', nombre: 'REC 0,26%', porcentaje: 0.26, tipo: 'rec' },
    { id: 'rec_0',    nombre: 'REC 0%',    porcentaje: 0,    tipo: 'rec' },
  ] },
];
const IMPUESTOS_FLAT = IMPUESTOS_CAT.flatMap(g => g.items);

// ── Config ────────────────────────────────────────────────────────────────────

const SERIES_CONFIG = [
  { id: 'F', label: 'Línea F — F[YY]%%%%' },
  { id: 'A', label: 'Línea A — A[YY]%%%%' },
  { id: 'B', label: 'Línea B — B[YY]%%%%' },
  { id: 'R', label: 'Rectificativa R — R[YY]%%%%' },
];
const IDIOMAS  = [{ id: 'es', label: 'Español' }, { id: 'en', label: 'English' }, { id: 'fr', label: 'Français' }];
const MONEDAS  = [{ id: 'eur', label: 'EUR (€ 1,00)' }, { id: 'usd', label: 'USD ($ 1,00)' }, { id: 'gbp', label: 'GBP (£ 1,00)' }];
const METODOS_PAGO = [
  { id: '',        label: 'No seleccionada' },
  { id: 'transfer', label: 'Transferencia bancaria' },
  { id: 'contado',  label: 'Pago al contado' },
];
const CUENTAS_CONTABLES = [
  { codigo: '70000000', nombre: 'Ventas de mercaderías' },
  { codigo: '70500000', nombre: 'Prestaciones de servicios' },
  { codigo: '70600000', nombre: 'Otros ingresos' },
  { codigo: '75100000', nombre: 'Resultados de operaciones en común' },
];
const MODOS_DOC = [
  { id: 'normal',    label: 'Normal' },
  { id: 'precio_h',  label: 'Utilizar precio / hora' },
  { id: 'ocultar_u', label: 'Ocultar unidades' },
  { id: 'sin_imp',   label: 'Sin impuestos' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type LineType = 'linea' | 'titulo' | 'suplido';

type EditorLine = {
  _key: string;
  type: LineType;
  concepto: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  impuestos: string[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function genKey() { return Math.random().toString(36).slice(2, 9); }

function emptyLine(type: LineType = 'linea'): EditorLine {
  return { _key: genKey(), type, concepto: '', descripcion: '', cantidad: 1, precio: 0, impuestos: type === 'linea' ? ['iva_21'] : [] };
}

function calcLine(line: EditorLine) {
  const base = +(line.cantidad * line.precio).toFixed(2);
  if (line.type !== 'linea') return { base, ivaAmt: 0, retAmt: 0, recAmt: 0, total: base };
  const taxes  = IMPUESTOS_FLAT.filter(t => line.impuestos.includes(t.id));
  const ivaAmt = +taxes.filter(t => t.tipo === 'iva').reduce((s, t) => s + base * t.porcentaje / 100, 0).toFixed(2);
  const retAmt = +taxes.filter(t => t.tipo === 'retencion').reduce((s, t) => s + base * t.porcentaje / 100, 0).toFixed(2);
  const recAmt = +taxes.filter(t => t.tipo === 'rec').reduce((s, t) => s + base * t.porcentaje / 100, 0).toFixed(2);
  return { base, ivaAmt, retAmt, recAmt, total: +(base + ivaAmt + retAmt + recAmt).toFixed(2) };
}

function nextNumero(list: FacturaEmitida[], serie: string): string {
  const year = new Date().getFullYear();
  const nums = list.filter(f => f.serie === serie)
    .map(f => parseInt(f.numero_factura.split('-').pop() ?? '0', 10))
    .filter(n => !isNaN(n) && n > 0);
  return `${serie}-${year}-${String(nums.length > 0 ? Math.max(...nums) + 1 : 1).padStart(3, '0')}`;
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── VencimientoPopover ────────────────────────────────────────────────────────

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_NAMES   = ['LU','MA','MI','JU','VI','SA','DO'];

function VencimientoPopover({
  value, onChange, onClose, anchorRef,
}: {
  value: string; onChange: (v: string) => void;
  onClose: () => void; anchorRef: React.RefObject<HTMLElement | null>;
}) {
  const [calMonth, setCalMonth] = useState(() => {
    const d = value ? new Date(value + 'T00:00:00') : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [nDias, setNDias] = useState('');
  const [pos, setPos]     = useState({ top: 0, left: 0 });
  const today             = new Date(); today.setHours(0, 0, 0, 0);

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      const top = window.innerHeight - r.bottom < 320 ? r.top - 320 - 4 : r.bottom + 4;
      setPos({ top, left: r.left });
    }
  }, [anchorRef]);

  const yr = calMonth.getFullYear(), mo = calMonth.getMonth();
  const firstDow  = new Date(yr, mo, 1).getDay();
  const startOff  = firstDow === 0 ? 6 : firstDow - 1;
  const daysInMo  = new Date(yr, mo + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startOff).fill(null), ...Array.from({ length: daysInMo }, (_, i) => i + 1)];

  function isSelected(day: number) {
    return value === new Date(yr, mo, day).toISOString().slice(0, 10);
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onMouseDown={onClose} />
      <div
        style={{ top: pos.top, left: pos.left }}
        className="fixed z-[9999] w-72 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-4"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Quick days */}
        <div className="flex items-center gap-2 mb-3">
          {[7, 14, 30].map(d => (
            <button key={d} type="button"
              onClick={() => { onChange(addDays(today, d)); onClose(); }}
              className="flex-1 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors">
              {d} días
            </button>
          ))}
          <div className="flex items-center gap-1 flex-1">
            <input type="number" value={nDias} onChange={e => setNDias(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && nDias) { onChange(addDays(today, parseInt(nDias))); onClose(); } }}
              placeholder="N"
              className="w-10 h-7 px-1.5 bg-zinc-800 border border-white/10 rounded text-xs text-white text-center focus:outline-none [color-scheme:dark]" />
            <span className="text-2xs text-zinc-600">d</span>
          </div>
        </div>
        {/* Month nav */}
        <div className="flex items-center justify-between mb-2">
          <button type="button" onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="p-1 text-zinc-500 hover:text-zinc-300 rounded"><ChevronLeft size={14} /></button>
          <span className="text-xs font-medium text-zinc-300">{MONTH_NAMES[mo]} {yr}</span>
          <button type="button" onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="p-1 text-zinc-500 hover:text-zinc-300 rounded"><ChevronRight size={14} /></button>
        </div>
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map(d => <div key={d} className="text-center text-2xs font-semibold text-zinc-600 py-0.5">{d}</div>)}
        </div>
        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px">
          {cells.map((day, i) => day === null ? <div key={i} /> : (
            <button key={i} type="button" onClick={() => { onChange(new Date(yr, mo, day).toISOString().slice(0, 10)); onClose(); }}
              className={`aspect-square flex items-center justify-center text-xs rounded-lg transition-colors
                ${isSelected(day) ? 'bg-blue-600 text-white font-medium' : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white'}`}>
              {day}
            </button>
          ))}
        </div>
        {/* Multiple dates link */}
        <button type="button" className="mt-3 w-full text-center text-2xs text-blue-400 hover:text-blue-300 transition-colors">
          Múltiples fechas de vencimiento
        </button>
      </div>
    </>,
    document.body,
  );
}

// ── ContactoSearch ────────────────────────────────────────────────────────────

function ContactoSearch({
  contactos, selectedId, onSelect,
}: {
  contactos: Contacto[];
  selectedId: string;
  onSelect: (id: string, nombre: string, nif: string, dir: string) => void;
}) {
  const [open, setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos]     = useState({ top: 0, left: 0, width: 0 });
  const wrapRef           = useRef<HTMLDivElement>(null);
  const selected          = contactos.find(c => c.id === selectedId);

  function openDrop() {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 280) });
    setOpen(true);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contactos.filter(c =>
      c.nombre.toLowerCase().includes(q) || (c.nif ?? '').toLowerCase().includes(q));
  }, [contactos, search]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', close, { capture: true });
  }, [open]);

  return (
    <div ref={wrapRef}>
      <div
        onClick={openDrop}
        className={`flex items-center gap-2 h-10 px-3 rounded-lg border cursor-pointer transition-colors
          ${open ? 'border-blue-500/50 bg-zinc-800' : 'border-white/[0.08] bg-zinc-900/60 hover:border-white/15'}`}
      >
        <Search size={13} className="text-zinc-500 shrink-0" />
        <span className={`text-sm flex-1 truncate ${selected ? 'text-white font-medium' : 'text-zinc-500'}`}>
          {selected ? selected.nombre : 'Seleccionar contacto'}
        </span>
        {selected && (
          <button type="button" onClick={e => { e.stopPropagation(); onSelect('', '', '', ''); }}
            className="text-zinc-600 hover:text-zinc-300 shrink-0"><X size={12} /></button>
        )}
      </div>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onMouseDown={() => setOpen(false)} />
          <div style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="fixed z-[9999] bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            <div className="p-2 border-b border-white/[0.06]">
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar contacto…"
                className="w-full bg-zinc-800 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                onMouseDown={e => e.stopPropagation()} />
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0
                ? <p className="text-xs text-zinc-600 px-3 py-3 text-center">Sin resultados</p>
                : filtered.map(c => (
                  <button key={c.id} type="button"
                    onMouseDown={e => { e.stopPropagation(); onSelect(c.id, c.nombre, c.nif ?? '', c.direccion ?? ''); setOpen(false); setSearch(''); }}
                    className="w-full text-left px-3 py-2 hover:bg-white/[0.04] transition-colors">
                    <p className="text-sm text-white font-medium">{c.nombre}</p>
                    {c.nif && <p className="text-2xs text-zinc-500 font-mono">{c.nif}</p>}
                  </button>
                ))
              }
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

// ── ImpuestosCell ─────────────────────────────────────────────────────────────

function ImpuestosCell({ selectedIds, onChange, disabled }: {
  selectedIds: string[]; onChange: (ids: string[]) => void; disabled?: boolean;
}) {
  const [open, setOpen]   = useState(false);
  const [pos, setPos]     = useState({ top: 0, left: 0, width: 0 });
  const wrapRef           = useRef<HTMLDivElement>(null);
  const scrollRef         = useRef<HTMLDivElement>(null);
  const selected          = IMPUESTOS_FLAT.filter(t => selectedIds.includes(t.id));

  function openDrop() {
    if (disabled || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const top = window.innerHeight - r.bottom < 320 ? r.top - 320 - 4 : r.bottom + 4;
    setPos({ top, left: r.left, width: 220 });
    setOpen(true);
  }

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', close, { capture: true });
  }, [open]);

  const tagColor: Record<TaxType, string> = {
    iva:       'bg-blue-500/15 text-blue-300',
    retencion: 'bg-amber-500/15 text-amber-300',
    rec:       'bg-violet-500/15 text-violet-300',
  };

  return (
    <div ref={wrapRef} className="flex items-center gap-1 w-full min-w-0">
      <button type="button" onClick={() => { if (scrollRef.current) scrollRef.current.scrollLeft -= 60; }}
        className="shrink-0 text-zinc-700 hover:text-zinc-400 transition-colors"><ChevronLeft size={11} /></button>

      <div ref={scrollRef} onClick={openDrop}
        className={`flex items-center gap-1 overflow-x-hidden flex-1 min-h-[26px] cursor-pointer px-0.5`}>
        {selected.length === 0
          ? <span className="text-xs text-zinc-600 select-none">—</span>
          : selected.map(t => (
            <span key={t.id} className={`inline-flex items-center gap-0.5 text-2xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap shrink-0 ${tagColor[t.tipo]}`}>
              {t.nombre.replace('Retención ', 'Ret. ').replace('Intracomunitario ', 'Intra. ')}
              <button type="button" onClick={e => { e.stopPropagation(); toggle(t.id); }} className="opacity-60 hover:opacity-100">
                <X size={8} />
              </button>
            </span>
          ))
        }
      </div>

      <button type="button" onClick={() => { if (scrollRef.current) scrollRef.current.scrollLeft += 60; }}
        className="shrink-0 text-zinc-700 hover:text-zinc-400 transition-colors"><ChevronRight size={11} /></button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onMouseDown={() => setOpen(false)} />
          <div style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="fixed z-[9999] bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-y-auto max-h-[300px] py-1"
            onMouseDown={e => e.stopPropagation()}>
            {IMPUESTOS_CAT.map(g => (
              <div key={g.grupo}>
                <p className="text-2xs font-semibold text-zinc-600 uppercase tracking-widest px-3 pt-2 pb-1">{g.grupo}</p>
                {g.items.map(t => {
                  const active = selectedIds.includes(t.id);
                  return (
                    <button key={t.id} type="button" onMouseDown={() => toggle(t.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/[0.04] transition-colors">
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0
                        ${active ? 'bg-blue-600 border-blue-500' : 'border-white/20'}`}>
                        {active && <Check size={9} className="text-white" />}
                      </div>
                      <span className={active ? 'text-white font-medium' : 'text-zinc-400'}>{t.nombre}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

// ── PortalSelect (small reusable dropdown) ────────────────────────────────────

function PortalSelect({ value, onChange, options, disabled }: {
  value: string; onChange: (v: string) => void;
  options: { id: string; label: string }[]; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0, width: 0 });
  const btnRef          = useRef<HTMLButtonElement>(null);
  const sel             = options.find(o => o.id === value);

  function openMenu() {
    if (disabled || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const top = window.innerHeight - r.bottom < 200 ? r.top - 200 - 4 : r.bottom + 4;
    setPos({ top, left: r.left, width: r.width });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', close, { capture: true });
  }, [open]);

  return (
    <>
      <button ref={btnRef} type="button" disabled={disabled}
        onMouseDown={e => { e.preventDefault(); if (open) setOpen(false); else openMenu(); }}
        className={`w-full flex items-center justify-between h-9 px-3 rounded-lg border text-sm transition-colors
          ${open ? 'border-blue-500/50 bg-zinc-800 text-white' : 'border-white/[0.08] bg-zinc-900/60 hover:border-white/15 text-zinc-300'}
          ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <span className="truncate">{sel?.label ?? '—'}</span>
        <ChevronDown size={12} className="text-zinc-500 ml-2 shrink-0" />
      </button>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onMouseDown={() => setOpen(false)} />
          <div style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="fixed z-[9999] bg-zinc-900 border border-white/10 rounded-lg shadow-2xl overflow-y-auto max-h-[200px] py-1">
            {options.map(o => (
              <button key={o.id} type="button"
                onMouseDown={e => { e.stopPropagation(); onChange(o.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors
                  ${o.id === value ? 'bg-white/[0.08] text-white font-medium' : 'text-zinc-300 hover:bg-white/[0.04] hover:text-white'}`}>
                {o.label}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

// ── OpcionesDrawer ────────────────────────────────────────────────────────────

function OpcionesDrawer({ serie, setSerie, idioma, setIdioma, moneda, setMoneda, onClose }: {
  serie: string; setSerie: (v: string) => void;
  idioma: string; setIdioma: (v: string) => void;
  moneda: string; setMoneda: (v: string) => void;
  onClose: () => void;
}) {
  return createPortal(
    <>
      <div className="fixed inset-0 z-[200] bg-black/60" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full z-[201] w-80 bg-zinc-950 border-l border-white/10 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-medium text-white">Opciones</h3>
          <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-white rounded-md hover:bg-white/5 transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          <div>
            <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Numeración</p>
            <PortalSelect value={serie} onChange={setSerie} options={SERIES_CONFIG.map(s => ({ id: s.id, label: s.label }))} />
          </div>

          <div>
            <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Idioma</p>
            <PortalSelect value={idioma} onChange={setIdioma} options={IDIOMAS.map(i => ({ id: i.id, label: i.label }))} />
          </div>

          <div>
            <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Moneda</p>
            <PortalSelect value={moneda} onChange={setMoneda} options={MONEDAS.map(m => ({ id: m.id, label: m.label }))} />
          </div>

          <div>
            <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Plantilla email</p>
            <PortalSelect value="default" onChange={() => {}} options={[{ id: 'default', label: 'Plantilla por defecto' }]} />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" id="cuentas-all" className="rounded" disabled />
            <label htmlFor="cuentas-all" className="text-xs text-zinc-500">Mostrar todas las cuentas contables</label>
          </div>

          <button type="button" className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors">
            <span className="text-base">✏</span> Campos Factura-e
          </button>

          <div>
            <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Plantilla de diseño</p>
            <div className="grid grid-cols-3 gap-2">
              {['Clásica', 'Moderna', 'Minimalista'].map((t, i) => (
                <div key={t} className={`aspect-[0.7] rounded-lg border-2 transition-colors cursor-pointer flex items-end p-2
                  ${i === 0 ? 'border-blue-500 bg-blue-500/5' : 'border-white/[0.08] hover:border-white/20 bg-zinc-900/40'}`}>
                  <span className="text-2xs text-zinc-500 leading-tight">{t}</span>
                </div>
              ))}
            </div>
            <button type="button" className="mt-2 text-2xs text-blue-400 hover:text-blue-300 transition-colors">
              + Crear nueva plantilla de diseño
            </button>
          </div>

        </div>
      </div>
    </>,
    document.body,
  );
}

// ── Invoice Preview overlay ───────────────────────────────────────────────────

function buildInvoiceHtml(p: Omit<PreviewProps, 'isPrivateMode' | 'onClose'>): string {
  const fmt = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  const dataRows = p.lineasCalc.map(l => {
    if (l.type === 'titulo') {
      return `<tr>
        <td colspan="4" style="padding:14px 16px 6px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:#71717a;background:#fafafa;border-top:1px solid #e5e7eb">${l.concepto}</td>
      </tr>`;
    }
    return `<tr style="border-top:1px solid #f0f0f0">
      <td style="padding:14px 16px;vertical-align:top">
        <div style="font-size:13px;font-weight:600;color:#111827">${l.concepto || '—'}</div>
        ${l.descripcion ? `<div style="font-size:11px;color:#9ca3af;margin-top:2px">${l.descripcion}</div>` : ''}
      </td>
      <td style="padding:14px 16px;text-align:right;font-size:13px;color:#374151;vertical-align:top;white-space:nowrap">${fmt(l.precio)}</td>
      <td style="padding:14px 16px;text-align:center;font-size:13px;color:#374151;vertical-align:top">${l.cantidad}</td>
      <td style="padding:14px 16px;text-align:right;font-size:13px;font-weight:700;color:#111827;vertical-align:top;white-space:nowrap">${fmt(l.base)}</td>
    </tr>`;
  }).join('');

  const summaryRows = [
    `<tr><td style="padding:6px 0;font-size:12px;color:#6b7280">Sub Total</td><td style="padding:6px 0;font-size:12px;color:#374151;text-align:right;font-family:'Courier New',monospace">${fmt(p.totals.subtotalBruto)}</td></tr>`,
    p.totals.ivaTotal !== 0 ? `<tr><td style="padding:6px 0;font-size:12px;color:#6b7280">IVA</td><td style="padding:6px 0;font-size:12px;color:#374151;text-align:right;font-family:'Courier New',monospace">${fmt(p.totals.ivaTotal)}</td></tr>` : '',
    p.totals.retTotal !== 0 ? `<tr><td style="padding:6px 0;font-size:12px;color:#6b7280">Retención</td><td style="padding:6px 0;font-size:12px;color:#dc2626;text-align:right;font-family:'Courier New',monospace">- ${fmt(Math.abs(p.totals.retTotal))}</td></tr>` : '',
  ].filter(Boolean).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Factura ${p.numero}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    background: #f3f4f6;
    color: #111827;
    padding: 40px 24px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    max-width: 760px;
    min-height: 297mm;
    margin: 0 auto;
    background: #fff;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 8px 32px rgba(0,0,0,.06);
    display: flex;
    flex-direction: column;
  }
  .page-spacer { flex: 1; min-height: 40px; }
  table { width: 100%; border-collapse: collapse; }
  @media print {
    @page { size: A4; margin: 0; }
    body { background: white; padding: 0; }
    .page { box-shadow: none; border-radius: 0; min-height: 297mm; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER BAND -->
  <div style="background:#111827;padding:32px 40px;display:flex;align-items:flex-start;justify-content:space-between">
    <div>
      <img src="${p.logoUrl ?? ''}" alt="Alsari Capital" style="height:40px;margin-bottom:14px;object-fit:contain;filter:brightness(0) invert(1);opacity:.9" onerror="this.style.display='none'" />
      <div style="font-size:20px;font-weight:800;color:#fff;line-height:1.2">${p.emisorNombre || 'Alsari Capital'}</div>
      ${p.emisorCif ? `<div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:3px">CIF: ${p.emisorCif}</div>` : ''}
      ${p.emisorDomicilio ? `<div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:2px">${p.emisorDomicilio}${p.emisorLocalidad ? `, ${p.emisorLocalidad}` : ''}</div>` : ''}
      ${p.emisorEmail ? `<div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:2px">${p.emisorEmail}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div style="font-size:36px;font-weight:900;color:#fff;letter-spacing:-1px;line-height:1">Factura</div>
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:4px;align-items:flex-end">
        <div style="font-size:12px;color:rgba(255,255,255,.55)">Nº <span style="color:#fff;font-weight:700;font-family:'Courier New',monospace">${p.numero || '—'}</span></div>
        <div style="font-size:12px;color:rgba(255,255,255,.55)">Fecha: <span style="color:#fff;font-weight:600">${p.fecha || '—'}</span></div>
        ${p.vencimiento ? `<div style="font-size:12px;color:rgba(255,255,255,.55)">Vencimiento: <span style="color:#fff;font-weight:600">${p.vencimiento}</span></div>` : ''}
      </div>
    </div>
  </div>

  <!-- BILL TO + TOTAL DUE -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:28px 40px;border-bottom:1px solid #f3f4f6">
    <div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:8px">Facturado a</div>
      <div style="font-size:15px;font-weight:700;color:#111827">${p.clienteNombre || '—'}</div>
      ${p.clienteNif ? `<div style="font-size:12px;color:#6b7280;margin-top:3px">NIF / CIF: ${p.clienteNif}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:6px">Total a cobrar</div>
      <div style="font-size:28px;font-weight:900;color:#111827;letter-spacing:-1px">${fmt(p.totals.totalACobrar)}</div>
    </div>
  </div>

  <!-- LINE ITEMS TABLE -->
  <table>
    <thead>
      <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb">
        <th style="padding:12px 16px;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#6b7280">Descripción del artículo</th>
        <th style="padding:12px 16px;text-align:right;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;white-space:nowrap">Precio</th>
        <th style="padding:12px 16px;text-align:center;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#6b7280">Cant.</th>
        <th style="padding:12px 16px;text-align:right;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#6b7280">Total</th>
      </tr>
    </thead>
    <tbody>
      ${dataRows || `<tr><td colspan="4" style="padding:40px 16px;text-align:center;font-size:13px;color:#9ca3af">Sin líneas de concepto</td></tr>`}
    </tbody>
  </table>

  <!-- SPACER -->
  <div class="page-spacer"></div>

  <!-- TOTALS + FOOTER -->
  <div style="display:flex;justify-content:flex-end;padding:28px 40px;border-top:2px solid #e5e7eb">
    <table style="width:260px">
      <tbody>
        ${summaryRows}
        <tr>
          <td colspan="2" style="padding-top:10px"><div style="height:2px;background:#111827;border-radius:1px"></div></td>
        </tr>
        <tr>
          <td style="padding:10px 0 0;font-size:15px;font-weight:800;color:#111827">Grand Total</td>
          <td style="padding:10px 0 0;font-size:15px;font-weight:900;color:#111827;text-align:right;font-family:'Courier New',monospace">${fmt(p.totals.totalACobrar)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- DATOS BANCARIOS (solo si transferencia) -->
  ${p.metodoPago === 'transfer' && p.cuentaIban ? `
  <div style="padding:20px 40px;border-top:1px solid #e5e7eb;background:#f9fafb">
    <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:10px">Datos para el pago</div>
    ${p.cuentaTitular ? `<div style="font-size:12px;color:#374151;margin-bottom:3px"><span style="color:#9ca3af">Titular: </span>${p.cuentaTitular}</div>` : ''}
    <div style="font-size:14px;font-weight:700;font-family:'Courier New',monospace;color:#111827;letter-spacing:.05em;margin-bottom:3px">${p.cuentaIban.replace(/(.{4})/g, '$1 ').trim()}</div>
    ${p.cuentaBanco ? `<div style="font-size:12px;color:#6b7280">${p.cuentaBanco}</div>` : ''}
  </div>` : ''}

  <!-- FOOTER BAND -->
  <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;display:flex;align-items:center;justify-content:space-between">
    <div style="font-size:11px;color:#9ca3af">Generado con <span style="font-weight:700;color:#6b7280">Alsari Capital OS</span> · alsari.net</div>
    <div style="font-size:11px;color:#9ca3af">Nº ${p.numero || '—'}</div>
  </div>

</div>
</body>
</html>`;
}

type PreviewProps = {
  numero: string; serie: string; fecha: string; vencimiento: string;
  emisorNombre: string;
  emisorCif?: string;
  emisorDomicilio?: string;
  emisorLocalidad?: string;
  emisorEmail?: string;
  logoUrl?: string;
  clienteNombre: string; clienteNif: string;
  lineasCalc: (EditorLine & { base: number; ivaAmt: number; retAmt: number; recAmt: number; total: number })[];
  totals: { subtotalBruto: number; ivaTotal: number; retTotal: number; totalACobrar: number };
  metodoPago?: string;
  cuentaIban?: string;
  cuentaAlias?: string;
  cuentaTitular?: string;
  cuentaBanco?: string;
  isPrivateMode: boolean;
  onClose: () => void;
};

function FacturaPreview({ numero, serie, fecha, vencimiento, emisorNombre, emisorCif, emisorDomicilio, emisorLocalidad, emisorEmail, clienteNombre, clienteNif, lineasCalc, totals, metodoPago, cuentaIban, cuentaAlias, cuentaTitular, cuentaBanco, isPrivateMode, onClose }: PreviewProps) {
  const fmt = (n: number) => isPrivateMode ? '—' : n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  function handleDownloadPdf() {
    const win = window.open('', '_blank', 'width=860,height=1100');
    if (!win) return;
    win.document.write(buildInvoiceHtml({
      numero, serie, fecha, vencimiento, emisorNombre, clienteNombre, clienteNif, lineasCalc, totals,
      logoUrl: `${window.location.origin}/logo.png`,
      ...(emisorCif        && { emisorCif }),
      ...(emisorDomicilio  && { emisorDomicilio }),
      ...(emisorLocalidad  && { emisorLocalidad }),
      ...(emisorEmail      && { emisorEmail }),
      ...(metodoPago       && { metodoPago }),
      ...(cuentaIban       && { cuentaIban }),
      ...(cuentaAlias      && { cuentaAlias }),
      ...(cuentaTitular    && { cuentaTitular }),
      ...(cuentaBanco      && { cuentaBanco }),
    }));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  return createPortal(
    <div className="fixed inset-0 z-[300] flex bg-black/60 backdrop-blur-sm">
      {/* Top bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
        <button onClick={handleDownloadPdf}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
          <Save size={12} />Descargar PDF
        </button>
      </div>
      <button onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-white/10 text-zinc-300 transition-colors">
        <X size={16} />
      </button>
      <div className="flex-1 overflow-y-auto flex justify-center py-16 px-4">
        <div className="w-full max-w-[760px] bg-white rounded shadow-2xl overflow-hidden min-h-[1122px] flex flex-col font-sans">

          {/* Header band */}
          <div className="bg-zinc-900 px-10 py-8 flex items-start justify-between">
            <div>
              <img src="/logo.png" alt="Alsari Capital" className="h-10 mb-3 object-contain brightness-0 invert opacity-90" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <p className="text-xl font-extrabold text-white leading-tight">{emisorNombre || 'Alsari Capital'}</p>
              {emisorCif && <p className="text-xs text-zinc-400 mt-0.5">CIF: {emisorCif}</p>}
              {emisorDomicilio && <p className="text-xs text-zinc-400 mt-0.5">{emisorDomicilio}{emisorLocalidad ? `, ${emisorLocalidad}` : ''}</p>}
              {emisorEmail && <p className="text-xs text-zinc-400 mt-0.5">{emisorEmail}</p>}
            </div>
            <div className="text-right">
              <p className="text-4xl font-light text-white tracking-tight leading-none">Factura</p>
              <div className="mt-3 space-y-1">
                <p className="text-xs text-zinc-400">Nº <span className="text-white font-medium font-mono">{numero || '—'}</span></p>
                <p className="text-xs text-zinc-400">Fecha: <span className="text-white font-semibold">{fecha || '—'}</span></p>
                {vencimiento && <p className="text-xs text-zinc-400">Vencimiento: <span className="text-white font-semibold">{vencimiento}</span></p>}
              </div>
            </div>
          </div>

          {/* Bill to + total due */}
          <div className="px-10 py-7 flex justify-between items-start border-b border-zinc-100">
            <div>
              <p className="text-2xs font-medium uppercase tracking-widest text-zinc-400 mb-2">Facturado a</p>
              <p className="text-base font-medium text-zinc-900">{clienteNombre || '—'}</p>
              {clienteNif && !isPrivateMode && <p className="text-xs text-zinc-500 mt-1">NIF / CIF: {clienteNif}</p>}
            </div>
            <div className="text-right">
              <p className="text-2xs font-medium uppercase tracking-widest text-zinc-400 mb-1.5">Total a cobrar</p>
              <p className="text-3xl font-light text-zinc-900 tracking-tight">{fmt(totals.totalACobrar)}</p>
            </div>
          </div>

          {/* Table */}
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-50 border-b-2 border-zinc-200">
                <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-widest text-zinc-400">Descripción del artículo</th>
                <th className="px-4 py-3 text-right text-2xs font-semibold uppercase tracking-widest text-zinc-400 w-28">Precio</th>
                <th className="px-4 py-3 text-center text-2xs font-semibold uppercase tracking-widest text-zinc-400 w-16">Cant.</th>
                <th className="px-4 py-3 text-right text-2xs font-semibold uppercase tracking-widest text-zinc-400 w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineasCalc.length === 0
                ? <tr><td colSpan={4} className="py-12 text-center text-sm text-zinc-400">Sin líneas de concepto</td></tr>
                : lineasCalc.map((l, i) => l.type === 'titulo'
                    ? (
                      <tr key={i} className="bg-zinc-50 border-t border-zinc-100">
                        <td colSpan={4} className="px-4 py-3 text-2xs font-semibold uppercase tracking-widest text-zinc-500">{l.concepto}</td>
                      </tr>
                    ) : (
                      <tr key={i} className="border-t border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                        <td className="px-4 py-4">
                          <p className="text-sm font-semibold text-zinc-900">{l.concepto || '—'}</p>
                          {l.descripcion && <p className="text-xs text-zinc-400 mt-0.5">{l.descripcion}</p>}
                        </td>
                        <td className="px-4 py-4 text-right text-sm text-zinc-600 font-mono">{fmt(l.precio)}</td>
                        <td className="px-4 py-4 text-center text-sm text-zinc-600">{l.cantidad}</td>
                        <td className="px-4 py-4 text-right text-sm font-medium text-zinc-900 font-mono">{fmt(l.base)}</td>
                      </tr>
                    )
                )
              }
            </tbody>
          </table>

          {/* Spacer — pushes totals to bottom of A4 */}
          <div className="flex-1 min-h-[40px]" />

          {/* Totals */}
          <div className="flex justify-end px-10 py-8 border-t-2 border-zinc-200">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm text-zinc-500"><span>Sub Total</span><span className="font-mono">{fmt(totals.subtotalBruto)}</span></div>
              {totals.ivaTotal !== 0 && <div className="flex justify-between text-sm text-zinc-500"><span>IVA</span><span className="font-mono">{fmt(totals.ivaTotal)}</span></div>}
              {totals.retTotal !== 0 && <div className="flex justify-between text-sm text-zinc-500"><span>Retención</span><span className="font-mono text-rose-600">- {fmt(Math.abs(totals.retTotal))}</span></div>}
              <div className="h-px bg-zinc-900 my-1" />
              <div className="flex justify-between font-semibold text-base text-zinc-900">
                <span>Grand Total</span><span className="font-mono">{fmt(totals.totalACobrar)}</span>
              </div>
            </div>
          </div>

          {/* Datos bancarios (solo si transferencia) */}
          {metodoPago === 'transfer' && cuentaIban && (
            <div className="px-10 py-5 border-t border-zinc-100 bg-zinc-50">
              <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">Datos para el pago</p>
              <div className="space-y-1">
                {cuentaTitular && <p className="text-xs text-zinc-600"><span className="text-zinc-400">Titular: </span>{cuentaTitular}</p>}
                <p className="text-sm font-medium font-mono text-zinc-900 tracking-wider">{cuentaIban.replace(/(.{4})/g, '$1 ').trim()}</p>
                {cuentaBanco && <p className="text-xs text-zinc-500">{cuentaBanco}</p>}
                {cuentaAlias && <p className="text-2xs text-zinc-400">{cuentaAlias}</p>}
              </div>
            </div>
          )}

          {/* Footer band */}
          <div className="bg-zinc-50 border-t border-zinc-100 px-10 py-4 flex justify-between items-center">
            <p className="text-xs text-zinc-400">Generado con <span className="font-semibold text-zinc-500">Alsari Capital OS</span> · alsari.net</p>
            <p className="text-xs text-zinc-400 font-mono">Nº {numero || '—'}</p>
          </div>

        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export type FacturaEmitidaEditorProps = {
  factura: FacturaEmitida | null;
  facturasList: FacturaEmitida[];
  contactos: Contacto[];
  sociedades: SociedadContabilidad[];
  isPrivateMode: boolean;
  onBack: () => void;
  onSave: (f: FacturaEmitida) => void;
};

// ── Main Editor ───────────────────────────────────────────────────────────────

export function FacturaEmitidaEditor({
  factura, facturasList, contactos, sociedades, isPrivateMode, onBack, onSave,
}: FacturaEmitidaEditorProps) {
  const today = new Date().toISOString().slice(0, 10);

  // Serie + número
  const [serie, setSerie]         = useState(factura?.serie ?? 'F');
  const [numero, setNumero]       = useState(factura?.numero_factura ?? '');
  const [numManual, setNumManual] = useState(false);

  // Header
  const [contactoId, setContactoId]           = useState('');
  const [clienteNombre, setClienteNombre]     = useState(factura?.cliente_nombre ?? '');
  const [clienteNif, setClienteNif]           = useState(factura?.cliente_nif ?? '');
  const [clienteDireccion, setClienteDireccion] = useState(factura?.cliente_direccion ?? '');
  const [fecha, setFecha]                     = useState(factura?.fecha_factura ?? today);
  const [vencimiento, setVencimiento]         = useState(factura?.fecha_vencimiento ?? '');
  const [showVencPop, setShowVencPop]         = useState(false);
  const [sociedadId, setSociedadId]           = useState(factura?.sociedad_id_ref ?? (sociedades[0]?.id ?? ''));
  const vencBtnRef = useRef<HTMLButtonElement>(null);

  // Cuentas bancarias de la sociedad emisora
  const [cuentas, setCuentas]             = useState<CuentaBancariaSociedad[]>([]);
  const [cuentaId, setCuentaId]           = useState(factura?.cuenta_bancaria_iban ?? '');
  const [showAddCuenta, setShowAddCuenta] = useState(false);
  const [ncAlias, setNcAlias]             = useState('');
  const [ncTitular, setNcTitular]         = useState('');
  const [ncIban, setNcIban]               = useState('');
  const [ncBanco, setNcBanco]             = useState('');
  const [ncSwift, setNcSwift]             = useState('');
  const [savingCuenta, setSavingCuenta]   = useState(false);

  // Lines
  const [lineas, setLineas] = useState<EditorLine[]>(() => {
    if (factura?.lineas?.length) {
      return factura.lineas.map(l => ({
        _key: genKey(), type: 'linea' as LineType,
        concepto: l.descripcion, descripcion: '',
        cantidad: l.cantidad, precio: l.precio_unitario,
        impuestos: l.tipo_iva > 0 ? ['iva_21'] : ['iva_0'],
      }));
    }
    return [emptyLine(), emptyLine()];
  });

  // Drag state
  const dragIdxRef = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // Modo documento (header popover)
  const [modoDoc, setModoDoc]             = useState('normal');
  const [mostrarUnidad, setMostrarUnidad] = useState(false);
  const [showModoDoc, setShowModoDoc]     = useState(false);
  const [modoDocPos, setModoDocPos]       = useState({ top: 0, left: 0 });
  const modoDocRef = useRef<HTMLButtonElement>(null);

  // Add line dropdown
  const [showAddMenu, setShowAddMenu]   = useState(false);
  const [addMenuPos, setAddMenuPos]     = useState({ top: 0, left: 0 });
  const addBtnRef = useRef<HTMLButtonElement>(null);

  // Options
  const [idioma, setIdioma]       = useState('es');
  const [moneda, setMoneda]       = useState('eur');
  const [showOpciones, setShowOpciones] = useState(false);
  const [showPreview, setShowPreview]   = useState(false);

  // Extras
  const [showTextoDoc, setShowTextoDoc]   = useState(false);
  const [showMensaje, setShowMensaje]     = useState(false);
  const [mensajeFinal, setMensajeFinal]   = useState('');
  const richTextRef = useRef<HTMLDivElement>(null);

  // Discount
  const [showDescuento, setShowDescuento]       = useState(false);
  const [descGlobalActivo, setDescGlobalActivo] = useState(false);
  const [descModo, setDescModo]                 = useState<'pct' | 'fijo'>('pct');
  const [descValor, setDescValor]               = useState('');

  // Categorización
  const [cuentaContable, setCuentaContable] = useState('70000000');
  const [tags, setTags]                     = useState<string[]>([]);
  const [tagInput, setTagInput]             = useState('');
  const [notaInterna, setNotaInterna]       = useState('');
  const [metodoPago, setMetodoPago]         = useState(factura?.metodo_pago ?? '');

  // Approve dropdown
  const [showApproveMenu, setShowApproveMenu] = useState(false);
  const approveBtnRef = useRef<HTMLDivElement>(null);
  const [approveMenuPos, setApproveMenuPos]   = useState({ top: 0, right: 0 });

  // Save state
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  // Auto-numero on serie change
  useEffect(() => {
    if (!factura && !numManual) setNumero(nextNumero(facturasList, serie));
  }, [serie, factura, numManual, facturasList]);

  // Load bank accounts whenever the emitting society changes
  useEffect(() => {
    if (!sociedadId) return;
    void getCuentasBancarias(sociedadId).then(setCuentas).catch(() => {});
  }, [sociedadId]);

  // ── Calculations ──────────────────────────────────────────────────────────

  const lineasCalc = useMemo(() => lineas.map(l => ({ ...l, ...calcLine(l) })), [lineas]);

  const totals = useMemo(() => {
    const subtotalBruto = +lineasCalc.reduce((s, l) => s + l.base, 0).toFixed(2);
    const ivaTotal      = +lineasCalc.reduce((s, l) => s + l.ivaAmt, 0).toFixed(2);
    const retTotal      = +lineasCalc.reduce((s, l) => s + l.retAmt, 0).toFixed(2);
    const recTotal      = +lineasCalc.reduce((s, l) => s + l.recAmt, 0).toFixed(2);
    const dv            = parseFloat(descValor) || 0;
    const descImporte   = descGlobalActivo && dv > 0
      ? descModo === 'pct' ? +(subtotalBruto * dv / 100).toFixed(2) : +dv.toFixed(2)
      : 0;
    const factor        = subtotalBruto > 0 ? (subtotalBruto - descImporte) / subtotalBruto : 1;
    const ivaAdj        = +(ivaTotal * factor).toFixed(2);
    const recAdj        = +(recTotal * factor).toFixed(2);
    const subtotal      = +(subtotalBruto - descImporte).toFixed(2);
    const total         = +(subtotal + ivaAdj + recAdj).toFixed(2);
    const totalACobrar  = +(total + retTotal).toFixed(2);
    return { subtotalBruto, descImporte, subtotal, ivaTotal: ivaAdj, retTotal, recTotal: recAdj, total, totalACobrar };
  }, [lineasCalc, descGlobalActivo, descValor, descModo]);

  const fmt = useCallback((n: number) =>
    isPrivateMode ? '—' : n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €',
  [isPrivateMode]);

  // ── Add bank account ──────────────────────────────────────────────────────

  async function handleAddCuenta() {
    if (!ncAlias.trim() || !ncTitular.trim() || !ncIban.trim()) return;
    setSavingCuenta(true);
    try {
      const nueva = await createCuentaBancaria({
        sociedad_id_ref: sociedadId,
        alias: ncAlias.trim(),
        titular: ncTitular.trim(),
        banco: ncBanco.trim() || null,
        iban: ncIban.trim().replace(/\s+/g, ''),
        swift: ncSwift.trim() || null,
        activa: true,
      });
      setCuentas(prev => [...prev, nueva]);
      setCuentaId(nueva.iban);
      setShowAddCuenta(false);
      setNcAlias(''); setNcTitular(''); setNcIban(''); setNcBanco(''); setNcSwift('');
    } catch { /* silent */ }
    setSavingCuenta(false);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave(estado: EstadoFacturaEmitida) {
    if (!clienteNombre.trim()) { setError('El nombre del cliente es obligatorio'); return; }
    if (!numero.trim())        { setError('El número de factura es obligatorio'); return; }
    setSaving(true); setError(null);
    try {
      const lineasPayload: LineaFactura[] = lineasCalc
        .filter(l => l.type !== 'titulo')
        .map(l => {
          const primerIva = IMPUESTOS_FLAT.find(t => l.impuestos.includes(t.id) && t.tipo === 'iva');
          return {
            descripcion:     l.concepto + (l.descripcion ? '\n' + l.descripcion : ''),
            cantidad:        l.cantidad,
            precio_unitario: l.precio,
            tipo_iva:        primerIva?.porcentaje ?? 21,
            subtotal:        l.base,
          };
        });

      const primerIva = IMPUESTOS_FLAT.find(t =>
        lineas.some(l => l.impuestos.includes(t.id)) && t.tipo === 'iva');
      const primerRet = IMPUESTOS_FLAT.find(t =>
        lineas.some(l => l.impuestos.includes(t.id)) && t.tipo === 'retencion');

      const notasPartes = [
        notaInterna  ? `[NOTA INTERNA] ${notaInterna}` : '',
        mensajeFinal ? `[MENSAJE FINAL] ${mensajeFinal}` : '',
        tags.length  ? `[TAGS] ${tags.join(', ')}` : '',
        `[CUENTA CONTABLE] ${cuentaContable}`,
      ].filter(Boolean);

      const cuentaSeleccionada = metodoPago === 'transfer'
        ? cuentas.find(c => c.iban === cuentaId) ?? null
        : null;

      const payload = {
        sociedad_id_ref:          sociedadId,
        serie,
        numero_factura:           numero.trim(),
        cliente_nombre:           clienteNombre.trim(),
        cliente_nif:              clienteNif || null,
        cliente_direccion:        clienteDireccion || null,
        fecha_factura:            fecha,
        fecha_vencimiento:        vencimiento || null,
        lineas:                   lineasPayload,
        base_imponible:           totals.subtotalBruto,
        tipo_iva:                 primerIva?.porcentaje ?? 21,
        cuota_iva:                totals.ivaTotal,
        retencion_pct:            Math.abs(primerRet?.porcentaje ?? 0),
        retencion_importe:        Math.abs(totals.retTotal),
        total:                    totals.total,
        total_a_cobrar:           totals.totalACobrar,
        estado,
        movimiento_id:            null,
        notas:                    notasPartes.join('\n') || null,
        metodo_pago:              metodoPago || null,
        cuenta_bancaria_iban:     cuentaSeleccionada?.iban ?? null,
        cuenta_bancaria_alias:    cuentaSeleccionada?.alias ?? null,
        cuenta_bancaria_titular:  cuentaSeleccionada?.titular ?? null,
      };

      if (factura) {
        await updateFacturaEmitida(factura.id, payload);
        onSave({ ...factura, ...payload });
      } else {
        const created = await insertFacturaEmitida(payload);
        onSave(created);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  // ── Drag handlers ─────────────────────────────────────────────────────────

  function handleDragStart(i: number) { dragIdxRef.current = i; }
  function handleDragEnter(i: number) { setDragOver(i); }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleDrop(targetIdx: number) {
    const from = dragIdxRef.current;
    if (from !== null && from !== targetIdx) {
      setLineas(prev => {
        const next = [...prev];
        const [item] = next.splice(from, 1);
        next.splice(targetIdx, 0, item!);
        return next;
      });
    }
    dragIdxRef.current = null;
    setDragOver(null);
  }

  function updateLinea(key: string, patch: Partial<Omit<EditorLine, '_key'>>) {
    setLineas(prev => prev.map(l => l._key === key ? { ...l, ...patch } : l));
  }

  // ── Add line popover pos ──────────────────────────────────────────────────

  function openAddMenu() {
    if (!addBtnRef.current) return;
    const r = addBtnRef.current.getBoundingClientRect();
    setAddMenuPos({ top: r.bottom + 4, left: r.left });
    setShowAddMenu(true);
  }

  function openApproveMenu() {
    if (!approveBtnRef.current) return;
    const r = approveBtnRef.current.getBoundingClientRect();
    setApproveMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    setShowApproveMenu(true);
  }

  // ── Rich text format ──────────────────────────────────────────────────────

  function execFmt(cmd: string, val?: string) {
    richTextRef.current?.focus();
    document.execCommand(cmd, false, val);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-16">

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-rose-500/8 border border-rose-500/20 rounded-xl px-4 py-2.5 shrink-0">
          <AlertCircle size={13} className="text-rose-400 shrink-0" />
          <p className="text-xs text-rose-300 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-rose-500/60 hover:text-rose-400"><X size={11} /></button>
        </div>
      )}

      {/* ── TOP BAR ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-200 border border-white/[0.08] hover:border-white/15 rounded-xl transition-all">
          <ArrowLeft size={13} />Volver
        </button>
        <h1 className="text-lg font-semibold text-white">
          {factura ? `Factura ${factura.numero_factura}` : 'Nueva factura'}
        </h1>

        <div className="ml-auto flex items-center gap-2">
          <button type="button" title="Plantillas"
            className="p-2 text-zinc-500 hover:text-zinc-300 border border-white/[0.08] hover:border-white/15 rounded-xl transition-all">
            <BookOpen size={14} />
          </button>
          <button type="button" onClick={() => setShowPreview(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-xl transition-all
              ${showPreview ? 'bg-white/5 border-white/15 text-zinc-200' : 'border-white/[0.08] text-zinc-500 hover:text-zinc-300 hover:border-white/15'}`}>
            <Eye size={13} />Vista previa
          </button>
          <button type="button" onClick={() => setShowOpciones(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-xl transition-all
              ${showOpciones ? 'bg-white/5 border-white/15 text-zinc-200' : 'border-white/[0.08] text-zinc-500 hover:text-zinc-300 hover:border-white/15'}`}>
            <SlidersHorizontal size={13} />Opciones
          </button>
          <button type="button" onClick={() => { void handleSave('borrador'); }} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 border border-white/[0.08] hover:border-white/15 rounded-xl transition-all disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Guardar borrador
          </button>
          {/* Approve + dropdown */}
          <div ref={approveBtnRef} className="flex items-center">
            <button type="button" onClick={() => { void handleSave('emitida'); }} disabled={saving}
              className="flex items-center gap-1.5 pl-4 pr-3 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-l-xl transition-colors disabled:opacity-50">
              <Lock size={13} />Aprobar
            </button>
            <button type="button" onClick={openApproveMenu}
              className="flex items-center px-2 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-r-xl border-l border-blue-500/30 transition-colors">
              <ChevronDown size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Approve dropdown portal */}
      {showApproveMenu && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onMouseDown={() => setShowApproveMenu(false)} />
          <div style={{ top: approveMenuPos.top, right: approveMenuPos.right }}
            className="fixed z-[9999] bg-zinc-900 border border-white/10 rounded-xl shadow-2xl py-1 w-48">
            <button onMouseDown={() => { void handleSave('emitida'); setShowApproveMenu(false); }}
              className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.04]">Guardar y crear nuevo</button>
            <button onMouseDown={() => { onBack(); setShowApproveMenu(false); }}
              className="w-full text-left px-3 py-2 text-sm text-rose-400 hover:bg-white/[0.04]">Cancelar</button>
          </div>
        </>,
        document.body,
      )}

      {/* ── CABECERA (4 campos) ───────────────────────────────────────────── */}
      <div className="bg-zinc-900/40 rounded-2xl border border-white/[0.06] p-5">
        <div className="grid grid-cols-4 gap-5">
          {/* Contacto */}
          <div>
            <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Contacto</p>
            <ContactoSearch contactos={contactos} selectedId={contactoId}
              onSelect={(id, nombre, nif, dir) => { setContactoId(id); setClienteNombre(nombre); setClienteNif(nif); setClienteDireccion(dir); }} />
          </div>
          {/* Número */}
          <div>
            <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Número de documento</p>
            <input value={numero} onChange={e => { setNumero(e.target.value); setNumManual(true); }}
              className="w-full h-10 px-3 bg-zinc-900/60 border border-white/[0.08] hover:border-white/15 focus:border-blue-500/50 rounded-lg text-sm text-white font-mono focus:outline-none [color-scheme:dark] transition-colors" />
            <p className="text-2xs text-zinc-600 mt-1">Auto-calculado · editable si necesitas ajustarlo</p>
          </div>
          {/* Fecha */}
          <div>
            <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Fecha</p>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full h-10 px-3 bg-zinc-900/60 border border-white/[0.08] hover:border-white/15 focus:border-blue-500/50 rounded-lg text-sm text-white focus:outline-none [color-scheme:dark] transition-colors" />
          </div>
          {/* Vencimiento */}
          <div>
            <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Vencimiento</p>
            <button ref={vencBtnRef} type="button" onClick={() => setShowVencPop(v => !v)}
              className={`w-full h-10 px-3 flex items-center justify-between border rounded-lg text-sm transition-colors
                ${vencimiento ? 'text-white' : 'text-zinc-500'}
                ${showVencPop ? 'border-blue-500/50 bg-zinc-800' : 'border-white/[0.08] bg-zinc-900/60 hover:border-white/15'}`}>
              <span>{vencimiento || 'Elige'}</span>
              {vencimiento
                ? <button type="button" onClick={e => { e.stopPropagation(); setVencimiento(''); }} className="text-zinc-600 hover:text-zinc-300"><X size={12} /></button>
                : <ChevronDown size={13} className="text-zinc-500" />
              }
            </button>
            {showVencPop && <VencimientoPopover value={vencimiento} onChange={setVencimiento} onClose={() => setShowVencPop(false)} anchorRef={vencBtnRef} />}
          </div>
        </div>
      </div>

      {/* Sociedad emisora */}
      {sociedades.length > 1 && (
        <div className="px-5 pb-5 -mt-2">
          <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Sociedad emisora</p>
          <PortalSelect
            value={sociedadId}
            onChange={setSociedadId}
            options={sociedades.map(s => ({ id: s.id, label: s.nombre }))}
          />
        </div>
      )}

      {/* ── TABLA DE LÍNEAS ───────────────────────────────────────────────── */}
      <div className="bg-zinc-900/40 rounded-2xl border border-white/[0.06] overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 800 }}>
            <colgroup>
              <col style={{ width: 36 }} />
              <col />
              <col style={{ width: 150 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 220 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 36 }} />
            </colgroup>
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="py-3" />
                <th className="text-left px-3 py-3 text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Concepto</th>
                <th className="text-left px-2 py-3 text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Descripción</th>
                <th className="py-3">
                  <button ref={modoDocRef} type="button"
                    onClick={() => {
                      if (modoDocRef.current) {
                        const r = modoDocRef.current.getBoundingClientRect();
                        setModoDocPos({ top: r.bottom + 4, left: r.left });
                      }
                      setShowModoDoc(v => !v);
                    }}
                    className="flex items-center gap-1 text-2xs font-semibold text-zinc-500 uppercase tracking-widest hover:text-zinc-300 transition-colors mx-auto">
                    Cantidad <ChevronDown size={9} />
                  </button>
                </th>
                <th className="text-right px-2 py-3 text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Precio</th>
                <th className="text-left px-2 py-3 text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Impuestos</th>
                <th className="text-right px-3 py-3 text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Total</th>
                <th className="py-3" />
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.03]">
              {lineas.map((line, i) => {
                const calc = lineasCalc[i];
                const isDragOver = dragOver === i;

                if (line.type === 'titulo') {
                  return (
                    <tr key={line._key}
                      draggable
                      onDragStart={() => handleDragStart(i)}
                      onDragEnter={() => handleDragEnter(i)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(i)}
                      onDragEnd={() => { dragIdxRef.current = null; setDragOver(null); }}
                      className={`bg-zinc-800/30 transition-all ${isDragOver ? 'border-t-2 border-blue-500' : ''}`}>
                      <td className="pl-2">
                        <button type="button" className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400">
                          <GripVertical size={13} />
                        </button>
                      </td>
                      <td colSpan={6} className="px-3 py-2">
                        <input value={line.concepto} onChange={e => updateLinea(line._key, { concepto: e.target.value })}
                          className="w-full bg-transparent text-sm font-medium text-zinc-300 focus:outline-none placeholder:text-zinc-600"
                          placeholder="Título de sección…" />
                      </td>
                      <td className="pr-2 text-center">
                        <button type="button" onClick={() => setLineas(prev => prev.filter(l => l._key !== line._key))}
                          className="text-zinc-600 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={line._key}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragEnter={() => handleDragEnter(i)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(i)}
                    onDragEnd={() => { dragIdxRef.current = null; setDragOver(null); }}
                    className={`group transition-all hover:bg-white/[0.01] ${isDragOver ? 'border-t-2 border-blue-500' : ''}`}>
                    {/* Drag handle */}
                    <td className="pl-2">
                      <button type="button" className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400 transition-colors">
                        <GripVertical size={13} />
                      </button>
                    </td>
                    {/* Concepto */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <input value={line.concepto}
                          onChange={e => updateLinea(line._key, { concepto: e.target.value })}
                          className="flex-1 bg-transparent text-sm text-white focus:outline-none placeholder:text-zinc-600 min-w-0"
                          placeholder="Escribe el concepto o usa @" />
                        <button type="button" className="shrink-0 text-zinc-700 hover:text-zinc-400 transition-colors"><Search size={11} /></button>
                      </div>
                      {line.type === 'suplido' && (
                        <span className="text-2xs font-medium bg-zinc-700/50 text-zinc-400 px-1.5 py-0.5 rounded mt-0.5 inline-block">Suplido</span>
                      )}
                    </td>
                    {/* Descripción */}
                    <td className="px-2 py-2">
                      <textarea value={line.descripcion}
                        onChange={e => updateLinea(line._key, { descripcion: e.target.value })}
                        rows={1}
                        className="w-full bg-transparent text-xs text-zinc-400 focus:outline-none placeholder:text-zinc-700 resize-y min-h-[24px]"
                        placeholder="Desc" />
                    </td>
                    {/* Cantidad */}
                    <td className="px-2 py-2">
                      {modoDoc !== 'ocultar_u' && (
                        <input type="number" value={line.cantidad}
                          onChange={e => updateLinea(line._key, { cantidad: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-transparent text-sm text-white text-center focus:outline-none [color-scheme:dark]" />
                      )}
                    </td>
                    {/* Precio */}
                    <td className="px-2 py-2">
                      <input type="number" value={line.precio}
                        onChange={e => updateLinea(line._key, { precio: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-transparent text-sm text-white text-right focus:outline-none [color-scheme:dark]" />
                    </td>
                    {/* Impuestos */}
                    <td className="px-2 py-2">
                      {modoDoc !== 'sin_imp' && (
                        <ImpuestosCell selectedIds={line.impuestos} onChange={ids => updateLinea(line._key, { impuestos: ids })} />
                      )}
                    </td>
                    {/* Total */}
                    <td className="px-3 py-2 text-right">
                      <span className="text-sm font-medium font-mono text-white tabular-nums">{fmt(calc?.total ?? 0)}</span>
                    </td>
                    {/* Delete */}
                    <td className="pr-2 text-center">
                      <button type="button" onClick={() => setLineas(prev => prev.filter(l => l._key !== line._key))}
                        className="text-zinc-700 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Modo documento popover */}
        {showModoDoc && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onMouseDown={() => setShowModoDoc(false)} />
            <div className="fixed z-[9999] w-64 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-4"
              style={{ top: modoDocPos.top, left: modoDocPos.left }}
              onMouseDown={e => e.stopPropagation()}>
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-xs font-medium text-zinc-400">Modo documento</p>
                <Info size={11} className="text-zinc-600" />
              </div>
              <div className="space-y-1 mb-3">
                {MODOS_DOC.map(m => (
                  <button key={m.id} type="button" onClick={() => setModoDoc(m.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors
                      ${modoDoc === m.id ? 'bg-blue-600/20 text-blue-300 font-medium' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={mostrarUnidad} onChange={e => setMostrarUnidad(e.target.checked)}
                  className="rounded accent-blue-500" />
                <span className="text-xs text-zinc-400">Mostrar tipo de unidad</span>
              </label>
            </div>
          </>,
          document.body,
        )}

        {/* Add line / Add discount bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.04]">
          <div className="flex items-center">
            <button type="button" onClick={() => setLineas(prev => [...prev, emptyLine()])}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 border border-white/[0.08] hover:border-white/15 rounded-l-lg transition-all">
              <Plus size={12} />Añadir línea
            </button>
            <div className="relative">
              <button ref={addBtnRef} type="button" onClick={openAddMenu}
                className="flex items-center px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 border border-l-0 border-white/[0.08] hover:border-white/15 rounded-r-lg transition-all">
                <ChevronDown size={12} />
              </button>
              {showAddMenu && createPortal(
                <>
                  <div className="fixed inset-0 z-[9998]" onMouseDown={() => setShowAddMenu(false)} />
                  <div className="fixed z-[9999] bg-zinc-900 border border-white/10 rounded-xl shadow-2xl py-1 w-44"
                    style={{ top: addMenuPos.top, left: addMenuPos.left }}
                    onMouseDown={e => e.stopPropagation()}>
                    <button onMouseDown={() => { setLineas(prev => [...prev, emptyLine('titulo')]); setShowAddMenu(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.04]">Añadir título</button>
                    <button onMouseDown={() => { setLineas(prev => [...prev, emptyLine('suplido')]); setShowAddMenu(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.04]">Añadir suplido</button>
                  </div>
                </>,
                document.body,
              )}
            </div>
          </div>
          {!showDescuento && (
            <button type="button" onClick={() => setShowDescuento(true)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
              ＋ Añadir descuento
            </button>
          )}
        </div>
      </div>

      {/* ── OPCIONES ADICIONALES ──────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Campos personalizados (bloqueado) */}
        <label className="flex items-center gap-3 cursor-not-allowed opacity-50">
          <input type="checkbox" disabled className="rounded" />
          <span className="text-sm text-zinc-400">Campos personalizados</span>
          <span className="text-2xs font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
            Mejorar plan
          </span>
        </label>

        {/* Texto en el documento */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={showTextoDoc} onChange={e => setShowTextoDoc(e.target.checked)} className="rounded accent-blue-500" />
            <span className="text-sm text-zinc-400">Añadir texto en el documento</span>
          </label>
          {showTextoDoc && (
            <div className="mt-3 bg-zinc-900/40 rounded-xl border border-white/[0.06] overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center gap-1 px-3 py-2 border-b border-white/[0.06] flex-wrap">
                {[
                  { icon: Bold, cmd: 'bold' }, { icon: Italic, cmd: 'italic' }, { icon: Underline, cmd: 'underline' },
                ].map(({ icon: Icon, cmd }) => (
                  <button key={cmd} type="button" onMouseDown={e => { e.preventDefault(); execFmt(cmd); }}
                    className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"><Icon size={13} /></button>
                ))}
                <div className="w-px h-4 bg-white/10 mx-1" />
                <button type="button" onMouseDown={e => { e.preventDefault(); execFmt('insertUnorderedList'); }}
                  className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"><List size={13} /></button>
                <button type="button" onMouseDown={e => { e.preventDefault(); execFmt('insertOrderedList'); }}
                  className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"><ListOrdered size={13} /></button>
                <div className="w-px h-4 bg-white/10 mx-1" />
                {[{ icon: AlignLeft, cmd: 'justifyLeft' }, { icon: AlignCenter, cmd: 'justifyCenter' }, { icon: AlignRight, cmd: 'justifyRight' }].map(({ icon: Icon, cmd }) => (
                  <button key={cmd} type="button" onMouseDown={e => { e.preventDefault(); execFmt(cmd); }}
                    className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"><Icon size={13} /></button>
                ))}
                <div className="w-px h-4 bg-white/10 mx-1" />
                <select className="bg-transparent text-xs text-zinc-500 focus:outline-none [color-scheme:dark]"
                  onChange={e => execFmt('fontSize', e.target.value)}>
                  {[10,12,14,16,18,20,24].map(s => <option key={s} value={String(s/4)}>{s}</option>)}
                </select>
              </div>
              {/* Editor area */}
              <div ref={richTextRef} contentEditable suppressContentEditableWarning
                className="px-4 py-3 min-h-[80px] text-sm text-zinc-200 focus:outline-none"
                style={{ lineHeight: 1.6 }} />
              <div className="px-4 py-2 border-t border-white/[0.04]">
                <button type="button" className="text-2xs text-blue-400 hover:text-blue-300 transition-colors">
                  Ver lista de palabras dinámicas →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mensaje al final */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={showMensaje} onChange={e => setShowMensaje(e.target.checked)} className="rounded accent-blue-500" />
            <span className="text-sm text-zinc-400">Añadir mensaje al final</span>
          </label>
          {showMensaje && (
            <textarea value={mensajeFinal} onChange={e => setMensajeFinal(e.target.value)} rows={3}
              className="mt-3 w-full bg-zinc-900/40 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/15 resize-y transition-colors"
              placeholder="Texto que aparecerá al final del PDF de la factura…" />
          )}
        </div>
      </div>

      {/* ── TOTALES (alineado a la derecha) ──────────────────────────────── */}
      <div className="flex justify-end">
        <div className="w-72 bg-zinc-900/40 rounded-2xl border border-white/[0.06] p-5 space-y-2">
          {showDescuento && totals.descImporte > 0 && (
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Subtotal sin descuento</span>
              <span className="font-mono">{fmt(totals.subtotalBruto)}</span>
            </div>
          )}

          {showDescuento && (
            <div className="space-y-2 pb-2 border-b border-white/[0.06]">
              {/* Descuento por producto */}
              <label className="flex items-center justify-between text-xs text-zinc-500 cursor-not-allowed opacity-50">
                <span className="flex items-center gap-1.5">
                  <input type="checkbox" disabled className="rounded" />Descuento por producto
                </span>
                <span className="font-mono">—</span>
              </label>
              {/* Descuento global */}
              <label className="flex items-center justify-between gap-2 text-xs cursor-pointer">
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <input type="checkbox" checked={descGlobalActivo} onChange={e => setDescGlobalActivo(e.target.checked)}
                    className="rounded accent-blue-500" />Descuento global
                </span>
                {descGlobalActivo && (
                  <div className="flex items-center gap-1">
                    <input type="number" value={descValor} onChange={e => setDescValor(e.target.value)}
                      className="w-16 bg-zinc-800 border border-white/10 rounded px-2 py-0.5 text-xs text-white text-right font-mono focus:outline-none [color-scheme:dark]" />
                    <button type="button" onClick={() => setDescModo(m => m === 'pct' ? 'fijo' : 'pct')}
                      className="text-2xs font-medium text-blue-400 hover:text-blue-300 transition-colors">
                      {descModo === 'pct' ? '%' : '€'}
                    </button>
                    <span className="text-zinc-600 font-mono text-xs">-{fmt(totals.descImporte)}</span>
                  </div>
                )}
              </label>
            </div>
          )}

          <div className="flex justify-between text-xs text-zinc-400">
            <span>Subtotal</span>
            <span className="font-mono">{fmt(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs text-zinc-400">
            <span>IVA</span>
            <span className="font-mono">{fmt(totals.ivaTotal)}</span>
          </div>
          {totals.retTotal !== 0 && (
            <div className="flex justify-between text-xs text-amber-400/80">
              <span>IRPF</span>
              <span className="font-mono">{fmt(totals.retTotal)}</span>
            </div>
          )}
          {totals.recTotal > 0 && (
            <div className="flex justify-between text-xs text-violet-400/80">
              <span>Rec. equiv.</span>
              <span className="font-mono">{fmt(totals.recTotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold text-white border-t border-white/[0.08] pt-2">
            <span>Total</span>
            <span className="font-mono tabular-nums">{fmt(totals.totalACobrar)}</span>
          </div>
        </div>
      </div>

      {/* ── MÉTODO DE PAGO + CATEGORIZACIÓN ──────────────────────────────── */}
      <div className="grid grid-cols-2 gap-5">

        {/* Método de pago */}
        <div className="bg-zinc-900/40 rounded-2xl border border-white/[0.06] p-5 space-y-4">
          <p className="text-sm font-medium text-white">Método de pago</p>
          <div>
            <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Selecciona una forma de pago</p>
            <PortalSelect
              value={metodoPago}
              onChange={v => { setMetodoPago(v); if (v !== 'transfer') setCuentaId(''); }}
              options={METODOS_PAGO.map(m => ({ id: m.id, label: m.label }))}
            />
          </div>

          {/* Cuenta bancaria (solo si transferencia) */}
          {metodoPago === 'transfer' && (
            <div className="space-y-2.5">
              <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Cuenta bancaria de cobro</p>
              {cuentas.length > 0 && (
                <PortalSelect
                  value={cuentaId}
                  onChange={setCuentaId}
                  options={[
                    { id: '', label: '— Seleccionar cuenta —' },
                    ...cuentas.map(c => ({ id: c.iban, label: `${c.alias}  ·  ${c.iban.replace(/(.{4})/g, '$1 ').trim()}` })),
                  ]}
                />
              )}
              {cuentas.length === 0 && !showAddCuenta && (
                <p className="text-xs text-zinc-600">No hay cuentas registradas para esta sociedad.</p>
              )}
              {!showAddCuenta ? (
                <button type="button" onClick={() => setShowAddCuenta(true)}
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  <Plus size={11} />Añadir cuenta bancaria
                </button>
              ) : (
                <div className="bg-zinc-800/60 rounded-xl border border-white/[0.08] p-3 space-y-2">
                  <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Nueva cuenta bancaria</p>
                  <input value={ncAlias} onChange={e => setNcAlias(e.target.value)} placeholder="Alias (ej. BBVA Principal)"
                    className="w-full h-8 px-3 bg-zinc-900/60 border border-white/[0.08] rounded-lg text-xs text-white focus:outline-none" />
                  <input value={ncTitular} onChange={e => setNcTitular(e.target.value)} placeholder="Titular de la cuenta"
                    className="w-full h-8 px-3 bg-zinc-900/60 border border-white/[0.08] rounded-lg text-xs text-white focus:outline-none" />
                  <input value={ncIban} onChange={e => setNcIban(e.target.value)} placeholder="IBAN (ES00 0000 0000 0000 0000 0000)"
                    className="w-full h-8 px-3 bg-zinc-900/60 border border-white/[0.08] rounded-lg text-xs text-white font-mono focus:outline-none" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={ncBanco} onChange={e => setNcBanco(e.target.value)} placeholder="Banco (opcional)"
                      className="h-8 px-3 bg-zinc-900/60 border border-white/[0.08] rounded-lg text-xs text-white focus:outline-none" />
                    <input value={ncSwift} onChange={e => setNcSwift(e.target.value)} placeholder="SWIFT/BIC (opcional)"
                      className="h-8 px-3 bg-zinc-900/60 border border-white/[0.08] rounded-lg text-xs text-white font-mono focus:outline-none" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { void handleAddCuenta(); }} disabled={savingCuenta || !ncAlias || !ncTitular || !ncIban}
                      className="flex-1 h-8 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-40">
                      {savingCuenta ? 'Guardando…' : 'Guardar cuenta'}
                    </button>
                    <button type="button" onClick={() => setShowAddCuenta(false)}
                      className="px-3 h-8 text-xs text-zinc-500 hover:text-zinc-300 border border-white/[0.08] rounded-lg transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pasarela banner — solo si no es transferencia */}
          {metodoPago !== 'transfer' && (
            <div className="flex items-center gap-3 bg-blue-500/6 border border-blue-500/15 rounded-xl p-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                <CreditCard size={14} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xs text-zinc-400 leading-snug">Conecta tu pasarela de pago para cobrar online de forma rápida</p>
              </div>
              <button type="button" className="text-2xs font-medium text-blue-400 hover:text-blue-300 shrink-0 transition-colors">Conectar</button>
            </div>
          )}
        </div>

        {/* Categorización */}
        <div className="bg-zinc-900/40 rounded-2xl border border-white/[0.06] p-5 space-y-4">
          <p className="text-sm font-medium text-white">Categorización</p>

          {/* Cuenta contable */}
          <div>
            <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Cuenta contable</p>
            <PortalSelect value={cuentaContable} onChange={setCuentaContable}
              options={CUENTAS_CONTABLES.map(c => ({ id: c.codigo, label: `${c.codigo} ${c.nombre}` }))} />
            <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
              <input type="checkbox" className="rounded accent-blue-500" />
              <span className="text-2xs text-zinc-600">Cuenta por concepto</span>
            </label>
          </div>

          {/* Etiquetas */}
          <div>
            <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Etiquetas</p>
            <div className="flex flex-wrap gap-1 min-h-[36px] px-3 py-1.5 bg-zinc-900/60 border border-white/[0.08] hover:border-white/15 rounded-lg cursor-text"
              onClick={() => document.getElementById('tag-input')?.focus()}>
              {tags.map(t => (
                <span key={t} className="inline-flex items-center gap-1 text-2xs font-medium px-1.5 py-0.5 bg-zinc-700/60 text-zinc-300 rounded-md">
                  {t}
                  <button type="button" onClick={() => setTags(prev => prev.filter(x => x !== t))} className="opacity-60 hover:opacity-100"><X size={8} /></button>
                </span>
              ))}
              <input id="tag-input" value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                    e.preventDefault();
                    setTags(prev => [...new Set([...prev, tagInput.trim()])]);
                    setTagInput('');
                  }
                }}
                className="flex-1 min-w-[60px] bg-transparent text-xs text-white focus:outline-none placeholder:text-zinc-600 py-0.5"
                placeholder={tags.length === 0 ? 'Tags' : ''} />
            </div>
            <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
              <input type="checkbox" className="rounded accent-blue-500" />
              <span className="text-2xs text-zinc-600">Etiquetas por concepto</span>
            </label>
          </div>

          {/* Nota interna */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Nota interna</p>
              <Info size={10} className="text-zinc-700" />
            </div>
            <input value={notaInterna} onChange={e => setNotaInterna(e.target.value)}
              className="w-full h-8 px-3 bg-zinc-900/60 border border-white/[0.08] hover:border-white/15 rounded-lg text-sm text-white focus:outline-none transition-colors"
              placeholder="Nota interna" />
          </div>

          {/* Asignar usuarios */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Asignar usuarios</p>
              <Info size={10} className="text-zinc-700" />
            </div>
            <input className="w-full h-8 px-3 bg-zinc-900/60 border border-white/[0.08] hover:border-white/15 rounded-lg text-sm text-zinc-400 focus:outline-none transition-colors"
              placeholder="Usuarios asignados" />
          </div>

          {/* Asignar proyecto */}
          <button type="button" className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            <FolderOpen size={12} />
            <span>＋ Asignar a proyecto</span>
          </button>
        </div>
      </div>

      {/* Opciones drawer */}
      {showOpciones && (
        <OpcionesDrawer
          serie={serie} setSerie={setSerie}
          idioma={idioma} setIdioma={setIdioma}
          moneda={moneda} setMoneda={setMoneda}
          onClose={() => setShowOpciones(false)}
        />
      )}

      {/* Invoice preview overlay */}
      {showPreview && (() => {
        const soc = sociedades.find(s => s.id === sociedadId);
        const cuentaSel = metodoPago === 'transfer' ? cuentas.find(c => c.iban === cuentaId) : undefined;
        return (
          <FacturaPreview
            numero={numero}
            serie={serie}
            fecha={fecha}
            vencimiento={vencimiento}
            emisorNombre={soc?.nombre ?? ''}
            emisorCif={soc?.cif ?? ''}
            emisorDomicilio={soc?.domicilio ?? ''}
            emisorLocalidad={soc ? `${soc.localidad ?? ''}${soc.codigo_postal ? ' ' + soc.codigo_postal : ''}`.trim() : ''}
            emisorEmail={soc?.email ?? ''}
            logoUrl={soc?.logo_url ?? ''}
            clienteNombre={clienteNombre}
            clienteNif={clienteNif}
            lineasCalc={lineasCalc}
            totals={totals}
            metodoPago={metodoPago}
            cuentaIban={cuentaSel?.iban ?? ''}
            cuentaAlias={cuentaSel?.alias ?? ''}
            cuentaTitular={cuentaSel?.titular ?? ''}
            cuentaBanco={cuentaSel?.banco ?? ''}
            isPrivateMode={isPrivateMode}
            onClose={() => setShowPreview(false)}
          />
        );
      })()}
    </div>
  );
}
