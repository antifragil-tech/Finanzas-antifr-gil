import { useEffect, useState } from 'react';
import {
  FolderOpen,
  CalendarClock,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  PlusCircle,
} from 'lucide-react';
import type { Presupuesto, PresupuestoPago } from '@alsari/types';
import { getPresupuestos, getAllPagos } from '../../lib/presupuestosApi';
import type { PresupuestosView } from '../PresupuestosSidebar';

const TIPO_LABEL: Record<string, string> = {
  obra: 'Obra',
  explotacion: 'Explotación',
  capex: 'CAPEX',
  corporativo: 'Corporativo',
  tesoreria: 'Tesorería',
};

const ESTADO_STYLES: Record<string, string> = {
  borrador: 'text-zinc-400 bg-zinc-800/60',
  activo: 'text-emerald-400 bg-emerald-500/10',
  cerrado: 'text-zinc-600 bg-zinc-900/60',
};

function fmt(n: number, priv: boolean) {
  if (priv) return '••••• €';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

type Props = {
  isPrivateMode: boolean;
  onNavigate: (v: PresupuestosView) => void;
  onSelectPresupuesto: (id: string) => void;
};

export function DashboardPresupuestos({ isPrivateMode, onNavigate, onSelectPresupuesto }: Props) {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [proximosPagos, setProximosPagos] = useState<PresupuestoPago[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hoy = new Date().toISOString().split('T')[0]!;
    const en30d = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]!;
    Promise.all([getPresupuestos(), getAllPagos({ desde: hoy, hasta: en30d, estado: 'pendiente' })])
      .then(([p, pg]) => {
        setPresupuestos(p);
        setProximosPagos(pg);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activos = presupuestos.filter((p) => p.estado === 'activo');
  const enCurso = presupuestos.filter((p) => p.estado !== 'cerrado').length;
  const totalComprometido = proximosPagos
    .filter((p) => p.tipo_flujo === 'gasto')
    .reduce((s, p) => s + p.importe, 0);
  const vencidos = proximosPagos.filter((p) => daysUntil(p.fecha_prevista) < 0);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-zinc-600">Cargando...</div>
    );
  }

  return (
    <div className="animate-fade-in space-y-8">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          {
            label: 'Presupuestos activos',
            value: activos.length.toString(),
            sub: `${enCurso} en curso`,
            icon: FolderOpen,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
          },
          {
            label: 'Pagos próximos 30d',
            value: fmt(totalComprometido, isPrivateMode),
            sub: `${proximosPagos.length} pagos previstos`,
            icon: CalendarClock,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
          },
          {
            label: 'Total presupuestado',
            value: fmt(
              presupuestos
                .filter((p) => p.estado === 'activo')
                .reduce((s, p) => s + (p.importe_total ?? 0), 0),
              isPrivateMode,
            ),
            sub: 'En presupuestos activos',
            icon: TrendingUp,
            color: 'text-violet-400',
            bg: 'bg-violet-500/10',
          },
          {
            label: 'Pagos vencidos',
            value: vencidos.length.toString(),
            sub: vencidos.length > 0 ? 'Requieren atención' : 'Todo al día',
            icon: AlertTriangle,
            color: vencidos.length > 0 ? 'text-rose-400' : 'text-zinc-500',
            bg: vencidos.length > 0 ? 'bg-rose-500/10' : 'bg-zinc-800/40',
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-5"
          >
            <div className={`h-9 w-9 rounded-xl ${kpi.bg} mb-4 flex items-center justify-center`}>
              <kpi.icon size={16} className={kpi.color} />
            </div>
            <p className="text-2xl font-semibold tracking-tight text-white">{kpi.value}</p>
            <p className="text-2xs mt-1 font-semibold uppercase tracking-widest text-zinc-500">
              {kpi.label}
            </p>
            <p className="mt-0.5 text-xs text-zinc-600">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Próximos pagos */}
      {proximosPagos.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Próximos 30 días
            </h2>
            <button
              onClick={() => onNavigate('calendario')}
              className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300"
            >
              Ver calendario <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {proximosPagos.slice(0, 5).map((pago) => {
              const dias = daysUntil(pago.fecha_prevista);
              const urgent = dias <= 7;
              return (
                <div
                  key={pago.id}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                    urgent
                      ? 'border-rose-500/20 bg-rose-500/5'
                      : 'border-white/[0.06] bg-zinc-900/40'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {pago.descripcion ?? 'Pago previsto'}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {new Date(pago.fecha_prevista).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {' · '}
                      {dias === 0
                        ? 'Hoy'
                        : dias < 0
                          ? `Vencido hace ${Math.abs(dias)}d`
                          : `En ${dias} días`}
                    </p>
                  </div>
                  <span
                    className={`ml-4 text-sm font-semibold ${urgent ? 'text-rose-300' : 'text-white'}`}
                  >
                    {fmt(pago.importe, isPrivateMode)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Lista de presupuestos activos */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Presupuestos activos
          </h2>
          <button
            onClick={() => onNavigate('nuevo')}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
          >
            <PlusCircle size={12} /> Nuevo
          </button>
        </div>

        {activos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
            <FolderOpen size={32} className="mx-auto mb-3 text-zinc-700" />
            <p className="text-sm font-semibold text-zinc-500">No hay presupuestos activos</p>
            <button
              onClick={() => onNavigate('nuevo')}
              className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-600/20 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-600/30"
            >
              Crear primer presupuesto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {activos.map((p) => {
              const total = p.importe_total ?? 0;
              const pagado = p.importe_pagado ?? 0;
              const pct = total > 0 ? Math.round((pagado / total) * 100) : 0;
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectPresupuesto(p.id)}
                  className="group rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-5 text-left transition-all hover:border-white/[0.12] hover:bg-zinc-900/80"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white transition-colors group-hover:text-emerald-300">
                        {p.nombre}
                      </p>
                      {p.proyecto_nombre && (
                        <p className="mt-0.5 text-xs text-zinc-500">{p.proyecto_nombre}</p>
                      )}
                    </div>
                    <span
                      className={`text-2xs shrink-0 rounded-full px-2 py-0.5 font-semibold uppercase tracking-widest ${ESTADO_STYLES[p.estado]}`}
                    >
                      {TIPO_LABEL[p.tipo] ?? p.tipo}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Ejecutado</span>
                      <span className="font-medium text-white">{pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between pt-0.5 text-xs">
                      <span className="text-zinc-600">{fmt(pagado, isPrivateMode)} pagado</span>
                      <span className="text-zinc-500">{fmt(total, isPrivateMode)} total</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Borradores */}
      {presupuestos.filter((p) => p.estado === 'borrador').length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Borradores
          </h2>
          <div className="space-y-2">
            {presupuestos
              .filter((p) => p.estado === 'borrador')
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelectPresupuesto(p.id)}
                  className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-zinc-900/30 px-4 py-3 text-left transition-all hover:bg-zinc-900/60"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-400">{p.nombre}</p>
                    {p.proyecto_nombre && (
                      <p className="text-xs text-zinc-600">{p.proyecto_nombre}</p>
                    )}
                  </div>
                  <span className="text-2xs rounded-full bg-zinc-800 px-2 py-0.5 font-semibold uppercase tracking-widest text-zinc-600">
                    Borrador
                  </span>
                </button>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
