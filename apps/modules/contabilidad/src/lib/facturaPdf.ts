// Decisión PURA (sin red) de dónde sale el PDF de una factura.
// Único sitio con la prioridad: storage_path (bucket privado) > archivo_url
// (legado público) > nada. Vive aparte de contabilidadApi para poder testearse
// sin resolver el cliente Supabase ni tocar la red. El firmado async de la URL
// (que sí necesita SUPABASE_URL + JWT) vive en contabilidadApi.getFacturaPdfUrl.

import type { FacturaRecibida } from '@alsari/types';

export type FacturaPdfSource =
  | { kind: 'signed'; path: string } // PDF en el bucket privado → firmar URL temporal
  | { kind: 'legacy'; url: string }  // documento legado con URL pública directa
  | { kind: 'none' };                // sin PDF persistido

export function resolveFacturaPdfSource(
  factura: Pick<FacturaRecibida, 'storage_path' | 'archivo_url'>,
): FacturaPdfSource {
  if (factura.storage_path) return { kind: 'signed', path: factura.storage_path };
  if (factura.archivo_url)  return { kind: 'legacy', url: factura.archivo_url };
  return { kind: 'none' };
}
