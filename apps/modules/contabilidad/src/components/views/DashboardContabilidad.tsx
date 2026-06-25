import { useEffect, useState } from 'react';
import {
  ArrowUpDown, FileText, BookOpen, GitMerge,
  TrendingDown, TrendingUp, AlertTriangle, Loader2,
} from 'lucide-react';
import {
  getMovimientos, getFacturasRecibidas, getAsientosBorrador,
} from '../../lib/contabilidadApi';
import type { MovimientoBancario, FacturaRecibida, AsientoBorrador } from '@alsari/types';
import type { ContabilidadView } from '../ContabilidadSidebar';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, priv: boolean) {
  if (priv) return '€ ****';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n);
}

const CATEGORIA_LABEL: Record<string, string> = {
  intragrupo_salida:             'Intragrupo ↑',
  intragrupo_entrada:            'Intragrupo ↓',
  rentas_cobradas:               'Rentas',
  cobros_operacion_inmobiliaria: 'Cobros oper.',
  gastos_inmobiliarios:          'Inmobiliario',
  bancarios:                     'Bancarios',
  fiscal:                        'Fiscal',
  notaria_legal:                 'Notaría',
  devoluciones:                  'Devolución',
  proveedores:                   'Proveedores',
  personal:                      'Personal',
  dividendos:                    'Dividendos',
  rendimientos_financieros:      'Rendimientos',
  extraordinario:                'Extraordinario',
};

const CATEGORIA_COLOR: Record<string, string> = {
  intragrupo_salida:             'bg-violet-500/20 text-violet-300',
  intragrupo_entrada:            'bg-violet-500/20 text-violet-300',
  rentas_cobradas:               'bg-emerald-500/20 text-emerald-300',
  cobros_operacion_inmobiliaria: 'bg-emerald-500/20 text-emerald-300',
  gastos_inmobiliarios:          'bg-orange-500/20 text-orange-300',
  bancarios:                     'bg-blue-500/20 text-blue-300',
  fiscal:                        'bg-rose-500/20 text-rose-300',
  notaria_legal:                 'bg-amber-500/20 text-amber-300',
  devoluciones:                  'bg-cyan-500/20 text-cyan-300',
  proveedores:                   'bg-zinc-500/20 text-zinc-300',
  personal:                      'bg-pink-500/20 text-pink-300',
  dividendos:                    'bg-indigo-500/20 text-indigo-300',
  rendimientos_financieros:      'bg-purple-500/20 text-purple-300',
  extraordinario:                'bg-zinc-700/40 text-zinc-400',
};

function categoriaColor(cat: string | null): string {
  if (!cat) return 'bg-zinc-700/40 text-zinc-400';
  return CATEGORIA_COLOR[cat] ?? 'bg-zinc-700/40 text-zinc-400';
}

function categoriaLabel(cat: string | null): string {
  if (!cat) return '—';
  return CATEGORIA_LABEL[cat] ?? cat;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, color, onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group w-full text-left rounded-2xl border border-white/5 bg-zinc-900/40 p-5 hover:bg-zinc-900/70 transition-all ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">{label}</p>
        <div className={`p-1.5 rounded-lg ${color}`}>
          <Icon size={14} />
        </div>
      </div>
      <p className="text-3xl font-light text-white tracking-tight">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </button>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  isPrivateMode: boolean;
  sociedades: { id: string; nombre: string }[];
  reglas: unknown[];
  onNavigate: (v: ContabilidadView) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function DashboardContabilidad({ isPrivateMode, onNavigate }: Props) {
  const [movimientos, setMovimientos] = useState<MovimientoBancario[]>([]);
  const [facturas, setFacturas]       = useState<FacturaRecibida[]>([]);
  const [asientos, setAsientos]       = useState<AsientoBorrador[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(false);
      try {
        const [movs, facts, asies] = await Promise.all([
          getMovimientos({ limit: 50 }),
          getFacturasRecibidas(),
          getAsientosBorrador(),
        ]);
        setMovimientos(movs);
        setFacturas(facts);
        setAsientos(asies);
      } catch {
        setError(true);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 py-12 text-zinc-500">
        <AlertTriangle size={18} className="text-amber-500" />
        <p className="text-sm">No se pudieron cargar los datos. Verifica la conexión a Supabase.</p>
      </div>
    );
  }

  const pendientesRevision = movimientos.filter(m => !m.revisado).length;
  const facturasPendientes = facturas.filter(f =>
    f.estado === 'pendiente_pago' || f.estado === 'revision_javi' || f.estado === 'borrador_ocr'
  );
  const totalPendientePago = facturasPendientes.reduce((s, f) => s + (f.total_a_pagar ?? 0), 0);

  // Facturas en pendiente_pago con fecha_vencimiento pasada
  const hoy = new Date().toISOString().slice(0, 10);
  const facturasVencidas = facturas.filter(f =>
    f.estado === 'pendiente_pago' && f.fecha_vencimiento && f.fecha_vencimiento < hoy
  );
  const asientosBorrador   = asientos.filter(a => a.estado === 'borrador').length;
  const recent             = movimientos.slice(0, 10);

  const ingresos = movimientos.filter(m => m.importe > 0).reduce((s, m) => s + m.importe, 0);
  const gastos   = movimientos.filter(m => m.importe < 0).reduce((s, m) => s + m.importe, 0);

  return (
    <div className="space-y-8">

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Sin revisar"
          value={pendientesRevision}
          sub={`de ${movimientos.length} movimientos`}
          icon={ArrowUpDown}
          color="bg-violet-500/20 text-violet-400"
          onClick={() => onNavigate('movimientos')}
        />
        <KpiCard
          label="Pendiente de pago"
          value={fmt(totalPendientePago, isPrivateMode)}
          sub={`${facturasPendientes.length} facturas`}
          icon={FileText}
          color="bg-amber-500/20 text-amber-400"
          onClick={() => onNavigate('facturas')}
        />
        <KpiCard
          label="Asientos borrador"
          value={asientosBorrador}
          sub="pendientes de confirmar"
          icon={BookOpen}
          color="bg-blue-500/20 text-blue-400"
          onClick={() => onNavigate('diario')}
        />
        <KpiCard
          label="Reconciliación"
          value="—"
          sub="Ver comparativa"
          icon={GitMerge}
          color="bg-rose-500/20 text-rose-400"
          onClick={() => onNavigate('reconciliacion')}
        />
      </div>

      {/* Flujo de caja */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5">
          <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Entradas (últimos 50)</p>
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-400" />
            <p className="text-2xl font-semibold text-emerald-400">{fmt(ingresos, isPrivateMode)}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5">
          <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Salidas (últimos 50)</p>
          <div className="flex items-center gap-2">
            <TrendingDown size={16} className="text-rose-400" />
            <p className="text-2xl font-semibold text-rose-400">{fmt(gastos, isPrivateMode)}</p>
          </div>
        </div>
      </div>

      {/* Movimientos recientes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">Movimientos recientes</h2>
          <button onClick={() => onNavigate('movimientos')} className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">
            Ver todos →
          </button>
        </div>
        <div className="rounded-2xl border border-white/5 overflow-hidden">
          {recent.length === 0 ? (
            <div className="py-12 text-center text-zinc-600 text-sm">
              No hay movimientos. Importa un extracto bancario para empezar.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-zinc-900/60">
                  {['Fecha', 'Concepto', 'Categoría', 'Importe', 'Rev.'].map(h => (
                    <th key={h} className={`text-2xs font-semibold text-zinc-500 uppercase tracking-widest px-4 py-3 ${h === 'Importe' ? 'text-right' : h === 'Rev.' ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {recent.map(m => (
                  <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs text-zinc-400 font-mono whitespace-nowrap">{m.fecha}</td>
                    <td className="px-4 py-3 text-xs text-zinc-200 max-w-xs truncate">{m.concepto}</td>
                    <td className="px-4 py-3">
                      <span className={`text-2xs font-medium px-2 py-0.5 rounded-full ${categoriaColor(m.categoria)}`}>
                        {categoriaLabel(m.categoria)}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-xs font-medium text-right font-mono whitespace-nowrap ${m.importe >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPrivateMode ? '****' : `${m.importe >= 0 ? '+' : ''}${m.importe.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block h-2 w-2 rounded-full ${m.revisado ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Facturas vencidas (pendiente pago con fecha_vencimiento pasada) */}
      {facturasVencidas.length > 0 && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-rose-400" />
            <p className="text-xs font-semibold text-rose-400 uppercase tracking-widest">Facturas vencidas</p>
          </div>
          <div className="space-y-2">
            {facturasVencidas.map(f => (
              <div key={f.id} className="flex items-center justify-between text-xs">
                <span className="text-zinc-300">{f.proveedor_nombre}</span>
                <span className="font-medium font-mono text-rose-300">{fmt(f.total_a_pagar, isPrivateMode)}</span>
                <span className="text-2xs font-medium px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400">VENCIDA</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
