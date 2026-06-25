/// <reference types="vite/client" />
// Documentos justificativos de un proyecto (estudios de mercado, tasaciones…).
// El archivo se sube al bucket de Storage 'proyecto-documentos' vía REST y los
// metadatos van a la tabla proyecto_documentos.

import { SUPABASE_URL, SUPABASE_ANON_KEY, getJwt, sbHeaders as headers, sbUrl } from '@alsari/supabase-client';
import { resolveDocumentoSource } from './documentoUrl';

const BUCKET = 'proyecto-documentos';

export type CategoriaDocumento = 'estudio_mercado' | 'tasacion' | 'renta' | 'contrato' | 'otro';

export type ProyectoDocumento = {
  id: string;
  proyecto_id_ref: string;
  nombre: string;
  categoria: CategoriaDocumento;
  descripcion: string | null;
  archivo_url: string;
  storage_path: string;
  tamano_bytes: number | null;
  mime_type: string | null;
  created_at: string;
};

export const CATEGORIA_LABEL: Record<CategoriaDocumento, string> = {
  estudio_mercado: 'Estudio de mercado',
  tasacion:        'Tasación oficial',
  renta:           'Justificante de renta',
  contrato:        'Escritura / contrato',
  otro:            'Otro',
};

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, headers: headers() };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(sbUrl(path), init);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${method} ${path}: HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Acceso al documento (bucket privado + signed URLs) ────────────────────────
// El bucket `proyecto-documentos` pasa a PRIVADO (A2-bis). La fuente canónica es
// `storage_path`; `archivo_url` queda como fallback legado. La decisión pura vive
// en ./documentoUrl (testeable sin red); aquí va la parte async (firmado).
export { resolveDocumentoSource };
export type { DocumentoSource } from './documentoUrl';

const SIGNED_URL_TTL_SECONDS = 3600; // 1 h: suficiente para abrir/descargar

async function createSignedDocumentoUrl(path: string, expiresIn = SIGNED_URL_TTL_SECONDS): Promise<string> {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${encodedPath}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${getJwt()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Firma de URL: HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }
  const data = (await res.json()) as { signedURL?: string };
  if (!data.signedURL) throw new Error('Firma de URL: respuesta sin signedURL');
  return `${SUPABASE_URL}/storage/v1${data.signedURL}`;
}

// Punto ÚNICO para obtener la URL abrible de un documento. Async: el bucket
// privado exige firmar la URL en el momento (caduca ~1 h).
export async function getDocumentoUrl(
  doc: Pick<ProyectoDocumento, 'storage_path' | 'archivo_url'>,
): Promise<string | null> {
  const src = resolveDocumentoSource(doc);
  if (src.kind === 'signed') return createSignedDocumentoUrl(src.path);
  if (src.kind === 'legacy') return src.url;
  return null;
}

export async function getDocumentos(proyectoIdRef: string): Promise<ProyectoDocumento[]> {
  return req<ProyectoDocumento[]>(
    'GET',
    `proyecto_documentos?proyecto_id_ref=eq.${encodeURIComponent(proyectoIdRef)}&select=*&order=created_at.desc`,
  );
}

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // quitar acentos
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')                  // resto → _
    .replace(/_+/g, '_');
}

export async function uploadDocumento(
  proyectoIdRef: string,
  file: File,
  categoria: CategoriaDocumento,
  descripcion: string,
): Promise<ProyectoDocumento> {
  const path = `${encodeURIComponent(proyectoIdRef)}/${Date.now()}-${sanitizeFilename(file.name)}`;

  // 1. Subir el binario al bucket de Storage
  const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${getJwt()}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: file,
  });
  if (!uploadRes.ok) {
    const txt = await uploadRes.text().catch(() => '');
    throw new Error(`Subida a Storage: HTTP ${uploadRes.status} — ${txt.slice(0, 200)}`);
  }

  const archivo_url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

  // 2. Guardar los metadatos
  const res = await fetch(sbUrl('proyecto_documentos'), {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify({
      proyecto_id_ref: proyectoIdRef,
      nombre: file.name,
      categoria,
      descripcion: descripcion.trim() || null,
      archivo_url,
      storage_path: path,
      tamano_bytes: file.size,
      mime_type: file.type || null,
    }),
  });
  if (!res.ok) throw new Error(`Guardar documento: ${res.status} — ${(await res.text()).slice(0, 200)}`);
  const rows = await res.json() as ProyectoDocumento[];
  if (!rows[0]) throw new Error('Respuesta vacía al guardar el documento');
  return rows[0];
}

export async function deleteDocumento(doc: ProyectoDocumento): Promise<void> {
  // Borrar primero el binario de Storage; si falla, no dejamos huérfana la fila
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${doc.storage_path}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${getJwt()}` },
  }).catch(() => { /* si el objeto ya no existe, seguimos borrando la fila */ });

  await req('DELETE', `proyecto_documentos?id=eq.${doc.id}`);
}
