import { useEffect, useState } from 'react';
import { CalendarClock, TrendingDown, TrendingUp, Filter, CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { PresupuestoPago } from '@alsari/types';
import { getAllPagos, updatePago } from '../../lib/presupuestosApi';

function fmt(n: number, priv: boolean) {
  if (priv) return '•••• €';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(d: string): number {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

type MesGroup = { mes: string; label: string; pagos: PresupuestoPago[] };

function groupByMonth(pagos: PresupuestoPago[]): MesGroup[] {
  const map = new Map<string, PresupuestoPago[]>();
  for (const p of pagos) {
    const key = p.fecha_prevista.slice(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return Array.from(map.entries()).map(([mes, ps]) => ({
    mes,
    label: new Date(mes + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
    pagos: ps,
  }));
}

const ESTADO_CONFIG = {
  pendiente: { icon: Clock,         color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20',  label: 'Pendiente' },
  pagado:    { icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Pagado' },
  cancelado: { icon: XCircle,       color: 'text-zinc-500',   bg: 'bg-zinc-800/40 border-zinc-700/20',    label: 'Cancelado' },
};

type Props = { isPrivateMode: boolean };

export function CalendarioPagos({ isPrivateMode }: Props) {
  const [pagos, setPagos]       = useState<PresupuestoPago[]>([]);
  const [loading, setLoading]   = useState(true);
  const [horizonte, setHorizonte] = useState<'3m' | '6m' | '12m' | 'todo'>('6m');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'gasto' | 'ingreso'>('todos');
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | 'pendiente' | 'pagado'>('todos');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const hoy = new Date();
    let hasta: string | undefined;
    if (horizonte === '3m')  hasta = new Date(hoy.getFullYear(), hoy.getMonth()+3, 1).toISOString().split('T')[0];
    if (horizonte === '6m')  hasta = new Date(hoy.getFullYear(), hoy.getMonth()+6, 1).toISOString().split('T')[0];
    if (horizonte === '12m') hasta = new Date(hoy.getFullYear(), hoy.getMonth()+12, 1).toISOString().split('T')[0];
    getAllPagos({ ...(hasta && { hasta }) })
      .then(setPagos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [horizonte]);

  const filtered = pagos.filter(p => {
    if (tipoFiltro !== 'todos' && p.tipo_flujo !== tipoFiltro) return false;
    if (estadoFiltro !== 'todos' && p.estado !== estadoFiltro) return false;
    return true;
  });

  const grupos = groupByMonth(filtered);

  const totalGastos   = filtered.filter(p=>p.tipo_flujo==='gasto'   && p.estado==='pendiente').reduce((s,p)=>s+p.importe,0);
  const totalIngresos = filtered.filter(p=>p.tipo_flujo==='ingreso' && p.estado==='pendiente').reduce((s,p)=>s+p.importe,0);
  const saldoPrevisto = totalIngresos - totalGastos;

  async function markPago(id: string, estado: 'pagado' | 'pendiente') {
    setUpdatingId(id);
    await updatePago(id, { estado }).catch(() => {});
    setPagos(prev => prev.map(p => p.id === id ? { ...p, estado } : p));
    setUpdatingId(null);
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Horizonte */}
        <div className="flex items-center gap-1 bg-zinc-900/60 border border-white/[0.06] rounded-xl p-1">
          {(['3m','6m','12m','todo'] as const).map(h => (
            <button
              key={h}
              onClick={() => setHorizonte(h)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                horizonte === h
                  ? 'bg-blue-600/20 border border-blue-500/30 text-blue-300'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {h === 'todo' ? 'Todo' : h}
            </button>
          ))}
        </div>

        {/* Tipo flujo */}
        <div className="flex items-center gap-1 bg-zinc-900/60 border border-white/[0.06] rounded-xl p-1">
          {(['todos','gasto','ingreso'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTipoFiltro(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                tipoFiltro === t
                  ? 'bg-zinc-800 border border-white/10 text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t === 'todos' ? 'Todos' : t === 'gasto' ? 'Gastos' : 'Ingresos'}
            </button>
          ))}
        </div>

        {/* Estado */}
        <div className="flex items-center gap-1 bg-zinc-900/60 border border-white/[0.06] rounded-xl p-1">
          {(['todos','pendiente','pagado'] as const).map(e => (
            <button
              key={e}
              onClick={() => setEstadoFiltro(e)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                estadoFiltro === e
                  ? 'bg-zinc-800 border border-white/10 text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {e === 'todos' ? 'Todos' : e === 'pendiente' ? 'Pendientes' : 'Pagados'}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1 text-zinc-600">
          <Filter size={12} />
          <span className="text-xs">{filtered.length} pagos</span>
        </div>
      </div>

      {/* Resumen de saldo previsto */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900/60 border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={14} className="text-rose-400" />
            <span className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Gastos previstos</span>
          </div>
          <p className="text-xl font-semibold text-white">{fmt(totalGastos, isPrivateMode)}</p>
        </div>
        <div className="bg-zinc-900/60 border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-emerald-400" />
            <span className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Ingresos previstos</span>
          </div>
          <p className="text-xl font-semibold text-white">{fmt(totalIngresos, isPrivateMode)}</p>
        </div>
        <div className={`border rounded-xl p-4 ${saldoPrevisto >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock size={14} className={saldoPrevisto >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
            <span className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Saldo previsto</span>
          </div>
          <p className={`text-xl font-semibold ${saldoPrevisto >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {saldoPrevisto >= 0 ? '+' : ''}{fmt(saldoPrevisto, isPrivateMode)}
          </p>
        </div>
      </div>

      {/* Pagos agrupados por mes */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">Cargando...</div>
      ) : grupos.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl">
          <CalendarClock size={32} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm font-semibold">No hay pagos en este periodo</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grupos.map(grupo => {
            const totalMes = grupo.pagos
              .filter(p => p.tipo_flujo === 'gasto' && p.estado !== 'cancelado')
              .reduce((s, p) => s + p.importe, 0);
            return (
              <div key={grupo.mes}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-zinc-300 capitalize">{grupo.label}</h3>
                  <span className="text-xs text-zinc-500">{fmt(totalMes, isPrivateMode)} en gastos</span>
                </div>
                <div className="space-y-2">
                  {grupo.pagos.map(pago => {
                    const dias    = daysUntil(pago.fecha_prevista);
                    const vencido = dias < 0 && pago.estado === 'pendiente';
                    const urgent  = dias <= 7 && dias >= 0 && pago.estado === 'pendiente';
                    const cfg     = ESTADO_CONFIG[pago.estado];
                    return (
                      <div
                        key={pago.id}
                        className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-all ${
                          vencido ? 'border-rose-500/30 bg-rose-500/5' :
                          urgent  ? 'border-amber-500/20 bg-amber-500/5' :
                          pago.estado === 'pagado' ? 'border-white/[0.04] bg-zinc-900/20 opacity-60' :
                          'border-white/[0.06] bg-zinc-900/40'
                        }`}
                      >
                        {/* Tipo flujo */}
                        <div className={`p-1.5 rounded-lg border ${cfg.bg} shrink-0`}>
                          {pago.tipo_flujo === 'gasto'
                            ? <TrendingDown size={12} className={cfg.color} />
                            : <TrendingUp size={12} className={cfg.color} />
                          }
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {pago.descripcion ?? 'Pago previsto'}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                            <span>{fmtDate(pago.fecha_prevista)}</span>
                            {vencido && <span className="text-rose-400 font-medium">Vencido</span>}
                            {urgent  && <span className="text-amber-400 font-medium">Esta semana</span>}
                          </div>
                        </div>

                        {/* Importe */}
                        <span className={`text-sm font-semibold shrink-0 ${
                          pago.tipo_flujo === 'ingreso' ? 'text-emerald-300' :
                          vencido ? 'text-rose-300' : 'text-white'
                        }`}>
                          {pago.tipo_flujo === 'ingreso' ? '+' : '-'}{fmt(pago.importe, isPrivateMode)}
                        </span>

                        {/* Acción rápida */}
                        {pago.estado === 'pendiente' && (
                          <button
                            onClick={() => void markPago(pago.id, 'pagado')}
                            disabled={updatingId === pago.id}
                            className="shrink-0 text-2xs font-semibold text-zinc-600 hover:text-emerald-400 uppercase tracking-widest transition-colors"
                          >
                            {updatingId === pago.id ? '...' : 'Marcar pagado'}
                          </button>
                        )}
                        {pago.estado === 'pagado' && (
                          <button
                            onClick={() => void markPago(pago.id, 'pendiente')}
                            disabled={updatingId === pago.id}
                            className="shrink-0 text-2xs font-semibold text-zinc-600 hover:text-amber-400 uppercase tracking-widest transition-colors"
                          >
                            Deshacer
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
