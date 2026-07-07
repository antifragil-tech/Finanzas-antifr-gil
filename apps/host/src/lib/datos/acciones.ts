'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { CATEGORIA_DE } from '@antifragil/operativa';
import { mesValido } from './periodo';

/**
 * Server actions de entrada manual de datos (solo servidor): insertan en las
 * tablas reales de Supabase vía PostgREST con la service_role key. Validación
 * SIEMPRE en servidor; sin entorno configurado devuelven un error legible por
 * redirect (?error=) — nunca un crash, el build de CI sin secrets sigue verde.
 */

const URL_BASE = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

// Dominios exactos de los enums vivos en Supabase (schema MVP verificado vía OpenAPI).
const TIPOS_GASTO = Object.keys(CATEGORIA_DE);
const CAPAS_COSTE = ['directo', 'fijo', 'compartido', 'general', 'amortizable'];
const ORIGENES_INGRESO = ['suelta', 'bono', 'programa', 'plan', 'partner'];
const ORIGENES_FACTURA_EMITIDA = ['sesion', 'bono', 'programa', 'partner'];
// Estados FÍSICOS del workflow de facturas_recibidas (baseline #4).
const ESTADOS_FACTURA_RECIBIDA = [
  'borrador_ocr',
  'revision_javi',
  'pendiente_pago',
  'pagada',
  'rechazada',
];

const SERIE_OPERATIVA = 'OPS';

// ---------------------------------------------------------------------------
// Utilidades internas
// ---------------------------------------------------------------------------

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo);
  return typeof v === 'string' ? v.trim() : '';
}

/** Número desde el form; admite coma decimal. null si vacío o no numérico. */
function numero(fd: FormData, campo: string): number | null {
  const bruto = texto(fd, campo);
  if (!bruto) return null;
  const n = Number(bruto.replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function fechaValida(fecha: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !Number.isNaN(new Date(fecha).getTime());
}

/** Redirige a la página de origen conservando el periodo activo. Nunca retorna. */
function volver(fd: FormData, aviso: { ok?: string; error?: string }): never {
  const mes = texto(fd, '_mes');
  const params = new URLSearchParams();
  if (mesValido(mes)) params.set('mes', mes);
  if (aviso.ok) params.set('ok', aviso.ok);
  if (aviso.error) params.set('error', aviso.error);
  redirect(`/tesoreria?${params.toString()}`);
}

interface ResultadoInsert<T> {
  ok: boolean;
  filas: T[];
  error: string;
  status: number;
}

/** POST a PostgREST con service_role. Devuelve error legible, jamás lanza por HTTP. */
async function insertar<T>(
  tabla: string,
  cuerpo: Record<string, unknown>,
): Promise<ResultadoInsert<T>> {
  if (!URL_BASE || !SERVICE_KEY) {
    return {
      ok: false,
      filas: [],
      status: 0,
      error: 'Sin conexión a Supabase: entorno no configurado (modo demo, solo lectura).',
    };
  }
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/${tabla}`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(cuerpo),
      cache: 'no-store',
    });
    if (!res.ok) {
      const detalle = (await res.text()).slice(0, 200);
      return {
        ok: false,
        filas: [],
        status: res.status,
        error: `Supabase HTTP ${res.status}: ${detalle}`,
      };
    }
    return { ok: true, filas: (await res.json()) as T[], status: res.status, error: '' };
  } catch (e) {
    return {
      ok: false,
      filas: [],
      status: 0,
      error: `Error de red al insertar en ${tabla}: ${String(e)}`,
    };
  }
}

async function consultar<T>(recurso: string): Promise<T[]> {
  if (!URL_BASE || !SERVICE_KEY) return [];
  const res = await fetch(`${URL_BASE}/rest/v1/${recurso}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return (await res.json()) as T[];
}

function revalidarFinanzas(): void {
  revalidatePath('/tesoreria');
  revalidatePath('/rentabilidad');
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

/** Alta manual de un gasto operativo (taxonomía A–D, doc 09). */
export async function crearGasto(fd: FormData): Promise<void> {
  const fecha = texto(fd, 'fecha');
  const concepto = texto(fd, 'concepto');
  const tipo = texto(fd, 'tipo');
  const capa = texto(fd, 'capa');
  const importe = numero(fd, 'importe');
  const documentoRecibido = fd.get('documento_recibido') === 'on';
  const nota = texto(fd, 'nota');

  if (!fechaValida(fecha))
    volver(fd, { error: 'Gasto: la fecha debe ser una fecha ISO válida (AAAA-MM-DD).' });
  if (!concepto) volver(fd, { error: 'Gasto: el concepto es obligatorio.' });
  if (!TIPOS_GASTO.includes(tipo)) volver(fd, { error: 'Gasto: tipo fuera de la taxonomía A–D.' });
  if (!CAPAS_COSTE.includes(capa)) volver(fd, { error: 'Gasto: capa de coste no válida.' });
  if (importe === null || importe <= 0)
    volver(fd, { error: 'Gasto: el importe debe ser mayor que 0.' });

  const r = await insertar('gastos_operativos', {
    fecha,
    tipo,
    concepto,
    importe,
    capa,
    documento_tipo: 'factura_recibida',
    documento_recibido: documentoRecibido,
    ...(nota ? { nota } : {}),
  });
  if (!r.ok) volver(fd, { error: r.error });

  revalidarFinanzas();
  volver(fd, { ok: `Gasto registrado: ${concepto} (${fecha}).` });
}

/** Alta manual de un ingreso devengado; el cobro opcional entra al libro de cobros (caja). */
export async function crearIngreso(fd: FormData): Promise<void> {
  const fecha = texto(fd, 'fecha');
  const concepto = texto(fd, 'concepto');
  const origen = texto(fd, 'origen');
  const importeDevengado = numero(fd, 'importe_devengado');
  const importeCobrado = numero(fd, 'importe_cobrado');

  if (!fechaValida(fecha))
    volver(fd, { error: 'Ingreso: la fecha debe ser una fecha ISO válida (AAAA-MM-DD).' });
  if (!concepto) volver(fd, { error: 'Ingreso: el concepto es obligatorio.' });
  if (!ORIGENES_INGRESO.includes(origen)) volver(fd, { error: 'Ingreso: origen no válido.' });
  if (importeDevengado === null || importeDevengado <= 0)
    volver(fd, { error: 'Ingreso: el importe devengado debe ser mayor que 0.' });
  if (importeCobrado !== null && importeCobrado <= 0)
    volver(fd, { error: 'Ingreso: si informas el cobro, debe ser mayor que 0.' });

  const r = await insertar<{ id: string }>('ingresos_devengados', {
    fecha_devengo: fecha,
    origen,
    origen_devengo: 'prestacion',
    concepto,
    importe_devengado: importeDevengado,
    registrado_por_email: 'entrada-manual-web',
  });
  if (!r.ok) volver(fd, { error: r.error });

  // Cobro opcional: caja y devengo son libros separados y JAMÁS se suman (doc 09 §4.4).
  let avisoCobro = '';
  if (importeCobrado !== null) {
    const cuentas = await consultar<{ id: string }>(
      'cuenta_tesoreria?select=id&activa=is.true&order=created_at.asc&limit=1',
    );
    const cuenta = cuentas[0];
    if (!cuenta) {
      avisoCobro = ' Ojo: el cobro NO se registró (no hay cuenta de tesorería activa).';
    } else {
      const rc = await insertar('cobros', {
        fecha,
        origen_tipo: 'otro',
        ...(r.filas[0]?.id ? { origen_id: r.filas[0].id } : {}),
        importe: importeCobrado,
        medio_pago: 'otro',
        cuenta_tesoreria_id: cuenta.id,
        registrado_por_email: 'entrada-manual-web',
        notas: `Cobro manual vinculado al ingreso: ${concepto}`,
      });
      if (!rc.ok) avisoCobro = ` Ojo: el ingreso se creó pero el cobro falló (${rc.error}).`;
    }
  }

  revalidarFinanzas();
  volver(fd, { ok: `Ingreso registrado: ${concepto} (${fecha}).${avisoCobro}` });
}

/** Alta manual de una factura recibida (soporte documental; no es el gasto). */
export async function crearFacturaRecibida(fd: FormData): Promise<void> {
  const fecha = texto(fd, 'fecha_emision');
  const proveedor = texto(fd, 'proveedor');
  const concepto = texto(fd, 'concepto');
  const total = numero(fd, 'total');
  const estado = texto(fd, 'estado');
  const referencia = texto(fd, 'referencia');

  if (!fechaValida(fecha))
    volver(fd, { error: 'Factura recibida: la fecha de emisión debe ser una fecha ISO válida.' });
  if (!proveedor) volver(fd, { error: 'Factura recibida: el proveedor es obligatorio.' });
  if (!concepto) volver(fd, { error: 'Factura recibida: el concepto es obligatorio.' });
  if (total === null || total <= 0)
    volver(fd, { error: 'Factura recibida: el total debe ser mayor que 0.' });
  if (!ESTADOS_FACTURA_RECIBIDA.includes(estado))
    volver(fd, { error: 'Factura recibida: estado fuera del workflow.' });

  const r = await insertar('facturas_recibidas', {
    proveedor_nombre: proveedor,
    fecha_factura: fecha,
    base_imponible: total,
    tipo_iva: 0,
    cuota_iva: 0,
    retencion_pct: 0,
    retencion_importe: 0,
    total,
    total_a_pagar: total,
    concepto,
    estado,
    notas: `alta manual web · desglose base/IVA sin verificar${referencia ? ` · ref gasto/liquidación: ${referencia}` : ''}`,
  });
  if (!r.ok) volver(fd, { error: r.error });

  revalidarFinanzas();
  volver(fd, { ok: `Factura recibida registrada: ${proveedor} (${fecha}).` });
}

/**
 * Emite una factura operativa serie OPS (registro PRECONTABLE, doc 02 D1:
 * la factura fiscal oficial está delegada fuera del OS). total = base + IVA;
 * el desglose viaja en notas con formato estable (la tabla no lo persiste).
 */
export async function emitirFacturaOperativa(fd: FormData): Promise<void> {
  const fecha = texto(fd, 'fecha');
  const contraparte = texto(fd, 'contraparte');
  const origen = texto(fd, 'origen');
  const concepto = texto(fd, 'concepto');
  const base = numero(fd, 'base');
  const iva = numero(fd, 'iva') ?? 0;

  if (!fechaValida(fecha))
    volver(fd, { error: 'Factura: la fecha debe ser una fecha ISO válida (AAAA-MM-DD).' });
  if (!contraparte)
    volver(fd, { error: 'Factura: la contraparte (cliente/partner) es obligatoria.' });
  if (!ORIGENES_FACTURA_EMITIDA.includes(origen))
    volver(fd, { error: 'Factura: origen no válido.' });
  if (!concepto) volver(fd, { error: 'Factura: el concepto es obligatorio.' });
  if (base === null || base <= 0) volver(fd, { error: 'Factura: la base debe ser mayor que 0.' });
  if (iva < 0) volver(fd, { error: 'Factura: el IVA no puede ser negativo.' });

  const total = Math.round((base + iva) * 100) / 100;
  const exencion =
    iva === 0 ? ' · Servicios sanitarios exentos de IVA (art. 20.Uno.3º Ley 37/1992)' : '';
  const notas = `Concepto: ${concepto} · Base: ${base.toFixed(2)} · IVA: ${iva.toFixed(2)}${exencion} · alta manual web`;

  // Numeración: max(numero) + 1 de la serie OPS. La unique (serie, numero)
  // protege ante concurrencia; si colisiona se reintenta una vez.
  let id: string | undefined;
  for (let intento = 0; intento < 2 && !id; intento += 1) {
    const ultimas = await consultar<{ numero: number }>(
      `facturas_emitidas_operativas?select=numero&serie=eq.${SERIE_OPERATIVA}&order=numero.desc&limit=1`,
    );
    const siguiente = (ultimas[0]?.numero ?? 0) + 1;
    const r = await insertar<{ id: string }>('facturas_emitidas_operativas', {
      serie: SERIE_OPERATIVA,
      numero: siguiente,
      origen_tipo: origen,
      contraparte,
      fecha,
      importe: total,
      estado: 'emitida_operativa',
      notas,
    });
    if (r.ok) {
      id = r.filas[0]?.id;
      break;
    }
    if (r.status !== 409) volver(fd, { error: r.error });
  }
  if (!id) volver(fd, { error: 'Factura: colisión de numeración; vuelve a intentarlo.' });

  revalidarFinanzas();
  redirect(`/tesoreria/factura/${id}`);
}
