import type { PersonaPatrimonio, ActivoPatrimonio, CapexActivo } from '@alsari/types';

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

// ── Personas ──────────────────────────────────────────────────────────────────

export async function getPersonas(): Promise<PersonaPatrimonio[]> {
  const res = await req('GET', 'personas_patrimonio?select=*&order=nombre');
  return res.json() as Promise<PersonaPatrimonio[]>;
}

// ── Activos ───────────────────────────────────────────────────────────────────

export async function getActivos(): Promise<ActivoPatrimonio[]> {
  const res = await req('GET', 'activos_patrimonio?select=*&order=categoria,nombre');
  return res.json() as Promise<ActivoPatrimonio[]>;
}

export async function getActivosByPersona(personaId: string): Promise<ActivoPatrimonio[]> {
  const res = await req('GET', `activos_patrimonio?titular_persona_id=eq.${encodeURIComponent(personaId)}&select=*&order=categoria,nombre`);
  return res.json() as Promise<ActivoPatrimonio[]>;
}

export async function getActivosBySociedad(sociedadId: string): Promise<ActivoPatrimonio[]> {
  const res = await req('GET', `activos_patrimonio?titular_sociedad_id=eq.${encodeURIComponent(sociedadId)}&select=*&order=categoria,nombre`);
  return res.json() as Promise<ActivoPatrimonio[]>;
}

export async function insertActivo(data: Omit<ActivoPatrimonio, 'id' | 'created_at' | 'updated_at' | 'titular_nombre'>): Promise<ActivoPatrimonio> {
  const res = await fetch(sbUrl('activos_patrimonio'), {
    method: 'POST',
    headers: h({ Prefer: 'return=representation' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`insertActivo: ${res.status} — ${(await res.text()).slice(0, 200)}`);
  const rows = await res.json() as ActivoPatrimonio[];
  if (!rows[0]) throw new Error('insertActivo: respuesta vacía');
  return rows[0];
}

export async function updateActivo(id: string, data: Partial<Omit<ActivoPatrimonio, 'id' | 'created_at' | 'updated_at' | 'titular_nombre'>>): Promise<void> {
  // Eliminar campos virtuales/computados que no existen en la tabla antes de enviar
  const { titular_nombre: _tn, id: _id, created_at: _ca, updated_at: _ua, ...clean } = data as ActivoPatrimonio;
  void _tn; void _id; void _ca; void _ua;
  await req('PATCH', `activos_patrimonio?id=eq.${encodeURIComponent(id)}`, { ...clean, updated_at: new Date().toISOString() });
}

export async function deleteActivo(id: string): Promise<void> {
  await req('DELETE', `activos_patrimonio?id=eq.${encodeURIComponent(id)}`);
}

// ── CAPEX ─────────────────────────────────────────────────────────────────────

export async function getCapexByActivo(activoId: string): Promise<CapexActivo[]> {
  const res = await req('GET', `capex_activos?activo_id=eq.${encodeURIComponent(activoId)}&select=*&order=fecha.desc`);
  return res.json() as Promise<CapexActivo[]>;
}

export async function insertCapex(data: Omit<CapexActivo, 'id' | 'created_at'>): Promise<CapexActivo> {
  const res = await fetch(sbUrl('capex_activos'), {
    method: 'POST',
    headers: h({ Prefer: 'return=representation' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`insertCapex: ${res.status} — ${(await res.text()).slice(0, 200)}`);
  const rows = await res.json() as CapexActivo[];
  if (!rows[0]) throw new Error('insertCapex: respuesta vacía');
  return rows[0];
}

export async function deleteCapex(id: string): Promise<void> {
  await req('DELETE', `capex_activos?id=eq.${encodeURIComponent(id)}`);
}
