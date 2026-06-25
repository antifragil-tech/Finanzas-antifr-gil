// Supabase Edge Function: archivar-en-drive (PR D)
//
// Archiva en Google Drive (Service Account + Shared Drive) el PDF de una factura
// y sus justificantes de pago. Drive es ARCHIVO SECUNDARIO: si algo falla, los
// documentos siguen a salvo en Supabase Storage (fuente operativa). Idempotente:
// si `drive_file_id` ya existe, no re-sube. No toca OCR, pagos, estados ni
// trazabilidad. Carpetas: Contabilidad/{Sociedad}/{Año}/{Mes}/{fecha}_{prov}_{num}/
//
// Secrets requeridas (Supabase): GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY,
// GOOGLE_DRIVE_ROOT_FOLDER_ID. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ya existen.
//
// Despliegue:  supabase functions deploy archivar-en-drive

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// ── Estructura de carpetas / nombres (espejo de lib/drivePaths.ts) ─────────────
function clean(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
}
function token(s: string, max = 60): string {
  const c = clean(s).replace(/\s+/g, '_').replace(/_+/g, '_');
  return c.slice(0, max).replace(/_+$/, '') || 'NA';
}
function carpetaFacturaSegments(f: { sociedadNombre: string; fechaFactura: string; proveedorNombre: string; numeroFactura: string | null }): string[] {
  const fecha = f.fechaFactura || 'sin-fecha';
  return [
    'Contabilidad',
    clean(f.sociedadNombre) || 'Sin sociedad',
    fecha.slice(0, 4) || 'sin-fecha',
    fecha.slice(5, 7) || '00',
    `${fecha}_${token(f.proveedorNombre)}_${token(f.numeroFactura || 's-n', 30)}`,
  ];
}
const NOMBRE_FACTURA_PDF = 'factura.pdf';
function nombreJustificante(i: number, fechaPago: string | null): string {
  return `justificante_${String(i).padStart(2, '0')}_${(fechaPago || '').slice(0, 10) || 'sin-fecha'}.pdf`;
}

// ── Auth Service Account (JWT RS256 → access token) ────────────────────────────
function b64urlBytes(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const b64urlStr = (str: string) => b64urlBytes(new TextEncoder().encode(str));
function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
async function getDriveToken(): Promise<string> {
  const email = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL') ?? '';
  const key = (Deno.env.get('GOOGLE_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('Faltan secrets GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY');
  const now = Math.floor(Date.now() / 1000);
  const head = b64urlStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const pay = b64urlStr(JSON.stringify({
    iss: email, scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const cryptoKey = await crypto.subtle.importKey('pkcs8', pemToDer(key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(`${head}.${pay}`));
  const assertion = `${head}.${pay}.${b64urlBytes(new Uint8Array(sig))}`;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Token Drive: ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token as string;
}

// ── Helpers de Drive (Shared Drive → supportsAllDrives) ────────────────────────
async function findOrCreateFolder(tk: string, driveId: string, parentId: string, name: string): Promise<string> {
  const safe = name.replace(/'/g, "\\'");
  const q = encodeURIComponent(`name='${safe}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&corpora=drive&driveId=${driveId}&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id,name)`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${tk}` } });
  const j = await r.json();
  if (r.ok && j.files && j.files.length > 0) return j.files[0].id;
  const c = await fetch('https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true', {
    method: 'POST', headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  const cj = await c.json();
  if (!c.ok) throw new Error(`crear carpeta "${name}": ${JSON.stringify(cj).slice(0, 150)}`);
  return cj.id as string;
}
async function ensureFolderPath(tk: string, driveId: string, rootId: string, segments: string[]): Promise<string> {
  let parent = rootId;
  for (const seg of segments) parent = await findOrCreateFolder(tk, driveId, parent, seg);
  return parent;
}
async function uploadFile(tk: string, folderId: string, name: string, bytes: Uint8Array, mime: string): Promise<{ id: string; webViewLink: string }> {
  const boundary = '----alsari' + Date.now();
  const enc = new TextEncoder();
  const pre = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [folderId] })}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`);
  const post = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(pre.length + bytes.length + post.length);
  body.set(pre, 0); body.set(bytes, pre.length); body.set(post, pre.length + bytes.length);
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true', {
    method: 'POST', headers: { Authorization: `Bearer ${tk}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`subir "${name}": ${JSON.stringify(j).slice(0, 150)}`);
  return { id: j.id, webViewLink: j.webViewLink };
}

// deno-lint-ignore no-explicit-any
async function downloadStorage(supabase: any, path: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from('facturas').download(path);
  if (error || !data) throw new Error(`descarga Storage (${path}): ${error?.message ?? 'sin datos'}`);
  return new Uint8Array(await data.arrayBuffer());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const { factura_id } = await req.json().catch(() => ({}));
    if (!factura_id) return json({ error: 'factura_id requerido' }, 400);

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: f } = await supabase.from('facturas_recibidas').select('*').eq('id', factura_id).maybeSingle();
    if (!f) return json({ error: 'Factura no existe' }, 404);

    let socNombre = f.sociedad_id_ref as string;
    const { data: soc } = await supabase.from('sociedades').select('nombre').eq('id_ref', f.sociedad_id_ref).maybeSingle();
    if (soc?.nombre) socNombre = soc.nombre;

    const { data: pagos } = await supabase.from('factura_pagos').select('*')
      .eq('factura_id', factura_id).not('justificante_storage_path', 'is', null).order('fecha_pago', { ascending: true });

    const hayPdf = !!f.storage_path;
    if (!hayPdf && (!pagos || pagos.length === 0)) {
      return json({ ok: true, sin_documentos: true, mensaje: 'Sin documentos para archivar (sin PDF ni justificantes).' });
    }

    const rootId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID') ?? '';
    if (!rootId) return json({ error: 'Falta secret GOOGLE_DRIVE_ROOT_FOLDER_ID' }, 500);

    let tk: string;
    try { tk = await getDriveToken(); } catch (e) { return json({ error: `Drive auth: ${String(e)}` }, 502); }

    const segments = carpetaFacturaSegments({ sociedadNombre: socNombre, fechaFactura: f.fecha_factura, proveedorNombre: f.proveedor_nombre, numeroFactura: f.numero_factura });
    let folderId: string;
    try { folderId = await ensureFolderPath(tk, rootId, rootId, segments); }
    catch (e) { return json({ error: `Drive carpetas: ${String(e)}` }, 502); }

    const errores: string[] = [];
    let facturaRes: Record<string, unknown> | null = null;
    const pagosRes: Record<string, unknown>[] = [];

    // PDF de factura
    if (hayPdf && !f.drive_file_id) {
      try {
        const bytes = await downloadStorage(supabase, f.storage_path);
        const up = await uploadFile(tk, folderId, NOMBRE_FACTURA_PDF, bytes, 'application/pdf');
        await supabase.from('facturas_recibidas').update({
          drive_file_id: up.id, drive_folder_id: folderId, drive_web_link: up.webViewLink,
          drive_estado: 'sincronizado', drive_error: null, drive_synced_at: new Date().toISOString(),
        }).eq('id', factura_id);
        facturaRes = { estado: 'sincronizado', web_link: up.webViewLink };
      } catch (e) {
        await supabase.from('facturas_recibidas').update({ drive_estado: 'error', drive_error: String(e).slice(0, 300), drive_folder_id: folderId }).eq('id', factura_id);
        errores.push(`factura: ${String(e).slice(0, 150)}`);
        facturaRes = { estado: 'error' };
      }
    } else if (f.drive_file_id) {
      facturaRes = { estado: 'sincronizado', web_link: f.drive_web_link, ya_archivado: true };
    } else {
      facturaRes = { estado: 'sin_pdf' };
    }

    // Justificantes
    for (let i = 0; i < (pagos ?? []).length; i++) {
      const p = pagos[i];
      if (p.drive_file_id) { pagosRes.push({ id: p.id, estado: 'sincronizado', ya_archivado: true }); continue; }
      try {
        const bytes = await downloadStorage(supabase, p.justificante_storage_path);
        const up = await uploadFile(tk, folderId, nombreJustificante(i + 1, p.fecha_pago), bytes, p.justificante_mime_type || 'application/pdf');
        await supabase.from('factura_pagos').update({
          drive_file_id: up.id, drive_web_link: up.webViewLink, drive_estado: 'sincronizado',
          drive_error: null, drive_synced_at: new Date().toISOString(),
        }).eq('id', p.id);
        pagosRes.push({ id: p.id, estado: 'sincronizado', web_link: up.webViewLink });
      } catch (e) {
        await supabase.from('factura_pagos').update({ drive_estado: 'error', drive_error: String(e).slice(0, 300) }).eq('id', p.id);
        errores.push(`justificante ${p.id}: ${String(e).slice(0, 150)}`);
        pagosRes.push({ id: p.id, estado: 'error' });
      }
    }

    return json({ ok: errores.length === 0, folder_id: folderId, factura: facturaRes, pagos: pagosRes, errores });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
