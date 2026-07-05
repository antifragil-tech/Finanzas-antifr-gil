import type { BalanceLine, DerivedKpis } from './sumasSaldosParser';

import { sbHeaders as h, sbUrl } from '@alsari/supabase-client';

async function req(method: string, path: string, body?: unknown): Promise<Response> {
  const init: RequestInit = { method, headers: h() };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(sbUrl(path), init);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${method} ${path}: HTTP ${res.status} — ${txt.slice(0, 300)}`);
  }
  return res;
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type PeriodoImportado = {
  sociedad_id: string;
  periodo: string; // 'YYYY-MM-DD'
  lineas: number;
  importado_en: string;
};

// El balance más antiguo de cada sociedad (su "Inicial" / balance de partida) se
// guarda con esta fecha sentinela. Cualquier otro período es un mes real.
export const PERIODO_INICIAL = '1900-01-01';

/** Etiqueta de un período: "Inicial" para la sentinela, "Mayo 2026" para meses. */
export function fmtPeriodo(iso: string): string {
  if (iso === PERIODO_INICIAL) return 'Inicial';
  const d = new Date(iso + 'T00:00:00');
  const s = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Etiqueta corta para ejes de gráfico: "Inicial" o "may 26". */
export function fmtPeriodoCorto(iso: string): string {
  if (iso === PERIODO_INICIAL) return 'Inicial';
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', {
    month: 'short',
    year: '2-digit',
  });
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getPeriodosImportados(): Promise<PeriodoImportado[]> {
  const res = await req(
    'GET',
    'v_balance_periodos?select=sociedad_id,periodo,lineas,importado_en&order=periodo.desc',
  );
  const rows = (await res.json()) as {
    sociedad_id: string;
    periodo: string;
    lineas: number;
    importado_en: string;
  }[];
  return rows;
}

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadSumasSaldos(
  sociedadId: string,
  sociedadNombre: string,
  periodo: string, // 'YYYY-MM-DD' (último día del mes)
  lines: BalanceLine[],
  kpis: DerivedKpis,
): Promise<void> {
  // 1. Borrar filas existentes para este período (upsert por UNIQUE no puede hacerlo en bulk delete+insert sin riesgo)
  await req(
    'DELETE',
    `balance_sumas_saldos?sociedad_id=eq.${encodeURIComponent(sociedadId)}&periodo=eq.${periodo}`,
  );

  // 2. Insertar en chunks
  const rows = lines.map((l) => ({
    sociedad_id: sociedadId,
    periodo,
    cuenta: l.cuenta,
    descripcion: l.descripcion || null,
    debe: l.debe,
    haber: l.haber,
    saldo_deudor: l.saldo_deudor,
    saldo_acreedor: l.saldo_acreedor,
  }));

  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await req('POST', 'balance_sumas_saldos', rows.slice(i, i + CHUNK));
  }

  // 3. Upsert KPIs derivados en kpis_sociedades
  const kpisRow = {
    id_ref: sociedadId,
    nombre: sociedadNombre,
    fecha_actualizacion: periodo,
    caja_disponible: kpis.caja_disponible,
    deuda_bancaria_lp: kpis.deuda_bancaria_lp,
    deuda_bancaria_cp: kpis.deuda_bancaria_cp,
    deuda_bancaria: kpis.deuda_bancaria,
    deuda_socios: kpis.deuda_socios,
    deuda_financiera_neta: kpis.deuda_financiera_neta,
    activo_corriente: kpis.activo_corriente,
    activo_no_corriente: kpis.activo_no_corriente,
    activo_total: kpis.activo_total,
    pasivo_corriente: kpis.pasivo_corriente,
    pasivo_no_corriente: kpis.pasivo_no_corriente,
    pasivo_total: kpis.pasivo_total,
    fondo_maniobra: kpis.fondo_maniobra,
    patrimonio_neto: kpis.patrimonio_neto,
  };

  await fetch(sbUrl('kpis_sociedades'), {
    method: 'POST',
    headers: h({ Prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify(kpisRow),
  }).then(async (r) => {
    if (!r.ok) throw new Error(`Upsert KPIs: ${r.status} — ${(await r.text()).slice(0, 200)}`);
  });
}

// ── Delete período ────────────────────────────────────────────────────────────

export async function deletePeriodo(sociedadId: string, periodo: string): Promise<void> {
  await req(
    'DELETE',
    `balance_sumas_saldos?sociedad_id=eq.${encodeURIComponent(sociedadId)}&periodo=eq.${periodo}`,
  );
}

// ── Consulta por sociedad ─────────────────────────────────────────────────────

export type BalanceSumasSaldosRow = {
  cuenta: string;
  descripcion: string | null;
  saldo_deudor: number;
  saldo_acreedor: number;
};

export async function getPeriodosBySociedad(sociedadId: string): Promise<PeriodoImportado[]> {
  // Consulta la tabla directamente (la vista v_balance_periodos requiere GRANT adicional sobre anon)
  const res = await req(
    'GET',
    `balance_sumas_saldos?sociedad_id=eq.${encodeURIComponent(sociedadId)}&select=periodo,created_at&order=periodo.desc`,
  );
  const rows = (await res.json()) as { periodo: string; created_at: string }[];
  // Agregar por período en cliente (evita depender de la vista)
  const map = new Map<string, { count: number; latest: string }>();
  for (const r of rows) {
    const cur = map.get(r.periodo);
    if (cur) {
      cur.count++;
    } else {
      map.set(r.periodo, { count: 1, latest: r.created_at });
    }
  }
  return Array.from(map.entries()).map(([periodo, { count, latest }]) => ({
    sociedad_id: sociedadId,
    periodo,
    lineas: count,
    importado_en: latest,
  }));
}

export async function getLineasBSS(
  sociedadId: string,
  periodo: string,
): Promise<BalanceSumasSaldosRow[]> {
  const res = await req(
    'GET',
    `balance_sumas_saldos?sociedad_id=eq.${encodeURIComponent(sociedadId)}&periodo=eq.${periodo}&select=cuenta,descripcion,saldo_deudor,saldo_acreedor&order=cuenta.asc`,
  );
  return res.json() as Promise<BalanceSumasSaldosRow[]>;
}
