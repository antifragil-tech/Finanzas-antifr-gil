import type { FacturaRecibida } from '@alsari/types';

// Detección de facturas duplicadas. Dos criterios, del más fuerte al más débil:
//   1. 'numero'        → mismo proveedor + mismo número de factura
//   2. 'importe-fecha' → mismo proveedor + misma fecha + mismo total
// Las rechazadas no cuentan: un duplicado rechazado es un duplicado resuelto.

export type MotivoDuplicado = 'numero' | 'importe-fecha';

export type InfoDuplicado = {
  otras: FacturaRecibida[];
  motivo: MotivoDuplicado;
  /** true si alguna de las duplicadas ya está imputada a un presupuesto */
  algunaVinculada: boolean;
};

function normNumero(s: string): string {
  return s.toUpperCase().replace(/[\s\-/.\\]/g, '');
}

function normProveedor(f: FacturaRecibida): string {
  if (f.proveedor_nif) return f.proveedor_nif.toUpperCase().replace(/[\s-]/g, '');
  return f.proveedor_nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function detectarDuplicados(facturas: FacturaRecibida[]): Map<string, InfoDuplicado> {
  const activas = facturas.filter(f => f.estado !== 'rechazada');

  const porNumero = new Map<string, FacturaRecibida[]>();
  const porImporteFecha = new Map<string, FacturaRecibida[]>();

  for (const f of activas) {
    const prov = normProveedor(f);
    if (!prov) continue;

    const num = f.numero_factura?.trim();
    if (num) {
      const k = `${prov}|${normNumero(num)}`;
      if (!porNumero.has(k)) porNumero.set(k, []);
      porNumero.get(k)!.push(f);
    }

    const kIF = `${prov}|${f.fecha_factura}|${f.total_a_pagar.toFixed(2)}`;
    if (!porImporteFecha.has(kIF)) porImporteFecha.set(kIF, []);
    porImporteFecha.get(kIF)!.push(f);
  }

  const result = new Map<string, InfoDuplicado>();

  const registrar = (grupo: FacturaRecibida[], motivo: MotivoDuplicado) => {
    if (grupo.length < 2) return;
    for (const f of grupo) {
      if (result.has(f.id)) continue; // 'numero' (más fuerte) tiene prioridad
      const otras = grupo.filter(o => o.id !== f.id);
      result.set(f.id, {
        otras,
        motivo,
        algunaVinculada: otras.some(o => o.presupuesto_pago_id !== null),
      });
    }
  };

  for (const grupo of porNumero.values()) registrar(grupo, 'numero');
  for (const grupo of porImporteFecha.values()) registrar(grupo, 'importe-fecha');

  return result;
}

export const MOTIVO_LABEL: Record<MotivoDuplicado, string> = {
  numero: 'mismo proveedor y nº de factura',
  'importe-fecha': 'mismo proveedor, fecha e importe',
};
