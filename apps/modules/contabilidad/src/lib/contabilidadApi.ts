/// <reference types="vite/client" />
import type {
  MovimientoBancario,
  FacturaRecibida,
  FacturaEmitida,
  AsientoBorrador,
  AsientoOficial,
  PlanCuenta,
  ReglaCategorizacion,
  ReconciliacionItem,
  EstadoFacturaRecibida,
  ConfiguracionContabilidad,
  Contacto,
  SociedadContabilidad,
  CuentaBancariaSociedad,
  FacturaAprobacion,
  AccionAprobacion,
  FacturaPago,
  FacturaIncidencia,
  MetodoPago,
  TipoPago,
  ProveedorRegla,
  ExtractoBancario,
  ResultadoImportacion,
} from '@alsari/types';

// ── Supabase client ───────────────────────────────────────────────────────────

import {
  getJwt,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  sbHeaders as headers,
  sbUrl as url,
} from '@alsari/supabase-client';
import { resolveFacturaPdfSource } from './facturaPdf';

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, headers: headers() };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(url(path), init);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${method} ${path}: HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(url(path), {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path}: ${res.status} — ${(await res.text()).slice(0, 200)}`);
  const rows = (await res.json()) as T[];
  if (!Array.isArray(rows) || !rows[0]) throw new Error(`POST ${path}: respuesta vacía`);
  return rows[0];
}

// ── Movimientos bancarios ─────────────────────────────────────────────────────

export async function getMovimientos(params?: {
  sociedad?: string;
  desde?: string;
  hasta?: string;
  categoria?: string;
  revisado?: boolean;
  extracto?: string;
  limit?: number;
}): Promise<MovimientoBancario[]> {
  const q: string[] = ['select=*', 'order=fecha.desc'];
  if (params?.sociedad) q.push(`sociedad_id_ref=eq.${encodeURIComponent(params.sociedad)}`);
  if (params?.desde) q.push(`fecha=gte.${params.desde}`);
  if (params?.hasta) q.push(`fecha=lte.${params.hasta}`);
  if (params?.categoria) q.push(`categoria=eq.${encodeURIComponent(params.categoria)}`);
  if (params?.revisado !== undefined) q.push(`revisado=eq.${params.revisado}`);
  if (params?.extracto) q.push(`extracto_id=eq.${encodeURIComponent(params.extracto)}`);
  if (params?.limit) q.push(`limit=${params.limit}`);
  return req<MovimientoBancario[]>('GET', `movimientos_bancarios?${q.join('&')}`);
}

// ── Extractos bancarios (PR F) ────────────────────────────────────────────────
export type ExtractoImportPayload = {
  sociedad_id_ref: string;
  cuenta_bancaria_id: string | null;
  banco: string;
  iban: string;
  anio: number;
  mes: number;
  nombre_archivo: string;
  formato: 'csv' | 'xlsx';
  archivo_hash: string;
};

// Importación ATÓMICA vía RPC: crea el extracto + inserta movimientos no
// duplicados (on conflict por hash) + devuelve el resumen.
export async function importarExtractoBancario(
  extracto: ExtractoImportPayload,
  movimientos: unknown[],
): Promise<ResultadoImportacion> {
  const res = await fetch(url('rpc/importar_extracto_bancario'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ p_extracto: extracto, p_movimientos: movimientos }),
  });
  if (!res.ok)
    throw new Error(`importar_extracto: ${res.status} — ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<ResultadoImportacion>;
}

export async function getExtractos(sociedad?: string): Promise<ExtractoBancario[]> {
  const q = sociedad
    ? `select=*&sociedad_id_ref=eq.${encodeURIComponent(sociedad)}&order=created_at.desc`
    : 'select=*&order=created_at.desc';
  return req<ExtractoBancario[]>('GET', `extractos_bancarios?${q}`);
}

export async function getMovimientosByExtracto(extractoId: string): Promise<MovimientoBancario[]> {
  return req<MovimientoBancario[]>(
    'GET',
    `movimientos_bancarios?extracto_id=eq.${encodeURIComponent(extractoId)}&select=*&order=fecha`,
  );
}

// Hashes ya existentes para una sociedad (para estimar nuevos/duplicados en el preview).
export async function getHashesMovimientos(sociedad: string): Promise<string[]> {
  const rows = await req<{ hash: string | null }[]>(
    'GET',
    `movimientos_bancarios?sociedad_id_ref=eq.${encodeURIComponent(sociedad)}&hash=not.is.null&select=hash`,
  );
  return rows.map((r) => r.hash).filter((h): h is string => !!h);
}

// Deshacer importación: borra los movimientos del extracto y lo marca `deshecho`.
export async function deshacerImportacionExtracto(extractoId: string): Promise<ExtractoBancario> {
  const res = await fetch(url('rpc/deshacer_importacion_extracto'), {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify({ p_extracto_id: extractoId }),
  });
  if (!res.ok)
    throw new Error(`deshacer_extracto: ${res.status} — ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as ExtractoBancario | ExtractoBancario[];
  return Array.isArray(data) ? data[0]! : data;
}

export async function insertMovimientos(
  items: Omit<MovimientoBancario, 'id' | 'importado_at' | 'created_at'>[],
): Promise<MovimientoBancario[]> {
  const res = await fetch(url('movimientos_bancarios'), {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(items),
  });
  if (!res.ok)
    throw new Error(`insertMovimientos: ${res.status} — ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<MovimientoBancario[]>;
}

export async function updateMovimiento(
  id: string,
  data: Partial<
    Pick<
      MovimientoBancario,
      | 'categoria'
      | 'subcategoria'
      | 'revisado'
      | 'notas'
      | 'entidad_contraparte'
      | 'es_intragrupo'
      | 'proyecto_id_ref'
    >
  >,
): Promise<void> {
  await req<void>('PATCH', `movimientos_bancarios?id=eq.${encodeURIComponent(id)}`, data);
}

export async function deleteMovimiento(id: string): Promise<void> {
  await req<void>('DELETE', `movimientos_bancarios?id=eq.${encodeURIComponent(id)}`);
}

// ── Facturas recibidas ────────────────────────────────────────────────────────

// ── Acceso al PDF de una factura (bucket privado + signed URLs) ────────────────
// El bucket `facturas` es PRIVADO. La fuente canónica del PDF es `storage_path`;
// `archivo_url` queda solo como fallback de documentos legados (URL pública).

const FACTURAS_BUCKET = 'facturas';
const SIGNED_URL_TTL_SECONDS = 3600; // 1 h: suficiente para una sesión de visor

// La decisión PURA de fuente (storage_path > archivo_url > nada) vive en
// ./facturaPdf para poder testearse sin red; aquí se re-exporta y se reutiliza.
export { resolveFacturaPdfSource };
export type { FacturaPdfSource } from './facturaPdf';

// Firma una URL temporal para un objeto del bucket privado `facturas`.
async function createSignedFacturaUrl(
  path: string,
  expiresIn = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${FACTURAS_BUCKET}/${encodedPath}`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${getJwt()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn }),
    },
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Firma de URL: HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }
  const data = (await res.json()) as { signedURL?: string };
  if (!data.signedURL) throw new Error('Firma de URL: respuesta sin signedURL');
  return `${SUPABASE_URL}/storage/v1${data.signedURL}`;
}

// Punto ÚNICO para obtener la URL abrible del PDF de una factura.
// Es async porque el bucket privado exige firmar la URL en el momento.
export async function getFacturaPdfUrl(
  factura: Pick<FacturaRecibida, 'storage_path' | 'archivo_url'>,
): Promise<string | null> {
  const src = resolveFacturaPdfSource(factura);
  if (src.kind === 'signed') return createSignedFacturaUrl(src.path);
  if (src.kind === 'legacy') return src.url;
  return null;
}

export async function getFacturasRecibidas(sociedad?: string): Promise<FacturaRecibida[]> {
  const q = sociedad
    ? `select=*&sociedad_id_ref=eq.${encodeURIComponent(sociedad)}&order=fecha_factura.desc`
    : 'select=*&order=fecha_factura.desc';
  return req<FacturaRecibida[]>('GET', `facturas_recibidas?${q}`);
}

export async function getFacturaById(id: string): Promise<FacturaRecibida | null> {
  const rows = await req<FacturaRecibida[]>(
    'GET',
    `facturas_recibidas?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
  );
  return rows[0] ?? null;
}

// Cambia la sociedad receptora de forma ATÓMICA y AUDITADA (RPC security definer:
// actualiza sociedad_id_ref, pone sociedad_validada=true e inserta evento
// `cambia_sociedad` con sociedad/cif anterior y nuevo). PR D.1.
export async function cambiarSociedadFactura(
  facturaId: string,
  sociedadId: string,
  comentario?: string | null,
): Promise<FacturaRecibida> {
  const res = await fetch(url('rpc/cambiar_sociedad_factura'), {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify({
      p_factura_id: facturaId,
      p_sociedad_id: sociedadId,
      p_comentario: comentario ?? null,
    }),
  });
  if (!res.ok)
    throw new Error(`cambiar_sociedad: ${res.status} — ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as FacturaRecibida | FacturaRecibida[];
  return Array.isArray(data) ? data[0]! : data;
}

export async function insertFacturaRecibida(
  data: Omit<FacturaRecibida, 'id' | 'created_at' | 'updated_at'>,
): Promise<FacturaRecibida> {
  return post<FacturaRecibida>('facturas_recibidas', data);
}

export async function updateFacturaRecibida(
  id: string,
  data: Partial<Omit<FacturaRecibida, 'id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  await req<void>('PATCH', `facturas_recibidas?id=eq.${encodeURIComponent(id)}`, {
    ...data,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteFacturaRecibida(
  id: string,
  presupuestoPagoId?: string | null,
): Promise<void> {
  if (presupuestoPagoId) {
    await req('DELETE', `presupuesto_pagos?id=eq.${encodeURIComponent(presupuestoPagoId)}`).catch(
      () => {},
    );
  }
  await req<void>('DELETE', `facturas_recibidas?id=eq.${encodeURIComponent(id)}`);
}

// ── Sociedades (ficha completa) ───────────────────────────────────────────────

export async function getSociedadesContabilidad(): Promise<SociedadContabilidad[]> {
  const rows = await req<
    Array<{
      id_ref: string;
      nombre: string;
      cif: string | null;
      domicilio: string | null;
      localidad: string | null;
      codigo_postal: string | null;
      pais: string | null;
      email: string | null;
      telefono: string | null;
      logo_url: string | null;
    }>
  >(
    'GET',
    'sociedades?select=id_ref,nombre,cif,domicilio,localidad,codigo_postal,pais,email,telefono,logo_url&order=nombre',
  );
  return rows.map((r) => ({
    id: r.id_ref,
    nombre: r.nombre,
    cif: r.cif,
    domicilio: r.domicilio,
    localidad: r.localidad,
    codigo_postal: r.codigo_postal,
    pais: r.pais,
    email: r.email,
    telefono: r.telefono,
    logo_url: r.logo_url,
  }));
}

export async function updateSociedad(
  idRef: string,
  data: Partial<
    Pick<
      SociedadContabilidad,
      | 'nombre'
      | 'cif'
      | 'domicilio'
      | 'localidad'
      | 'codigo_postal'
      | 'pais'
      | 'email'
      | 'telefono'
      | 'logo_url'
    >
  >,
): Promise<void> {
  await req<void>('PATCH', `sociedades?id_ref=eq.${encodeURIComponent(idRef)}`, data);
}

// ── Cuentas bancarias por sociedad ────────────────────────────────────────────

export async function getCuentasBancarias(
  sociedadIdRef: string,
): Promise<CuentaBancariaSociedad[]> {
  return req<CuentaBancariaSociedad[]>(
    'GET',
    `cuentas_bancarias_sociedad?sociedad_id_ref=eq.${encodeURIComponent(sociedadIdRef)}&activa=eq.true&order=alias`,
  );
}

export async function createCuentaBancaria(
  data: Omit<CuentaBancariaSociedad, 'id' | 'created_at'>,
): Promise<CuentaBancariaSociedad> {
  return post<CuentaBancariaSociedad>('cuentas_bancarias_sociedad', data);
}

export async function deleteCuentaBancaria(id: string): Promise<void> {
  await req<void>('DELETE', `cuentas_bancarias_sociedad?id=eq.${encodeURIComponent(id)}`);
}

// ── Facturas emitidas ─────────────────────────────────────────────────────────

export async function getFacturasEmitidas(sociedad?: string): Promise<FacturaEmitida[]> {
  const q = sociedad
    ? `select=*&sociedad_id_ref=eq.${encodeURIComponent(sociedad)}&order=fecha_factura.desc`
    : 'select=*&order=fecha_factura.desc';
  return req<FacturaEmitida[]>('GET', `facturas_emitidas?${q}`);
}

export async function insertFacturaEmitida(
  data: Omit<FacturaEmitida, 'id' | 'created_at' | 'updated_at'>,
): Promise<FacturaEmitida> {
  return post<FacturaEmitida>('facturas_emitidas', data);
}

export async function updateFacturaEmitida(
  id: string,
  data: Partial<Omit<FacturaEmitida, 'id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  await req<void>('PATCH', `facturas_emitidas?id=eq.${encodeURIComponent(id)}`, {
    ...data,
    updated_at: new Date().toISOString(),
  });
}

// ── Asientos borrador ─────────────────────────────────────────────────────────

export async function getAsientosBorrador(
  sociedad?: string,
  desde?: string,
  hasta?: string,
): Promise<AsientoBorrador[]> {
  const q: string[] = ['select=*', 'order=fecha.desc'];
  if (sociedad) q.push(`sociedad_id_ref=eq.${encodeURIComponent(sociedad)}`);
  if (desde) q.push(`fecha=gte.${desde}`);
  if (hasta) q.push(`fecha=lte.${hasta}`);
  return req<AsientoBorrador[]>('GET', `asientos_borrador?${q.join('&')}`);
}

export async function insertAsientoBorrador(
  data: Omit<AsientoBorrador, 'id' | 'created_at' | 'updated_at'>,
): Promise<AsientoBorrador> {
  return post<AsientoBorrador>('asientos_borrador', data);
}

export async function updateAsientoBorrador(
  id: string,
  data: Partial<
    Pick<AsientoBorrador, 'estado' | 'lineas' | 'total_debe' | 'total_haber' | 'concepto'>
  >,
): Promise<void> {
  await req<void>('PATCH', `asientos_borrador?id=eq.${encodeURIComponent(id)}`, {
    ...data,
    updated_at: new Date().toISOString(),
  });
}

// ── Asientos oficiales ────────────────────────────────────────────────────────

export async function getAsientosOficiales(
  sociedad?: string,
  desde?: string,
  hasta?: string,
): Promise<AsientoOficial[]> {
  const q: string[] = ['select=*', 'order=fecha.desc'];
  if (sociedad) q.push(`sociedad_id_ref=eq.${encodeURIComponent(sociedad)}`);
  if (desde) q.push(`fecha=gte.${desde}`);
  if (hasta) q.push(`fecha=lte.${hasta}`);
  return req<AsientoOficial[]>('GET', `asientos_oficiales?${q.join('&')}`);
}

export async function insertAsientosOficiales(
  items: Omit<AsientoOficial, 'id' | 'created_at'>[],
): Promise<AsientoOficial[]> {
  const res = await fetch(url('asientos_oficiales'), {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(items),
  });
  if (!res.ok)
    throw new Error(`insertAsientosOficiales: ${res.status} — ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<AsientoOficial[]>;
}

// ── Plan de cuentas ───────────────────────────────────────────────────────────

export async function getPlanCuentas(sociedad: string): Promise<PlanCuenta[]> {
  return req<PlanCuenta[]>(
    'GET',
    `plan_cuentas?sociedad_id_ref=eq.${encodeURIComponent(sociedad)}&select=*&order=codigo`,
  );
}

export async function insertCuenta(
  data: Omit<PlanCuenta, 'id' | 'created_at'>,
): Promise<PlanCuenta> {
  return post<PlanCuenta>('plan_cuentas', data);
}

// ── Reglas de categorización ──────────────────────────────────────────────────

export async function getReglas(): Promise<ReglaCategorizacion[]> {
  return req<ReglaCategorizacion[]>(
    'GET',
    'reglas_categorizacion?select=*&activa=eq.true&order=prioridad.desc',
  );
}

export async function incrementarConfirmaciones(id: string, confirmaciones: number): Promise<void> {
  await req<void>('PATCH', `reglas_categorizacion?id=eq.${encodeURIComponent(id)}`, {
    confirmaciones,
  });
}

// ── Reconciliación ────────────────────────────────────────────────────────────

export async function getReconciliacion(
  sociedad: string,
  periodo: string,
): Promise<ReconciliacionItem[]> {
  return req<ReconciliacionItem[]>(
    'GET',
    `reconciliacion_log?sociedad_id_ref=eq.${encodeURIComponent(sociedad)}&periodo=eq.${periodo}&select=*&order=created_at.desc`,
  );
}

export async function insertReconciliacionItems(
  items: Omit<ReconciliacionItem, 'id' | 'created_at'>[],
): Promise<void> {
  await fetch(url('reconciliacion_log'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(items),
  });
}

export async function resolverItem(id: string, notas: string): Promise<void> {
  await req<void>('PATCH', `reconciliacion_log?id=eq.${encodeURIComponent(id)}`, {
    resuelto: true,
    resolucion_notas: notas,
  });
}

// ── OCR + Workflow ────────────────────────────────────────────────────────────

export async function procesarFacturaPdf(file: File, sociedadId: string): Promise<FacturaRecibida> {
  const form = new FormData();
  form.append('file', file);
  form.append('sociedad_id', sociedadId);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/procesar-factura`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${getJwt()}` },
    body: form,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`procesarFactura: ${res.status} — ${txt.slice(0, 300)}`);
  }
  const data = (await res.json()) as { factura: FacturaRecibida };
  return data.factura;
}

// ── Archivo en Google Drive (PR D) ────────────────────────────────────────────
export type ArchivarDriveResultado = {
  ok: boolean;
  sin_documentos?: boolean;
  mensaje?: string;
  folder_id?: string;
  factura?: { estado: string; web_link?: string; ya_archivado?: boolean } | null;
  pagos?: { id: string; estado: string; web_link?: string; ya_archivado?: boolean }[];
  errores?: string[];
  error?: string;
};

// Archiva el PDF de la factura + sus justificantes en Google Drive (Edge Function
// con Service Account + Shared Drive). Idempotente. Drive es secundario: si falla,
// no rompe nada (los documentos siguen en Supabase Storage).
export async function archivarFacturaEnDrive(facturaId: string): Promise<ArchivarDriveResultado> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/archivar-en-drive`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${getJwt()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ factura_id: facturaId }),
  });
  const data = (await res
    .json()
    .catch(() => ({ error: `HTTP ${res.status}` }))) as ArchivarDriveResultado;
  if (!res.ok) throw new Error(data.error || `archivar-en-drive: HTTP ${res.status}`);
  return data;
}

export async function avanzarEstadoFactura(
  id: string,
  nuevoEstado: EstadoFacturaRecibida,
  updates?: Partial<Omit<FacturaRecibida, 'id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  await req<void>('PATCH', `facturas_recibidas?id=eq.${encodeURIComponent(id)}`, {
    ...updates,
    estado: nuevoEstado,
    updated_at: new Date().toISOString(),
  });
}

// ── Auditoría de transiciones (factura_aprobaciones) ──────────────────────────

export async function getAprobaciones(facturaId: string): Promise<FacturaAprobacion[]> {
  return req<FacturaAprobacion[]>(
    'GET',
    `factura_aprobaciones?factura_id=eq.${encodeURIComponent(facturaId)}&order=created_at.asc&select=*`,
  );
}

// Cambia el estado de la factura E inserta el evento de auditoría de forma
// ATÓMICA (una sola transacción en la RPC security definer). El actor se deriva
// de la sesión en el servidor; el cliente no puede falsificarlo.
export async function avanzarEstadoFacturaConAuditoria(args: {
  facturaId: string;
  accion: AccionAprobacion;
  comentario?: string | null;
  motivoRechazo?: string | null;
}): Promise<FacturaRecibida> {
  const res = await fetch(url('rpc/avanzar_estado_factura_con_auditoria'), {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify({
      p_factura_id: args.facturaId,
      p_accion: args.accion,
      p_comentario: args.comentario ?? null,
      p_motivo_rechazo: args.motivoRechazo ?? null,
    }),
  });
  if (!res.ok)
    throw new Error(`avanzar_estado: ${res.status} — ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as FacturaRecibida | FacturaRecibida[];
  return Array.isArray(data) ? data[0]! : data;
}

// ── Pagos de factura (libro de tesorería) e incidencias ───────────────────────

export async function getFacturaPagos(facturaId: string): Promise<FacturaPago[]> {
  return req<FacturaPago[]>(
    'GET',
    `factura_pagos?factura_id=eq.${encodeURIComponent(facturaId)}&order=fecha_pago.asc,created_at.asc&select=*`,
  );
}

export async function getFacturaIncidencias(facturaId: string): Promise<FacturaIncidencia[]> {
  return req<FacturaIncidencia[]>(
    'GET',
    `factura_incidencias?factura_id=eq.${encodeURIComponent(facturaId)}&order=created_at.desc&select=*`,
  );
}

export type JustificanteSubido = {
  storage_path: string;
  nombre: string;
  mime: string;
  size: number;
};

// Sube el justificante al bucket PRIVADO `facturas` en la ruta acotada por la
// política RLS: recibidas/{factura_id}/pagos/{pago_id}/{filename}. Sin upsert:
// cada pago tiene id único → ruta única. Las correcciones son un pago nuevo.
export async function uploadJustificante(
  facturaId: string,
  pagoId: string,
  file: File,
): Promise<JustificanteSubido> {
  const safeName = file.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `recibidas/${facturaId}/pagos/${pagoId}/${safeName}`;
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${FACTURAS_BUCKET}/${encoded}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${getJwt()}`,
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Subida de justificante: HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }
  return {
    storage_path: path,
    nombre: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
  };
}

// Firma una URL temporal del justificante (bucket privado `facturas`).
export async function getJustificanteUrl(storagePath: string): Promise<string> {
  return createSignedFacturaUrl(storagePath);
}

export type RegistrarPagoResultado = {
  pago_id: string;
  estado_factura: string;
  total_pagado: number;
  pendiente: number;
  transiciona: boolean;
};

// Registra un pago de forma ATÓMICA (pago + auditoría + incidencia si aplica +
// transición a `pagada` si corresponde), con el actor derivado en el servidor.
// El `pagoId` lo genera el cliente para casar con la ruta del justificante.
export async function registrarPagoFactura(args: {
  pagoId: string;
  facturaId: string;
  importe: number;
  fechaPago: string;
  metodoPago: MetodoPago;
  tipoPago: TipoPago;
  justificante?: JustificanteSubido | null;
  comentario?: string | null;
}): Promise<RegistrarPagoResultado> {
  const j = args.justificante ?? null;
  const res = await fetch(url('rpc/registrar_pago_factura'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      p_pago_id: args.pagoId,
      p_factura_id: args.facturaId,
      p_importe: args.importe,
      p_fecha_pago: args.fechaPago,
      p_metodo_pago: args.metodoPago,
      p_tipo_pago: args.tipoPago,
      p_justificante_storage_path: j?.storage_path ?? null,
      p_justificante_nombre: j?.nombre ?? null,
      p_justificante_mime: j?.mime ?? null,
      p_justificante_size: j?.size ?? null,
      p_comentario: args.comentario ?? null,
    }),
  });
  if (!res.ok)
    throw new Error(`registrar_pago: ${res.status} — ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<RegistrarPagoResultado>;
}

export async function resolverIncidenciaFactura(
  incidenciaId: string,
  comentario?: string | null,
): Promise<FacturaIncidencia> {
  const res = await fetch(url('rpc/resolver_incidencia_factura'), {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify({ p_incidencia_id: incidenciaId, p_comentario: comentario ?? null }),
  });
  if (!res.ok)
    throw new Error(`resolver_incidencia: ${res.status} — ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as FacturaIncidencia | FacturaIncidencia[];
  return Array.isArray(data) ? data[0]! : data;
}

// ── Configuración ─────────────────────────────────────────────────────────────

export async function getConfiguracion(): Promise<ConfiguracionContabilidad> {
  const rows = await req<ConfiguracionContabilidad[]>(
    'GET',
    'configuracion_contabilidad?id=eq.default&select=*',
  );
  if (!rows[0]) throw new Error('No hay configuración en BD');
  return rows[0];
}

export async function updateConfiguracion(
  data: Partial<Omit<ConfiguracionContabilidad, 'id' | 'updated_at'>>,
): Promise<void> {
  await req<void>('PATCH', 'configuracion_contabilidad?id=eq.default', {
    ...data,
    updated_at: new Date().toISOString(),
  });
}

// ── Aprendizaje OCR ───────────────────────────────────────────────────────────

export async function registrarCorreccionOcr(campo: string, esCorrecta: boolean): Promise<void> {
  await fetch(url('rpc/registrar_correccion_ocr'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ p_campo: campo, p_correcta: esCorrecta }),
  });
}

// ── Contactos ─────────────────────────────────────────────────────────────────

export async function getContactos(tipo?: Contacto['tipo']): Promise<Contacto[]> {
  const q = tipo
    ? `select=*&tipo=eq.${encodeURIComponent(tipo)}&order=nombre`
    : 'select=*&order=nombre';
  return req<Contacto[]>('GET', `contactos?${q}`);
}

export async function insertContacto(
  data: Omit<Contacto, 'id' | 'created_at' | 'updated_at'>,
): Promise<Contacto> {
  return post<Contacto>('contactos', data);
}

export async function updateContacto(
  id: string,
  data: Partial<Omit<Contacto, 'id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  await req<void>('PATCH', `contactos?id=eq.${encodeURIComponent(id)}`, {
    ...data,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteContacto(id: string): Promise<void> {
  await req<void>('DELETE', `contactos?id=eq.${encodeURIComponent(id)}`);
}

// ── Reglas de proveedor (PR E) ────────────────────────────────────────────────
// Config operativa por (contacto, sociedad). SOLO sugerencias: no automatiza nada.

export type NuevaProveedorRegla = Partial<
  Omit<ProveedorRegla, 'id' | 'created_at' | 'updated_at'>
> & { contacto_id: string };

export async function getProveedorReglas(): Promise<ProveedorRegla[]> {
  return req<ProveedorRegla[]>('GET', 'proveedores_reglas?select=*&order=created_at.desc');
}

export async function getReglasByContacto(contactoId: string): Promise<ProveedorRegla[]> {
  return req<ProveedorRegla[]>(
    'GET',
    `proveedores_reglas?contacto_id=eq.${encodeURIComponent(contactoId)}&select=*&order=created_at.desc`,
  );
}

export async function insertProveedorRegla(data: NuevaProveedorRegla): Promise<ProveedorRegla> {
  return post<ProveedorRegla>('proveedores_reglas', data);
}

export async function updateProveedorRegla(
  id: string,
  data: Partial<Omit<ProveedorRegla, 'id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  await req<void>('PATCH', `proveedores_reglas?id=eq.${encodeURIComponent(id)}`, data);
}

export async function deleteProveedorRegla(id: string): Promise<void> {
  await req<void>('DELETE', `proveedores_reglas?id=eq.${encodeURIComponent(id)}`);
}

// ── Vinculación factura → partida de presupuesto ──────────────────────────────
// Flujo: seleccionar partida → crear pago automático → enlazar FKs

export type PartidaParaVincular = {
  id: string;
  presupuesto_id: string;
  capitulo_id: string;
  descripcion: string;
  importe_presupuestado: number;
  tipo_iva: number;
  proveedor_esperado: string | null;
  presupuesto_nombre: string;
  proyecto_nombre: string | null;
  capitulo_nombre: string;
};

export async function searchPartidasPresupuesto(query?: string): Promise<PartidaParaVincular[]> {
  const [partidas, capitulos, presupuestos] = await Promise.all([
    req<
      Array<{
        id: string;
        presupuesto_id: string;
        capitulo_id: string;
        descripcion: string;
        importe_presupuestado: number;
        tipo_iva: number;
        proveedor_esperado: string | null;
      }>
    >(
      'GET',
      'presupuesto_partidas?select=id,presupuesto_id,capitulo_id,descripcion,importe_presupuestado,tipo_iva,proveedor_esperado&order=created_at.asc&limit=500',
    ),
    req<Array<{ id: string; nombre: string }>>('GET', 'presupuesto_capitulos?select=id,nombre'),
    req<Array<{ id: string; nombre: string; proyecto_nombre: string | null }>>(
      'GET',
      'presupuestos?select=id,nombre,proyecto_nombre',
    ),
  ]);

  const capMap = new Map(capitulos.map((c) => [c.id, c]));
  const presupMap = new Map(presupuestos.map((p) => [p.id, p]));

  const results = partidas.map((r) => ({
    id: r.id,
    presupuesto_id: r.presupuesto_id,
    capitulo_id: r.capitulo_id,
    descripcion: r.descripcion,
    importe_presupuestado: r.importe_presupuestado,
    tipo_iva: r.tipo_iva,
    proveedor_esperado: r.proveedor_esperado,
    presupuesto_nombre: presupMap.get(r.presupuesto_id)?.nombre ?? '—',
    proyecto_nombre: presupMap.get(r.presupuesto_id)?.proyecto_nombre ?? null,
    capitulo_nombre: capMap.get(r.capitulo_id)?.nombre ?? '—',
  }));

  if (!query) return results;
  const q = query.toLowerCase();
  return results.filter(
    (r) =>
      r.presupuesto_nombre.toLowerCase().includes(q) ||
      r.descripcion.toLowerCase().includes(q) ||
      r.capitulo_nombre.toLowerCase().includes(q) ||
      (r.proyecto_nombre?.toLowerCase().includes(q) ?? false) ||
      (r.proveedor_esperado?.toLowerCase().includes(q) ?? false),
  );
}

export type PagoCreado = { id: string };

export async function crearPagoDesdeFactura(
  partida: PartidaParaVincular,
  factura: {
    id: string;
    base_imponible: number;
    tipo_iva: number;
    fecha_factura: string;
    fecha_vencimiento: string | null;
    numero_factura: string | null;
    proveedor_nombre: string;
    estado: string;
  },
): Promise<PagoCreado> {
  const fechaPago = factura.fecha_vencimiento ?? factura.fecha_factura;
  const descripcion = factura.numero_factura
    ? `Fra. ${factura.numero_factura} — ${factura.proveedor_nombre}`
    : factura.proveedor_nombre;
  const estadoPago = factura.estado === 'pagada' ? 'pagado' : 'pendiente';

  // Crear pago
  const res = await fetch(url('presupuesto_pagos'), {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify({
      presupuesto_id: partida.presupuesto_id,
      partida_id: partida.id,
      descripcion,
      importe: factura.base_imponible,
      tipo_iva: factura.tipo_iva,
      fecha_prevista: fechaPago,
      tipo_flujo: 'gasto',
      estado: estadoPago,
      factura_recibida_id: factura.id,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`POST presupuesto_pagos: ${res.status} — ${txt.slice(0, 300)}`);
  }
  const rows = (await res.json()) as PagoCreado[];
  if (!Array.isArray(rows) || !rows[0]?.id)
    throw new Error('No se pudo crear el pago (respuesta vacía)');
  const pago = rows[0];

  // Actualizar factura con el FK inverso
  await req('PATCH', `facturas_recibidas?id=eq.${factura.id}`, {
    presupuesto_pago_id: pago.id,
    updated_at: new Date().toISOString(),
  });

  return pago;
}

export async function marcarPagoComoPagado(pagoId: string): Promise<void> {
  await req('PATCH', `presupuesto_pagos?id=eq.${pagoId}`, { estado: 'pagado' });
}

export async function desvincularFacturaDePresupuesto(
  facturaId: string,
  pagoId: string,
): Promise<void> {
  await Promise.all([
    req('PATCH', `facturas_recibidas?id=eq.${facturaId}`, {
      presupuesto_pago_id: null,
      updated_at: new Date().toISOString(),
    }),
    req('PATCH', `presupuesto_pagos?id=eq.${pagoId}`, { factura_recibida_id: null }),
  ]);
}

// ── Auth: usuario actual ──────────────────────────────────────────────────────

export async function getCurrentUserEmail(): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${getJwt()}` },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { email?: string };
    return user.email ?? null;
  } catch {
    return null;
  }
}
