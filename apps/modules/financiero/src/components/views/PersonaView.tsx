import { useState, useEffect, useMemo } from 'react';
import { formatCurrency } from '@alsari/utils';
import type { ActivoPatrimonio, PersonaPatrimonio, CapexActivo } from '@alsari/types';
import {
  getPersonas,
  getActivosByPersona,
  getCapexByActivo,
  insertCapex,
  deleteCapex,
} from '../../lib/patrimonioImport';
import {
  Building2,
  TrendingUp,
  BarChart2,
  Anchor,
  RefreshCw,
  AlertTriangle,
  Wallet,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  Hammer,
  Plus,
  Trash2,
} from 'lucide-react';

const CATEGORIA_CONFIG = {
  inmobiliario: {
    label: 'Inmobiliario',
    icon: <Building2 size={14} />,
    color: 'text-blue-400 bg-blue-500/15 border-blue-500/20',
  },
  fondo: {
    label: 'Fondos',
    icon: <TrendingUp size={14} />,
    color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20',
  },
  cotizado: {
    label: 'Cotizados',
    icon: <BarChart2 size={14} />,
    color: 'text-violet-400 bg-violet-500/15 border-violet-500/20',
  },
  bien_valor: {
    label: 'Bienes de Valor',
    icon: <Anchor size={14} />,
    color: 'text-amber-400 bg-amber-500/15 border-amber-500/20',
  },
} as const;

function valorNeto(a: ActivoPatrimonio): number {
  return (a.valor_actual * a.porcentaje_propiedad) / 100 - (a.deuda_viva ?? 0);
}

function plusvaliaLatente(a: ActivoPatrimonio): number | null {
  if (a.valor_adquisicion == null) return null;
  if (
    (a.categoria === 'cotizado' || a.categoria === 'fondo') &&
    a.num_unidades != null &&
    a.precio_coste_medio != null
  ) {
    return (a.valor_actual - a.precio_coste_medio) * a.num_unidades;
  }
  return a.valor_actual - a.valor_adquisicion;
}

function capitalExpuesto(a: ActivoPatrimonio): number {
  return (a.valor_actual * a.porcentaje_propiedad) / 100;
}

function rendimientoBruto(a: ActivoPatrimonio): number | null {
  const ce = capitalExpuesto(a);
  if (ce <= 0 || !a.renta_mensual) return null;
  return ((a.renta_mensual * 12) / ce) * 100;
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

function Stat({
  label,
  value,
  highlight,
  negative,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-3">
      <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
      <p
        className={`mt-0.5 text-sm font-semibold ${highlight ? 'text-emerald-400' : negative ? 'text-rose-400' : 'text-zinc-200'}`}
      >
        {value}
      </p>
    </div>
  );
}

function KpiTooltipWrapper({
  children,
  tooltip,
}: {
  children: React.ReactNode;
  tooltip: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 min-w-[280px] rounded-xl border border-white/10 bg-zinc-900 p-3 shadow-2xl">
          {tooltip}
        </div>
      )}
    </div>
  );
}

type Props = {
  personaNombre: string; // 'Javier' | 'Iván'
  holdingNombre: string; // 'Pavier S.L.' | 'Armia S.L.'
  isPrivateMode: boolean;
  onViewHolding: () => void;
};

export function PersonaView({ personaNombre, holdingNombre, isPrivateMode, onViewHolding }: Props) {
  const [, setPersonas] = useState<PersonaPatrimonio[] | null>(null);
  const [activos, setActivos] = useState<ActivoPatrimonio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [popupCat, setPopupCat] = useState<keyof typeof CATEGORIA_CONFIG | null>(null);
  const [capexByActivo, setCapexByActivo] = useState<Record<string, CapexActivo[]>>({});
  const [capexLoadedFor, setCapexLoadedFor] = useState<Set<string>>(new Set());
  const [capexLoading, setCapexLoading] = useState<Set<string>>(new Set());
  const [capexForm, setCapexForm] = useState<{
    activoId: string;
    descripcion: string;
    importe: string;
    fecha: string;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const ps = await getPersonas();
      setPersonas(ps);
      const persona = ps.find((p) =>
        p.nombre.toLowerCase().includes(personaNombre.toLowerCase().split(' ')[0] ?? ''),
      );
      if (persona) {
        const a = await getActivosByPersona(persona.id);
        setActivos(a);
      } else {
        setActivos([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [personaNombre]); // eslint-disable-line react-hooks/exhaustive-deps

  const kpis = useMemo(() => {
    const neto = activos.reduce((s, a) => s + valorNeto(a), 0);
    const bruto = activos.reduce((s, a) => s + (a.valor_actual * a.porcentaje_propiedad) / 100, 0);
    const deuda = activos.reduce((s, a) => s + (a.deuda_viva ?? 0), 0);
    const apalancamiento = bruto > 0 ? (deuda / bruto) * 100 : null;
    const rentaTotal = activos.reduce((s, a) => s + (a.renta_mensual ?? 0), 0);
    const cashFlow = activos.reduce(
      (s, a) => s + (a.renta_mensual ? a.renta_mensual - (a.cuota_mensual ?? 0) : 0),
      0,
    );
    const capConRenta = activos
      .filter((a) => (a.renta_mensual ?? 0) > 0)
      .reduce((s, a) => s + capitalExpuesto(a), 0);
    const costesAnuales = activos
      .filter((a) => (a.renta_mensual ?? 0) > 0)
      .reduce((s, a) => s + (a.coste_mantenimiento_anual ?? 0), 0);
    const rentBruta = capConRenta > 0 ? ((rentaTotal * 12) / capConRenta) * 100 : null;
    const rentNeta =
      capConRenta > 0 ? ((rentaTotal * 12 - costesAnuales) / capConRenta) * 100 : null;
    const pvItems = activos.map((a) => plusvaliaLatente(a)).filter((p): p is number => p != null);
    const plusvalia = pvItems.length > 0 ? pvItems.reduce((s, p) => s + p, 0) : null;
    const bycat = Object.fromEntries(
      (Object.keys(CATEGORIA_CONFIG) as (keyof typeof CATEGORIA_CONFIG)[]).map((k) => {
        const items = activos.filter((a) => a.categoria === k);
        const brutoK = items.reduce(
          (s, a) => s + (a.valor_actual * a.porcentaje_propiedad) / 100,
          0,
        );
        const deudaK = items.reduce((s, a) => s + (a.deuda_viva ?? 0), 0);
        const netoK = brutoK - deudaK;
        const rentaK = items.reduce((s, a) => s + (a.renta_mensual ?? 0), 0);
        const costesK = items
          .filter((a) => (a.renta_mensual ?? 0) > 0)
          .reduce((s, a) => s + (a.coste_mantenimiento_anual ?? 0), 0);
        const cfK = items.reduce(
          (s, a) => s + (a.renta_mensual ? a.renta_mensual - (a.cuota_mensual ?? 0) : 0),
          0,
        );
        const capRentaK = items
          .filter((a) => (a.renta_mensual ?? 0) > 0)
          .reduce((s, a) => s + capitalExpuesto(a), 0);
        const rentBrutaK = capRentaK > 0 ? ((rentaK * 12) / capRentaK) * 100 : null;
        const rentNetaK = capRentaK > 0 ? ((rentaK * 12 - costesK) / capRentaK) * 100 : null;
        const pvItems = items.map((a) => plusvaliaLatente(a)).filter((p): p is number => p != null);
        const pvTotal = pvItems.length > 0 ? pvItems.reduce((s, p) => s + p, 0) : null;
        // Para fondos/cotizados: coste total invertido
        const costeInvertido = items.reduce((s, a) => {
          if (
            (a.categoria === 'cotizado' || a.categoria === 'fondo') &&
            a.num_unidades &&
            a.precio_coste_medio
          )
            return s + a.num_unidades * a.precio_coste_medio;
          if (a.valor_adquisicion) return s + a.valor_adquisicion;
          return s;
        }, 0);
        const divTotal = items.reduce((s, a) => {
          const d = dividendoAnual(a);
          return d != null ? s + d : s;
        }, 0);
        return [
          k,
          {
            neto: netoK,
            bruto: brutoK,
            deuda: deudaK,
            renta: rentaK,
            cashFlow: cfK,
            rentBruta: rentBrutaK,
            rentNeta: rentNetaK,
            pvTotal,
            costeInvertido,
            divTotal,
            count: items.length,
          },
        ];
      }),
    ) as Record<
      keyof typeof CATEGORIA_CONFIG,
      {
        neto: number;
        bruto: number;
        deuda: number;
        renta: number;
        cashFlow: number;
        rentBruta: number | null;
        rentNeta: number | null;
        pvTotal: number | null;
        costeInvertido: number;
        divTotal: number;
        count: number;
      }
    >;
    // Breakdowns para tooltips
    const netoBreakdown = (
      Object.entries(CATEGORIA_CONFIG) as [
        keyof typeof CATEGORIA_CONFIG,
        (typeof CATEGORIA_CONFIG)[keyof typeof CATEGORIA_CONFIG],
      ][]
    )
      .map(([id, cfg]) => ({
        label: cfg.label,
        value: bycat[id].neto,
        color: cfg.color.split(' ')[0] ?? 'text-zinc-400',
      }))
      .filter((x) => x.value !== 0);

    const deudaBreakdown = activos
      .filter((a) => (a.deuda_viva ?? 0) > 0)
      .map((a) => ({
        nombre: a.nombre,
        deuda: a.deuda_viva ?? 0,
        ltv:
          a.valor_actual > 0
            ? ((a.deuda_viva ?? 0) / ((a.valor_actual * a.porcentaje_propiedad) / 100)) * 100
            : null,
      }));

    const cfBreakdown = activos
      .filter((a) => (a.renta_mensual ?? 0) > 0)
      .map((a) => ({
        nombre: a.nombre,
        renta: a.renta_mensual ?? 0,
        cuota: a.cuota_mensual ?? 0,
        cf: (a.renta_mensual ?? 0) - (a.cuota_mensual ?? 0),
      }));

    const rentaBreakdown = activos
      .filter((a) => (a.renta_mensual ?? 0) > 0)
      .map((a) => ({ nombre: a.nombre, renta: a.renta_mensual ?? 0, rb: rendimientoBruto(a) }));

    const pvBreakdown = activos
      .map((a) => {
        const pv = plusvaliaLatente(a);
        return { nombre: a.nombre, pv, pvP: plusvaliaPct(a, pv) };
      })
      .filter((x): x is { nombre: string; pv: number; pvP: number | null } => x.pv != null);

    return {
      neto,
      bruto,
      deuda,
      apalancamiento,
      rentaTotal,
      cashFlow,
      rentBruta,
      rentNeta,
      plusvalia,
      bycat,
      netoBreakdown,
      deudaBreakdown,
      cfBreakdown,
      rentaBreakdown,
      pvBreakdown,
    };
  }, [activos]);

  const v = (n: number) => (isPrivateMode ? '••••' : formatCurrency(n));

  const loadCapex = async (activoId: string) => {
    if (capexLoadedFor.has(activoId)) return;
    setCapexLoading((s) => {
      const n = new Set(s);
      n.add(activoId);
      return n;
    });
    try {
      const items = await getCapexByActivo(activoId);
      setCapexByActivo((prev) => ({ ...prev, [activoId]: items }));
      setCapexLoadedFor((s) => {
        const n = new Set(s);
        n.add(activoId);
        return n;
      });
    } catch {
      /* silently */
    } finally {
      setCapexLoading((s) => {
        const n = new Set(s);
        n.delete(activoId);
        return n;
      });
    }
  };

  const handleAddCapex = async (activoId: string) => {
    if (!capexForm || !capexForm.descripcion.trim() || !capexForm.importe) return;
    try {
      const item = await insertCapex({
        activo_id: activoId,
        descripcion: capexForm.descripcion.trim(),
        importe: parseFloat(capexForm.importe),
        fecha: capexForm.fecha,
      });
      setCapexByActivo((prev) => ({ ...prev, [activoId]: [...(prev[activoId] ?? []), item] }));
      setCapexForm(null);
    } catch {
      /* silently */
    }
  };

  const handleDeleteCapex = async (capexId: string, activoId: string) => {
    try {
      await deleteCapex(capexId);
      setCapexByActivo((prev) => ({
        ...prev,
        [activoId]: (prev[activoId] ?? []).filter((c) => c.id !== capexId),
      }));
    } catch {
      /* silently */
    }
  };

  const toggleExpand = (id: string) => {
    if (!expanded.has(id)) void loadCapex(id);
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw size={28} className="animate-spin text-blue-500" />
      </div>
    );
  if (error)
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <AlertTriangle size={36} className="text-rose-500" />
        <p className="text-sm text-zinc-400">{error}</p>
      </div>
    );

  const firstName = personaNombre.split(' ')[0] ?? personaNombre;

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-xl font-semibold uppercase tracking-tight text-white">
            <Wallet className="text-emerald-400" size={22} />
            Patrimonio Personal · {firstName}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Activos a nombre propio (no a través de {holdingNombre})
          </p>
        </div>
        <button
          onClick={() => {
            void load();
          }}
          className="rounded-xl border border-white/10 bg-zinc-900 p-2 text-zinc-500 transition-all hover:text-zinc-300"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {activos.length === 0 ? (
        <div className="space-y-2 rounded-2xl border border-white/5 bg-white/[0.02] p-10 text-center">
          <Wallet size={32} className="mx-auto text-zinc-700" />
          <p className="text-sm font-semibold uppercase tracking-widest text-zinc-600">
            Sin activos personales registrados
          </p>
          <p className="text-xs text-zinc-600">Añádelos desde la sección Patrimonio del sidebar</p>
        </div>
      ) : (
        <>
          {/* ── 5 KPIs globales ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {/* 1. Patrimonio Neto */}
            <KpiTooltipWrapper
              tooltip={
                <div className="space-y-1">
                  <p className="text-2xs mb-2 font-semibold uppercase tracking-widest text-zinc-500">
                    Por clase de activo
                  </p>
                  {kpis.netoBreakdown.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between border-b border-white/[0.04] py-1 last:border-0"
                    >
                      <span className="text-xs text-zinc-400">{item.label}</span>
                      <span className={`text-xs font-semibold ${item.color}`}>{v(item.value)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-white/10 pt-2">
                    <span className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
                      Neto total
                    </span>
                    <span className="text-sm font-semibold text-white">{v(kpis.neto)}</span>
                  </div>
                </div>
              }
            >
              <div className="cursor-default rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
                  Patrimonio Neto
                </p>
                <p className="mt-1.5 text-xl font-semibold text-white">{v(kpis.neto)}</p>
                <p className="text-2xs mt-1.5 font-medium text-zinc-600">Bruto {v(kpis.bruto)}</p>
              </div>
            </KpiTooltipWrapper>

            {/* 2. Deuda Total */}
            <KpiTooltipWrapper
              tooltip={
                kpis.deudaBreakdown.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-2xs mb-2 font-semibold uppercase tracking-widest text-zinc-500">
                      Deuda por activo
                    </p>
                    {kpis.deudaBreakdown.map((item) => (
                      <div
                        key={item.nombre}
                        className="flex items-center justify-between gap-3 border-b border-white/[0.04] py-1 last:border-0"
                      >
                        <span className="truncate text-xs text-zinc-300">{item.nombre}</span>
                        <div className="shrink-0 text-right">
                          <span className="text-xs font-semibold text-rose-400">
                            {v(item.deuda)}
                          </span>
                          {item.ltv != null && (
                            <span className="text-2xs ml-2 text-zinc-600">
                              LTV {item.ltv.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-white/10 pt-2">
                      <span className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
                        Total
                      </span>
                      <span className="text-sm font-semibold text-rose-400">{v(kpis.deuda)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">Sin deuda registrada</p>
                )
              }
            >
              <div className="cursor-default rounded-2xl border border-rose-500/15 bg-rose-500/[0.03] p-4">
                <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
                  Deuda Total
                </p>
                <p className="mt-1.5 text-xl font-semibold text-rose-400">
                  {kpis.deuda > 0 ? v(kpis.deuda) : '—'}
                </p>
                <p className="text-2xs mt-1.5 font-medium text-zinc-600">
                  {kpis.apalancamiento != null && kpis.deuda > 0
                    ? `Apal. ${kpis.apalancamiento.toFixed(1)}%`
                    : 'Sin deuda'}
                </p>
              </div>
            </KpiTooltipWrapper>

            {/* 3. Cash Flow */}
            <KpiTooltipWrapper
              tooltip={
                kpis.cfBreakdown.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-2xs mb-2 font-semibold uppercase tracking-widest text-zinc-500">
                      Renta − Cuota por activo
                    </p>
                    {kpis.cfBreakdown.map((item) => (
                      <div
                        key={item.nombre}
                        className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-white/[0.04] py-1 last:border-0"
                      >
                        <span className="truncate text-xs text-zinc-300">{item.nombre}</span>
                        <div className="shrink-0 text-right">
                          <span className="text-2xs text-zinc-600">
                            {v(item.renta)} − {v(item.cuota)}
                          </span>
                          <span
                            className={`ml-2 text-xs font-semibold ${item.cf >= 0 ? 'text-blue-400' : 'text-rose-400'}`}
                          >
                            {v(item.cf)}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-white/10 pt-2">
                      <span className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
                        Total
                      </span>
                      <span
                        className={`text-sm font-semibold ${kpis.cashFlow >= 0 ? 'text-blue-400' : 'text-rose-400'}`}
                      >
                        {v(kpis.cashFlow)}/mes
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">Sin ingresos registrados</p>
                )
              }
            >
              <div
                className={`cursor-default rounded-2xl border p-4 ${kpis.rentaTotal > 0 ? (kpis.cashFlow >= 0 ? 'border-blue-500/15 bg-blue-500/[0.03]' : 'border-rose-500/15 bg-rose-500/[0.03]') : 'border-white/5 bg-white/[0.01] opacity-50'}`}
              >
                <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
                  Cash Flow
                </p>
                <p
                  className={`mt-1.5 text-xl font-semibold ${kpis.rentaTotal > 0 ? (kpis.cashFlow >= 0 ? 'text-blue-400' : 'text-rose-400') : 'text-zinc-600'}`}
                >
                  {kpis.rentaTotal > 0 ? `${v(kpis.cashFlow)}/mes` : '—'}
                </p>
                <p className="text-2xs mt-1.5 font-medium text-zinc-600">
                  {kpis.rentaTotal > 0 ? `Renta ${v(kpis.rentaTotal)}` : 'Sin ingresos'}
                </p>
              </div>
            </KpiTooltipWrapper>

            {/* 4. Rentabilidad */}
            <KpiTooltipWrapper
              tooltip={
                kpis.rentaBreakdown.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-2xs mb-2 font-semibold uppercase tracking-widest text-zinc-500">
                      Yield por activo
                    </p>
                    {kpis.rentaBreakdown.map((item) => (
                      <div
                        key={item.nombre}
                        className="flex items-center justify-between gap-3 border-b border-white/[0.04] py-1 last:border-0"
                      >
                        <span className="truncate text-xs text-zinc-300">{item.nombre}</span>
                        <div className="shrink-0 text-right">
                          <span className="text-2xs text-zinc-600">{v(item.renta)}/mes</span>
                          {item.rb != null && (
                            <span className="ml-2 text-xs font-semibold text-emerald-400">
                              {item.rb.toFixed(2)}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-white/10 pt-2">
                      <span className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
                        Media pond.
                      </span>
                      <span className="text-sm font-semibold text-emerald-400">
                        {kpis.rentBruta != null ? `${kpis.rentBruta.toFixed(2)}%` : '—'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">Sin activos con renta</p>
                )
              }
            >
              <div
                className={`cursor-default rounded-2xl border p-4 ${kpis.rentBruta != null ? 'border-emerald-500/15 bg-emerald-500/[0.03]' : 'border-white/5 bg-white/[0.01] opacity-50'}`}
              >
                <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
                  Rentabilidad
                </p>
                <p
                  className={`mt-1.5 text-xl font-semibold ${kpis.rentBruta != null ? 'text-emerald-400' : 'text-zinc-600'}`}
                >
                  {kpis.rentBruta != null ? `${kpis.rentBruta.toFixed(2)}%` : '—'}
                </p>
                <p className="text-2xs mt-1.5 font-medium text-zinc-600">
                  {kpis.rentBruta != null && kpis.rentNeta != null
                    ? `bruta · ${kpis.rentNeta.toFixed(2)}% neta`
                    : 'Sin renta'}
                </p>
              </div>
            </KpiTooltipWrapper>

            {/* 5. Plusvalía */}
            <KpiTooltipWrapper
              tooltip={
                kpis.pvBreakdown.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-2xs mb-2 font-semibold uppercase tracking-widest text-zinc-500">
                      Plusvalía por activo
                    </p>
                    {kpis.pvBreakdown.map((item) => (
                      <div
                        key={item.nombre}
                        className="flex items-center justify-between gap-3 border-b border-white/[0.04] py-1 last:border-0"
                      >
                        <span className="truncate text-xs text-zinc-300">{item.nombre}</span>
                        <div className="shrink-0 text-right">
                          <span
                            className={`text-xs font-semibold ${item.pv >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                          >
                            {item.pv >= 0 ? '+' : ''}
                            {v(item.pv)}
                          </span>
                          {item.pvP != null && (
                            <span className="text-2xs ml-2 text-zinc-600">
                              {item.pvP.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-white/10 pt-2">
                      <span className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
                        Total
                      </span>
                      <span
                        className={`text-sm font-semibold ${(kpis.plusvalia ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                      >
                        {kpis.plusvalia != null
                          ? `${kpis.plusvalia >= 0 ? '+' : ''}${v(kpis.plusvalia)}`
                          : '—'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">Sin precio de coste registrado</p>
                )
              }
            >
              <div
                className={`cursor-default rounded-2xl border p-4 ${kpis.plusvalia != null ? (kpis.plusvalia >= 0 ? 'border-emerald-500/15 bg-emerald-500/[0.03]' : 'border-rose-500/15 bg-rose-500/[0.03]') : 'border-white/5 bg-white/[0.01] opacity-50'}`}
              >
                <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
                  Plusvalía
                </p>
                <p
                  className={`mt-1.5 text-xl font-semibold ${kpis.plusvalia != null ? (kpis.plusvalia >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-zinc-600'}`}
                >
                  {kpis.plusvalia != null
                    ? `${kpis.plusvalia >= 0 ? '+' : ''}${v(kpis.plusvalia)}`
                    : '—'}
                </p>
                <p className="text-2xs mt-1.5 font-medium text-zinc-600">
                  {kpis.plusvalia != null && kpis.bruto > 0
                    ? `${((kpis.plusvalia / kpis.bruto) * 100).toFixed(1)}% s/ cartera`
                    : 'Sin precio coste'}
                </p>
              </div>
            </KpiTooltipWrapper>
          </div>

          {/* ── 4 Category cards (clickable → popup) ──────────────────── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(
              Object.entries(CATEGORIA_CONFIG) as [
                keyof typeof CATEGORIA_CONFIG,
                (typeof CATEGORIA_CONFIG)[keyof typeof CATEGORIA_CONFIG],
              ][]
            ).map(([id, cfg]) => {
              const ck = kpis.bycat[id];
              const empty = ck.count === 0;
              return (
                <button
                  key={id}
                  onClick={() => !empty && setPopupCat(id)}
                  disabled={empty}
                  className={`rounded-2xl border p-4 text-left transition-all ${empty ? 'cursor-default border-white/5 bg-white/[0.01] opacity-40' : `${cfg.color} cursor-pointer hover:brightness-110`}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {cfg.icon}
                      <p className="text-2xs font-semibold uppercase tracking-widest">
                        {cfg.label}
                      </p>
                    </div>
                    <span className="text-2xs font-semibold text-zinc-600">{ck.count}</span>
                  </div>
                  <p
                    className={`mt-2 text-lg font-semibold ${empty ? 'text-zinc-600' : 'text-white'}`}
                  >
                    {v(ck.neto)}
                  </p>
                  {!empty && (
                    <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
                      {ck.deuda > 0 && (
                        <span className="text-2xs font-medium text-rose-400">
                          Deuda {v(ck.deuda)}
                        </span>
                      )}
                      {ck.renta > 0 && (
                        <span className="text-2xs font-medium text-emerald-400">
                          Renta {v(ck.renta)}/mes
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Toggle list por categoría ─────────────────────────────── */}
          <div className="space-y-4">
            {(
              Object.entries(CATEGORIA_CONFIG) as [
                keyof typeof CATEGORIA_CONFIG,
                (typeof CATEGORIA_CONFIG)[keyof typeof CATEGORIA_CONFIG],
              ][]
            ).map(([id, cfg]) => {
              const items = activos.filter((a) => a.categoria === id);
              if (!items.length) return null;
              return (
                <div key={id} className="space-y-1">
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <div className={`rounded-lg border p-1 ${cfg.color}`}>{cfg.icon}</div>
                    <span className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
                      {cfg.label}
                    </span>
                  </div>
                  {items.map((a) => {
                    const neto = valorNeto(a);
                    const isOpen = expanded.has(a.id);
                    const pv = isOpen ? plusvaliaLatente(a) : null;
                    const pvP = isOpen ? plusvaliaPct(a, pv) : null;
                    const rb = isOpen ? rendimientoBruto(a) : null;
                    const rn = isOpen ? rendimientoNeto(a) : null;
                    const cf = isOpen ? cashFlowMensual(a) : null;
                    const div = isOpen ? dividendoAnual(a) : null;
                    const ce = capitalExpuesto(a);
                    return (
                      <div
                        key={a.id}
                        className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]"
                      >
                        <button
                          onClick={() => toggleExpand(a.id)}
                          className="flex w-full items-center justify-between px-4 py-3 transition-all hover:bg-white/[0.02]"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-medium text-white">
                              {a.nombre}
                            </span>
                            {a.subcategoria && (
                              <span className="text-2xs shrink-0 font-semibold uppercase tracking-widest text-zinc-600">
                                {a.subcategoria.replace(/_/g, ' ')}
                              </span>
                            )}
                            {a.deuda_viva > 0 && !isOpen && (
                              <span className="text-2xs shrink-0 font-semibold text-rose-400/70">
                                · Deuda {v(a.deuda_viva)}
                              </span>
                            )}
                          </div>
                          <div className="ml-3 flex shrink-0 items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-semibold text-emerald-400">{v(neto)}</p>
                              <p className="text-2xs text-zinc-600">neto</p>
                            </div>
                            {isOpen ? (
                              <ChevronUp size={13} className="text-zinc-600" />
                            ) : (
                              <ChevronDown size={13} className="text-zinc-600" />
                            )}
                          </div>
                        </button>
                        {isOpen && (
                          <div className="border-t border-white/[0.04] px-4 pb-4 pt-1">
                            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                              <Stat label="Valor actual" value={v(a.valor_actual)} />
                              {a.porcentaje_propiedad < 100 && (
                                <Stat label="Capital expuesto" value={v(ce)} />
                              )}
                              {a.deuda_viva > 0 && (
                                <Stat label="Deuda viva" value={v(a.deuda_viva)} negative />
                              )}
                              {pv != null && (
                                <Stat
                                  label="Plusvalía latente"
                                  value={v(pv)}
                                  highlight={pv > 0}
                                  negative={pv < 0}
                                />
                              )}
                              {pvP != null && (
                                <Stat
                                  label="Plusvalía %"
                                  value={`${pvP.toFixed(1)}%`}
                                  highlight={pvP > 0}
                                  negative={pvP < 0}
                                />
                              )}
                              {a.categoria === 'inmobiliario' &&
                                a.deuda_viva > 0 &&
                                a.valor_actual > 0 && (
                                  <Stat
                                    label="LTV"
                                    value={`${((a.deuda_viva / a.valor_actual) * 100).toFixed(1)}%`}
                                  />
                                )}
                              {rb != null && (
                                <Stat label="Rdto. bruto" value={`${rb.toFixed(2)}%`} highlight />
                              )}
                              {rn != null && (
                                <Stat
                                  label="Rdto. neto"
                                  value={`${rn.toFixed(2)}%`}
                                  highlight={rn > 0}
                                  negative={rn < 0}
                                />
                              )}
                              {cf != null && (
                                <Stat
                                  label="Cash flow/mes"
                                  value={v(cf)}
                                  highlight={cf > 0}
                                  negative={cf < 0}
                                />
                              )}
                              {div != null && (
                                <Stat label="Dividendo/año" value={v(div)} highlight />
                              )}
                              {a.fecha_valoracion && (
                                <Stat
                                  label="Valorado"
                                  value={new Date(a.fecha_valoracion).toLocaleDateString('es-ES')}
                                />
                              )}
                            </div>
                            {a.notas && (
                              <p className="mt-2 text-xs italic text-zinc-600">{a.notas}</p>
                            )}

                            {/* CAPEX / Reformas */}
                            <div className="mt-3 border-t border-white/[0.04] pt-3">
                              <div className="mb-2 flex items-center justify-between">
                                <p className="text-2xs flex items-center gap-1.5 font-semibold uppercase tracking-widest text-zinc-500">
                                  <Hammer size={10} />
                                  CAPEX / Reformas
                                  {(capexByActivo[a.id]?.length ?? 0) > 0 && (
                                    <span className="font-medium normal-case tracking-normal text-amber-400/70">
                                      · {v(capexByActivo[a.id]!.reduce((s, c) => s + c.importe, 0))}
                                    </span>
                                  )}
                                </p>
                                {capexForm?.activoId !== a.id && (
                                  <button
                                    onClick={() =>
                                      setCapexForm({
                                        activoId: a.id,
                                        descripcion: '',
                                        importe: '',
                                        fecha: new Date().toISOString().split('T')[0] ?? '',
                                      })
                                    }
                                    className="text-2xs flex items-center gap-1 font-semibold uppercase tracking-widest text-blue-400 transition-colors hover:text-blue-300"
                                  >
                                    <Plus size={9} /> Añadir
                                  </button>
                                )}
                              </div>

                              {capexLoading.has(a.id) && (
                                <p className="text-2xs py-1 text-zinc-600">Cargando...</p>
                              )}

                              {(capexByActivo[a.id]?.length ?? 0) > 0 && (
                                <div className="mb-2 space-y-1">
                                  {capexByActivo[a.id]!.map((cx) => (
                                    <div
                                      key={cx.id}
                                      className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2"
                                    >
                                      <div className="flex min-w-0 items-center gap-2">
                                        <span className="truncate text-xs text-zinc-300">
                                          {cx.descripcion}
                                        </span>
                                        <span className="text-2xs shrink-0 text-zinc-600">
                                          {new Date(cx.fecha + 'T00:00:00').toLocaleDateString(
                                            'es-ES',
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex shrink-0 items-center gap-2">
                                        <span className="text-xs font-semibold text-amber-400">
                                          {v(cx.importe)}
                                        </span>
                                        <button
                                          onClick={() => void handleDeleteCapex(cx.id, a.id)}
                                          className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                                        >
                                          <Trash2 size={10} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {capexForm?.activoId === a.id && (
                                <div className="space-y-2 rounded-xl border border-white/[0.06] bg-zinc-900/50 p-3">
                                  <input
                                    type="text"
                                    placeholder="Descripción (ej. Reforma cocina)"
                                    value={capexForm.descripcion}
                                    onChange={(e) =>
                                      setCapexForm({ ...capexForm, descripcion: e.target.value })
                                    }
                                    className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 transition-colors focus:border-blue-500/50 focus:outline-none"
                                  />
                                  <div className="grid grid-cols-2 gap-2">
                                    <input
                                      type="number"
                                      placeholder="Importe €"
                                      min="0"
                                      step="0.01"
                                      value={capexForm.importe}
                                      onChange={(e) =>
                                        setCapexForm({ ...capexForm, importe: e.target.value })
                                      }
                                      className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 transition-colors focus:border-blue-500/50 focus:outline-none"
                                    />
                                    <input
                                      type="date"
                                      value={capexForm.fecha}
                                      onChange={(e) =>
                                        setCapexForm({ ...capexForm, fecha: e.target.value })
                                      }
                                      className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 transition-colors focus:border-blue-500/50 focus:outline-none"
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => void handleAddCapex(a.id)}
                                      disabled={!capexForm.descripcion.trim() || !capexForm.importe}
                                      className="text-2xs flex-1 rounded-lg border border-blue-500/30 bg-blue-600/30 py-2 font-semibold uppercase tracking-widest text-blue-300 transition-all hover:bg-blue-600/40 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      Guardar
                                    </button>
                                    <button
                                      onClick={() => setCapexForm(null)}
                                      className="text-2xs rounded-lg border border-white/10 bg-zinc-900 px-4 py-2 font-semibold text-zinc-500 transition-all hover:text-zinc-300"
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
              );
            })}
          </div>
        </>
      )}

      {/* ── Enlace al holding ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/15 p-2.5 text-blue-400">
            <Building2 size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{holdingNombre}</p>
            <p className="text-xs text-zinc-500">
              Holding personal de {firstName} — ver sus sociedades y proyectos
            </p>
          </div>
        </div>
        <button
          onClick={onViewHolding}
          className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/20 px-4 py-2.5 text-xs font-medium text-blue-300 transition-all hover:bg-blue-600/30"
        >
          <ExternalLink size={13} /> Ver holding
        </button>
      </div>

      {/* ── Popup de categoría: KPIs agregados ───────────────────────── */}
      {popupCat &&
        (() => {
          const cfg = CATEGORIA_CONFIG[popupCat];
          const ck = kpis.bycat[popupCat];
          const ltv = ck.bruto > 0 && ck.deuda > 0 ? (ck.deuda / ck.bruto) * 100 : null;
          const pvPctTotal =
            ck.pvTotal != null && ck.costeInvertido > 0
              ? (ck.pvTotal / ck.costeInvertido) * 100
              : null;
          const divYield = ck.divTotal > 0 && ck.bruto > 0 ? (ck.divTotal / ck.bruto) * 100 : null;

          // KPIs según clase de activo
          const isInmobiliario = popupCat === 'inmobiliario';
          const isFinanciero = popupCat === 'fondo' || popupCat === 'cotizado';

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
              onClick={() => setPopupCat(null)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div
                  className={`flex items-center justify-between rounded-t-2xl border-b border-white/5 px-5 py-4`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl border p-2 ${cfg.color}`}>{cfg.icon}</div>
                    <div>
                      <p
                        className={`text-2xs font-semibold uppercase tracking-widest ${cfg.color.split(' ')[0]}`}
                      >
                        {cfg.label}
                      </p>
                      <p className="text-2xl font-semibold text-white">{v(ck.neto)}</p>
                      <p className="text-2xs mt-0.5 font-medium text-zinc-600">
                        {ck.count} activo{ck.count !== 1 ? 's' : ''} · valor neto
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPopupCat(null)}
                    className="rounded-lg p-2 text-zinc-500 transition-all hover:bg-white/5 hover:text-zinc-200"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* KPIs agregados */}
                <div className="space-y-4 p-5">
                  {isInmobiliario && (
                    <>
                      {/* Bloque 1: Balance */}
                      <div>
                        <p className="text-2xs mb-2 font-semibold uppercase tracking-widest text-zinc-600">
                          Balance
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <Stat label="Valor bruto" value={v(ck.bruto)} />
                          <Stat
                            label="Deuda total"
                            value={ck.deuda > 0 ? v(ck.deuda) : '—'}
                            negative={ck.deuda > 0}
                          />
                          <Stat
                            label={ltv != null ? `LTV ${ltv.toFixed(1)}%` : 'Valor neto'}
                            value={v(ck.neto)}
                            highlight
                          />
                        </div>
                      </div>
                      {/* Bloque 2: Rendimiento */}
                      {ck.renta > 0 && (
                        <div>
                          <p className="text-2xs mb-2 font-semibold uppercase tracking-widest text-zinc-600">
                            Rendimiento
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            <Stat label="Renta bruta/año" value={v(ck.renta * 12)} highlight />
                            <Stat
                              label="Cash flow/mes"
                              value={v(ck.cashFlow)}
                              highlight={ck.cashFlow >= 0}
                              negative={ck.cashFlow < 0}
                            />
                            <Stat
                              label="Rentabilidad"
                              value={ck.rentBruta != null ? `${ck.rentBruta.toFixed(2)}%` : '—'}
                              highlight={ck.rentBruta != null}
                            />
                          </div>
                          {ck.rentNeta != null && (
                            <p className="text-2xs mt-1.5 px-0.5 font-medium text-zinc-600">
                              Rentabilidad neta: {ck.rentNeta.toFixed(2)}% s/ capital expuesto
                            </p>
                          )}
                        </div>
                      )}
                      {/* Bloque 3: Plusvalía */}
                      {ck.pvTotal != null && (
                        <div>
                          <p className="text-2xs mb-2 font-semibold uppercase tracking-widest text-zinc-600">
                            Plusvalía latente
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <Stat
                              label="Plusvalía total"
                              value={`${ck.pvTotal >= 0 ? '+' : ''}${v(ck.pvTotal)}`}
                              highlight={ck.pvTotal > 0}
                              negative={ck.pvTotal < 0}
                            />
                            {pvPctTotal != null && (
                              <Stat
                                label="Plusvalía %"
                                value={`${pvPctTotal.toFixed(1)}%`}
                                highlight={pvPctTotal > 0}
                                negative={pvPctTotal < 0}
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {isFinanciero && (
                    <>
                      {/* Bloque 1: Cartera */}
                      <div>
                        <p className="text-2xs mb-2 font-semibold uppercase tracking-widest text-zinc-600">
                          Cartera
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <Stat label="Valor actual" value={v(ck.bruto)} highlight />
                          <Stat
                            label="Coste invertido"
                            value={ck.costeInvertido > 0 ? v(ck.costeInvertido) : '—'}
                          />
                          {ck.pvTotal != null && (
                            <Stat
                              label="Plusvalía"
                              value={`${ck.pvTotal >= 0 ? '+' : ''}${v(ck.pvTotal)}`}
                              highlight={ck.pvTotal > 0}
                              negative={ck.pvTotal < 0}
                            />
                          )}
                        </div>
                      </div>
                      {/* Bloque 2: Rentabilidad */}
                      {(pvPctTotal != null || ck.divTotal > 0) && (
                        <div>
                          <p className="text-2xs mb-2 font-semibold uppercase tracking-widest text-zinc-600">
                            Rentabilidad
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {pvPctTotal != null && (
                              <Stat
                                label="Rentab. total %"
                                value={`${pvPctTotal.toFixed(1)}%`}
                                highlight={pvPctTotal > 0}
                                negative={pvPctTotal < 0}
                              />
                            )}
                            {ck.divTotal > 0 && (
                              <Stat label="Dividendo/año" value={v(ck.divTotal)} highlight />
                            )}
                            {divYield != null && (
                              <Stat
                                label="Yield dividendo"
                                value={`${divYield.toFixed(2)}%`}
                                highlight
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {!isInmobiliario && !isFinanciero && (
                    /* Bienes de valor */
                    <div>
                      <p className="text-2xs mb-2 font-semibold uppercase tracking-widest text-zinc-600">
                        Valoración
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <Stat label="Valor actual" value={v(ck.bruto)} highlight />
                        {ck.costeInvertido > 0 && (
                          <Stat label="Coste" value={v(ck.costeInvertido)} />
                        )}
                        {ck.pvTotal != null && (
                          <Stat
                            label="Plusvalía"
                            value={`${ck.pvTotal >= 0 ? '+' : ''}${v(ck.pvTotal)}`}
                            highlight={ck.pvTotal > 0}
                            negative={ck.pvTotal < 0}
                          />
                        )}
                      </div>
                      {pvPctTotal != null && (
                        <p className="text-2xs mt-2 font-medium text-zinc-600">
                          {pvPctTotal.toFixed(1)}% de revalorización sobre coste
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

// ── Sección compacta para insertar en Overview de sociedad ────────────────────

type ActivosSociedadSectionProps = {
  sociedadIdRef: string;
  isPrivateMode: boolean;
  onNavigateToPatrimonio: () => void;
};

export function ActivosSociedadSection({
  sociedadIdRef,
  isPrivateMode,
  onNavigateToPatrimonio,
}: ActivosSociedadSectionProps) {
  const [activos, setActivos] = useState<ActivoPatrimonio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // reuse getActivosBySociedad via dynamic import to avoid circular dep
    import('../../lib/patrimonioImport')
      .then(({ getActivosBySociedad }) =>
        getActivosBySociedad(sociedadIdRef)
          .then(setActivos)
          .catch(() => setActivos([]))
          .finally(() => setLoading(false)),
      )
      .catch(() => setLoading(false));
  }, [sociedadIdRef]);

  const v = (n: number) => (isPrivateMode ? '••••' : formatCurrency(n));

  const totalActivos = activos.reduce(
    (s, a) => s + (a.valor_actual * a.porcentaje_propiedad) / 100,
    0,
  );
  const totalDeuda = activos.reduce((s, a) => s + (a.deuda_viva ?? 0), 0);
  const totalNeto = totalActivos - totalDeuda;

  if (loading || activos.length === 0) return null;

  return (
    <div className="space-y-4 border-t border-white/5 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white">
          <Wallet size={16} className="text-emerald-400" />
          Activos Patrimoniales
        </h3>
        <button
          onClick={onNavigateToPatrimonio}
          className="text-2xs flex items-center gap-1.5 font-semibold uppercase tracking-widest text-emerald-500 transition-colors hover:text-emerald-300"
        >
          <ExternalLink size={11} /> Gestionar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
          <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">Activos</p>
          <p className="mt-1 text-base font-semibold text-white">{v(totalActivos)}</p>
        </div>
        <div className="rounded-xl border border-rose-500/10 bg-rose-500/[0.03] p-4 text-center">
          <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">Deuda</p>
          <p className="mt-1 text-base font-semibold text-rose-400">{v(totalDeuda)}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03] p-4 text-center">
          <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">Neto</p>
          <p className="mt-1 text-base font-semibold text-emerald-400">{v(totalNeto)}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {activos.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-2.5"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-200">{a.nombre}</span>
              {a.subcategoria && (
                <span className="text-2xs font-semibold uppercase tracking-widest text-zinc-600">
                  {a.subcategoria}
                </span>
              )}
            </div>
            <span className="text-xs font-semibold text-zinc-300">{v(valorNeto(a))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
