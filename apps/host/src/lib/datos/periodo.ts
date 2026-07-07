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
