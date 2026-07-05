import type { ParsedMayor, ParsedEntry } from './mayorParser';
import type { BalanceKPIs } from './pgcEngine';

import { sbHeaders, sbUrl } from '@alsari/supabase-client';

async function sbFetch(
  method: string,
  path: string,
  body?: unknown,
  extra?: Record<string, string>,
): Promise<Response> {
  const init: RequestInit = { method, headers: sbHeaders(extra) };
  if (body !== undefined) init.body = JSON.stringify(body);
  return fetch(sbUrl(path), init);
}

export interface SaveResult {
  batchId: string;
  rowCount: number;
  batchAlreadyExisted: boolean;
}

export async function saveImport(
  parsed: ParsedMayor,
  entityId: string,
  kpis?: BalanceKPIs,
): Promise<SaveResult> {
  let batchId = '';
  let batchAlreadyExisted = false;

  // 1. Intentar crear batch — si ya existe para este periodo, seguimos igualmente
  const batchRes = await sbFetch(
    'POST',
    'import_batches?select=id',
    {
      entity_id: entityId,
      entity_name: parsed.entityName,
      period_start: ddmmyyyyToISO(parsed.periodStart),
      period_end: ddmmyyyyToISO(parsed.periodEnd),
      row_count: parsed.entries.length,
    },
    { Prefer: 'return=representation' },
  );

  if (batchRes.ok) {
    const rows = (await batchRes.json()) as Array<{ id: string }>;
    batchId = rows[0]?.id ?? '';

    // 2. Insertar asientos en chunks de 500 (solo cuando batch es nuevo)
    const CHUNK = 500;
    for (let i = 0; i < parsed.entries.length; i += CHUNK) {
      const chunk = parsed.entries.slice(i, i + CHUNK).map((e: ParsedEntry) => ({
        batch_id: batchId,
        entity_id: entityId,
        subcuenta: e.subcuenta,
        subcuenta_nombre: e.subcuentaNombre,
        asiento: e.asiento || null,
        fecha: e.fecha,
        concepto: e.concepto || null,
        debe: e.debe,
        haber: e.haber,
      }));
      const r = await sbFetch('POST', 'journal_entries', chunk);
      if (!r.ok) {
        // Limpiar batch parcial
        await sbFetch('DELETE', `import_batches?id=eq.${encodeURIComponent(batchId)}`);
        const txt = await r.text().catch(() => '');
        throw new Error(`Error insertando asientos (chunk ${i}): ${txt.slice(0, 200)}`);
      }
    }
  } else {
    const errBody = await batchRes.json().catch(() => ({}) as Record<string, unknown>);
    const code = (errBody as Record<string, unknown>)['code'];
    if (batchRes.status === 409 || code === '23505') {
      batchAlreadyExisted = true;
    } else {
      const txt = JSON.stringify(errBody).slice(0, 200);
      throw new Error(`Error al crear batch: HTTP ${batchRes.status} — ${txt}`);
    }
  }

  // 3. Siempre actualizar kpis_sociedades (independientemente de si el batch era nuevo)
  if (kpis) {
    const today = new Date().toISOString().split('T')[0] ?? '';
    const r = await sbFetch(
      'POST',
      'kpis_sociedades',
      {
        id_ref: entityId,
        nombre: parsed.entityName,
        tipo: 'Sociedad',
        caja_disponible: kpis.caja,
        deuda_bancaria_cp: kpis.deudaBancariaCp,
        deuda_bancaria_lp: kpis.deudaBancariaLp,
        deuda_bancaria: kpis.deudaBancaria,
        deuda_socios: kpis.deudaPartesVinculadas,
        deuda_financiera_neta: kpis.deudaFinancieraNeta,
        activo_corriente: kpis.activoCorriente,
        activo_no_corriente: kpis.activoNoCorriente,
        activo_total: kpis.activoTotal,
        pasivo_corriente: kpis.pasivoCorriente,
        pasivo_no_corriente: kpis.pasivoNoCorriente,
        pasivo_total: kpis.pasivoTotal,
        fondo_maniobra: kpis.fondoManiobra,
        patrimonio_neto: kpis.patrimonioNeto,
        fecha_actualizacion: today,
      },
      { Prefer: 'resolution=merge-duplicates' },
    );
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`Error actualizando KPIs: HTTP ${r.status} — ${txt.slice(0, 200)}`);
    }
  }

  return { batchId, rowCount: parsed.entries.length, batchAlreadyExisted };
}

export async function listImports(entityId?: string): Promise<
  Array<{
    id: string;
    entity_id: string;
    entity_name: string;
    period_start: string;
    period_end: string;
    row_count: number;
    imported_at: string;
  }>
> {
  const filter = entityId ? `&entity_id=eq.${encodeURIComponent(entityId)}` : '';
  const r = await sbFetch(
    'GET',
    `import_batches?select=id,entity_id,entity_name,period_start,period_end,row_count,imported_at&order=imported_at.desc${filter}`,
  );
  if (!r.ok) throw new Error(`listImports: HTTP ${r.status}`);
  return r.json() as Promise<
    Array<{
      id: string;
      entity_id: string;
      entity_name: string;
      period_start: string;
      period_end: string;
      row_count: number;
      imported_at: string;
    }>
  >;
}

function ddmmyyyyToISO(ddmmyyyy: string): string {
  const parts = ddmmyyyy.split('/');
  if (parts.length === 3 && parts[2] && parts[1] && parts[0]) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return ddmmyyyy;
}
