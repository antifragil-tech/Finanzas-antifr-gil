/// <reference types="vite/client" />
// Helper de escenarios financieros por proyecto.
// Cada escenario almacena parámetros modificados + KPIs calculados en JSONB.

import type { EscenarioFinanciero, EscenarioTipo } from '@alsari/types';
import type { AnalisisFinanciero, TipoAnalisis } from './analisisFinanciero';
import {
  calcKpisCV,
  calcKpisRentaExtended,
  calcKpisAlternativo,
  calcKpisExplotacion,
  calcKpisPrestamo,
  calcKpisCapexInterno,
} from './analisisFinanciero';

// ── Auth / Supabase client ─────────────────────────────────────────────────────

import { sbHeaders as hdrs, sbUrl } from '@alsari/supabase-client';

async function req<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: hdrs(opts.headers as Record<string, string> | undefined),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : []) as T;
}

// ── Generación local de escenarios ────────────────────────────────────────────

type EscenarioDelta = Partial<AnalisisFinanciero>;

function applyDelta(base: AnalisisFinanciero, delta: EscenarioDelta): AnalisisFinanciero {
  const merged = { ...base };
  for (const [k, v] of Object.entries(delta)) {
    if (v !== undefined) (merged as Record<string, unknown>)[k] = v;
  }
  return merged;
}

function pct(val: number | null | undefined, d: number): number | null {
  return val != null ? val * (1 + d) : null;
}

function calcResultado(
  a: AnalisisFinanciero,
  fechaInicio: string | null,
  fechaSalida: string | null,
): Record<string, unknown> {
  const tipo = a.tipo_analisis;
  if (tipo === 'compra_venta') {
    const k = calcKpisCV(a, fechaInicio, fechaSalida, a.superficie_arrendable_m2 ?? null);
    return {
      inversionTotal: k.inversionTotal,
      margenBruto: k.margenBruto,
      margenPct: k.margenPct,
      beneficioNeto: k.beneficioNeto,
      precioVenta: a.precio_venta_previsto ?? null,
      moic: k.moic,
      tirEquity: k.tirEquity,
      van: k.van,
    };
  }
  if (tipo === 'renta') {
    const k = calcKpisRentaExtended(a, fechaInicio, fechaSalida);
    const cashflowAnual = k.noIAnual != null ? k.noIAnual - (k.servicioDeudaAnual ?? 0) : null;
    return {
      noIAnual: k.noIAnual,
      yieldNetoCoste: k.yieldNetoCoste,
      yieldNetoValorActual: k.yieldNetoValorActual,
      cashOnCash: k.cashOnCash,
      dscr: k.dscr,
      tirConResidual: k.tirConResidual,
      valorReversion: k.valorReversion,
      rentaAnualBruta: k.rentaAnualBruta,
      van: k.van,
      cashflowAnual,
      valorResidualUsado: k.valorResidualUsado,
    };
  }
  if (tipo === 'explotacion') {
    const k = calcKpisExplotacion(a);
    return {
      ingresosAnuales: k.ingresosAnuales,
      ebitdaAnual: k.ebitdaAnual,
      margenEbitda: k.margenEbitda,
      fcfAnual: k.fcfAnual,
      paybackOperativo: k.paybackOperativo,
      breakEvenIngresos: k.breakEvenIngresos,
      van: k.van,
      tir: k.tir,
    };
  }
  if (tipo === 'prestamo') {
    const k = calcKpisPrestamo(a);
    return {
      cuotaMensual: k.cuotaMensual,
      interesTotales: k.interesTotales,
      cobroAnual: k.cobroAnual,
      perdidaEsperada: k.perdidaEsperada,
      tirInstrumento: k.tirInstrumento,
      van: k.van,
      vanAjustado: k.vanAjustado,
      coberturaGarantia: k.coberturaGarantia,
    };
  }
  if (tipo === 'capex_interno') {
    const k = calcKpisCapexInterno(a);
    return {
      ahorroBruto: k.ahorroBruto,
      cajaNetaAnual: k.cajaNetaAnual,
      paybackCapex: k.paybackCapex,
      vanCapex: k.vanCapex,
      tirCapex: k.tirCapex,
      depreciacionAnual: k.depreciacionAnual,
      valorResidual: k.valorResidual,
    };
  }
  if (tipo === 'alternativo') {
    const k = calcKpisAlternativo(a, fechaInicio, fechaSalida);
    return {
      retornoTotal: k.retornoTotal,
      beneficioEsperado: k.beneficioEsperado,
      moic: k.moic,
      tirEquity: k.tirEquity,
      van: k.van,
      margenLatente: k.margenLatente,
    };
  }
  return {};
}

export type EscenarioGenerado = {
  escenario: EscenarioTipo;
  nombre: string;
  parametros: AnalisisFinanciero;
  resultado: Record<string, unknown>;
};

export function generarEscenariosDesdeAnalisis(
  a: AnalisisFinanciero,
  fechaInicio: string | null = null,
  fechaSalida: string | null = null,
): EscenarioGenerado[] {
  const tipo = a.tipo_analisis;
  let deltaConservador: EscenarioDelta;
  let deltaOptimista: EscenarioDelta;

  const n = (v: number | null | undefined, fn: (x: number) => number): number | null =>
    v != null ? fn(v) : null;

  if (tipo === 'renta') {
    deltaConservador = {
      renta_mensual_bruta: pct(a.renta_mensual_bruta, -0.1),
      gastos_operativos_anuales: pct(a.gastos_operativos_anuales, 0.1),
      tasa_ocupacion_prevista_pct: n(a.tasa_ocupacion_prevista_pct, (v) => Math.max(0, v - 5)),
      valoracion_actual: pct(a.valoracion_actual, -0.1),
      cap_rate_salida_pct: n(a.cap_rate_salida_pct, (v) => v + 0.5),
    };
    deltaOptimista = {
      renta_mensual_bruta: pct(a.renta_mensual_bruta, 0.1),
      tasa_ocupacion_prevista_pct: n(a.tasa_ocupacion_prevista_pct, (v) => Math.min(100, v + 3)),
      valoracion_actual: pct(a.valoracion_actual, 0.1),
      cap_rate_salida_pct: n(a.cap_rate_salida_pct, (v) => Math.max(0.5, v - 0.25)),
    };
  } else if (tipo === 'compra_venta') {
    deltaConservador = {
      precio_venta_previsto: pct(a.precio_venta_previsto, -0.1),
      presupuesto_obra: pct(a.presupuesto_obra, 0.1),
      gastos_venta: pct(a.gastos_venta, 0.05),
      plazo_ejecucion_obra_meses: n(a.plazo_ejecucion_obra_meses, (v) => v + 6),
    };
    deltaOptimista = {
      precio_venta_previsto: pct(a.precio_venta_previsto, 0.07),
      plazo_ejecucion_obra_meses: n(a.plazo_ejecucion_obra_meses, (v) => Math.max(0, v - 3)),
    };
  } else if (tipo === 'explotacion') {
    deltaConservador = {
      ingresos_anuales_previstos: pct(a.ingresos_anuales_previstos, -0.15),
      costes_variables_pct: n(a.costes_variables_pct, (v) => v + 5),
      costes_fijos_anuales: pct(a.costes_fijos_anuales, 0.1),
      tasa_crecimiento_anual_pct: 0,
    };
    deltaOptimista = {
      ingresos_anuales_previstos: pct(a.ingresos_anuales_previstos, 0.15),
      costes_variables_pct: n(a.costes_variables_pct, (v) => Math.max(0, v - 2)),
      tasa_crecimiento_anual_pct:
        a.tasa_crecimiento_anual_pct != null ? a.tasa_crecimiento_anual_pct + 2 : 2,
    };
  } else if (tipo === 'prestamo') {
    deltaConservador = {
      probabilidad_impago_pct: n(a.probabilidad_impago_pct, (v) => v * 2),
      lgd_pct: n(a.lgd_pct, (v) => Math.min(100, v + 10)),
    };
    deltaOptimista = {
      probabilidad_impago_pct: n(a.probabilidad_impago_pct, (v) => v * 0.7),
      lgd_pct: n(a.lgd_pct, (v) => Math.max(0, v - 10)),
    };
  } else if (tipo === 'capex_interno') {
    deltaConservador = {
      beneficio_esperado_anual: pct(a.beneficio_esperado_anual, -0.2),
      vida_util_activo_anios: n(a.vida_util_activo_anios, (v) => Math.max(1, v - 1)),
      precio_adquisicion: pct(a.precio_adquisicion, 0.1),
    };
    deltaOptimista = {
      beneficio_esperado_anual: pct(a.beneficio_esperado_anual, 0.2),
      vida_util_activo_anios: n(a.vida_util_activo_anios, (v) => v + 1),
    };
  } else {
    // alternativo
    deltaConservador = { retorno_previsto_total: pct(a.retorno_previsto_total, -0.2) };
    deltaOptimista = { retorno_previsto_total: pct(a.retorno_previsto_total, 0.15) };
  }

  const paramBase = { ...a };
  const paramConservador = applyDelta(a, deltaConservador);
  const paramOptimista = applyDelta(a, deltaOptimista);

  return [
    {
      escenario: 'conservador',
      nombre: 'Conservador',
      parametros: paramConservador,
      resultado: calcResultado(paramConservador, fechaInicio, fechaSalida),
    },
    {
      escenario: 'base',
      nombre: 'Base',
      parametros: paramBase,
      resultado: calcResultado(paramBase, fechaInicio, fechaSalida),
    },
    {
      escenario: 'optimista',
      nombre: 'Optimista',
      parametros: paramOptimista,
      resultado: calcResultado(paramOptimista, fechaInicio, fechaSalida),
    },
  ];
}

// ── API remota ────────────────────────────────────────────────────────────────

export async function getEscenariosProyecto(
  proyectoId: string,
  tipoAnalisis: TipoAnalisis,
): Promise<EscenarioFinanciero[]> {
  const url =
    sbUrl('proyecto_escenarios_financieros') +
    `?proyecto_id_ref=eq.${encodeURIComponent(proyectoId)}&tipo_analisis=eq.${tipoAnalisis}&order=escenario.asc`;
  return req<EscenarioFinanciero[]>(url);
}

export async function upsertEscenarioProyecto(
  proyectoId: string,
  tipoAnalisis: TipoAnalisis,
  escenario: EscenarioTipo,
  nombre: string,
  parametros: Record<string, unknown>,
  resultado: Record<string, unknown>,
): Promise<EscenarioFinanciero> {
  const url = sbUrl('proyecto_escenarios_financieros');
  const payload = {
    proyecto_id_ref: proyectoId,
    tipo_analisis: tipoAnalisis,
    escenario,
    nombre,
    parametros,
    resultado,
    updated_at: new Date().toISOString(),
  };
  const rows = await req<EscenarioFinanciero[]>(url, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
  });
  if (!rows[0]) throw new Error('No se pudo guardar el escenario');
  return rows[0];
}

export async function deleteEscenariosProyecto(
  proyectoId: string,
  tipoAnalisis: TipoAnalisis,
): Promise<void> {
  await req(
    sbUrl(
      `proyecto_escenarios_financieros?proyecto_id_ref=eq.${encodeURIComponent(proyectoId)}&tipo_analisis=eq.${tipoAnalisis}`,
    ),
    { method: 'DELETE' },
  );
}
