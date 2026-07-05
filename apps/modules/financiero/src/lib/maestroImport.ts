import type { SociedadRow, ProyectoRow, KpisSocRow, KpisProjRow } from './maestroParser';
import type { FlujoCajaRow, ProyectoDetalle } from '@alsari/types';

import { sbHeaders as h, sbUrl } from '@alsari/supabase-client';

async function req(method: string, path: string, body?: unknown): Promise<Response> {
  const init: RequestInit = { method, headers: h() };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(sbUrl(path), init);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${method} ${path}: HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }
  return res;
}

// ── Lecturas ──────────────────────────────────────────────────────────────────

export async function getSociedades(): Promise<SociedadRow[]> {
  const res = await req('GET', 'sociedades?select=*&order=id_ref');
  return res.json() as Promise<SociedadRow[]>;
}

export async function getProyectos(): Promise<ProyectoRow[]> {
  const res = await req('GET', 'proyectos?select=*&order=id_ref');
  return res.json() as Promise<ProyectoRow[]>;
}

// ── CRUD Sociedades ───────────────────────────────────────────────────────────

export async function insertSociedad(data: SociedadRow): Promise<void> {
  await req('POST', 'sociedades', data);
}

export async function updateSociedad(
  idRef: string,
  data: Partial<Omit<SociedadRow, 'id_ref'>>,
): Promise<void> {
  await req('PATCH', `sociedades?id_ref=eq.${encodeURIComponent(idRef)}`, data);
}

export async function deleteSociedad(idRef: string): Promise<void> {
  await req('DELETE', `sociedades?id_ref=eq.${encodeURIComponent(idRef)}`);
}

// ── CRUD Proyectos ────────────────────────────────────────────────────────────

export async function insertProyecto(data: ProyectoRow): Promise<void> {
  await req('POST', 'proyectos', data);
}

export async function updateProyecto(
  idRef: string,
  data: Partial<Omit<ProyectoRow, 'id_ref'>>,
): Promise<void> {
  await req('PATCH', `proyectos?id_ref=eq.${encodeURIComponent(idRef)}`, data);
}

export async function deleteProyecto(idRef: string): Promise<void> {
  await req('DELETE', `proyectos?id_ref=eq.${encodeURIComponent(idRef)}`);
}

// ── KPIs por sociedad ─────────────────────────────────────────────────────────

export async function getKpisSociedad(idRef: string, nombre: string): Promise<KpisSocRow | null> {
  // intenta por id_ref; si no hay, cae al nombre (cubre discrepancias históricas como S-002 vs S-006)
  const r1 = await req('GET', `kpis_sociedades?id_ref=eq.${encodeURIComponent(idRef)}&limit=1`);
  const d1 = (await r1.json()) as KpisSocRow[];
  if (d1.length) return d1[0] ?? null;
  const r2 = await req('GET', `kpis_sociedades?nombre=ilike.${encodeURIComponent(nombre)}&limit=1`);
  const d2 = (await r2.json()) as KpisSocRow[];
  return d2.length ? (d2[0] ?? null) : null;
}

export async function saveKpisSociedad(data: KpisSocRow): Promise<void> {
  await fetch(sbUrl('kpis_sociedades'), {
    method: 'POST',
    headers: h({ Prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify(data),
  }).then(async (r) => {
    if (!r.ok) throw new Error(`saveKpis: ${r.status} — ${(await r.text()).slice(0, 200)}`);
  });
}

// ── KPIs por proyecto ─────────────────────────────────────────────────────────

export async function getKpisProyecto(idRef: string): Promise<KpisProjRow | null> {
  const r = await req('GET', `kpis_proyectos?id_ref=eq.${encodeURIComponent(idRef)}&limit=1`);
  const d = (await r.json()) as KpisProjRow[];
  return d.length ? (d[0] ?? null) : null;
}

export async function saveKpisProyecto(data: KpisProjRow): Promise<void> {
  await fetch(sbUrl('kpis_proyectos'), {
    method: 'POST',
    headers: h({ Prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify(data),
  }).then(async (r) => {
    if (!r.ok) throw new Error(`saveKpisProj: ${r.status} — ${(await r.text()).slice(0, 200)}`);
  });
}

// ── Detalle de proyecto (campos descriptivos) ─────────────────────────────────

export async function getProyectoDetalle(idRef: string): Promise<ProyectoDetalle | null> {
  const r = await req(
    'GET',
    `proyectos?id_ref=eq.${encodeURIComponent(idRef)}&select=id_ref,nombre,sociedad_tenedora,estado,fecha_inicio,fecha_prevista_salida,fecha_salida_real,tipo_activo,ubicacion,superficie_m2&limit=1`,
  );
  const d = (await r.json()) as ProyectoDetalle[];
  return d.length ? (d[0] ?? null) : null;
}

export async function updateProyectoDetalle(
  idRef: string,
  data: Partial<Omit<ProyectoDetalle, 'id_ref'>>,
): Promise<void> {
  await req('PATCH', `proyectos?id_ref=eq.${encodeURIComponent(idRef)}`, data);
}

// ── Flujos de caja ────────────────────────────────────────────────────────────

export async function getFlujosCajaProyecto(proyectoId: string): Promise<FlujoCajaRow[]> {
  const r = await req(
    'GET',
    `flujos_caja_proyectos?proyecto_id=eq.${encodeURIComponent(proyectoId)}&order=fecha`,
  );
  return r.json() as Promise<FlujoCajaRow[]>;
}

export async function insertFlujoCaja(
  data: Omit<FlujoCajaRow, 'id' | 'created_at' | 'updated_at'>,
): Promise<FlujoCajaRow> {
  const res = await fetch(sbUrl('flujos_caja_proyectos'), {
    method: 'POST',
    headers: h({ Prefer: 'return=representation' }),
    body: JSON.stringify(data),
  });
  if (!res.ok)
    throw new Error(`insertFlujoCaja: ${res.status} — ${(await res.text()).slice(0, 200)}`);
  const rows = (await res.json()) as FlujoCajaRow[];
  if (!rows[0]) throw new Error('insertFlujoCaja: respuesta vacía de Supabase');
  return rows[0];
}

export async function updateFlujoCaja(
  id: string,
  data: Partial<Omit<FlujoCajaRow, 'id' | 'proyecto_id'>>,
): Promise<void> {
  await req('PATCH', `flujos_caja_proyectos?id=eq.${encodeURIComponent(id)}`, data);
}

export async function deleteFlujoCaja(id: string): Promise<void> {
  await req('DELETE', `flujos_caja_proyectos?id=eq.${encodeURIComponent(id)}`);
}

// El antiguo `syncFromExcel` (upsert masivo desde el Excel maestro) se eliminó:
// el Excel fue solo el vehículo de carga inicial y Supabase es la única fuente
// de verdad. Los datos maestros se editan desde la propia app (CRUD de arriba).
