'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  borrarLote,
  construirPlan,
  esTipoReporte,
  guardarLote,
  leerLote,
  loteValido,
} from './importacionWeb';
import { cuentasTesoreriaPorTipo } from './fuenteDatos';

/**
 * Server actions de la importación de reportes y la conciliación pago→factura.
 * Mismo patrón que acciones.ts: PostgREST con service_role SOLO en servidor,
 * validación aquí, errores legibles vía redirect (?error=) — nunca crash, y el
 * build de CI sin secrets sigue verde (las acciones solo corren en request).
 */

const URL_BASE = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

const RUTA = '/tesoreria/importar';
const TAMANO_MAXIMO = 4 * 1024 * 1024; // 4 MB

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo);
  return typeof v === 'string' ? v.trim() : '';
}

function esUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** Redirige a la página de importación con aviso. Nunca retorna. */
function volver(aviso: { ok?: string; error?: string; lote?: string }): never {
  const params = new URLSearchParams();
  if (aviso.lote) params.set('lote', aviso.lote);
  if (aviso.ok) params.set('ok', aviso.ok);
  if (aviso.error) params.set('error', aviso.error);
  redirect(`${RUTA}?${params.toString()}`);
}

function sinEntorno(): boolean {
  return !URL_BASE || !SERVICE_KEY;
}

async function api(
  metodo: 'GET' | 'POST' | 'PATCH',
  recurso: string,
  cuerpo?: unknown,
  prefer?: string,
): Promise<{ ok: boolean; datos: unknown[]; error: string }> {
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/${recurso}`, {
      method: metodo,
      headers: {
        apikey: SERVICE_KEY ?? '',
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: prefer ?? 'return=representation',
      },
      ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}),
      cache: 'no-store',
    });
    if (!res.ok) {
      const detalle = (await res.text()).slice(0, 200);
      return { ok: false, datos: [], error: `Supabase HTTP ${res.status}: ${detalle}` };
    }
    const textoRes = await res.text();
    return { ok: true, datos: textoRes ? (JSON.parse(textoRes) as unknown[]) : [], error: '' };
  } catch (e) {
    return { ok: false, datos: [], error: `Error de red: ${String(e)}` };
  }
}

// ---------------------------------------------------------------------------
// Subir y previsualizar
// ---------------------------------------------------------------------------

/** Guarda el CSV como lote temporal (tmpdir, nunca el repo) y abre la preview. */
export async function subirReporte(fd: FormData): Promise<void> {
  const tipo = texto(fd, 'tipo');
  const archivo = fd.get('archivo');

  if (!esTipoReporte(tipo)) volver({ error: 'Tipo de reporte no reconocido.' });
  if (!(archivo instanceof File) || archivo.size === 0)
    volver({ error: 'Selecciona un archivo CSV exportado (no llegó ningún archivo).' });
  if (archivo.size > TAMANO_MAXIMO)
    volver({ error: 'Archivo demasiado grande (máx. 4 MB): trocea el export.' });

  const csv = await archivo.text();
  if (!csv.trim().includes('\n'))
    volver({ error: 'El archivo no parece un CSV con cabecera y filas.' });

  const lote = await guardarLote({
    tipo,
    csv,
    nombreArchivo: archivo.name,
    subidoEn: new Date().toISOString(),
  });
  redirect(`${RUTA}?lote=${lote}`);
}

/** Descarta un lote sin aplicar nada. */
export async function descartarLote(fd: FormData): Promise<void> {
  const lote = texto(fd, 'lote');
  if (loteValido(lote)) await borrarLote(lote);
  volver({ ok: 'Lote descartado sin aplicar.' });
}

// ---------------------------------------------------------------------------
// Aplicar (insertar con claves deterministas — re-importar no duplica)
// ---------------------------------------------------------------------------

export async function aplicarLote(fd: FormData): Promise<void> {
  const loteId = texto(fd, 'lote');
  if (!loteValido(loteId)) volver({ error: 'Lote no válido.' });
  if (sinEntorno())
    volver({
      lote: loteId,
      error: 'Sin conexión a Supabase: entorno no configurado (modo demo, solo lectura).',
    });

  const lote = await leerLote(loteId);
  if (!lote)
    volver({ error: 'El lote caducó (reinicio del servidor): vuelve a subir el archivo.' });

  const plan = construirPlan(lote.tipo, lote.csv, await cuentasTesoreriaPorTipo());
  if (plan.vista.length === 0)
    volver({ lote: loteId, error: 'El lote no tiene filas válidas que aplicar.' });

  let insertadas = 0;
  let omitidas = 0;
  for (const grupo of plan.inserciones) {
    if (grupo.filas.length === 0) continue;
    // on_conflict=id + ignore-duplicates ⇒ idempotencia real: la clave uuid v5
    // es determinista por contenido, re-importar el mismo archivo no duplica.
    const r = await api(
      'POST',
      `${grupo.tabla}?on_conflict=id`,
      grupo.filas,
      'return=representation,resolution=ignore-duplicates',
    );
    if (!r.ok) volver({ lote: loteId, error: `Insertando en ${grupo.tabla}: ${r.error}` });
    insertadas += r.datos.length;
    omitidas += grupo.filas.length - r.datos.length;
  }

  await borrarLote(loteId);
  revalidatePath('/tesoreria');
  revalidatePath('/rentabilidad');
  revalidatePath(RUTA);
  volver({
    ok: `Importación aplicada: ${insertadas} fila(s) nuevas, ${omitidas} ya existentes omitidas.`,
  });
}

// ---------------------------------------------------------------------------
// Conciliación: pago saliente del banco ↔ factura recibida
// ---------------------------------------------------------------------------

export async function conciliarPago(fd: FormData): Promise<void> {
  const movimientoId = texto(fd, 'movimiento_id');
  const facturaId = texto(fd, 'factura_id');

  if (!esUuid(movimientoId) || !esUuid(facturaId))
    volver({ error: 'Conciliación: identificadores no válidos.' });
  if (sinEntorno())
    volver({ error: 'Sin conexión a Supabase: entorno no configurado (modo demo).' });

  // Doble vínculo + estado: la factura queda pagada con su movimiento asociado.
  const rMov = await api(
    'PATCH',
    `movimientos_bancarios?id=eq.${movimientoId}&factura_recibida_id=is.null`,
    { factura_recibida_id: facturaId, revisado: true },
  );
  if (!rMov.ok) volver({ error: `Conciliación (movimiento): ${rMov.error}` });
  if (rMov.datos.length === 0)
    volver({ error: 'Ese pago ya estaba conciliado con otra factura (recarga la página).' });

  const rFac = await api('PATCH', `facturas_recibidas?id=eq.${facturaId}`, {
    movimiento_id: movimientoId,
    estado: 'pagada',
  });
  if (!rFac.ok) volver({ error: `Conciliación (factura): ${rFac.error}` });

  // Si la factura da soporte a un gasto, cerramos también el vínculo inverso.
  const factura = rFac.datos[0] as { gasto_operativo_id?: string | null } | undefined;
  if (factura?.gasto_operativo_id) {
    await api('PATCH', `gastos_operativos?id=eq.${factura.gasto_operativo_id}`, {
      factura_recibida_id: facturaId,
    });
  }

  revalidatePath('/tesoreria');
  revalidatePath(RUTA);
  volver({ ok: 'Pago conciliado: factura vinculada y marcada como pagada.' });
}
