// Lógica de importación de extractos bancarios (PR F): hashing canónico para
// deduplicar (fichero + fila), adaptador XLSX→filas (reutiliza los parsers CSV
// existentes), rango de fechas y aviso de dedup. Sin red ni estado.
import type { MovimientoBancario, MovimientoCsvRaw, ReglaCategorizacion } from '@alsari/types';
import { enriquecerMovimiento } from './categorizacion';

// ── Hash ──────────────────────────────────────────────────────────────────────
export type MovParaHash = {
  sociedad_id_ref: string;
  iban: string;
  fecha: string;
  importe: number;
  concepto_normalizado: string | null;
  saldo: number | null;
  referencia: string | null;
};

// Cadena canónica determinista: importes a céntimos, fecha ISO (10), IBAN sin
// espacios y mayúsculas, concepto colapsado/minúsculas, saldo en céntimos.
export function canonicalMovimiento(m: MovParaHash): string {
  const centimos = Math.round((Number(m.importe) || 0) * 100);
  const fecha    = (m.fecha || '').slice(0, 10);
  const iban     = (m.iban || '').toUpperCase().replace(/\s+/g, '');
  const concepto = (m.concepto_normalizado || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const saldo    = m.saldo === null || m.saldo === undefined ? '' : String(Math.round(Number(m.saldo) * 100));
  const ref      = (m.referencia || '').trim().toLowerCase();
  return [m.sociedad_id_ref, iban, fecha, centimos, concepto, saldo, ref].join('|');
}

// sha256 hex. Usa Web Crypto (disponible en navegador y en Node 20+/vitest).
export async function sha256Hex(input: string | ArrayBuffer): Promise<string> {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hashMovimiento(m: MovParaHash): Promise<string> {
  return sha256Hex(canonicalMovimiento(m));
}

export function hashArchivo(content: string | ArrayBuffer): Promise<string> {
  return sha256Hex(content);
}

// ── XLSX → filas → CSV (reutiliza los parsers CSV existentes) ─────────────────
// `xlsx` se carga de forma diferida (dynamic import) para no inflar el bundle
// principal: solo se descarga cuando el usuario importa un fichero XLSX.
export async function xlsxToRows(buf: ArrayBuffer): Promise<string[][]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buf, { type: 'array' });
  const first = wb.SheetNames[0];
  if (!first) return [];
  const sheet = wb.Sheets[first];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' });
  return rows.map(r => (Array.isArray(r) ? r.map(c => String(c ?? '')) : []));
}

// Convierte filas a un CSV con cada celda entre comillas (el parser CSV ya maneja
// comillas y separadores ; / ,). Permite alimentar `parsearExtracto` con XLSX.
export function rowsToCsv(rows: string[][]): string {
  return rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
}

// ── Rango de fechas y aviso de dedup ──────────────────────────────────────────
export function rangoFechas(movs: { fecha: string }[]): { min: string | null; max: string | null } {
  const fechas = movs.map(m => (m.fecha || '').slice(0, 10)).filter(Boolean).sort();
  return { min: fechas[0] ?? null, max: fechas[fechas.length - 1] ?? null };
}

// La deduplicación pierde precisión si hay movimientos sin saldo NI referencia
// (dos movimientos idénticos el mismo día colisionarían en hash).
export function hayMovimientosSinSaldoNiReferencia(
  movs: { saldo: number | null; referencia?: string | null }[],
): boolean {
  return movs.some(m => (m.saldo === null || m.saldo === undefined) && !m.referencia);
}

// ── Orquestación: enriquecer + hashear listo para la RPC ──────────────────────
export type MovimientoParaImportar =
  Omit<MovimientoBancario, 'id' | 'importado_at' | 'created_at'> & { hash: string };

export async function prepararMovimientos(
  raws: MovimientoCsvRaw[],
  ctx: {
    sociedad_id_ref: string; iban: string; banco: string; fuente: string;
    cuenta_bancaria_id: string | null; reglas: ReglaCategorizacion[];
  },
): Promise<MovimientoParaImportar[]> {
  const enriched = raws.map(r =>
    enriquecerMovimiento(r, ctx.sociedad_id_ref, ctx.iban, ctx.banco, ctx.fuente, ctx.reglas));
  return Promise.all(enriched.map(async m => ({
    ...m,
    cuenta_bancaria_id: ctx.cuenta_bancaria_id,
    hash: await hashMovimiento({
      sociedad_id_ref: m.sociedad_id_ref, iban: m.iban, fecha: m.fecha,
      importe: m.importe, concepto_normalizado: m.concepto_normalizado,
      saldo: m.saldo, referencia: m.referencia,
    }),
  })));
}
