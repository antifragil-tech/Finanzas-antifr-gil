import { sbHeaders, sbUrl } from '@alsari/supabase-client';

export type TipoFlujo =
  | 'inversion' | 'recapex' | 'venta'
  | 'dividendo' | 'ingreso_operativo' | 'gasto_operativo' | 'otro';

export type FlujoCaja = {
  id: string;
  proyecto_id: string;
  fecha: string;
  importe: number;
  tipo_flujo: TipoFlujo;
  concepto: string | null;
};

export type FlujoCajaInput = Omit<FlujoCaja, 'id'>;

function h(): HeadersInit {
  return sbHeaders({ Prefer: 'return=representation' });
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(sbUrl(path), { headers: h(), ...opts });
  if (!res.ok) throw new Error(`Supabase ${path}: HTTP ${res.status}`);
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ([] as unknown as T);
}

export async function getFlujos(proyectoId?: string): Promise<FlujoCaja[]> {
  const filter = proyectoId ? `&proyecto_id=eq.${proyectoId}` : '';
  return req<FlujoCaja[]>(`flujos_caja_proyectos?select=*&order=fecha.asc${filter}`);
}

export async function insertFlujo(data: FlujoCajaInput): Promise<FlujoCaja> {
  const rows = await req<FlujoCaja[]>('flujos_caja_proyectos', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return rows[0]!;
}

export async function deleteFlujo(id: string): Promise<void> {
  await req(`flujos_caja_proyectos?id=eq.${id}`, { method: 'DELETE' });
}
