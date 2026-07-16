// Utilidades puras del selector de periodo (?mes=YYYY-MM) de las páginas del OS.

/** Valida el formato YYYY-MM del parámetro ?mes= (input type="month"). */
export function mesValido(valor: unknown): valor is string {
  return typeof valor === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor);
}

/** Primer valor de un searchParam de Next (string | string[] | undefined). */
export function primerValor(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** 'enero de 2026' a partir de '2026-01' (para títulos y descripciones). */
export function etiquetaMes(mes: string): string {
  const [anio, m] = mes.split('-').map(Number);
  return new Date(anio ?? 1970, (m ?? 1) - 1, 1).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });
}

/** Filtra por periodo: la fecha ISO (YYYY-MM-DD) debe empezar por el mes activo. */
export function filtrarPorMes<T>(
  items: T[],
  mes: string | undefined,
  fechaDe: (x: T) => string,
): T[] {
  if (!mes) return items;
  return items.filter((x) => fechaDe(x).startsWith(mes));
}

/** Mes (YYYY-MM) más reciente de una lista de fechas ISO. undefined si vacía. */
export function mesMasReciente(fechas: string[]): string | undefined {
  let max: string | undefined;
  for (const f of fechas) {
    const m = f.slice(0, 7);
    if (!max || m > max) max = m;
  }
  return max;
}

/** Desplaza un mes YYYY-MM en k meses (negativo hacia atrás). */
export function desplazarMes(mes: string, k: number): string {
  const [anio, m] = mes.split('-').map(Number);
  const d = new Date(anio ?? 1970, (m ?? 1) - 1 + k, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Mes anterior a YYYY-MM. */
export function mesAnterior(mes: string): string {
  return desplazarMes(mes, -1);
}

/** 'jul' a partir de '2026-07' (etiquetas cortas de tendencia). */
export function etiquetaMesCorta(mes: string): string {
  const [anio, m] = mes.split('-').map(Number);
  return new Date(anio ?? 1970, (m ?? 1) - 1, 1).toLocaleDateString('es-ES', { month: 'short' });
}

/** Variación % de actual sobre anterior. null si no hay base de comparación. */
export function variacionPct(actual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}

/**
 * Resuelve el mes activo de una página: ?mes=YYYY-MM lo fija; ?mes=todo muestra
 * todo el histórico (undefined); sin parámetro cae al mes más reciente con
 * datos (así la portada abre enfocada, no en un agregado de todo el tiempo).
 */
export function resolverMes(
  mesParam: string | undefined,
  fechas: string[],
  respaldo: string,
): string | undefined {
  if (mesParam === 'todo') return undefined;
  if (mesValido(mesParam)) return mesParam;
  return mesMasReciente(fechas) ?? respaldo;
}
