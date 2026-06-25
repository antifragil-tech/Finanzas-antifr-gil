// Bloque de métricas reales consolidadas + gráfico de flujos + tabla de trazabilidad
import { useState, useEffect } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { Loader2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import type { MetricasProyectoResumen, FlujoProyectoConsolidado } from '@alsari/types';
import { getMetricasProyectoResumen, getFlujosProyectoConsolidados } from '../../../../lib/metricasProyectoApi';
import { KpiCard, KpiGrid, fmt, fmtPct } from './shared';

const FUENTE_LABEL: Record<string, string> = {
  flujo_manual:     'Flujo manual',
  presupuesto_pago: 'Pago presupuesto',
  factura_recibida: 'Factura recibida',
};

const FUENTE_COLOR: Record<string, string> = {
  flujo_manual:     'bg-blue-500/15 text-blue-300 border-blue-500/20',
  presupuesto_pago: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
  factura_recibida: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' });
}

// ── Chart ─────────────────────────────────────────────────────────────────────

function FlujosChart({ flujos }: { flujos: FlujoProyectoConsolidado[] }) {
  const sorted = [...flujos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  type ChartRow = { fecha: string; importe: number; acumulado: number };
  const data = sorted.reduce<ChartRow[]>((acc, f) => {
    const prev = acc[acc.length - 1]?.acumulado ?? 0;
    acc.push({ fecha: fmtDate(f.fecha), importe: Math.round(f.importe), acumulado: Math.round(prev + f.importe) });
    return acc;
  }, []);

  if (data.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/30 p-5">
      <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Flujos y acumulado</p>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false}
            tickFormatter={v => v >= 1000 || v <= -1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
          <Tooltip
            contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#a1a1aa' }}
            formatter={(value: number) => [value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }), '']}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} />
          <Bar dataKey="importe" name="Importe" fill="#6366f1" radius={[3,3,0,0]}
            label={false}
            // positive = green, negative = red via Cell would require Cell import — use neutral violet
          />
          <Line dataKey="acumulado" name="Acumulado" stroke="#34d399" strokeWidth={2} dot={false} type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Tabla de trazabilidad ─────────────────────────────────────────────────────

function TrazabilidadTable({ flujos }: { flujos: FlujoProyectoConsolidado[] }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...flujos].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const visible = expanded ? sorted : sorted.slice(0, 8);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/30 overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between border-b border-white/[0.05]">
        <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Trazabilidad de flujos</p>
        <span className="text-xs text-zinc-600">{flujos.length} movimientos</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {['Fecha','Concepto','Importe','Fuente','Estado','Tipo','Sociedad'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-2xs font-semibold text-zinc-600 uppercase tracking-widest whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((f, i) => (
              <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-2.5 text-zinc-400 whitespace-nowrap">{fmtDate(f.fecha)}</td>
                <td className="px-4 py-2.5 text-zinc-300 max-w-[180px] truncate">{f.concepto ?? '—'}</td>
                <td className={`px-4 py-2.5 font-medium tabular-nums whitespace-nowrap ${f.importe < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {f.importe.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-2xs font-medium border ${FUENTE_COLOR[f.fuente] ?? 'bg-zinc-800 text-zinc-400 border-white/10'}`}>
                    {FUENTE_LABEL[f.fuente] ?? f.fuente}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-zinc-500 capitalize">{f.estado ?? '—'}</td>
                <td className="px-4 py-2.5 text-zinc-500">
                  {f.es_real ? <span className="text-emerald-500">Real</span> : <span className="text-amber-500">Previsto</span>}
                </td>
                <td className="px-4 py-2.5 text-zinc-600">{f.sociedad_id_ref ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {flujos.length > 8 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors border-t border-white/[0.05]"
        >
          {expanded ? <><ChevronUp size={13} /> Mostrar menos</> : <><ChevronDown size={13} /> Ver todos ({flujos.length})</>}
        </button>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function MetricasReales({ proyectoId }: { proyectoId: string }) {
  const [metricas, setMetricas] = useState<MetricasProyectoResumen | null>(null);
  const [flujos, setFlujos]     = useState<FlujoProyectoConsolidado[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    setLoading(true); setError('');
    Promise.all([
      getMetricasProyectoResumen(proyectoId),
      getFlujosProyectoConsolidados(proyectoId),
    ]).then(([m, f]) => {
      setMetricas(m);
      setFlujos(f);
    }).catch(e => {
      setError(e instanceof Error ? e.message : 'Error cargando métricas');
    }).finally(() => setLoading(false));
  }, [proyectoId]);

  if (loading) return (
    <div className="flex justify-center py-10">
      <Loader2 size={18} className="animate-spin text-zinc-600" />
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-2 py-6 text-xs text-amber-400">
      <AlertTriangle size={14} />
      {error.includes('42P01')
        ? 'Las vistas de métricas no están disponibles aún. Aplica la migración SQL 20260531 en Supabase.'
        : error}
    </div>
  );

  const noHayFlujos = flujos.length === 0;
  const noHayMetricas = !metricas || (
    !metricas.gasto_real_acumulado &&
    !metricas.ingreso_real_acumulado &&
    !metricas.presupuesto_total_aprobado
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Métricas reales del proyecto</p>
      </div>

      {noHayMetricas && noHayFlujos ? (
        <div className="flex flex-col items-center justify-center py-10 rounded-2xl border border-white/[0.06] bg-zinc-900/20">
          <p className="text-sm text-zinc-500">No hay flujos reales vinculados a este proyecto todavía.</p>
          <p className="text-xs text-zinc-700 mt-1">Vincula facturas, pagos de presupuesto o añade flujos manuales para ver métricas.</p>
        </div>
      ) : (
        <>
          {metricas && (
            <>
              <KpiGrid cols={4}>
                <KpiCard
                  label="Gasto real acumulado"
                  value={metricas.gasto_real_acumulado ? fmt(metricas.gasto_real_acumulado) : '—'}
                  sub="Flujos reales negativos"
                  tooltip="Total de pagos y salidas de dinero reales vinculadas a este proyecto."
                />
                <KpiCard
                  label="Ingreso real acumulado"
                  value={metricas.ingreso_real_acumulado ? fmt(metricas.ingreso_real_acumulado) : '—'}
                  sub="Flujos reales positivos"
                  tooltip="Total de cobros e ingresos reales vinculados a este proyecto."
                />
                <KpiCard
                  label="Saldo neto real"
                  value={metricas.saldo_neto_real != null ? fmt(metricas.saldo_neto_real) : '—'}
                  sub="Ingresos − gastos reales"
                  semaforo={metricas.saldo_neto_real != null ? (metricas.saldo_neto_real >= 0 ? 'verde' : 'rojo') : 'neutro'}
                  tooltip="Diferencia entre ingresos y gastos reales acumulados. Indica si el proyecto ha generado o consumido caja."
                />
                {metricas.ultimo_movimiento_fecha && (
                  <KpiCard
                    label="Último movimiento"
                    value={fmtDate(metricas.ultimo_movimiento_fecha)}
                    sub="Fecha del flujo real más reciente"
                    tooltip="Fecha del último flujo real registrado en este proyecto."
                  />
                )}
              </KpiGrid>

              <KpiGrid cols={3}>
                {metricas.presupuesto_total_aprobado != null && (
                  <KpiCard
                    label="Presupuesto aprobado"
                    value={fmt(metricas.presupuesto_total_aprobado)}
                    sub="Partidas activas y cerradas"
                    tooltip="Importe total de las partidas presupuestarias activas o cerradas del proyecto."
                  />
                )}
                {metricas.presupuesto_pagado != null && (
                  <KpiCard
                    label="Presupuesto pagado"
                    value={fmt(metricas.presupuesto_pagado)}
                    sub="Pagos ejecutados"
                    tooltip="Pagos ya ejecutados sobre las partidas presupuestarias del proyecto."
                  />
                )}
                {metricas.presupuesto_pendiente != null && (
                  <KpiCard
                    label="Presupuesto pendiente"
                    value={fmt(metricas.presupuesto_pendiente)}
                    sub="Pagos por ejecutar"
                    semaforo={metricas.presupuesto_pendiente > 0 ? 'ambar' : 'neutro'}
                    tooltip="Pagos presupuestados aún no ejecutados. Un importe elevado indica compromisos futuros de caja."
                  />
                )}
              </KpiGrid>

              {/* Desviación presupuesto vs real */}
              {metricas.desviacion_presupuesto_importe != null ? (
                <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4 space-y-3">
                  <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Desviación presupuesto vs real</p>
                  <KpiGrid cols={3}>
                    <KpiCard
                      label="Presupuesto maestro"
                      value={metricas.presupuesto_total_aprobado ? fmt(metricas.presupuesto_total_aprobado) : '—'}
                      sub="Total aprobado"
                      tooltip="Importe total del presupuesto maestro aprobado para este proyecto."
                    />
                    <KpiCard
                      label="Gasto real acumulado"
                      value={metricas.gasto_real_acumulado ? fmt(metricas.gasto_real_acumulado) : '—'}
                      sub="Flujos reales negativos"
                      tooltip="Total de pagos y salidas de dinero reales vinculadas a este proyecto."
                    />
                    <KpiCard
                      label="Desviación presupuestaria"
                      value={`${metricas.desviacion_presupuesto_importe >= 0 ? '+' : ''}${fmt(metricas.desviacion_presupuesto_importe)}`}
                      sub={metricas.desviacion_presupuesto_pct != null ? `${(metricas.desviacion_presupuesto_pct * 100).toFixed(1)}% sobre presupuesto` : undefined}
                      semaforo={
                        metricas.desviacion_presupuesto_pct == null ? 'neutro'
                        : metricas.desviacion_presupuesto_pct > 0.15 ? 'rojo'
                        : metricas.desviacion_presupuesto_pct > 0.05 ? 'ambar'
                        : 'verde'
                      }
                      tooltip="Diferencia entre el presupuesto aprobado y el gasto real. Un valor negativo indica que se está por debajo del presupuesto; positivo, por encima."
                    />
                  </KpiGrid>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/[0.05] bg-zinc-900/30 text-xs text-zinc-600">
                  <span className="text-zinc-700">—</span>
                  Este proyecto todavía no tiene presupuesto maestro. Marca uno para activar la desviación presupuesto vs real.
                </div>
              )}

              {(metricas.inversion_total_proyectada || metricas.gasto_real_acumulado) && (
                <div className="grid grid-cols-2 gap-3">
                  {metricas.inversion_total_proyectada != null && (
                    <KpiCard
                      label="Inversión proyectada"
                      value={fmt(metricas.inversion_total_proyectada)}
                      sub="Según análisis financiero"
                      tooltip="Inversión total estimada según los parámetros del análisis financiero del proyecto."
                    />
                  )}
                  {metricas.inversion_total_proyectada && metricas.gasto_real_acumulado ? (
                    <KpiCard
                      label="Ejecución vs proyectado"
                      value={fmtPct(metricas.gasto_real_acumulado / metricas.inversion_total_proyectada)}
                      sub="Gasto real / inversión proyectada"
                      semaforo={
                        metricas.gasto_real_acumulado / metricas.inversion_total_proyectada > 1.15 ? 'rojo'
                        : metricas.gasto_real_acumulado / metricas.inversion_total_proyectada > 1.05 ? 'ambar'
                        : 'verde'
                      }
                      tooltip="Porcentaje del gasto real respecto a la inversión proyectada. Por encima del 100% indica sobrecosto respecto a lo planificado."
                    />
                  ) : null}
                </div>
              )}

              {(metricas.facturas_pendientes_importe || metricas.facturas_pagadas_importe) && (
                <div className="grid grid-cols-2 gap-3">
                  {metricas.facturas_pendientes_importe != null && metricas.facturas_pendientes_importe > 0 && (
                    <KpiCard
                      label="Facturas pendientes"
                      value={fmt(metricas.facturas_pendientes_importe)}
                      sub="Pendiente de pago o en revisión"
                      semaforo="ambar"
                      tooltip="Importe de facturas en estado pendiente de pago o revisión vinculadas a este proyecto."
                    />
                  )}
                  {metricas.facturas_pagadas_importe != null && metricas.facturas_pagadas_importe > 0 && (
                    <KpiCard
                      label="Facturas pagadas"
                      value={fmt(metricas.facturas_pagadas_importe)}
                      sub="Incluye las vinculadas a presupuesto"
                      tooltip="Importe de facturas ya pagadas, incluidas las vinculadas a partidas de presupuesto."
                    />
                  )}
                </div>
              )}
            </>
          )}

          {!noHayFlujos && (
            <>
              <FlujosChart flujos={flujos} />
              <TrazabilidadTable flujos={flujos} />
            </>
          )}
        </>
      )}
    </div>
  );
}
