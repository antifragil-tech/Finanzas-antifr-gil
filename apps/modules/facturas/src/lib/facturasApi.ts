/// <reference types="vite/client" />
import type { FacturaRecibida, EstadoFacturaRecibida } from '@alsari/types';

import { sbHeaders as headers, sbUrl } from '@alsari/supabase-client';

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, headers: headers() };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(sbUrl(path), init);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${method} ${path}: HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Facturas recibidas ────────────────────────────────────────────────────────

export async function getFacturas(params?: {
  estado?: EstadoFacturaRecibida;
  sociedad_id_ref?: string;
}): Promise<FacturaRecibida[]> {
  const filters: string[] = ['order=fecha_factura.desc'];
  if (params?.estado) filters.push(`estado=eq.${params.estado}`);
  if (params?.sociedad_id_ref) filters.push(`sociedad_id_ref=eq.${params.sociedad_id_ref}`);
  return req<FacturaRecibida[]>('GET', `facturas_recibidas?select=*&${filters.join('&')}`);
}

export async function updateFacturaEstado(
  id: string,
  estado: EstadoFacturaRecibida,
): Promise<void> {
  await req('PATCH', `facturas_recibidas?id=eq.${id}`, {
    estado,
    updated_at: new Date().toISOString(),
  });
}

export async function vincularFacturaAPago(facturaId: string, pagoId: string): Promise<void> {
  await Promise.all([
    req('PATCH', `facturas_recibidas?id=eq.${facturaId}`, {
      presupuesto_pago_id: pagoId,
      updated_at: new Date().toISOString(),
    }),
    req('PATCH', `presupuesto_pagos?id=eq.${pagoId}`, {
      factura_recibida_id: facturaId,
    }),
  ]);
}

export async function desvincularFactura(facturaId: string, pagoId: string): Promise<void> {
  await Promise.all([
    req('PATCH', `facturas_recibidas?id=eq.${facturaId}`, {
      presupuesto_pago_id: null,
      updated_at: new Date().toISOString(),
    }),
    req('PATCH', `presupuesto_pagos?id=eq.${pagoId}`, {
      factura_recibida_id: null,
    }),
  ]);
}

// ── Búsqueda de pagos de presupuesto para vincular ────────────────────────────

export type PagoParaVincular = {
  id: string;
  descripcion: string | null;
  importe: number;
  fecha_prevista: string;
  presupuesto_nombre: string;
  proyecto_nombre: string | null;
  sociedad_id_ref: string | null;
  factura_recibida_id: string | null;
};

export async function searchPagosParaVincular(query?: string): Promise<PagoParaVincular[]> {
  // Traemos pagos pendientes con datos del presupuesto
  const rows = await req<
    Array<{
      id: string;
      descripcion: string | null;
      importe: number;
      fecha_prevista: string;
      factura_recibida_id: string | null;
      presupuestos: {
        nombre: string;
        proyecto_nombre: string | null;
        sociedad_id_ref: string | null;
      } | null;
    }>
  >(
    'GET',
    'presupuesto_pagos?select=id,descripcion,importe,fecha_prevista,factura_recibida_id,presupuestos!presupuesto_pagos_presupuesto_id_fkey(nombre,proyecto_nombre,sociedad_id_ref)&estado=eq.pendiente&order=fecha_prevista.asc&limit=100',
  );

  const results = rows.map((r) => ({
    id: r.id,
    descripcion: r.descripcion,
    importe: r.importe,
    fecha_prevista: r.fecha_prevista,
    presupuesto_nombre: r.presupuestos?.nombre ?? '—',
    proyecto_nombre: r.presupuestos?.proyecto_nombre ?? null,
    sociedad_id_ref: r.presupuestos?.sociedad_id_ref ?? null,
    factura_recibida_id: r.factura_recibida_id,
  }));

  if (!query) return results;
  const q = query.toLowerCase();
  return results.filter(
    (r) =>
      r.presupuesto_nombre.toLowerCase().includes(q) ||
      (r.proyecto_nombre?.toLowerCase().includes(q) ?? false) ||
      (r.descripcion?.toLowerCase().includes(q) ?? false),
  );
}
