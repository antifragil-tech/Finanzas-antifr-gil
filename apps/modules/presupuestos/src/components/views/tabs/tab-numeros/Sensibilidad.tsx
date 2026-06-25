// Análisis de sensibilidad — "Qué pasa si..." por tipo de proyecto
import type { AnalisisFinanciero } from '../../../../lib/analisisFinanciero';
import {
  calcKpisCV, calcKpisRentaExtended, calcKpisAlternativo,
  calcKpisExplotacion, calcKpisPrestamo, calcKpisCapexInterno,
} from '../../../../lib/analisisFinanciero';
import type { ProyectoRow } from '../../../../lib/proyectosApi';
import { fmt, fmtPct, fmtX, fmtAno } from './shared';

// ── Tipos internos ────────────────────────────────────────────────────────────

type RowFormat = 'pct' | 'eur' | 'ano' | 'mult';

type SensRow = {
  escenario: string;
  metrica:   string;
  base:      string;
  stress:    string;
  deltaAbs:  string;  // diferencia absoluta (p.p. para %, € para importes, etc.)
  deltaRel:  string;  // impacto relativo %
  esNegativo: boolean;
};

function pct(v: number | null | undefined, d: number): number | null {
  return v != null ? v * (1 + d) : null;
}
function sum(v: number | null | undefined, d: number): number | null {
  return v != null ? v + d : null;
}

// ── Builder de fila ───────────────────────────────────────────────────────────

function buildSensRow(
  escenario: string,
  metrica:   string,
  baseRaw:   number | null | undefined,
  stressRaw: number | null | undefined,
  format:    RowFormat,
  lowerIsBetter = false,
): SensRow {
  const bNum = baseRaw  != null && isFinite(baseRaw)  && !isNaN(baseRaw)  ? baseRaw  : null;
  const sNum = stressRaw != null && isFinite(stressRaw) && !isNaN(stressRaw) ? stressRaw : null;

  const renderVal = (v: number): string => {
    if (format === 'pct') return fmtPct(v);
    if (format === 'eur') return fmt(v);
    if (format === 'ano') return fmtAno(v);
    return fmtX(v);
  };

  const baseStr   = bNum != null ? renderVal(bNum) : '—';
  const stressStr = sNum != null ? renderVal(sNum) : '—';

  if (bNum === null || sNum === null) {
    return { escenario, metrica, base: baseStr, stress: stressStr, deltaAbs: '—', deltaRel: '—', esNegativo: false };
  }

  const diff = sNum - bNum;
  const sign = diff >= 0 ? '+' : '';

  // Diferencia absoluta
  let deltaAbs: string;
  if (format === 'pct') {
    // Valores en decimal (ej. 0.123): diferencia en puntos porcentuales
    const pp = diff * 100;
    deltaAbs = `${pp >= 0 ? '+' : ''}${pp.toFixed(1)} p.p.`;
  } else if (format === 'eur') {
    // toLocaleString incluye el signo negativo propio; solo añadir '+' para positivos
    deltaAbs = `${sign}${fmt(diff)}`;
  } else if (format === 'ano') {
    deltaAbs = `${sign}${Math.abs(diff).toFixed(1)} años`;
  } else {
    deltaAbs = `${sign}${Math.abs(diff).toFixed(2)}x`;
  }

  // Impacto relativo
  const relPct  = bNum !== 0 ? ((sNum - bNum) / Math.abs(bNum)) * 100 : null;
  const deltaRel = relPct != null
    ? `${relPct >= 0 ? '+' : ''}${relPct.toFixed(0)}%`
    : '—';

  const isImprovement = lowerIsBetter ? diff <= 0 : diff >= 0;
  return { escenario, metrica, base: baseStr, stress: stressStr, deltaAbs, deltaRel, esNegativo: !isImprovement };
}

// ── Tabla de sensibilidad ─────────────────────────────────────────────────────

function SensTable({ title, rows }: { title: string; rows: SensRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/30 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/[0.05]">
        <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">{title}</p>
        <p className="text-2xs text-zinc-700 mt-0.5">
          Simula el impacto de cambios adversos en las variables clave. La columna "Diferencia" muestra el cambio absoluto; "Impacto" muestra la variación relativa respecto al escenario base.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[640px]">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {(['Escenario de estrés', 'Métrica analizada', 'Base', 'Estrés', 'Diferencia', 'Impacto'] as const).map(h => (
                <th key={h} className="px-4 py-2 text-left text-2xs font-semibold text-zinc-600 uppercase tracking-widest whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-2.5 text-zinc-400 whitespace-nowrap">{r.escenario}</td>
                <td className="px-4 py-2.5 text-zinc-500">{r.metrica}</td>
                <td className="px-4 py-2.5 text-zinc-300 tabular-nums whitespace-nowrap">{r.base}</td>
                <td className="px-4 py-2.5 text-zinc-300 tabular-nums whitespace-nowrap">{r.stress}</td>
                <td className={`px-4 py-2.5 font-medium tabular-nums whitespace-nowrap ${r.esNegativo ? 'text-rose-400' : 'text-emerald-400'}`}>{r.deltaAbs}</td>
                <td className={`px-4 py-2.5 font-medium tabular-nums whitespace-nowrap ${r.esNegativo ? 'text-rose-400' : 'text-emerald-400'}`}>{r.deltaRel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Cálculo por tipo ──────────────────────────────────────────────────────────

function calcRentaRows(a: AnalisisFinanciero, fi: string | null, fs: string | null): SensRow[] {
  const b  = calcKpisRentaExtended(a, fi, fs);
  const s1 = calcKpisRentaExtended({ ...a, renta_mensual_bruta: pct(a.renta_mensual_bruta, -0.10) }, fi, fs);
  const s2 = calcKpisRentaExtended({
    ...a,
    gastos_operativos_anuales: pct(a.gastos_operativos_anuales, 0.10),
    ibi_anual:    pct(a.ibi_anual,    0.10),
    seguro_anual: pct(a.seguro_anual, 0.10),
  }, fi, fs);
  const s3 = calcKpisRentaExtended({
    ...a,
    valoracion_actual:  pct(a.valoracion_actual,  -0.10),
    cap_rate_salida_pct: sum(a.cap_rate_salida_pct, 0.5),
  }, fi, fs);
  return [
    buildSensRow('Renta −10%',          'Rentabilidad neta sobre coste',  b.yieldNetoCoste,  s1.yieldNetoCoste,  'pct'),
    buildSensRow('Gastos +10%',         'Renta neta operativa (NOI)',      b.noIAnual,         s2.noIAnual,         'eur'),
    buildSensRow('Valor residual −10%', 'TIR con valor residual',          b.tirConResidual,   s3.tirConResidual,   'pct'),
  ];
}

function calcCVRows(a: AnalisisFinanciero, fi: string | null, fs: string | null): SensRow[] {
  const sup = a.superficie_arrendable_m2 ?? null;
  const b   = calcKpisCV(a, fi, fs, sup);
  const s1  = calcKpisCV({ ...a, precio_venta_previsto: pct(a.precio_venta_previsto, -0.05) }, fi, fs, sup);
  const s2  = calcKpisCV({ ...a, precio_venta_previsto: pct(a.precio_venta_previsto, -0.10) }, fi, fs, sup);
  const s3  = calcKpisCV({ ...a, presupuesto_obra:      pct(a.presupuesto_obra,       0.10) }, fi, fs, sup);
  const s4  = calcKpisCV({ ...a, gastos_venta:          pct(a.gastos_venta,           0.15) }, fi, fs, sup);
  return [
    buildSensRow('Precio venta −5%',  'Beneficio neto',       b.beneficioNeto, s1.beneficioNeto, 'eur'),
    buildSensRow('Precio venta −10%', 'Beneficio neto',       b.beneficioNeto, s2.beneficioNeto, 'eur'),
    buildSensRow('Obra +10%',         'Margen sobre venta',   b.margenPct,     s3.margenPct,     'pct'),
    buildSensRow('Gastos venta +15%', 'Beneficio neto',       b.beneficioNeto, s4.beneficioNeto, 'eur'),
  ];
}

function calcExplotacionRows(a: AnalisisFinanciero): SensRow[] {
  const b  = calcKpisExplotacion(a);
  const s1 = calcKpisExplotacion({ ...a, ingresos_anuales_previstos: pct(a.ingresos_anuales_previstos, -0.10) });
  const s2 = calcKpisExplotacion({ ...a, costes_fijos_anuales:       pct(a.costes_fijos_anuales,        0.10) });
  const s3 = calcKpisExplotacion({ ...a, costes_variables_pct:       sum(a.costes_variables_pct,          5)  });
  return [
    buildSensRow('Ingresos −10%',        'EBITDA anual',    b.ebitdaAnual,  s1.ebitdaAnual,  'eur'),
    buildSensRow('Costes fijos +10%',    'EBITDA anual',    b.ebitdaAnual,  s2.ebitdaAnual,  'eur'),
    buildSensRow('Costes variables +5%', 'Margen EBITDA',   b.margenEbitda, s3.margenEbitda, 'pct'),
  ];
}

function calcPrestamoRows(a: AnalisisFinanciero): SensRow[] {
  const b  = calcKpisPrestamo(a);
  const s1 = calcKpisPrestamo({ ...a, probabilidad_impago_pct: a.probabilidad_impago_pct != null ? a.probabilidad_impago_pct * 2 : null });
  const s2 = calcKpisPrestamo({ ...a, lgd_pct:                 a.lgd_pct != null ? Math.min(100, a.lgd_pct + 10) : null });
  return [
    buildSensRow('Probabilidad impago ×2', 'Pérdida esperada', b.perdidaEsperada, s1.perdidaEsperada, 'eur', true),
    buildSensRow('LGD +10 puntos',         'Pérdida esperada', b.perdidaEsperada, s2.perdidaEsperada, 'eur', true),
  ];
}

function calcCapexRows(a: AnalisisFinanciero): SensRow[] {
  const b  = calcKpisCapexInterno(a);
  const s1 = calcKpisCapexInterno({ ...a, beneficio_esperado_anual: pct(a.beneficio_esperado_anual, -0.20) });
  const s2 = calcKpisCapexInterno({ ...a, precio_adquisicion:       pct(a.precio_adquisicion,        0.10) });
  const s3 = calcKpisCapexInterno({ ...a, vida_util_activo_anios: a.vida_util_activo_anios != null ? Math.max(1, a.vida_util_activo_anios - 1) : null });
  return [
    buildSensRow('Beneficio −20%',   'Recuperación del CAPEX',    b.paybackCapex, s1.paybackCapex, 'ano', true),
    buildSensRow('Inversión +10%',   'Valor actual neto (VAN)',    b.vanCapex,     s2.vanCapex,     'eur'),
    buildSensRow('Vida útil −1 año', 'TIR del CAPEX',             b.tirCapex,     s3.tirCapex,     'pct'),
  ];
}

function calcAlternativoRows(a: AnalisisFinanciero, fi: string | null, fs: string | null): SensRow[] {
  const b  = calcKpisAlternativo(a, fi, fs);
  const s1 = calcKpisAlternativo({ ...a, retorno_previsto_total: pct(a.retorno_previsto_total, -0.20) }, fi, fs);
  return [
    buildSensRow('Retorno −20%', 'Múltiplo sobre capital (MOIC)', b.moic, s1.moic, 'mult'),
  ];
}

// ── Componente principal ──────────────────────────────────────────────────────

export function Sensibilidad({ analisis, proyecto }: { analisis: AnalisisFinanciero; proyecto: ProyectoRow }) {
  const tipo = analisis.tipo_analisis;
  const fi   = proyecto.fecha_inicio;
  const fs   = proyecto.fecha_prevista_salida;

  const rows = (() => {
    if (tipo === 'renta')         return calcRentaRows(analisis, fi, fs);
    if (tipo === 'compra_venta')  return calcCVRows(analisis, fi, fs);
    if (tipo === 'explotacion')   return calcExplotacionRows(analisis);
    if (tipo === 'prestamo')      return calcPrestamoRows(analisis);
    if (tipo === 'capex_interno') return calcCapexRows(analisis);
    if (tipo === 'alternativo')   return calcAlternativoRows(analisis, fi, fs);
    return [];
  })();

  if (rows.every(r => r.base === '—')) return null;

  return (
    <SensTable
      title="Análisis de sensibilidad — ¿Qué pasa si...?"
      rows={rows}
    />
  );
}
