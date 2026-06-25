// Decisión PURA (sin red) de dónde sale un documento de proyecto: storage_path
// (bucket privado → signed URL) > archivo_url (legado público) > nada. Vive aparte
// de documentosApi para testearse sin resolver el cliente Supabase ni la red. El
// firmado async (que necesita SUPABASE_URL + JWT) vive en documentosApi.getDocumentoUrl.

import type { ProyectoDocumento } from './documentosApi';

export type DocumentoSource =
  | { kind: 'signed'; path: string } // objeto en bucket privado → firmar URL temporal
  | { kind: 'legacy'; url: string }  // documento legado con URL pública directa
  | { kind: 'none' };                // sin documento

export function resolveDocumentoSource(
  doc: Pick<ProyectoDocumento, 'storage_path' | 'archivo_url'>,
): DocumentoSource {
  if (doc.storage_path) return { kind: 'signed', path: doc.storage_path };
  if (doc.archivo_url)  return { kind: 'legacy', url: doc.archivo_url };
  return { kind: 'none' };
}
