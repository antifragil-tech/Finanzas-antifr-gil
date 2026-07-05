type Flujo = { fecha: string; importe: number };

const MAX_ITER = 200;
const TOLERANCIA = 1e-7;

function aniosDesdeInicio(f0: Date, ft: Date): number {
  return (ft.getTime() - f0.getTime()) / (365.25 * 24 * 3600 * 1000);
}

// Calcula la TIR con fechas irregulares (XIRR) mediante Newton-Raphson.
// flujos: array con al menos un importe negativo y uno positivo.
// Retorna la tasa como decimal (0.15 = 15%). Lanza si no converge.
export function calcularXIRR(flujos: Flujo[], guess = 0.1): number {
  if (flujos.length < 2) throw new Error('XIRR requiere al menos 2 flujos.');

  const hayNegativo = flujos.some((f) => f.importe < 0);
  const hayPositivo = flujos.some((f) => f.importe > 0);
  if (!hayNegativo || !hayPositivo) {
    throw new Error('XIRR requiere flujos positivos y negativos.');
  }

  const fechas = flujos.map((f) => new Date(f.fecha));
  const f0 = fechas[0]!;
  const t = fechas.map((d) => aniosDesdeInicio(f0, d));

  let r = guess;

  for (let i = 0; i < MAX_ITER; i++) {
    let fx = 0;
    let dfx = 0;

    for (let j = 0; j < flujos.length; j++) {
      const cf = flujos[j]!.importe;
      const tj = t[j]!;
      const base = Math.pow(1 + r, tj);
      fx += cf / base;
      dfx -= (cf * tj) / (base * (1 + r));
    }

    if (Math.abs(dfx) < 1e-12) break;

    const rNew = r - fx / dfx;

    if (Math.abs(rNew - r) < TOLERANCIA) return rNew;
    r = rNew;
  }

  throw new Error('XIRR no convergió. Revisa que los flujos sean coherentes.');
}
