import { useMemo, useState } from 'react';
import { formatCurrency, parseCurrency } from '@alsari/utils';
import type { DashboardData, SocietyOption } from '@alsari/types';
import {
  Building2,
  Globe,
  Crown,
  ChevronRight,
  Wallet,
  Briefcase,
  Pencil,
  RefreshCw,
} from 'lucide-react';
import type { SociedadRow } from '../../lib/maestroParser';
import { getSociedades } from '../../lib/maestroImport';
import { SociedadDetail } from './SociedadDetail';

function normP(v: number | null | undefined): number {
  if (!v) return 0;
  return v > 1 ? v / 100 : v;
}

function effectiveGroupPct(
  idRef: string,
  sociedades: DashboardData['sociedades'],
  visited: Set<string> = new Set(),
): number {
  if (visited.has(idRef)) return 0;
  visited.add(idRef);
  const soc = sociedades?.find((s) => s['ID-Ref'] === idRef);
  if (!soc) return 1;
  const direct = Math.min(1, normP(soc['% Pavier'] as number) + normP(soc['% Armia'] as number));
  if (direct > 0) return direct;
  if (soc.parent_sociedad_id) {
    return (
      effectiveGroupPct(soc.parent_sociedad_id as string, sociedades, visited) *
      normP(soc.pct_en_sociedad_padre ?? 0)
    );
  }
  return 1;
}

type Props = {
  data: DashboardData;
  availableSocieties: SocietyOption[];
  isPrivateMode: boolean;
  onSelectSociety: (s: SocietyOption) => void;
  onRefresh?: () => void;
  onNavigateToPatrimonio?: () => void;
};

type Kpis = { caja: number; deuda: number; neto: number };
type BreakdownItem = { nombre: string; caja: number; deuda: number; neto: number };

type CardProps = {
  society: SocietyOption;
  kpis: Kpis | null;
  breakdown?: BreakdownItem[];
  projectCount: number;
  isPrivateMode: boolean;
  onClick: () => void;
  onOpenFicha?: () => void;
};

function KpiCell({
  label,
  value,
  color,
  breakdown,
  field,
  isPrivateMode,
}: {
  label: string;
  value: string;
  color: string;
  breakdown?: BreakdownItem[];
  field: 'caja' | 'deuda' | 'neto';
  isPrivateMode: boolean;
}) {
  const sorted = breakdown
    ?.filter((b) => Math.abs(b[field]) > 0)
    .sort((a, b) => Math.abs(b[field]) - Math.abs(a[field]));

  return (
    <div className="group/kpi relative">
      <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-600">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${color} ${isPrivateMode ? 'blur-sm' : ''}`}>
        {value}
      </p>
      {sorted && sorted.length > 1 && !isPrivateMode && (
        <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-56 rounded-xl border border-white/[0.1] bg-zinc-900 p-2.5 text-left opacity-0 shadow-xl transition-opacity duration-150 group-hover/kpi:opacity-100">
          <p className="text-2xs mb-2 font-semibold uppercase tracking-widest text-zinc-500">
            {label} por sociedad
          </p>
          <div className="space-y-1">
            {sorted.map((b) => (
              <div key={b.nombre} className="flex items-center justify-between gap-2">
                <span className="text-2xs truncate text-zinc-400">{b.nombre}</span>
                <span
                  className={`text-2xs shrink-0 font-medium ${field === 'deuda' ? 'text-rose-400' : b[field] >= 0 ? 'text-zinc-200' : 'text-rose-400'}`}
                >
                  {formatCurrency(b[field])}
                </span>
              </div>
            ))}
          </div>
          <div className="absolute left-4 top-full -mt-1 h-2 w-2 rotate-45 border-b border-r border-white/[0.1] bg-zinc-900" />
        </div>
      )}
    </div>
  );
}

function EntityCard({
  society,
  kpis,
  breakdown,
  projectCount,
  isPrivateMode,
  onClick,
  onOpenFicha,
}: CardProps) {
  const v = (n: number) => (isPrivateMode ? '••••' : formatCurrency(n));

  const isPersona = society.id === 'javier_alarcon' || society.id === 'ivan_alarcon';
  const isGlobal = society.idRef === null;
  const isHolding = society.badge === 'Holding Principal';

  const accent = isPersona
    ? {
        border: 'border-amber-500/20 hover:border-amber-400/40',
        icon: 'bg-amber-500/20 text-amber-400',
        arrow: 'group-hover:text-amber-400',
      }
    : isGlobal
      ? {
          border: 'border-blue-500/20 hover:border-blue-400/40',
          icon: 'bg-blue-500/20 text-blue-400',
          arrow: 'group-hover:text-blue-400',
        }
      : isHolding
        ? {
            border: 'border-blue-500/15 hover:border-blue-400/30',
            icon: 'bg-blue-500/15 text-blue-400',
            arrow: 'group-hover:text-blue-400',
          }
        : {
            border: 'border-white/[0.07] hover:border-white/20',
            icon: 'bg-zinc-800 text-zinc-400',
            arrow: 'group-hover:text-zinc-300',
          };

  const Icon = isGlobal ? Globe : isPersona || society.showCrown ? Crown : Building2;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick();
      }}
      className={`group w-full cursor-pointer rounded-2xl border bg-white/[0.02] p-5 text-left transition-all hover:bg-white/[0.04] ${accent.border}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`shrink-0 rounded-xl p-2.5 ${accent.icon}`}>
            <Icon size={16} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-white">
              {society.nombre}
            </p>
            {society.badge && (
              <p className="text-2xs mt-0.5 font-semibold uppercase tracking-widest text-zinc-600">
                {society.badge}
              </p>
            )}
            {society.cif && <p className="text-2xs mt-0.5 text-zinc-700">CIF {society.cif}</p>}
          </div>
        </div>
        <div className="mt-0.5 flex shrink-0 items-center gap-1">
          {onOpenFicha && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenFicha();
              }}
              title="Abrir ficha completa (datos, KPIs, histórico, balances)"
              className="rounded-lg p-1.5 text-zinc-700 transition-colors hover:bg-blue-500/10 hover:text-blue-400"
            >
              <Pencil size={13} />
            </button>
          )}
          <ChevronRight size={15} className={`text-zinc-700 transition-colors ${accent.arrow}`} />
        </div>
      </div>

      {isPersona ? (
        <div className="mt-4 flex items-center gap-2 border-t border-white/[0.05] pt-3 text-zinc-600">
          <Wallet size={11} />
          <span className="text-2xs font-semibold uppercase tracking-widest">
            Patrimonio personal
          </span>
        </div>
      ) : kpis ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <KpiCell
            label="Caja"
            value={v(kpis.caja)}
            color="text-white"
            field="caja"
            isPrivateMode={isPrivateMode}
            {...(breakdown ? { breakdown } : {})}
          />
          <KpiCell
            label="Deuda"
            value={v(kpis.deuda)}
            color="text-rose-400"
            field="deuda"
            isPrivateMode={isPrivateMode}
            {...(breakdown ? { breakdown } : {})}
          />
          <KpiCell
            label="Neto"
            value={v(kpis.neto)}
            color={kpis.neto >= 0 ? 'text-emerald-400' : 'text-rose-400'}
            field="neto"
            isPrivateMode={isPrivateMode}
            {...(breakdown ? { breakdown } : {})}
          />
        </div>
      ) : (
        <div className="mt-4 border-t border-white/[0.05] pt-3">
          <p className="text-2xs text-zinc-700">Sin datos financieros</p>
        </div>
      )}

      {projectCount > 0 && (
        <div className="mt-3 flex items-center gap-2 border-t border-white/[0.05] pt-3 text-zinc-600">
          <Briefcase size={11} />
          <span className="text-2xs font-semibold uppercase tracking-widest">
            {projectCount} proyecto{projectCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

export function EntidadesView({
  data,
  availableSocieties,
  isPrivateMode,
  onSelectSociety,
  onRefresh,
  onNavigateToPatrimonio,
}: Props) {
  // Ficha completa de gestión abierta in-situ (la misma que en Datos Maestros)
  const [detailSoc, setDetailSoc] = useState<SociedadRow | null>(null);
  const [loadingFicha, setLoadingFicha] = useState(false);
  const [errorFicha, setErrorFicha] = useState<string | null>(null);

  const openFicha = async (idRef: string) => {
    setLoadingFicha(true);
    setErrorFicha(null);
    try {
      const all = await getSociedades();
      const soc = all.find((s) => s.id_ref === idRef);
      if (!soc) throw new Error(`No se encontró la sociedad ${idRef} en datos maestros`);
      setDetailSoc(soc);
    } catch (e) {
      setErrorFicha(e instanceof Error ? e.message : 'Error abriendo la ficha');
    } finally {
      setLoadingFicha(false);
    }
  };

  const kpisMap = useMemo(() => {
    const map = new Map<string, Kpis>();
    data.finanzas_sociedades?.forEach((f) => {
      const id = f['ID-Ref'];
      if (!id) return;
      const caja = parseCurrency(f['Caja Disponible']);
      const deuda = parseCurrency(f['Deuda Bancaria']);
      map.set(id, { caja, deuda, neto: caja - deuda });
    });
    return map;
  }, [data.finanzas_sociedades]);

  const consolidatedKpis = useMemo<Kpis | null>(() => {
    if (!data.finanzas_sociedades?.length) return null;
    return data.finanzas_sociedades.reduce(
      (acc, f) => {
        const idRef = f['ID-Ref'] as string;
        const kpiNombre = (f.Nombre as string)?.toLowerCase().trim();
        const socMeta = data.sociedades?.find(
          (s) =>
            s['ID-Ref'] === idRef ||
            (s['Nombre de la Sociedad'] as string)?.toLowerCase().trim() === kpiNombre,
        );
        const resolvedId = (socMeta?.['ID-Ref'] as string) ?? idRef;
        const pct = effectiveGroupPct(resolvedId, data.sociedades);
        const caja = parseCurrency(f['Caja Disponible']) * pct;
        const deuda = parseCurrency(f['Deuda Bancaria']) * pct;
        return { caja: acc.caja + caja, deuda: acc.deuda + deuda, neto: acc.neto + (caja - deuda) };
      },
      { caja: 0, deuda: 0, neto: 0 },
    );
  }, [data.finanzas_sociedades, data.sociedades]);

  // Desglose por sociedad para el tooltip de los KPIs consolidados
  const consolidatedBreakdown = useMemo<BreakdownItem[]>(() => {
    if (!data.finanzas_sociedades?.length) return [];
    return data.finanzas_sociedades
      .map((f) => {
        const idRef = f['ID-Ref'] as string;
        const kpiNombre = (f.Nombre as string)?.toLowerCase().trim();
        const socMeta = data.sociedades?.find(
          (s) =>
            s['ID-Ref'] === idRef ||
            (s['Nombre de la Sociedad'] as string)?.toLowerCase().trim() === kpiNombre,
        );
        const resolvedId = (socMeta?.['ID-Ref'] as string) ?? idRef;
        const pct = effectiveGroupPct(resolvedId, data.sociedades);
        const nombre =
          (socMeta?.['Nombre de la Sociedad'] as string) ??
          availableSocieties.find((s) => s.idRef === resolvedId)?.nombre ??
          (f.Nombre as string) ??
          idRef;
        const caja = parseCurrency(f['Caja Disponible']) * pct;
        const deuda = parseCurrency(f['Deuda Bancaria']) * pct;
        return { nombre, caja, deuda, neto: caja - deuda, pct };
      })
      .filter((b) => b.caja !== 0 || b.deuda !== 0);
  }, [data.finanzas_sociedades, data.sociedades, availableSocieties]);

  const projectCounts = useMemo(() => {
    const map = new Map<string, number>();
    data.proyectos?.forEach((p) => {
      const id = p.clean_tenedora ?? p['Sociedad-Ref'];
      if (id) map.set(id, (map.get(id) ?? 0) + 1);
    });
    return map;
  }, [data.proyectos]);

  const personas = availableSocieties.filter(
    (s) => s.id === 'javier_alarcon' || s.id === 'ivan_alarcon',
  );
  const global = availableSocieties.filter((s) => s.idRef === null);
  const holdings = availableSocieties.filter((s) => s.badge === 'Holding Principal');
  const filiales = availableSocieties.filter((s) => s.badge === 'Filial');

  const renderCard = (s: SocietyOption) => {
    const bd = s.idRef === null ? consolidatedBreakdown : undefined;
    // La ficha de gestión solo aplica a sociedades reales (no personas ni consolidado)
    const isPersona = s.id === 'javier_alarcon' || s.id === 'ivan_alarcon';
    const fichaRef = !isPersona && s.idRef ? s.idRef : null;
    return (
      <EntityCard
        key={s.id}
        society={s}
        kpis={s.idRef ? (kpisMap.get(s.idRef) ?? null) : consolidatedKpis}
        {...(bd !== undefined ? { breakdown: bd } : {})}
        projectCount={s.idRef ? (projectCounts.get(s.idRef) ?? 0) : 0}
        isPrivateMode={isPrivateMode}
        onClick={() => onSelectSociety(s)}
        {...(fichaRef
          ? {
              onOpenFicha: () => {
                void openFicha(fichaRef);
              },
            }
          : {})}
      />
    );
  };

  if (detailSoc) {
    return (
      <SociedadDetail
        sociedad={detailSoc}
        onBack={() => setDetailSoc(null)}
        backLabel="Volver a Entidades"
        {...(onRefresh ? { onRefresh } : {})}
        {...(onNavigateToPatrimonio ? { onNavigateToPatrimonio } : {})}
      />
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="flex items-center gap-3 text-xl font-semibold uppercase tracking-tight text-white">
          <Building2 className="text-blue-400" size={22} />
          Entidades
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Selecciona una entidad para ver su detalle, proyectos y balance · el lápiz abre la ficha
          de gestión
        </p>
        {loadingFicha && (
          <p className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
            <RefreshCw size={12} className="animate-spin" />
            Abriendo ficha...
          </p>
        )}
        {errorFicha && <p className="mt-2 text-xs text-rose-400">{errorFicha}</p>}
      </div>

      {personas.length > 0 && (
        <div className="space-y-3">
          <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">Personas</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{personas.map(renderCard)}</div>
        </div>
      )}

      {global.length > 0 && (
        <div className="space-y-3">
          <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
            Consolidado
          </p>
          <div className="grid grid-cols-1 gap-4">{global.map(renderCard)}</div>
        </div>
      )}

      {holdings.length > 0 && (
        <div className="space-y-3">
          <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">Holdings</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{holdings.map(renderCard)}</div>
        </div>
      )}

      {filiales.length > 0 && (
        <div className="space-y-3">
          <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">Filiales</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filiales.map(renderCard)}
          </div>
        </div>
      )}
    </div>
  );
}
