// cashflowHoldingApi.ts
// Lee cashflow_consolidado: flujos de proyectos + vencimientos distribuidos
// por sociedad según vencimiento_sociedades.porcentaje

import { sbHeaders, sbUrl } from '@alsari/supabase-client';

export type FuenteFlujoHolding =
  | 'flujo_manual'
  | 'presupuesto_pago'
  | 'factura_recibida'
  | 'vencimiento';

export type FlujoHolding = {
  proyecto_id_ref: string | null;
  sociedad_id_ref: string | null;
  fecha: string;
  importe: number;
  tipo_flujo: string;
  concepto: string | null;
  fuente: FuenteFlujoHolding;
  estado: string | null;
  es_real: boolean;
  es_previsto: boolean;
};

async function req<T>(path: string): Promise<T> {
  const res = await fetch(sbUrl(path), { headers: sbHeaders() });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : []) as T;
}

export type FiltrosFlujoHolding = {
  sociedadId?: string; // una sola sociedad (legacy)
  sociedadIds?: string[]; // varias sociedades — usa in.()
  desde?: string;
  hasta?: string;
  soloReales?: boolean;
  soloPendientes?: boolean;
  limit?: number;
};

export async function getFlujosHolding(filtros: FiltrosFlujoHolding = {}): Promise<FlujoHolding[]> {
  const params = new URLSearchParams();
  params.set('order', 'fecha.asc');
  params.set('limit', String(filtros.limit ?? 1500));

  const ids = filtros.sociedadIds?.length
    ? filtros.sociedadIds
    : filtros.sociedadId
      ? [filtros.sociedadId]
      : [];

  if (ids.length === 1) {
    params.set('sociedad_id_ref', `eq.${ids[0]}`);
  } else if (ids.length > 1) {
    params.set('sociedad_id_ref', `in.(${ids.join(',')})`);
  }

  if (filtros.desde) params.set('fecha', `gte.${filtros.desde}`);
  if (filtros.soloReales) params.set('es_real', 'eq.true');
  if (filtros.soloPendientes) params.set('es_real', 'eq.false');

  const rows = await req<FlujoHolding[]>(`cashflow_consolidado?${params.toString()}`);

  // Filtro 'hasta' en cliente (PostgREST no permite gte+lte sobre el mismo campo
  // en una sola request sin RPC)
  return filtros.hasta ? rows.filter((r) => r.fecha <= filtros.hasta!) : rows;
}

// ── Fetch de sociedades disponibles para el selector ─────────────────────────

export type SociedadOpcion = { id_ref: string; nombre: string };

export async function getSociedadesCashflow(): Promise<SociedadOpcion[]> {
  return req<SociedadOpcion[]>('sociedades?select=id_ref,nombre&order=nombre.asc');
}
