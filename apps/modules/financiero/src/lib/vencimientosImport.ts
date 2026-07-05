import { sbHeaders, sbUrl } from '@alsari/supabase-client';

export type TipoVencimiento =
  | 'seguro'
  | 'deuda'
  | 'prestamo'
  | 'contrato'
  | 'impuesto'
  | 'compromiso'
  | 'otro'
  | 'pignorado';
export type EstadoVencimiento = 'pendiente' | 'gestionado' | 'vencido';
export type Recurrencia = 'anual' | 'semestral' | 'trimestral' | 'mensual';

export type Vencimiento = {
  id: string;
  titulo: string;
  tipo: TipoVencimiento;
  fecha_vencimiento: string;
  importe: number | null;
  sociedad_id: string | null;
  notas: string | null;
  estado: EstadoVencimiento;
  recurrencia: Recurrencia | null;
  es_entrada: boolean;
  created_at: string;
};

export type VencimientoInput = Omit<Vencimiento, 'id' | 'created_at'>;

function h(): HeadersInit {
  return sbHeaders({ Prefer: 'return=representation' });
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(sbUrl(path), { headers: h(), ...opts });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Supabase ${path}: HTTP ${res.status} — ${body}`);
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ([] as unknown as T);
}

export async function getVencimientos(): Promise<Vencimiento[]> {
  return req<Vencimiento[]>('vencimientos?select=*&order=fecha_vencimiento.asc');
}

export async function insertVencimiento(data: VencimientoInput): Promise<Vencimiento> {
  const rows = await req<Vencimiento[]>('vencimientos', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return rows[0]!;
}

export async function updateVencimiento(
  id: string,
  data: Partial<VencimientoInput>,
): Promise<void> {
  await req(`vencimientos?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
  });
}

export async function deleteVencimiento(id: string): Promise<void> {
  await req(`vencimientos?id=eq.${id}`, { method: 'DELETE' });
}

// ── Vencimiento multi-sociedad ────────────────────────────────────────────────

export type VencimientoSociedad = {
  id: string;
  vencimiento_id: string;
  sociedad_id: string;
  porcentaje: number;
};

export async function getVencimientoSociedades(
  vencimientoId: string,
): Promise<VencimientoSociedad[]> {
  return req<VencimientoSociedad[]>(
    `vencimiento_sociedades?vencimiento_id=eq.${vencimientoId}&order=porcentaje.desc`,
  );
}

export async function setVencimientoSociedades(
  vencimientoId: string,
  rows: { sociedad_id: string; porcentaje: number }[],
): Promise<void> {
  const validRows = rows.filter((r) => r.sociedad_id);
  // Borra las existentes y reinserta (upsert completo)
  await req(`vencimiento_sociedades?vencimiento_id=eq.${vencimientoId}`, {
    method: 'DELETE',
  });
  if (validRows.length === 0) return;
  await req('vencimiento_sociedades', {
    method: 'POST',
    body: JSON.stringify(validRows.map((r) => ({ ...r, vencimiento_id: vencimientoId }))),
  });
}
