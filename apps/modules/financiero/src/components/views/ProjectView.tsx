import { useMemo, useState, useEffect } from 'react';
import { formatCurrency, parseCurrency, calcularMetricasProyecto } from '@alsari/utils';
import type { DashboardData, FlujoCajaRow, ProyectoDetalle, TipoFlujo } from '@alsari/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ComposedChart, Area } from 'recharts';
import { RefreshCw, MapPin, Layers, Calendar, TrendingUp, Activity } from 'lucide-react';
import { getProyectoDetalle, getFlujosCajaProyecto } from '../../lib/maestroImport';

type ProjectViewProps = {
  data: DashboardData;
  projectId: string;
  isPrivateMode: boolean;
};

const TIPO_FLUJO_LABELS: Record<TipoFlujo, string> = {
  inversion: 'Inversión', recapex: 'ReCapex', venta: 'Venta',
  dividendo: 'Dividendo', ingreso_operativo: 'Ingreso Op.', gasto_operativo: 'Gasto Op.', otro: 'Otro',
};

const TIPO_FLUJO_COLOR: Record<TipoFlujo, string> = {
  inversion: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  recapex: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  venta: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  dividendo: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
  ingreso_operativo: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/20',
  gasto_operativo: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
  otro: 'bg-zinc-700/30 text-zinc-400 border-zinc-600/20',
};

const TASA_DEFAULT = 0.08;

export function ProjectView({ data, projectId, isPrivateMode }: ProjectViewProps) {
  const project = useMemo(
    () => data.proyectos?.find(p => p?.clean_id === projectId || p?.['ID-Ref'] === projectId),
    [data.proyectos, projectId],
  );

  const projectFinancial = useMemo(
    () => data.finanzas_proyectos?.find(f => f?.['ID-Ref']?.toString().trim() === projectId),
    [data.finanzas_proyectos, projectId],
  );

  const [detalle, setDetalle]     = useState<ProyectoDetalle | null>(null);
  const [flujos, setFlujos]       = useState<FlujoCajaRow[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    setLoading(true);
    setDetalle(null);
    setFlujos([]);
    void Promise.all([
      getProyectoDetalle(projectId).catch(() => null),
      getFlujosCajaProyecto(projectId).catch(() => [] as FlujoCajaRow[]),
    ]).then(([det, fl]) => {
      setDetalle(det);
      setFlujos(fl);
      setLoading(false);
    });
  }, [projectId]);

  const metricas = useMemo(
    () => calcularMetricasProyecto(flujos, detalle?.fecha_inicio ?? null, TASA_DEFAULT),
    [flujos, detalle],
  );

  const flujosChartData = useMemo(() => {
    if (!flujos.length) return [];
    let acumulado = 0;
    return [...flujos]
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map(f => {
        acumulado += f.importe;
        return {
          fecha: new Date(f.fecha).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
          importe: f.importe,
          acumulado,
        };
      });
  }, [flujos]);

  if (!project || !projectFinancial) {
    return (
      <div className="flex items-center justify-center py-32 text-zinc-600">
        <p className="text-lg font-semibold uppercase tracking-widest">Proyecto no encontrado</p>
      </div>
    );
  }

  const inversion      = parseCurrency(projectFinancial['Inversión inicial']);
  const capex          = parseCurrency(projectFinancial['ReCapex Acumulado']);
  const capitalExpuesto = parseCurrency(projectFinancial['Capital Expuesto'] ?? projectFinancial['Capital expuesto']);
  const valoracion     = parseCurrency(projectFinancial['Valoración']);
  const margen         = parseCurrency(projectFinancial['Margen latente de salida'] ?? projectFinancial['Margen Latente']);
  const beneficio      = parseCurrency(projectFinancial['Beneficio Acumulado']);

  const margenStr = (projectFinancial['Margen latente de salida %']?.toString() ?? projectFinancial['Margen Latente %']?.toString() ?? '0')
    .replace(/[%€\s]/g, '').replace(',', '.');
  let margenPorcentaje = parseFloat(margenStr);
  if (margenPorcentaje > 10000) margenPorcentaje /= 100;
  if (isNaN(margenPorcentaje)) margenPorcentaje = 0;

  const projectName = project?.clean_nombre ?? project?.Nombre ?? project?.['Nombre del proyecto'] ?? 'Sin nombre';
  const projectType = project?.Tipo ?? 'Proyecto';
  const mask = (val: number) => isPrivateMode ? '••••' : formatCurrency(val);
  const multiplicador = capitalExpuesto > 0 ? valoracion / capitalExpuesto : 0;

  const chartData = [
    { name: 'Coste', valor: capitalExpuesto, fill: '#3b82f6' },
    { name: 'Valor', valor: valoracion, fill: '#10b981' },
  ];

  const totalEntradas = flujos.filter(f => f.importe > 0).reduce((s, f) => s + f.importe, 0);
  const totalSalidas  = flujos.filter(f => f.importe < 0).reduce((s, f) => s + f.importe, 0);

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-light text-white tracking-tight">{projectName}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-zinc-400 text-sm">ID: {projectId} · {projectType}</p>
            {detalle?.tipo_activo && (
              <span className="px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-2xs text-violet-400 font-medium uppercase tracking-wide">
                {detalle.tipo_activo}
              </span>
            )}
            {detalle?.ubicacion && (
              <span className="flex items-center gap-1 text-2xs text-zinc-500">
                <MapPin size={10} />{detalle.ubicacion}
              </span>
            )}
            {detalle?.superficie_m2 && (
              <span className="flex items-center gap-1 text-2xs text-zinc-500">
                <Layers size={10} />{detalle.superficie_m2.toLocaleString('es-ES')} m²
              </span>
            )}
          </div>
        </div>
        <div className={`px-4 py-1 rounded-full text-sm font-medium ${margen >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
          {margen >= 0 ? 'Rentable' : 'En Pérdida'}
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Capital Expuesto" value={mask(capitalExpuesto)}
          sub={<span className="flex justify-between w-full"><span>Inv: {mask(inversion)}</span><span>Capex: {mask(capex)}</span></span>} />
        <KpiCard label="Valoración Actual" value={mask(valoracion)} valueColor="text-emerald-400" sub="Valor de mercado estimado" />
        <KpiCard label="Margen Latente" value={mask(margen)} valueColor={margen >= 0 ? 'text-emerald-400' : 'text-rose-400'}
          sub={`Rentabilidad: ${isPrivateMode ? '••' : `${margenPorcentaje.toFixed(2)}%`}`} />
      </div>

      {/* Gráfico + Rentabilidad */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-80">
        <div className="p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col">
          <h3 className="text-zinc-300 font-medium mb-4">Análisis de Valor</h3>
          <div className="flex-1 w-full">
            {isPrivateMode ? (
              <div className="h-full flex items-center justify-center text-zinc-600 text-sm font-medium">Datos ocultos</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="name" stroke="#666" />
                  <YAxis stroke="#666" tickFormatter={(val: number) => `${(val / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', borderRadius: '8px' }} labelStyle={{ color: '#fff', fontWeight: 'bold' }} formatter={(value: number) => [formatCurrency(value), 'Valor']} />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col justify-center items-center">
          <div className="text-center">
            <p className="text-zinc-400 mb-2">Rentabilidad s/Capital</p>
            <div className={`text-5xl font-light ${isPrivateMode ? 'blur-sm select-none' : ''} ${margenPorcentaje >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {margenPorcentaje > 0 ? '+' : ''}{margenPorcentaje.toFixed(2)}%
            </div>
            <p className="text-sm text-zinc-500 mt-4">Multiplicador: {isPrivateMode ? '••' : `x${multiplicador.toFixed(2)}`}</p>
            <div className="mt-6 w-full max-w-xs">
              <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-500 ${margenPorcentaje >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  style={{ width: `${Math.min(Math.abs(margenPorcentaje), 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs secundarios */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MiniKpi label="Inversión Inicial" value={mask(inversion)} />
        <MiniKpi label="ReCapex Acumulado" value={mask(capex)} color="text-blue-400" />
        <MiniKpi label="Beneficio Acumulado" value={mask(beneficio)} color={beneficio >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
        <MiniKpi label="ROI Potencial" value={isPrivateMode ? '••' : `${margenPorcentaje > 0 ? '+' : ''}${margenPorcentaje.toFixed(2)}%`} color={margenPorcentaje >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
      </div>

      {/* Ficha del activo + fechas */}
      {!loading && detalle && (detalle.fecha_inicio ?? detalle.fecha_prevista_salida ?? detalle.tipo_activo ?? detalle.ubicacion) && (
        <Section icon={<Layers size={14} />} title="Ficha del Activo">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {detalle.tipo_activo && <InfoField label="Tipo de Activo" value={detalle.tipo_activo} />}
            {detalle.ubicacion   && <InfoField label="Ubicación"      value={detalle.ubicacion} />}
            {detalle.superficie_m2 && <InfoField label="Superficie" value={`${detalle.superficie_m2.toLocaleString('es-ES')} m²`} />}
            {detalle.fecha_inicio && (
              <InfoField label="Fecha Inicio" value={new Date(detalle.fecha_inicio).toLocaleDateString('es-ES')}
                icon={<Calendar size={10} />} />
            )}
            {detalle.fecha_prevista_salida && (
              <InfoField label="Salida Prevista" value={new Date(detalle.fecha_prevista_salida).toLocaleDateString('es-ES')}
                icon={<Calendar size={10} />} />
            )}
            {detalle.fecha_salida_real && (
              <InfoField label="Salida Real" value={new Date(detalle.fecha_salida_real).toLocaleDateString('es-ES')}
                icon={<Calendar size={10} />} color="text-emerald-400" />
            )}
            {metricas.dias_desde_inicio != null && (
              <InfoField label="Tiempo en cartera"
                value={`${metricas.dias_desde_inicio}d · ${(metricas.dias_desde_inicio / 365.25).toFixed(1)} años`} />
            )}
          </div>
        </Section>
      )}

      {/* Métricas calculadas (solo si hay flujos) */}
      {!loading && flujos.length >= 2 && (
        <Section icon={<Activity size={14} />} title="Métricas de Retorno">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricaCard
              label="TIR (XIRR)"
              value={metricas.tir != null ? `${(metricas.tir * 100).toFixed(2)}%` : '—'}
              sub="Tasa interna de retorno"
              color={metricas.tir != null ? (metricas.tir > 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-zinc-400'}
              isPrivate={isPrivateMode}
            />
            <MetricaCard
              label="VAN"
              value={metricas.van != null ? mask(metricas.van) : '—'}
              sub={`Tasa ${(TASA_DEFAULT * 100).toFixed(0)}%`}
              color={metricas.van != null ? (metricas.van > 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-zinc-400'}
              isPrivate={isPrivateMode}
            />
            <MetricaCard
              label="MOIC"
              value={metricas.moic != null ? `×${metricas.moic.toFixed(2)}` : '—'}
              sub="Múltiplo sobre capital"
              color={metricas.moic != null ? (metricas.moic > 1 ? 'text-emerald-400' : 'text-rose-400') : 'text-zinc-400'}
              isPrivate={isPrivateMode}
            />
            <MetricaCard
              label="Período"
              value={metricas.periodo_inversion_dias != null
                ? `${metricas.periodo_inversion_dias}d`
                : metricas.dias_desde_inicio != null ? `${metricas.dias_desde_inicio}d` : '—'}
              sub={metricas.dias_desde_inicio != null ? `${(metricas.dias_desde_inicio / 365.25).toFixed(1)} años` : 'Sin fecha inicio'}
              color="text-zinc-300"
            />
          </div>
        </Section>
      )}

      {/* Flujos de caja */}
      {loading ? (
        <Section icon={<TrendingUp size={14} />} title="Flujos de Caja">
          <div className="flex items-center gap-2 text-zinc-500 text-xs py-4">
            <RefreshCw size={13} className="animate-spin" />Cargando flujos...
          </div>
        </Section>
      ) : flujos.length > 0 ? (
        <Section icon={<TrendingUp size={14} />} title={`Flujos de Caja · ${flujos.length} movimientos`}>
          {/* Gráfico acumulado */}
          {flujosChartData.length >= 2 && (
            <div className="h-48 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={flujosChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="fecha" stroke="#52525b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#52525b" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name === 'acumulado' ? 'Saldo acumulado' : 'Flujo',
                    ]}
                  />
                  <Bar dataKey="importe" radius={[3, 3, 0, 0]}
                    fill="#6366f1"
                    label={false}>
                    {flujosChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.importe >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.7} />
                    ))}
                  </Bar>
                  <Area dataKey="acumulado" type="monotone" stroke="#6366f1" strokeWidth={2}
                    fill="#6366f1" fillOpacity={0.08} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabla de flujos */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-2xs text-zinc-500 uppercase tracking-widest border-b border-white/5">
                  <th className="pb-2 text-left font-medium">Fecha</th>
                  <th className="pb-2 text-left font-medium">Tipo</th>
                  <th className="pb-2 text-left font-medium">Concepto</th>
                  <th className="pb-2 text-right font-medium">Importe</th>
                </tr>
              </thead>
              <tbody>
                {flujos.map(f => (
                  <tr key={f.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 pr-4 text-zinc-400 font-mono text-xs">
                      {new Date(f.fecha).toLocaleDateString('es-ES')}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`px-2 py-0.5 rounded-full border text-2xs font-medium uppercase tracking-wide ${TIPO_FLUJO_COLOR[f.tipo_flujo]}`}>
                        {TIPO_FLUJO_LABELS[f.tipo_flujo]}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-500 text-xs truncate max-w-[200px]">{f.concepto ?? '—'}</td>
                    <td className={`py-2.5 text-right font-mono font-medium text-sm ${f.importe >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPrivateMode ? '••••' : `${f.importe >= 0 ? '+' : ''}${formatCurrency(f.importe)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-white/10">
                <tr>
                  <td colSpan={3} className="pt-3 text-2xs text-zinc-500 uppercase tracking-widest font-medium">Balance</td>
                  <td className="pt-3 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-emerald-400 font-mono text-xs">+{isPrivateMode ? '••••' : formatCurrency(totalEntradas)}</span>
                      <span className="text-rose-400 font-mono text-xs">{isPrivateMode ? '••••' : formatCurrency(totalSalidas)}</span>
                      <span className={`font-mono font-semibold text-sm ${(totalEntradas + totalSalidas) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {isPrivateMode ? '••••' : `${(totalEntradas + totalSalidas) >= 0 ? '+' : ''}${formatCurrency(totalEntradas + totalSalidas)}`}
                      </span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-2xs text-zinc-600 mt-4">Los flujos se gestionan desde Datos Maestros → Proyecto.</p>
        </Section>
      ) : null}
    </div>
  );
}

// ── Componentes ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, valueColor = 'text-white', sub }: { label: string; value: string; valueColor?: string; sub: React.ReactNode }) {
  return (
    <div className="p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
      <p className="text-zinc-400 text-sm mb-1">{label}</p>
      <p className={`text-2xl font-medium ${valueColor}`}>{value}</p>
      <div className="mt-2 text-xs text-zinc-500 flex justify-between">{sub}</div>
    </div>
  );
}

function MiniKpi({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
      <p className="text-zinc-400 text-xs mb-1">{label}</p>
      <p className={`text-lg font-medium font-mono ${color}`}>{value}</p>
    </div>
  );
}

function MetricaCard({ label, value, sub, color, isPrivate }: { label: string; value: string; sub: string; color: string; isPrivate?: boolean }) {
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
      <p className="text-2xs font-medium text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${color} ${isPrivate ? 'blur-sm select-none' : ''}`}>{value}</p>
      <p className="text-2xs text-zinc-600 mt-1">{sub}</p>
    </div>
  );
}

function InfoField({ label, value, icon, color = 'text-zinc-300' }: { label: string; value: string; icon?: React.ReactNode; color?: string }) {
  return (
    <div className="p-3 rounded-lg bg-zinc-900/40 border border-white/[0.04]">
      <p className="text-2xs font-medium text-zinc-600 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-sm font-semibold ${color} flex items-center gap-1`}>{icon}{value}</p>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-white/5 bg-zinc-900/50">
        <span className="text-violet-400">{icon}</span>
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
