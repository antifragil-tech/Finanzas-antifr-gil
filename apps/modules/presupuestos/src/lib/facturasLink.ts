/// <reference types="vite/client" />

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

// ── Facturas disponibles para vincular a un pago ──────────────────────────────

export type FacturaParaVincular = {
  id: string;
  proveedor_nombre: string;
  numero_factura: string | null;
  fecha_factura: string;
  concepto: string | null;
  total_a_pagar: number;
  presupuesto_pago_id: string | null;
  estado: string;
};

export async function searchFacturasParaVincular(): Promise<FacturaParaVincular[]> {
  return req<FacturaParaVincular[]>(
    'GET',
    'facturas_recibidas?select=id,proveedor_nombre,numero_factura,fecha_factura,concepto,total_a_pagar,presupuesto_pago_id,estado&estado=in.(borrador_ocr,revision_javi,pendiente_pago)&order=fecha_factura.desc&limit=200',
  );
}

export async function vincularPagoAFactura(pagoId: string, facturaId: string): Promise<void> {
  await Promise.all([
    req('PATCH', `presupuesto_pagos?id=eq.${pagoId}`, { factura_recibida_id: facturaId }),
    req('PATCH', `facturas_recibidas?id=eq.${facturaId}`, {
      presupuesto_pago_id: pagoId,
      updated_at: new Date().toISOString(),
    }),
  ]);
}

// ── Mini-ficha de factura para mostrar en el pago ─────────────────────────────

export type FacturaMini = {
  id: string;
  proveedor_nombre: string;
  numero_factura: string | null;
  fecha_factura: string;
  base_imponible: number | null;
  total_a_pagar: number;
  estado: string;
};

export async function getFacturasMini(ids: string[]): Promise<Map<string, FacturaMini>> {
  if (ids.length === 0) return new Map();
  const rows = await req<FacturaMini[]>(
    'GET',
    `facturas_recibidas?select=id,proveedor_nombre,numero_factura,fecha_factura,base_imponible,total_a_pagar,estado&id=in.(${ids.join(',')})`,
  );
  return new Map(rows.map((f) => [f.id, f]));
}

export async function desvincularPago(pagoId: string): Promise<void> {
  // Read current factura_recibida_id to also clear the inverse FK
  const rows = await req<Array<{ factura_recibida_id: string | null }>>(
    'GET',
    `presupuesto_pagos?id=eq.${pagoId}&select=factura_recibida_id`,
  );
  const facturaId = rows[0]?.factura_recibida_id ?? null;
  const ops: Promise<unknown>[] = [
    req('PATCH', `presupuesto_pagos?id=eq.${pagoId}`, { factura_recibida_id: null }),
  ];
  if (facturaId) {
    ops.push(
      req('PATCH', `facturas_recibidas?id=eq.${facturaId}`, {
        presupuesto_pago_id: null,
        updated_at: new Date().toISOString(),
      }),
    );
  }
  await Promise.all(ops);
}
