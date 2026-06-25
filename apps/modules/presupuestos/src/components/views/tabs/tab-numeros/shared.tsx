// Shared primitives for TabNumeros sub-components
import { useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';
import type { Semaforo } from '../../../../lib/analisisFinanciero';
import { SEMAFORO_COLORS, SEMAFORO_BG } from '../../../../lib/analisisFinanciero';

export const lbl = 'block text-2xs font-medium text-zinc-500 uppercase tracking-widest mb-1';
export const inp = 'w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors [color-scheme:dark]';

export const fmt    = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
export const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
export const fmtX   = (n: number) => `${n.toFixed(2)}x`;
export const fmtAno = (n: number) => `${n.toFixed(1)} años`;
export const safe   = (v: number | null | undefined, render: (n: number) => string): string =>
  v != null && isFinite(v) && !isNaN(v) ? render(v) : '—';

// ── KpiCard con tooltip opcional ──────────────────────────────────────────────
// El tooltip se muestra al pasar el ratón (hover) o al recibir foco (teclado).
// Implementado con CSS puro via Tailwind — sin librerías externas.

export function KpiCard({ label, value, sub, semaforo = 'neutro', tooltip }: {
  label: string;
  value: string;
  sub?: string | undefined;
  semaforo?: Semaforo | undefined;
  tooltip?: string | undefined;
}) {
  return (
    <div
      className="relative group/kpi"
      tabIndex={tooltip ? 0 : undefined}
    >
      <div className={`rounded-xl border p-4 ${SEMAFORO_BG[semaforo]}`}>
        <div className="flex items-start gap-1 mb-1">
          <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest leading-tight flex-1">{label}</p>
          {tooltip && (
            <HelpCircle size={11} className="text-zinc-700 shrink-0 mt-px" aria-hidden="true" />
          )}
        </div>
        <p className={`text-xl font-semibold ${SEMAFORO_COLORS[semaforo]}`}>{value}</p>
        {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
      </div>

      {tooltip && (
        <div
          className="pointer-events-none absolute bottom-full left-0 mb-2 z-50 w-64 opacity-0 group-hover/kpi:opacity-100 group-focus-within/kpi:opacity-100 transition-opacity duration-150"
          role="tooltip"
        >
          <div className="bg-zinc-800 border border-white/10 rounded-xl p-3 text-xs text-zinc-300 shadow-xl leading-relaxed">
            {tooltip}
          </div>
          <div className="absolute top-full left-4 border-4 border-transparent border-t-zinc-800" />
        </div>
      )}
    </div>
  );
}

export function NumInput({ label, value, onChange, placeholder, hint, suffix = '€', step = '1000' }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string; suffix?: string; step?: string;
}) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <div className="relative">
        <input
          type="number" min="0" step={step}
          className={`${inp} pr-8`}
          value={value} placeholder={placeholder ?? '0'}
          onChange={e => onChange(e.target.value)}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-600">{suffix}</span>
      </div>
      {hint && <p className="text-2xs text-zinc-600 mt-0.5">{hint}</p>}
    </div>
  );
}

export function PctInput({ label, value, onChange, hint }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string;
}) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <div className="relative">
        <input type="number" min="0" max="100" step="0.1" className={`${inp} pr-8`}
          value={value} placeholder="0" onChange={e => onChange(e.target.value)} />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-600">%</span>
      </div>
      {hint && <p className="text-2xs text-zinc-600 mt-0.5">{hint}</p>}
    </div>
  );
}

// ── Tasa de descuento: desplegable por tipo de inversión + personalizado ──────
// Valores orientativos por riesgo del activo. Al elegir un tipo se fija su tasa;
// "Personalizado" abre un campo % para introducir cualquier valor.
// Trabaja en decimales (value/onChange = "0.08" para 8%), igual que el resto del
// análisis; la conversión a % es interna.
const TASA_PRESETS: { label: string; value: number }[] = [
  { label: 'Liquidez / monetarios (3-4,5%)',                   value: 0.04 },
  { label: 'Renta fija conservadora (4-6%)',                   value: 0.05 },
  { label: 'Vivienda alquilada prime / segura (6-7,5%)',       value: 0.07 },
  { label: 'Vivienda normal en alquiler (7,5-9%)',             value: 0.08 },
  { label: 'Local / nave con buen contrato (8-10%)',           value: 0.09 },
  { label: 'Proyecto inmobiliario con obra/licencia (10-15%)', value: 0.12 },
  { label: 'Promoción / desarrollo / suelo (15-20%+)',         value: 0.18 },
  { label: 'Startup / negocio operativo (20-30%+)',            value: 0.25 },
];

export function TasaDescuentoInput({ label = 'Tasa de descuento', value, onChange, hint }: {
  label?: string; value: string; onChange: (v: string) => void; hint?: string;
}) {
  const decimal  = value !== '' ? parseFloat(value) : NaN;
  const matchIdx = isNaN(decimal) ? -1 : TASA_PRESETS.findIndex(p => Math.abs(p.value - decimal) < 1e-4);
  const [customMode, setCustomMode] = useState(false);
  // Muestra el campo % si el usuario eligió "Personalizado" o si el valor guardado
  // no coincide con ningún preset (p.ej. una tasa antigua a medida).
  const showCustom  = customMode || (!isNaN(decimal) && matchIdx < 0);
  const selectValue = showCustom ? 'custom' : (matchIdx >= 0 ? String(matchIdx) : '');

  return (
    <div>
      <label className={lbl}>{label}</label>
      <select
        className={`${inp} pr-8 appearance-none`}
        value={selectValue}
        onChange={e => {
          const v = e.target.value;
          if (v === 'custom') { setCustomMode(true); return; }
          if (v === '') return;
          setCustomMode(false);
          onChange(String(TASA_PRESETS[Number(v)]!.value));
        }}
      >
        <option value="" disabled>— Tipo de inversión —</option>
        {TASA_PRESETS.map((p, i) => <option key={i} value={String(i)}>{p.label}</option>)}
        <option value="custom">Personalizado…</option>
      </select>
      {showCustom && (
        <div className="relative mt-2">
          <input
            type="number" min="0" max="100" step="0.1"
            className={`${inp} pr-8`}
            value={!isNaN(decimal) ? String(+(decimal * 100).toFixed(2)) : ''}
            placeholder="8"
            onChange={e => onChange(e.target.value !== '' ? String(parseFloat(e.target.value) / 100) : '')}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-600">%</span>
        </div>
      )}
      {hint && <p className="text-2xs text-zinc-600 mt-0.5">{hint}</p>}
    </div>
  );
}

export function SelectInput({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <select className={`${inp} pr-8 appearance-none`} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function TextAreaInput({ label, value, onChange, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <textarea
        className={`${inp} resize-none h-20`}
        value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
      {hint && <p className="text-2xs text-zinc-600 mt-0.5">{hint}</p>}
    </div>
  );
}

export function KpiGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  const cls = cols === 4
    ? 'grid grid-cols-2 md:grid-cols-4 gap-3'
    : cols === 3
    ? 'grid grid-cols-2 md:grid-cols-3 gap-3'
    : 'grid grid-cols-2 gap-3';
  return <div className={cls}>{children}</div>;
}

// ── Collapsible: bloque desplegable (cerrado por defecto) ─────────────────────
// Para detalle secundario que no debe competir en la primera pantalla.

export function Collapsible({
  title, subtitle, defaultOpen = false, badge, children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0 text-left">
          <ChevronDown size={14} className={`text-zinc-500 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zinc-200 truncate">{title}</p>
            {subtitle && <p className="text-2xs text-zinc-600 truncate mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </button>
      {open && <div className="px-5 pb-5 pt-1 animate-fade-in">{children}</div>}
    </div>
  );
}

export function SectionHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-zinc-600 bg-zinc-900/60 border border-white/[0.05] rounded-lg px-3 py-2">
      {children}
    </p>
  );
}
