// MOIC (Money-on-Invested-Capital): total entradas / total salidas en valor absoluto.
export function calcularMOIC(flujos: Array<{ importe: number }>): number | null {
  const entradas = flujos.filter(f => f.importe > 0).reduce((s, f) => s + f.importe, 0);
  const salidas  = flujos.filter(f => f.importe < 0).reduce((s, f) => s + Math.abs(f.importe), 0);
  if (salidas === 0) return null;
  return entradas / salidas;
}
