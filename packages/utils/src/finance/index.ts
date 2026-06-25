import { calcularXIRR } from './xirr';
import { calcularVAN } from './npv';
import { calcularMOIC } from './moic';

export { calcularXIRR } from './xirr';
export { calcularVAN } from './npv';
export { calcularMOIC } from './moic';

type Flujo = { fecha: string; importe: number; [k: string]: unknown };
type Metricas = { tir: number | null; van: number | null; moic: number | null; dias_desde_inicio: number | null; periodo_inversion_dias: number | null; tasa_descuento_van: number };

const MS_DIA = 24 * 3600 * 1000;

export function calcularMetricasProyecto(
  flujos: Flujo[],
  fechaInicio: string | null,
  tasaDescuento = 0.08,
): Metricas {
  const flujosOrdenados = [...flujos].sort((a, b) => a.fecha.localeCompare(b.fecha));

  // TIR
  let tir: number | null = null;
  try {
    if (flujosOrdenados.length >= 2) {
      tir = calcularXIRR(flujosOrdenados);
    }
  } catch { /* flujos insuficientes o no convergentes */ }

  // VAN
  let van: number | null = null;
  if (flujosOrdenados.length >= 1) {
    van = calcularVAN(flujosOrdenados, tasaDescuento);
  }

  // MOIC
  const moic = flujos.length > 0 ? calcularMOIC(flujos) : null;

  // Días desde inicio
  const hoy = Date.now();
  const dias_desde_inicio = fechaInicio
    ? Math.floor((hoy - new Date(fechaInicio).getTime()) / MS_DIA)
    : null;

  // Período total (inicio → último flujo o hoy)
  const ultimoFlujo = flujosOrdenados.at(-1);
  const periodo_inversion_dias = fechaInicio && ultimoFlujo
    ? Math.floor((new Date(ultimoFlujo.fecha).getTime() - new Date(fechaInicio).getTime()) / MS_DIA)
    : null;

  return { tir, van, moic, dias_desde_inicio, periodo_inversion_dias, tasa_descuento_van: tasaDescuento } satisfies Metricas;
}
