import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Scale, BarChart3, PieChart, Layers } from 'lucide-react';
import { KPICard } from '@alsari/ui';
import { formatCurrency, parseCurrency } from '@alsari/utils';
import type { DashboardData, SocietyOption } from '@alsari/types';

type Props = {
  data: DashboardData;
  selectedSociety: SocietyOption;
  isPrivateMode: boolean;
};

type ProjectEntry = {
  id: string;
  nombre: string;
  origen: string;      // "Propio" | sociedad name for sub-contributions
  valoracion: number;
  capitalExpuesto: number;
  margenPct: number;
  pctEfectivo: number; // effective ownership from current node's perspective (0–1)
};

type NAVTotals = {
  valoracion: number;
  capital: number;
  deuda: number;
};

// Handles both DB formats: 0–1 fraction (0.70) and 0–100 percentage (70)
function normPct(val: number | null | undefined): number {
  if (!val) return 0;
  return val > 1 ? val / 100 : val;
}

function findFin(finanzas: DashboardData['finanzas_proyectos'], projectId: string) {
  return finanzas.find(f => f?.['ID-Ref']?.toString().trim() === projectId);
}

/**
 * Returns the flat list of projects reachable from `societyId`, with effective
 * ownership fractions already multiplied through the chain.
 *
 * For top-level holdings (S-001 / S-002): children are detected via pct_pavier / pct_armia.
 *   Only societies WITHOUT a parent_sociedad_id are iterated (direct holdings),
 *   so sub-chains are reached through recursion, not duplicated.
 *
 * For intermediate/leaf societies: children are detected via parent_sociedad_id.
 *
 * `effectivePct` = accumulated ownership from the viewing node down to this call.
 * `visited` guards against circular references.
 */
function flattenProjects(
  societyId: string,
  data: DashboardData,
  effectivePct: number,
  origen: string,
  visited: Set<string>,
): ProjectEntry[] {
  if (visited.has(societyId) || effectivePct <= 0) return [];
  const next = new Set(visited);
  next.add(societyId);

  const results: ProjectEntry[] = [];

  // Own projects
  for (const project of data.proyectos ?? []) {
    const tenedora = project.clean_tenedora ?? project['Sociedad-Ref'] ?? '';
    if (tenedora !== societyId) continue;
    const projectId = project.clean_id ?? project['ID-Ref']?.toString().trim() ?? '';
    const fin = findFin(data.finanzas_proyectos ?? [], projectId);
    const valoracion = parseCurrency(fin?.Valoración);
    const capitalExpuesto = parseCurrency(fin?.['Capital Expuesto']);
    if (valoracion === 0 && capitalExpuesto === 0) continue;
    results.push({
      id: projectId,
      nombre: project.clean_nombre ?? project.Nombre ?? '',
      origen,
      valoracion,
      capitalExpuesto,
      margenPct: capitalExpuesto > 0 ? ((valoracion - capitalExpuesto) / capitalExpuesto) * 100 : 0,
      pctEfectivo: effectivePct,
    });
  }

  // Sub-societies via parent_sociedad_id (intermediate chains)
  for (const soc of data.sociedades ?? []) {
    if (soc.parent_sociedad_id !== societyId) continue;
    const childPct = normPct(soc.pct_en_sociedad_padre);
    if (childPct <= 0) continue;
    const childOrigen = origen === 'Propio'
      ? soc['Nombre de la Sociedad']
      : `${origen} › ${soc['Nombre de la Sociedad']}`;
    results.push(
      ...flattenProjects(soc['ID-Ref'], data, effectivePct * childPct, childOrigen, next)
    );
  }

  return results;
}

/**
 * For top-level holdings: iterate directly-held societies
 * (pct > 0 in the relevant weight column AND no parent_sociedad_id —
 * meaning they are NOT intermediate sub-chains that reach through recursion).
 */
function flattenHoldingProjects(
  holdingId: string,
  weightCol: '% Pavier' | '% Armia',
  data: DashboardData,
): ProjectEntry[] {
  const results: ProjectEntry[] = [];
  for (const soc of data.sociedades ?? []) {
    if (soc['ID-Ref'] === holdingId) continue;
    if (soc.parent_sociedad_id) continue; // reached via recursion from intermediate parent
    const pct = normPct(parseCurrency(soc[weightCol]));
    if (pct <= 0) continue;
    results.push(
      ...flattenProjects(soc['ID-Ref'], data, pct, soc['Nombre de la Sociedad'], new Set([holdingId]))
    );
  }
  return results;
}

function totals(entries: ProjectEntry[]): NAVTotals & { margenPct: number } {
  const valoracion = entries.reduce((s, e) => s + e.valoracion * e.pctEfectivo, 0);
  const capital = entries.reduce((s, e) => s + e.capitalExpuesto * e.pctEfectivo, 0);
  const deuda = 0; // filled by caller from finanzas_sociedades
  const margenPct = capital > 0 ? ((valoracion - capital) / capital) * 100 : 0;
  return { valoracion, capital, deuda, margenPct };
}

function weightedDebt(societyId: string | null, isHolding: boolean, weightCol: '% Pavier' | '% Armia', data: DashboardData): number {
  return (data.finanzas_sociedades ?? []).reduce((sum, fin) => {
    const socId = fin['ID-Ref'] as string | undefined;
    const deuda = parseCurrency(fin['Deuda Bancaria']);
    if (societyId === null) return sum + deuda;
    if (isHolding) {
      const soc = data.sociedades?.find(s => s['ID-Ref'] === socId);
      return sum + deuda * normPct(parseCurrency(soc?.[weightCol] ?? 0));
    }
    if (socId === societyId) return sum + deuda;
    // sub-chain societies
    if (isDescendant(socId ?? '', societyId, data)) return sum + deuda;
    return sum;
  }, 0);
}

/** Returns true if `candidateId` is a descendant (direct or indirect) of `ancestorId`. */
function isDescendant(candidateId: string, ancestorId: string, data: DashboardData, visited = new Set<string>()): boolean {
  if (visited.has(candidateId)) return false;
  visited.add(candidateId);
  const soc = data.sociedades?.find(s => s['ID-Ref'] === candidateId);
  if (!soc?.parent_sociedad_id) return false;
  if (soc.parent_sociedad_id === ancestorId) return true;
  return isDescendant(soc.parent_sociedad_id, ancestorId, data, visited);
}

export function NAVSection({ data, selectedSociety, isPrivateMode }: Props) {
  const nav = useMemo(() => {
    if (!data.proyectos?.length || !data.finanzas_proyectos?.length) return null;

    const isGroup = selectedSociety.idRef === null;

    // Detect top-level holdings dynamically by name — same logic as App.tsx sidebar
    const pavierSoc = data.sociedades?.find(s =>
      s?.['Nombre de la Sociedad']?.toString().toLowerCase().includes('pavier')
    );
    const armiaSoc = data.sociedades?.find(s =>
      s?.['Nombre de la Sociedad']?.toString().toLowerCase().includes('armia')
    );
    const PAVIER_ID = pavierSoc?.['ID-Ref'] ?? '';
    const ARMIA_ID  = armiaSoc?.['ID-Ref'] ?? '';

    const isHolding = !!selectedSociety.idRef && (
      selectedSociety.idRef === PAVIER_ID || selectedSociety.idRef === ARMIA_ID
    );
    const weightCol: '% Pavier' | '% Armia' =
      selectedSociety.idRef === ARMIA_ID ? '% Armia' : '% Pavier';

    // ── Compute project entries ──────────────────────────────────────────────
    let allEntries: ProjectEntry[];

    if (isGroup) {
      // AUM: each project at 100% — total portfolio under management without weighting
      allEntries = [];
      for (const project of data.proyectos) {
        const projectId = project.clean_id ?? project['ID-Ref']?.toString().trim() ?? '';
        const fin = findFin(data.finanzas_proyectos ?? [], projectId);
        const valoracion = parseCurrency(fin?.Valoración);
        const capitalExpuesto = parseCurrency(fin?.['Capital Expuesto']);
        if (valoracion === 0 && capitalExpuesto === 0) continue;
        const soc = data.sociedades?.find(s => s['ID-Ref'] === (project.clean_tenedora ?? project['Sociedad-Ref'] ?? ''));
        allEntries.push({
          id: projectId,
          nombre: project.clean_nombre ?? project.Nombre ?? '',
          origen: soc?.['Nombre de la Sociedad'] ?? '',
          valoracion,
          capitalExpuesto,
          margenPct: capitalExpuesto > 0 ? ((valoracion - capitalExpuesto) / capitalExpuesto) * 100 : 0,
          pctEfectivo: 1.0,
        });
      }
    } else if (isHolding) {
      allEntries = flattenHoldingProjects(selectedSociety.idRef!, weightCol, data);
    } else {
      // Individual / intermediate society: own + sub-chain via parent_sociedad_id
      allEntries = flattenProjects(selectedSociety.idRef!, data, 1.0, 'Propio', new Set());
    }

    if (allEntries.length === 0) return null;

    // ── Propio vs consolidado ────────────────────────────────────────────────
    const hasChildren = !isGroup && !isHolding &&
      (data.sociedades ?? []).some(s => s.parent_sociedad_id === selectedSociety.idRef);

    const propioEntries   = allEntries.filter(e => e.origen === 'Propio');
    const allConsolidated = allEntries;

    const tPropio      = hasChildren ? totals(propioEntries) : null;
    const tConsolidado = totals(allConsolidated);

    const deuda = weightedDebt(selectedSociety.idRef, isHolding, weightCol, data);
    const navNeto = tConsolidado.valoracion - deuda;

    return {
      propioEntries,
      allEntries: [...allConsolidated].sort((a, b) => b.valoracion * b.pctEfectivo - a.valoracion * a.pctEfectivo),
      tPropio,
      tConsolidado,
      deuda,
      navNeto,
      hasChildren,
      isHolding,
      isGroup,
    };
  }, [data, selectedSociety]);

  if (!nav) return null;

  const mask = (val: number) => isPrivateMode ? '••••' : formatCurrency(val);
  const { allEntries, tPropio, tConsolidado, deuda, navNeto, hasChildren, isHolding, isGroup } = nav;

  const showOrigen  = isGroup || isHolding || hasChildren;
  const showPct     = isHolding || hasChildren;

  const footerCols = 1 + (showOrigen ? 1 : 0) + (showPct ? 1 : 0);

  // ── KPI Cards ──────────────────────────────────────────────────────────────
  // When a society has both propio and consolidated, show them split via secondaryValue
  const valorKPI   = tConsolidado.valoracion;
  const capitalKPI = tConsolidado.capital;
  const plusvaliaKPI = valorKPI - capitalKPI;
  const margenKPI  = tConsolidado.margenPct;

  const label = isGroup
    ? 'Grupo Alsari Capital — valoración bruta AUM'
    : isHolding
    ? `Cartera ${selectedSociety.nombre} — participación efectiva`
    : hasChildren
    ? `${selectedSociety.nombre} — consolidado`
    : selectedSociety.nombre;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white uppercase tracking-tight flex items-center gap-3">
          <PieChart className="text-violet-400" size={24} />
          Valor Neto de Activos (NAV)
        </h2>
        <p className="text-xs text-zinc-500 mt-1 font-medium">
          Valoración a mercado · {label}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <KPICard
          title={isGroup ? 'Valor de Cartera (AUM)' : hasChildren ? 'Valor Consolidado' : 'Valor de Cartera'}
          value={mask(valorKPI)}
          secondaryValue={tPropio ? mask(tPropio.valoracion) : undefined}
          secondaryTitle={tPropio ? 'Propio' : undefined}
          icon={BarChart3}
          color="violet"
          tooltip={
            isGroup
              ? 'Suma de valoraciones a mercado sin ponderar (AUM total gestionado)'
              : isHolding
              ? 'Suma de valoraciones ponderadas por % de participación efectiva'
              : hasChildren
              ? 'Consolidado incluye participaciones en filiales ponderadas'
              : 'Valoración de mercado actual de los activos directos'
          }
        />
        <KPICard
          title="Capital Desplegado"
          value={mask(capitalKPI)}
          secondaryValue={tPropio ? mask(tPropio.capital) : undefined}
          secondaryTitle={tPropio ? 'Propio' : undefined}
          icon={Layers}
          color="blue"
          tooltip="Capital total invertido: inversión inicial + ReCapex acumulado"
        />
        <KPICard
          title={plusvaliaKPI >= 0 ? 'Plusvalía Latente' : 'Minusvalía Latente'}
          value={mask(Math.abs(plusvaliaKPI))}
          secondaryValue={`${plusvaliaKPI >= 0 ? '+' : ''}${margenKPI.toFixed(1)}%`}
          secondaryTitle="sobre capital"
          icon={plusvaliaKPI >= 0 ? TrendingUp : TrendingDown}
          color={plusvaliaKPI >= 0 ? 'emerald' : 'rose'}
          tooltip="Diferencia entre valor de mercado y capital invertido. No realizada hasta la venta."
        />
        <KPICard
          title="NAV Neto de Deuda"
          value={mask(navNeto)}
          icon={Scale}
          color={navNeto >= 0 ? 'emerald' : 'rose'}
          tooltip={`Valor consolidado (${isPrivateMode ? '••••' : formatCurrency(valorKPI)}) menos deuda financiera (${isPrivateMode ? '••••' : formatCurrency(deuda)})`}
        />
      </div>

      {/* ── Tabla de desglose ────────────────────────────────────────────── */}
      <div className="glass-panel overflow-hidden rounded-[2rem] border border-white/5 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5">
                <th className="px-8 py-5 text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Proyecto</th>
                {showOrigen && (
                  <th className="px-8 py-5 text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Origen</th>
                )}
                {showPct && (
                  <th className="px-8 py-5 text-2xs font-semibold text-zinc-500 uppercase tracking-widest text-center">Part.</th>
                )}
                <th className="px-8 py-5 text-2xs font-semibold text-zinc-500 uppercase tracking-widest text-right">Capital</th>
                <th className="px-8 py-5 text-2xs font-semibold text-zinc-500 uppercase tracking-widest text-right">Valoración</th>
                {(isHolding || hasChildren) && (
                  <th className="px-8 py-5 text-2xs font-semibold text-zinc-500 uppercase tracking-widest text-right">Val. Efectiva</th>
                )}
                <th className="px-8 py-5 text-2xs font-semibold text-zinc-500 uppercase tracking-widest text-right">Margen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {allEntries.map((e) => {
                const mc = e.margenPct > 0 ? 'text-emerald-400' : e.margenPct < 0 ? 'text-rose-400' : 'text-zinc-400';
                const isOwn = e.origen === 'Propio';
                return (
                  <tr key={`${e.id}-${e.origen}`} className="group hover:bg-white/[0.01] transition-colors">
                    <td className="px-8 py-5 text-sm text-white font-medium group-hover:text-violet-400 transition-colors">
                      {e.nombre}
                    </td>
                    {showOrigen && (
                      <td className="px-8 py-5 text-xs font-medium">
                        {isOwn
                          ? <span className="text-zinc-400">Propio</span>
                          : <span className="text-violet-400/80">{e.origen}</span>
                        }
                      </td>
                    )}
                    {showPct && (
                      <td className="px-8 py-5 text-center">
                        <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                          isOwn
                            ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                            : 'bg-violet-500/10 border border-violet-500/20 text-violet-400'
                        }`}>
                          {e.pctEfectivo >= 0.999 ? '100%' : `${(e.pctEfectivo * 100).toFixed(1)}%`}
                        </span>
                      </td>
                    )}
                    <td className={`px-8 py-5 text-right font-mono text-sm text-zinc-400 ${isPrivateMode ? 'blur-sm select-none' : ''}`}>
                      {formatCurrency(e.capitalExpuesto)}
                    </td>
                    <td className={`px-8 py-5 text-right font-mono text-sm text-white font-medium ${isPrivateMode ? 'blur-sm select-none' : ''}`}>
                      {formatCurrency(e.valoracion)}
                    </td>
                    {(isHolding || hasChildren) && (
                      <td className={`px-8 py-5 text-right font-mono text-sm text-violet-300 font-medium ${isPrivateMode ? 'blur-sm select-none' : ''}`}>
                        {formatCurrency(e.valoracion * e.pctEfectivo)}
                      </td>
                    )}
                    <td className={`px-8 py-5 text-right font-mono text-sm font-semibold ${mc} ${isPrivateMode ? 'blur-sm select-none' : ''}`}>
                      {e.margenPct > 0 ? '+' : ''}{e.margenPct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/10 bg-white/[0.02]">
                <td className="px-8 py-5 text-xs font-semibold text-zinc-400 uppercase tracking-widest" colSpan={footerCols}>
                  TOTAL CONSOLIDADO
                </td>
                <td className={`px-8 py-5 text-right font-mono text-sm text-zinc-300 font-semibold ${isPrivateMode ? 'blur-sm select-none' : ''}`}>
                  {mask(allEntries.reduce((s, e) => s + e.capitalExpuesto, 0))}
                </td>
                <td className={`px-8 py-5 text-right font-mono text-sm text-white font-semibold ${isPrivateMode ? 'blur-sm select-none' : ''}`}>
                  {mask(allEntries.reduce((s, e) => s + e.valoracion, 0))}
                </td>
                {(isHolding || hasChildren) && (
                  <td className={`px-8 py-5 text-right font-mono text-sm text-violet-300 font-semibold ${isPrivateMode ? 'blur-sm select-none' : ''}`}>
                    {mask(tConsolidado.valoracion)}
                  </td>
                )}
                <td className={`px-8 py-5 text-right font-mono text-sm font-semibold ${tConsolidado.margenPct >= 0 ? 'text-emerald-400' : 'text-rose-400'} ${isPrivateMode ? 'blur-sm select-none' : ''}`}>
                  {tConsolidado.margenPct > 0 ? '+' : ''}{tConsolidado.margenPct.toFixed(1)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {deuda > 0 && (
        <p className="text-xs text-zinc-600 text-right">
          Deuda financiera:{' '}
          <span className={`font-medium text-zinc-400 ${isPrivateMode ? 'blur-sm' : ''}`}>{formatCurrency(deuda)}</span>
          {' '}· NAV neto:{' '}
          <span className={`font-medium ${navNeto >= 0 ? 'text-emerald-400' : 'text-rose-400'} ${isPrivateMode ? 'blur-sm' : ''}`}>{formatCurrency(navNeto)}</span>
        </p>
      )}
    </div>
  );
}
