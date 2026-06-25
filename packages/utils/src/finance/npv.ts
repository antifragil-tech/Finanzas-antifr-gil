type Flujo = { fecha: string; importe: number };

// Calcula el VAN con flujos en fechas irregulares.
// tasaDescuento: decimal anual (0.08 = 8%).
export function calcularVAN(flujos: Flujo[], tasaDescuento: number): number {
  if (flujos.length === 0) return 0;

  const f0 = new Date(flujos[0]!.fecha);

  return flujos.reduce((acc, f) => {
    const anios = (new Date(f.fecha).getTime() - f0.getTime()) / (365.25 * 24 * 3600 * 1000);
    return acc + f.importe / Math.pow(1 + tasaDescuento, anios);
  }, 0);
}
