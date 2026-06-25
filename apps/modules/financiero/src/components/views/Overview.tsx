import { useMemo, useState, useEffect } from 'react';
import { KPICard } from '@alsari/ui';
import { formatCurrency, parseCurrency } from '@alsari/utils';
import { Wallet, Landmark, Briefcase, Scale, Banknote, BookOpen, Table2, AlertTriangle, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import type { DashboardData, SocietyOption } from '@alsari/types';
import { NAVSection } from './NAVSection';
import { BssSaldosSection } from './BssSaldosSection';
import { getPeriodosBySociedad, getLineasBSS, fmtPeriodo } from '../../lib/sumasSaldosImport';
import { deriveKpis, type DerivedKpis } from '../../lib/sumasSaldosParser';

type OverviewProps = {
  data: DashboardData;
  selectedSociety: SocietyOption;
  isPrivateMode: boolean;
};

type SocietyBreakdown = { nombre: string; valor: number; pct: number }[];

function BreakdownTooltip({ label, items, mask }: {
  label: string;
  items: SocietyBreakdown;
  mask: (n: number) => string;
}) {
  const sorted = [...items].filter(i => i.valor !== 0).sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
  if (!sorted.length) return <span>{label} — sin datos</span>;
  return (
    <div className="text-left w-72">
      <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">{label} por sociedad</p>
      <div className="space-y-2.5">
        {sorted.map(({ nombre, valor, pct }) => (
          <div key={nombre} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-2xs font-medium text-zinc-600 shrink-0">{(pct * 100).toFixed(0)}%</span>
              <span className="text-zinc-300 text-xs truncate">{nombre}</span>
            </div>
            <span className="text-white font-semibold text-xs shrink-0">{mask(valor)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Helpers de consolidación ──────────────────────────────────────────────────

type KpiRow = {
  caja: number; deudaBancaria: number; deudaBancariaLP: number; deudaBancariaCP: number;
  deudaSocios: number; fondoManiobra: number; activoCorriente: number; pasivoCorriente: number;
  patrimonioNeto: number; activoTotal: number; pasivoTotal: number;
};
type FlatSociety = KpiRow & { idRef: string; nombre: string; pct: number };

const ZERO_ROW: KpiRow = {
  caja: 0, deudaBancaria: 0, deudaBancariaLP: 0, deudaBancariaCP: 0,
  deudaSocios: 0, fondoManiobra: 0, activoCorriente: 0, pasivoCorriente: 0,
  patrimonioNeto: 0, activoTotal: 0, pasivoTotal: 0,
};

function normP(v: number | null | undefined): number {
  if (!v) return 0; return v > 1 ? v / 100 : v;
}

function parseRow(fin: NonNullable<DashboardData['finanzas_sociedades']>[0], w = 1): KpiRow {
  return {
    caja:            parseCurrency(fin['Caja Disponible'])    * w,
    deudaBancaria:   parseCurrency(fin['Deuda Bancaria'])     * w,
    deudaBancariaLP: parseCurrency(fin['Deuda Bancaria L/P']) * w,
    deudaBancariaCP: parseCurrency(fin['Deuda Bancaria C/P']) * w,
    deudaSocios:     parseCurrency(fin['Deuda de socios'])    * w,
    fondoManiobra:   parseCurrency(fin['Fondo de maniobra'])  * w,
    activoCorriente: parseCurrency(fin['Activo Corriente'])   * w,
    pasivoCorriente: parseCurrency(fin['Pasivo Corriente'])   * w,
    patrimonioNeto:  parseCurrency(fin['Patrimonio neto'])    * w,
    activoTotal:     parseCurrency(fin['Activo Total'])       * w,
    pasivoTotal:     parseCurrency(fin['Pasivo Total'])       * w,
  };
}

// KPIs derivados de un balance histórico → formato KpiRow de esta vista
function derivedToRow(d: DerivedKpis): KpiRow {
  return {
    caja:            d.caja_disponible,
    deudaBancaria:   d.deuda_bancaria,
    deudaBancariaLP: d.deuda_bancaria_lp,
    deudaBancariaCP: d.deuda_bancaria_cp,
    deudaSocios:     d.deuda_socios,
    fondoManiobra:   d.fondo_maniobra,
    activoCorriente: d.activo_corriente,
    pasivoCorriente: d.pasivo_corriente,
    patrimonioNeto:  d.patrimonio_neto,
    activoTotal:     d.activo_total,
    pasivoTotal:     d.pasivo_total,
  };
}

function mulRow(r: KpiRow, w: number): KpiRow {
  return {
    caja: r.caja * w, deudaBancaria: r.deudaBancaria * w,
    deudaBancariaLP: r.deudaBancariaLP * w, deudaBancariaCP: r.deudaBancariaCP * w,
    deudaSocios: r.deudaSocios * w, fondoManiobra: r.fondoManiobra * w,
    activoCorriente: r.activoCorriente * w, pasivoCorriente: r.pasivoCorriente * w,
    patrimonioNeto: r.patrimonioNeto * w, activoTotal: r.activoTotal * w, pasivoTotal: r.pasivoTotal * w,
  };
}

function sumRows(rows: KpiRow[]): KpiRow {
  return rows.reduce((a, r) => ({
    caja:            a.caja            + r.caja,
    deudaBancaria:   a.deudaBancaria   + r.deudaBancaria,
    deudaBancariaLP: a.deudaBancariaLP + r.deudaBancariaLP,
    deudaBancariaCP: a.deudaBancariaCP + r.deudaBancariaCP,
    deudaSocios:     a.deudaSocios     + r.deudaSocios,
    fondoManiobra:   a.fondoManiobra   + r.fondoManiobra,
    activoCorriente: a.activoCorriente + r.activoCorriente,
    pasivoCorriente: a.pasivoCorriente + r.pasivoCorriente,
    patrimonioNeto:  a.patrimonioNeto  + r.patrimonioNeto,
    activoTotal:     a.activoTotal     + r.activoTotal,
    pasivoTotal:     a.pasivoTotal     + r.pasivoTotal,
  }), { ...ZERO_ROW });
}

/**
 * Devuelve la lista plana de todas las sociedades alcanzables desde societyId,
 * con sus KPIs ya multiplicados por el % efectivo acumulado.
 *
 * holdingCol solo se pasa para la llamada inicial desde un holding (Pavier/Armia).
 * Permite encontrar los hijos directos por % Pavier/% Armia. Una vez dentro
 * de un intermedio (Perisur/Rialsa/Alsari), se usan parent_sociedad_id.
 */
function flattenSociety(
  societyId: string,
  finanzas: NonNullable<DashboardData['finanzas_sociedades']>,
  sociedades: DashboardData['sociedades'],
  effectivePct: number,
  visited: Set<string>,
  holdingCol?: '% Pavier' | '% Armia',
): FlatSociety[] {
  if (visited.has(societyId) || effectivePct <= 0) return [];
  const next = new Set(visited);
  next.add(societyId);

  const soc    = sociedades?.find(s => s['ID-Ref'] === societyId);
  const fin    = finanzas.find(f => f['ID-Ref'] === societyId);
  const nombre = (soc?.['Nombre de la Sociedad'] as string) ?? (fin?.Nombre as string) ?? societyId;

  const result: FlatSociety[] = [];
  if (fin) result.push({ idRef: societyId, nombre, pct: effectivePct, ...parseRow(fin, effectivePct) });

  if (holdingCol) {
    // Hijos directos del holding: tienen % > 0 en la columna y sin parent_sociedad_id
    for (const child of (sociedades ?? [])) {
      if (child['ID-Ref'] === societyId || child.parent_sociedad_id) continue;
      const childPct = normP(parseCurrency(String(child[holdingCol] ?? 0)));
      if (childPct <= 0) continue;
      // A partir de aquí, los nietos usan parent_sociedad_id (sin holdingCol)
      result.push(...flattenSociety(child['ID-Ref'], finanzas, sociedades, effectivePct * childPct, next));
    }
  } else {
    // Hijos de sociedades intermedias: via parent_sociedad_id
    for (const child of (sociedades ?? [])) {
      if (child.parent_sociedad_id !== societyId) continue;
      const childPct = normP(child.pct_en_sociedad_padre ?? 0);
      if (childPct <= 0) continue;
      result.push(...flattenSociety(child['ID-Ref'], finanzas, sociedades, effectivePct * childPct, next));
    }
  }
  return result;
}

// Para la vista global: % efectivo del grupo en cada sociedad (suma % Pavier + % Armia, recursivo)
function effectiveGroupPct(
  idRef: string,
  sociedades: DashboardData['sociedades'],
  visited: Set<string> = new Set()
): number {
  if (visited.has(idRef)) return 0;
  visited.add(idRef);
  const soc    = sociedades?.find(s => s['ID-Ref'] === idRef);
  if (!soc) return 1;
  const direct = Math.min(1, normP(soc['% Pavier'] as number) + normP(soc['% Armia'] as number));
  if (direct > 0) return direct;
  if (soc.parent_sociedad_id) {
    return effectiveGroupPct(soc.parent_sociedad_id, sociedades, visited) * normP(soc.pct_en_sociedad_padre ?? 0);
  }
  return 1; // holding de primer nivel
}

export function Overview({ data, selectedSociety, isPrivateMode }: OverviewProps) {
  const kpis = useMemo(() => {
    if (!data.finanzas_sociedades?.length) return null;

    // Detectar holdings por nombre (igual que NAVSection)
    const pavierSoc = data.sociedades?.find(s => (s['Nombre de la Sociedad'] as string)?.toLowerCase().includes('pavier'));
    const armiaSoc  = data.sociedades?.find(s => (s['Nombre de la Sociedad'] as string)?.toLowerCase().includes('armia'));
    const PAVIER_ID = (pavierSoc?.['ID-Ref'] as string) ?? '';
    const ARMIA_ID  = (armiaSoc?.['ID-Ref']  as string) ?? '';

    let flatItems: FlatSociety[];

    if (selectedSociety.idRef === null) {
      // Global: cada sociedad al % efectivo del grupo (% Pavier + % Armia, recursivo)
      // Cuando el ID-Ref de kpis_sociedades no coincide con el de sociedades,
      // intentamos cruzar por nombre para no contabilizar al 100% por error.
      flatItems = data.finanzas_sociedades.map(soc => {
        const idRef   = soc['ID-Ref'] as string;
        const kpiNombre = (soc.Nombre as string)?.toLowerCase().trim();
        const socMeta = data.sociedades?.find(s =>
          s['ID-Ref'] === idRef ||
          (s['Nombre de la Sociedad'] as string)?.toLowerCase().trim() === kpiNombre
        );
        const resolvedId = (socMeta?.['ID-Ref'] as string) ?? idRef;
        const nombre     = (socMeta?.['Nombre de la Sociedad'] as string) ?? (soc.Nombre as string) ?? idRef;
        const pct        = effectiveGroupPct(resolvedId, data.sociedades);
        return { idRef: resolvedId, nombre, pct, ...parseRow(soc, pct) };
      });
    } else if (selectedSociety.idRef === PAVIER_ID) {
      flatItems = flattenSociety(PAVIER_ID, data.finanzas_sociedades, data.sociedades, 1.0, new Set(), '% Pavier');
    } else if (selectedSociety.idRef === ARMIA_ID) {
      flatItems = flattenSociety(ARMIA_ID,  data.finanzas_sociedades, data.sociedades, 1.0, new Set(), '% Armia');
    } else {
      // Intermediate (Rialsa, Perisur, Alsari) o hoja: consolida via parent_sociedad_id
      flatItems = flattenSociety(selectedSociety.idRef, data.finanzas_sociedades, data.sociedades, 1.0, new Set());
    }

    if (!flatItems.length) return null;

    const consolidated = sumRows(flatItems);
    const hasChildren  = flatItems.length > 1;
    const isHolding    = selectedSociety.idRef === PAVIER_ID || selectedSociety.idRef === ARMIA_ID;

    // propio = solo los KPIs propios sin subsidiarias (para mostrar como secundario)
    const ownFin = data.finanzas_sociedades.find(f => f['ID-Ref'] === selectedSociety.idRef);
    const propio = ownFin ? parseRow(ownFin) : consolidated;

    const breakdown = hasChildren ? flatItems : null;

    // Detectar sociedades con % sin configurar (aparecen al 100% cuando no deberían)
    const unconfigured = selectedSociety.idRef === null
      ? flatItems.filter(item => {
          if (item.idRef === PAVIER_ID || item.idRef === ARMIA_ID) return false;
          return item.pct >= 0.99; // al 100% → probablemente sin % configurado
        }).map(item => item.nombre)
      : [];

    return { propio, consolidated, isHolding, hasChildren, breakdown, unconfigured, flatItems };
  }, [data, selectedSociety]);

  // ── Selector de período (balance histórico) ────────────────────────────────
  // Cada período muestra los KPIs derivados al vuelo del balance de sumas y saldos
  // de ese mes, para la sociedad y todas sus participadas (ponderadas por su %
  // efectivo). Por defecto se selecciona el último período (el más reciente).
  // selPeriodo es null solo mientras se cargan los períodos o si la sociedad no
  // tiene ninguno (entonces se muestran los KPIs de kpis_sociedades).
  const [periodos, setPeriodos]           = useState<string[]>([]);
  const [selPeriodo, setSelPeriodo]       = useState<string | null>(null);
  const [periodById, setPeriodById]       = useState<{ periodo: string; map: Map<string, KpiRow> } | null>(null);
  const [loadingPeriodo, setLoadingPeriodo] = useState(false);

  useEffect(() => {
    setSelPeriodo(null);
    setPeriodById(null);
    if (!selectedSociety.idRef) { setPeriodos([]); return; }
    getPeriodosBySociedad(selectedSociety.idRef)
      .then(ps => {
        const sorted = ps.map(p => p.periodo).sort();
        setPeriodos(sorted);
        setSelPeriodo(sorted.length > 0 ? sorted[sorted.length - 1]! : null);
      })
      .catch(() => setPeriodos([]));
  }, [selectedSociety.idRef]);

  useEffect(() => {
    if (!selPeriodo || !kpis?.flatItems) return;
    let cancelled = false;
    setLoadingPeriodo(true);
    void Promise.all(
      kpis.flatItems.map(async it => {
        try {
          const lineas = await getLineasBSS(it.idRef, selPeriodo);
          return [it.idRef, lineas.length > 0 ? derivedToRow(deriveKpis(lineas)) : null] as const;
        } catch {
          return [it.idRef, null] as const;
        }
      }),
    ).then(entries => {
      if (cancelled) return;
      const map = new Map<string, KpiRow>();
      for (const [id, row] of entries) if (row) map.set(id, row);
      setPeriodById({ periodo: selPeriodo, map });
    }).finally(() => { if (!cancelled) setLoadingPeriodo(false); });
    return () => { cancelled = true; };
  }, [selPeriodo, kpis]);

  // Vista activa: el período seleccionado (una vez cargado) o, si la sociedad no
  // tiene balances, los KPIs base de kpis_sociedades.
  const view = useMemo(() => {
    if (!kpis) return null;
    if (!selPeriodo || !periodById || periodById.periodo !== selPeriodo) {
      return { ...kpis, periodoActivo: null as string | null, missing: [] as string[] };
    }
    const items = kpis.flatItems.map(it => {
      const base = periodById.map.get(it.idRef);
      return { ...it, ...(base ? mulRow(base, it.pct) : { ...ZERO_ROW }) };
    });
    const consolidated = sumRows(items);
    const own    = selectedSociety.idRef ? periodById.map.get(selectedSociety.idRef) : undefined;
    const propio = own ?? { ...ZERO_ROW };
    const missing = kpis.flatItems.filter(it => !periodById.map.has(it.idRef)).map(it => it.nombre);
    return {
      propio, consolidated,
      isHolding: kpis.isHolding, hasChildren: kpis.hasChildren,
      breakdown: kpis.hasChildren ? items : null,
      unconfigured: kpis.unconfigured, flatItems: items,
      periodoActivo: selPeriodo, missing,
    };
  }, [kpis, selPeriodo, periodById, selectedSociety.idRef]);

  const mask = (val: number) => isPrivateMode ? '••••' : formatCurrency(val);

  if (!kpis) {
    return (
      <div className="space-y-12">
        <NAVSection data={data} selectedSociety={selectedSociety} isPrivateMode={isPrivateMode} />
        <div className="text-center py-12 text-zinc-600">
          <p className="text-sm font-medium">Sin datos contables · {selectedSociety.nombre}</p>
          <p className="text-xs mt-1">Sube el libro mayor desde Datos Maestros para ver el balance.</p>
        </div>
      </div>
    );
  }

  const { propio, consolidated, hasChildren, breakdown, unconfigured, periodoActivo, missing } = view ?? { ...kpis, periodoActivo: null, missing: [] };

  // Índice del selector: 0..n-1 = períodos (asc). El último es el más reciente.
  const selIdx = selPeriodo === null ? periodos.length - 1 : Math.max(0, periodos.indexOf(selPeriodo));
  const setIdx = (i: number) => { const p = periodos[i]; if (p) setSelPeriodo(p); };

  const bdTooltip = (label: string, field: 'caja' | 'deudaBancaria' | 'deudaSocios' | 'fondoManiobra' | 'patrimonioNeto') =>
    breakdown
      ? <BreakdownTooltip label={label} items={breakdown.map(b => ({ nombre: b.nombre, valor: b[field], pct: b.pct }))} mask={mask} />
      : undefined;

  // Primario: siempre el consolidado (incluye subsidiarias ponderadas)
  // Secundario: propio (solo datos de la sociedad sin filiales) cuando hay hijos
  const primaryVal = (_propioVal: number, consolidatedVal: number) => mask(consolidatedVal);
  const secondaryVal = (propioVal: number) => hasChildren ? mask(propioVal) : undefined;

  return (
    <div className="space-y-12">
      <NAVSection data={data} selectedSociety={selectedSociety} isPrivateMode={isPrivateMode} />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white uppercase tracking-tight flex items-center gap-3">
            <BookOpen className="text-blue-400" size={24} />
            Balance Contable
          </h2>
          <p className="text-xs text-zinc-500 font-medium">
            {periodoActivo
              ? <>Balance a <span className="text-blue-300">{fmtPeriodo(periodoActivo)}</span> — derivado del sumas y saldos del período</>
              : <>Posición de liquidez y deuda a valor contable ·{' '}
                  {hasChildren ? `${selectedSociety.nombre} — consolidado ponderado` : selectedSociety.nombre}</>}
          </p>
        </div>

        {/* Selector de período: ← Inicial · Mayo 2026 → (el último es el más reciente) */}
        {selectedSociety.idRef !== null && periodos.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIdx(selIdx - 1)}
              disabled={selIdx === 0}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              aria-label="Período anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <select
              value={selIdx}
              onChange={e => setIdx(Number(e.target.value))}
              className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
            >
              {periodos.map((p, i) => <option key={p} value={i}>{fmtPeriodo(p)}</option>)}
            </select>
            <button
              onClick={() => setIdx(selIdx + 1)}
              disabled={selIdx === periodos.length - 1}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              aria-label="Período siguiente"
            >
              <ChevronRight size={16} />
            </button>
            {loadingPeriodo && <RefreshCw size={13} className="animate-spin text-zinc-500 ml-1" />}
          </div>
        )}
      </div>

      {periodoActivo && missing.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-snug">
            <span className="font-semibold uppercase tracking-widest">Sin balance de {fmtPeriodo(periodoActivo)}:</span>{' '}
            {missing.join(', ')} — sus importes constan a 0 en esta vista. Sube su sumas y saldos del período para completar el consolidado.
          </p>
        </div>
      )}

      {unconfigured.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-0.5">% de participación sin configurar</p>
            <p className="text-xs text-amber-400/80 leading-snug">
              {unconfigured.join(', ')} — se están contabilizando al 100% en vez del % real del grupo.
              Entra en <span className="font-medium text-amber-300">Datos Maestros → Sociedades</span> y configura
              los campos <span className="font-mono">% Pavier</span> y <span className="font-mono">% Armia</span> para corregirlo.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        <KPICard
          title="Caja Disponible"
          value={primaryVal(propio.caja, consolidated.caja)}
          secondaryValue={secondaryVal(propio.caja)}
          secondaryTitle="Propio"
          icon={Wallet}
          color="emerald"
          tooltip={bdTooltip('Caja disponible', 'caja') ?? 'Saldos bancarios y liquidez inmediata operativa.'}
        />

        <KPICard
          title="Deuda Bancaria"
          value={primaryVal(propio.deudaBancaria, consolidated.deudaBancaria)}
          secondaryValue={secondaryVal(propio.deudaBancaria)}
          secondaryTitle="Propio"
          icon={Landmark}
          color="rose"
          tooltip={bdTooltip('Deuda bancaria', 'deudaBancaria') ?? (
            <div className="space-y-2 text-left">
              <div className="flex justify-between items-center gap-4">
                <span className="text-zinc-400">Largo Plazo (L/P):</span>
                <span className="text-white font-semibold">{mask(consolidated.deudaBancariaLP)}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-zinc-400">Corto Plazo (C/P):</span>
                <span className="text-white font-semibold">{mask(consolidated.deudaBancariaCP)}</span>
              </div>
            </div>
          )}
        />

        <KPICard
          title="Deuda Socios"
          value={primaryVal(propio.deudaSocios, consolidated.deudaSocios)}
          secondaryValue={secondaryVal(propio.deudaSocios)}
          secondaryTitle="Propio"
          icon={Briefcase}
          color="amber"
          tooltip={bdTooltip('Deuda socios', 'deudaSocios') ?? 'Préstamos de socios y cuentas corrientes con socios.'}
        />

        <KPICard
          title="Fondo de Maniobra"
          value={primaryVal(propio.fondoManiobra, consolidated.fondoManiobra)}
          secondaryValue={secondaryVal(propio.fondoManiobra)}
          secondaryTitle="Propio"
          icon={Scale}
          color="blue"
          tooltip={bdTooltip('Fondo de maniobra', 'fondoManiobra') ?? (
            <div className="space-y-2 text-left">
              <div className="flex justify-between items-center gap-4">
                <span className="text-zinc-400">Activo Corriente:</span>
                <span className="text-white font-semibold">{mask(consolidated.activoCorriente)}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-zinc-400">Pasivo Corriente:</span>
                <span className="text-white font-semibold">{mask(consolidated.pasivoCorriente)}</span>
              </div>
            </div>
          )}
        />

        <KPICard
          title="Patrimonio Neto"
          value={primaryVal(propio.patrimonioNeto, consolidated.patrimonioNeto)}
          secondaryValue={secondaryVal(propio.patrimonioNeto)}
          secondaryTitle="Propio"
          icon={Banknote}
          color="blue"
          tooltip={bdTooltip('Patrimonio neto', 'patrimonioNeto') ?? (
            <div className="space-y-2 text-left">
              <div className="flex justify-between items-center gap-4">
                <span className="text-zinc-400">Activo Total:</span>
                <span className="text-white font-semibold">{mask(consolidated.activoTotal)}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-zinc-400">Pasivo Total:</span>
                <span className="text-white font-semibold">{mask(consolidated.pasivoTotal)}</span>
              </div>
            </div>
          )}
        />
      </div>

      {/* ── Sumas y Saldos ─────────────────────────────────────────────── */}
      {selectedSociety.idRef !== null && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-white uppercase tracking-tight flex items-center gap-3">
              <Table2 className="text-blue-400" size={24} />
              Sumas y Saldos
            </h2>
            <p className="text-xs text-zinc-500 mt-2 font-medium">
              Detalle de cuentas PGC del último balance importado
            </p>
          </div>
          <BssSaldosSection societyIdRef={selectedSociety.idRef} />
        </div>
      )}

    </div>
  );
}
