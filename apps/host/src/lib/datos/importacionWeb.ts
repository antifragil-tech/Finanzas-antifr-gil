import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  importarEfectivo,
  importarExtractoBanco,
  importarFacturasSalonized,
  normalizarClave,
  parseCsv,
} from '@antifragil/operativa';

/**
 * Importación web de reportes periódicos (solo servidor).
 *
 * - El archivo subido JAMÁS se persiste en el repo: vive como lote temporal
 *   en el tmpdir del sistema solo entre la previsualización y el "Aplicar".
 * - Cada fila recibe una clave DETERMINISTA (uuid v5 del contenido): re-importar
 *   el mismo archivo no duplica nada (insert con ignore-duplicates sobre el id).
 */

export type TipoReporte = 'facturas_salonized' | 'efectivo' | 'extracto_banco';

export const TIPOS_REPORTE: { valor: TipoReporte; etiqueta: string; destino: string }[] = [
  {
    valor: 'facturas_salonized',
    etiqueta: 'Facturas Salonized (semanal/mensual)',
    destino: 'ingresos_devengados + cobros',
  },
  { valor: 'efectivo', etiqueta: 'Pagos en efectivo (fecha;hora;importe;nota)', destino: 'cobros' },
  {
    valor: 'extracto_banco',
    etiqueta: 'Extracto banco (semanal, importe con signo)',
    destino: 'movimientos_bancarios',
  },
];

export function esTipoReporte(v: unknown): v is TipoReporte {
  return TIPOS_REPORTE.some((t) => t.valor === v);
}

// ---------------------------------------------------------------------------
// uuid v5 (RFC 4122, SHA-1) — clave determinista por contenido de fila
// ---------------------------------------------------------------------------

/** Namespace propio del OS (uuid fijo, arbitrario pero estable para siempre). */
const NAMESPACE_ANTIFRAGIL = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export function uuidV5(nombre: string, namespace: string = NAMESPACE_ANTIFRAGIL): string {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const h = createHash('sha1').update(ns).update(nombre, 'utf8').digest();
  const b = h.subarray(0, 16);
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x50; // versión 5
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80; // variante RFC 4122
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Añade a cada clave un contador de ocurrencia (…|0, …|1) para que dos filas
 * LEGÍTIMAMENTE idénticas del mismo archivo (dos pagos de 45 € a la misma hora)
 * no colapsen en un solo uuid, manteniendo el determinismo al re-importar.
 */
function conOcurrencia(claves: string[]): string[] {
  const vistas = new Map<string, number>();
  return claves.map((c) => {
    const n = vistas.get(c) ?? 0;
    vistas.set(c, n + 1);
    return `${c}|${n}`;
  });
}

// ---------------------------------------------------------------------------
// Lotes temporales (tmpdir del sistema — nunca el repo)
// ---------------------------------------------------------------------------

const DIR_LOTES = join(tmpdir(), 'antifragil-os-lotes');

export interface Lote {
  tipo: TipoReporte;
  csv: string;
  nombreArchivo: string;
  subidoEn: string;
}

export async function guardarLote(lote: Lote): Promise<string> {
  const id = randomBytes(8).toString('hex');
  await mkdir(DIR_LOTES, { recursive: true });
  await writeFile(join(DIR_LOTES, `${id}.json`), JSON.stringify(lote), 'utf8');
  return id;
}

export function loteValido(id: unknown): id is string {
  return typeof id === 'string' && /^[a-f0-9]{16}$/.test(id);
}

export async function leerLote(id: string): Promise<Lote | null> {
  if (!loteValido(id)) return null;
  try {
    return JSON.parse(await readFile(join(DIR_LOTES, `${id}.json`), 'utf8')) as Lote;
  } catch {
    return null;
  }
}

export async function borrarLote(id: string): Promise<void> {
  if (!loteValido(id)) return;
  await rm(join(DIR_LOTES, `${id}.json`), { force: true });
}

// ---------------------------------------------------------------------------
// Plan de importación: filas parseadas → inserciones con id determinista
// ---------------------------------------------------------------------------

export interface FilaVista {
  /** id determinista de la fila en su tabla principal (para detectar duplicados). */
  id: string;
  tabla: string;
  fecha: string;
  concepto: string;
  importe: number;
  /** Nota de la fila (p. ej. "cobro tarjeta omitido: sin cuenta banco"). */
  detalle?: string;
}

export interface PlanImportacion {
  tipo: TipoReporte;
  /** Inserciones agrupadas por tabla destino, en orden de aplicación. */
  inserciones: { tabla: string; filas: Record<string, unknown>[] }[];
  /** Una entrada por fila fuente válida (lo que ve la preview). */
  vista: FilaVista[];
  errores: string[];
  avisos: string[];
  desconocidos: string[];
}

const EMAIL_IMPORTACION = 'importacion-web';

/** movimientos_bancarios.banco tiene CHECK: solo estos valores (verificado en vivo). */
function normalizarBanco(
  v: string | undefined,
): 'santander' | 'bbva' | 'caixabank' | 'caja_rural' | 'otro' {
  const k = normalizarClave(v ?? '');
  if (k.includes('santander')) return 'santander';
  if (k.includes('bbva')) return 'bbva';
  if (k.includes('caixa')) return 'caixabank';
  if (k.includes('rural')) return 'caja_rural';
  return 'otro';
}

interface CuentasTesoreria {
  caja: string | null;
  banco: string | null;
}

/**
 * Construye el plan completo (sin tocar la base). `cuentas` llega resuelto por
 * el llamador (consulta por TIPO de cuenta, nunca ids hardcodeados).
 */
export function construirPlan(
  tipo: TipoReporte,
  csv: string,
  cuentas: CuentasTesoreria,
): PlanImportacion {
  const filas = parseCsv(csv);

  if (tipo === 'efectivo') {
    const r = importarEfectivo(filas);
    const claves = conOcurrencia(
      r.entidades.map((e) => `efectivo|${e.fecha}|${e.hora}|${e.importe}|${e.nota}`),
    );
    const plan: PlanImportacion = {
      tipo,
      inserciones: [],
      vista: [],
      errores: [...r.errores],
      avisos: [...r.avisos],
      desconocidos: [...r.desconocidos],
    };
    if (!cuentas.caja) {
      plan.errores.push(
        'No existe cuenta de tesorería activa de tipo "caja": imposible registrar efectivo.',
      );
      return plan;
    }
    const cuerpos = r.entidades.map((e, i) => {
      const id = uuidV5(claves[i] ?? '');
      plan.vista.push({
        id,
        tabla: 'cobros',
        fecha: e.fecha,
        concepto: `Efectivo${e.hora ? ` ${e.hora}` : ''}${e.nota ? ` · ${e.nota}` : ''}`,
        importe: e.importe,
      });
      return {
        id,
        fecha: e.fecha,
        origen_tipo: 'otro',
        importe: e.importe,
        medio_pago: 'efectivo',
        cuenta_tesoreria_id: cuentas.caja,
        registrado_por_email: EMAIL_IMPORTACION,
        notas: `Reporte efectivo${e.hora ? ` · ${e.hora}` : ''}${e.nota ? ` · ${e.nota}` : ''}`,
      };
    });
    plan.inserciones.push({ tabla: 'cobros', filas: cuerpos });
    return plan;
  }

  if (tipo === 'facturas_salonized') {
    const r = importarFacturasSalonized(filas);
    const clavesBase = conOcurrencia(
      r.entidades.map((e) =>
        e.numeroFactura
          ? `salonized|${e.numeroFactura}`
          : `salonized|${e.fecha}|${e.cliente}|${e.importe}`,
      ),
    );
    const plan: PlanImportacion = {
      tipo,
      inserciones: [],
      vista: [],
      errores: [...r.errores],
      avisos: [...r.avisos],
      desconocidos: [...r.desconocidos],
    };
    const ingresos: Record<string, unknown>[] = [];
    const cobros: Record<string, unknown>[] = [];
    let cobrosOmitidos = 0;
    r.entidades.forEach((e, i) => {
      const clave = clavesBase[i] ?? '';
      const idIngreso = uuidV5(`${clave}|ingreso`);
      ingresos.push({
        id: idIngreso,
        fecha_devengo: e.fecha,
        origen: 'suelta',
        origen_devengo: 'prestacion',
        concepto: `${e.concepto} · ${e.cliente}${e.numeroFactura ? ` · Salonized ${e.numeroFactura}` : ''}`,
        importe_devengado: e.importe,
        registrado_por_email: EMAIL_IMPORTACION,
      });
      let detalle: string | undefined;
      if (e.metodoPago) {
        const cuenta = e.metodoPago === 'efectivo' ? cuentas.caja : cuentas.banco;
        if (cuenta) {
          cobros.push({
            id: uuidV5(`${clave}|cobro`),
            fecha: e.fecha,
            origen_tipo: 'otro',
            importe: e.importe,
            medio_pago: e.metodoPago,
            cuenta_tesoreria_id: cuenta,
            registrado_por_email: EMAIL_IMPORTACION,
            notas: `Salonized${e.numeroFactura ? ` ${e.numeroFactura}` : ''} · ${e.cliente}`,
          });
          detalle = `+ cobro ${e.metodoPago}`;
        } else {
          cobrosOmitidos += 1;
          detalle = `cobro ${e.metodoPago} omitido (sin cuenta de tesorería de ese tipo)`;
        }
      } else {
        detalle = 'sin método de pago: solo devengo';
      }
      plan.vista.push({
        id: idIngreso,
        tabla: 'ingresos_devengados',
        fecha: e.fecha,
        concepto: `${e.numeroFactura ? `${e.numeroFactura} · ` : ''}${e.cliente} · ${e.concepto}`,
        importe: e.importe,
        detalle,
      });
    });
    if (cobrosOmitidos > 0) {
      plan.avisos.push(
        `${cobrosOmitidos} cobro(s) no-efectivo omitidos: no existe cuenta de tesorería tipo "banco" (el devengo sí entra).`,
      );
    }
    plan.inserciones.push({ tabla: 'ingresos_devengados', filas: ingresos });
    if (cobros.length > 0) plan.inserciones.push({ tabla: 'cobros', filas: cobros });
    return plan;
  }

  // extracto_banco
  const r = importarExtractoBanco(filas);
  const claves = conOcurrencia(
    r.entidades.map((e) => `banco|${e.fecha}|${e.importe}|${e.concepto}`),
  );
  const plan: PlanImportacion = {
    tipo,
    inserciones: [],
    vista: [],
    errores: [...r.errores],
    avisos: [...r.avisos],
    desconocidos: [...r.desconocidos],
  };
  const movimientos = r.entidades.map((e, i) => {
    const clave = claves[i] ?? '';
    const id = uuidV5(clave);
    plan.vista.push({
      id,
      tabla: 'movimientos_bancarios',
      fecha: e.fecha,
      concepto: e.concepto,
      importe: e.importe,
      detalle: e.importe < 0 ? 'pago saliente (conciliable)' : 'abono entrante',
    });
    return {
      id,
      // Convención de los seeds: 2025 = Antifrágil S.C., 2026+ = GEA S.L.
      sociedad_id_ref: e.fecha < '2026-01-01' ? 'ANT' : 'GEA',
      iban: e.iban ?? 'DESCONOCIDO',
      banco: normalizarBanco(e.banco),
      fecha: e.fecha,
      ...(e.fechaValor ? { fecha_valor: e.fechaValor } : {}),
      concepto: e.concepto,
      importe: e.importe,
      ...(e.saldo !== undefined ? { saldo: e.saldo } : {}),
      es_intragrupo: false,
      revisado: false,
      fuente: EMAIL_IMPORTACION,
      hash: clave,
    };
  });
  plan.inserciones.push({ tabla: 'movimientos_bancarios', filas: movimientos });
  return plan;
}

// ---------------------------------------------------------------------------
// Conciliación pago saliente → factura recibida (matching puro)
// ---------------------------------------------------------------------------

export interface PagoSaliente {
  id: string;
  fecha: string;
  concepto: string;
  importe: number;
}

export interface FacturaCandidata {
  id: string;
  proveedor: string;
  fecha: string;
  total: number;
  estado: string;
  gastoOperativoId: string | null;
}

export interface Sugerencia {
  factura: FacturaCandidata;
  /** nº de tokens del proveedor presentes en el concepto del movimiento. */
  afinidad: number;
  diasDiferencia: number;
}

function tokens(s: string): string[] {
  // normalizarClave del dominio ya minusculiza, quita acentos y deja [a-z0-9_].
  return normalizarClave(s)
    .split('_')
    .filter((t) => t.length >= 3);
}

const MS_DIA = 24 * 60 * 60 * 1000;

/** Candidatas: importe igual (±0,01), fecha a ±45 días, ordenadas por afinidad de nombre. */
export function sugerirFacturas(
  pago: PagoSaliente,
  facturas: FacturaCandidata[],
  maximo = 3,
): Sugerencia[] {
  const objetivo = Math.abs(pago.importe);
  const fechaPago = new Date(pago.fecha).getTime();
  const tokensConcepto = new Set(tokens(pago.concepto));
  return facturas
    .filter((f) => Math.abs(f.total - objetivo) <= 0.01)
    .map((f) => ({
      factura: f,
      afinidad: tokens(f.proveedor).filter((t) => tokensConcepto.has(t)).length,
      diasDiferencia: Math.round(Math.abs(new Date(f.fecha).getTime() - fechaPago) / MS_DIA),
    }))
    .filter((s) => s.diasDiferencia <= 45)
    .sort((a, b) => b.afinidad - a.afinidad || a.diasDiferencia - b.diasDiferencia)
    .slice(0, maximo);
}
