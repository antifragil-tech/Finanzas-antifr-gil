/// <reference types="vite/client" />
import type {
  Presupuesto, PresupuestoCapitulo, PresupuestoPartida, PresupuestoPago,
  PresupuestoEstado, PresupuestoTipo, PresupuestoCategoria,
  PagoEstado, PagoTipoFlujo, RecurrenciaPartida,
} from '@alsari/types';

// ── Supabase client ───────────────────────────────────────────────────────────

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

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(sbUrl(path), {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path}: ${res.status} — ${(await res.text()).slice(0, 200)}`);
  const rows = await res.json() as T[];
  if (!Array.isArray(rows) || !rows[0]) throw new Error(`POST ${path}: respuesta vacía`);
  return rows[0];
}

// ── Presupuestos ──────────────────────────────────────────────────────────────

export async function getPresupuestos(): Promise<Presupuesto[]> {
  return req<Presupuesto[]>('GET', 'presupuestos?select=*&order=created_at.desc');
}

export async function getPresupuestosByProyecto(proyecto_id_ref: string): Promise<Presupuesto[]> {
  return req<Presupuesto[]>('GET', `presupuestos?proyecto_id_ref=eq.${encodeURIComponent(proyecto_id_ref)}&select=*&order=created_at.desc`);
}

export async function getPresupuesto(id: string): Promise<Presupuesto> {
  const rows = await req<Presupuesto[]>('GET', `presupuestos?id=eq.${id}&select=*`);
  if (!rows[0]) throw new Error('Presupuesto no encontrado');
  return rows[0];
}

export async function createPresupuesto(data: {
  nombre: string;
  tipo: PresupuestoTipo;
  categoria?: PresupuestoCategoria;
  proyecto_id_ref?: string;
  proyecto_nombre?: string;
  sociedad_id_ref?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  notas?: string;
}): Promise<Presupuesto> {
  return post<Presupuesto>('presupuestos', {
    ...data,
    categoria: data.categoria ?? 'gasto',
    estado: 'borrador' as PresupuestoEstado,
  });
}

export async function updatePresupuesto(id: string, data: Partial<Pick<
  Presupuesto,
  'nombre' | 'tipo' | 'proyecto_id_ref' | 'proyecto_nombre' | 'sociedad_id_ref' | 'estado' |
  'fecha_inicio' | 'fecha_fin' | 'notas' | 'es_presupuesto_maestro' | 'fecha_aprobacion' | 'aprobado_por'
>>): Promise<void> {
  await req('PATCH', `presupuestos?id=eq.${id}`, { ...data, updated_at: new Date().toISOString() });
}

/**
 * Marca un presupuesto como maestro del proyecto.
 * Primero desactiva cualquier maestro existente, luego activa el indicado.
 * Respeta el índice único parcial: nunca habrá dos maestros simultáneos.
 */
export async function marcarPresupuestoMaestro(
  proyectoIdRef: string,
  presupuestoId: string
): Promise<void> {
  // Paso 1: quitar maestro a todos los presupuestos del proyecto
  await req(
    'PATCH',
    `presupuestos?proyecto_id_ref=eq.${encodeURIComponent(proyectoIdRef)}&es_presupuesto_maestro=eq.true`,
    { es_presupuesto_maestro: false, updated_at: new Date().toISOString() }
  );
  // Paso 2: marcar el nuevo como maestro
  await req(
    'PATCH',
    `presupuestos?id=eq.${presupuestoId}`,
    { es_presupuesto_maestro: true, updated_at: new Date().toISOString() }
  );
}

/** Obtiene el presupuesto maestro de un proyecto, o null si no existe. */
export async function getMaestroPresupuesto(proyectoIdRef: string): Promise<Presupuesto | null> {
  const rows = await req<Presupuesto[]>(
    'GET',
    `presupuestos?proyecto_id_ref=eq.${encodeURIComponent(proyectoIdRef)}&es_presupuesto_maestro=eq.true&select=*&limit=1`
  );
  return rows[0] ?? null;
}

export async function deletePresupuesto(id: string): Promise<void> {
  await req('DELETE', `presupuestos?id=eq.${id}`);
}

export async function updateNombreProyectoEnPresupuestos(
  proyectoIdRef: string,
  nuevoNombre: string
): Promise<void> {
  await req('PATCH', `presupuestos?proyecto_id_ref=eq.${encodeURIComponent(proyectoIdRef)}`, {
    proyecto_nombre: nuevoNombre,
  });
}

// ── Capítulos ─────────────────────────────────────────────────────────────────

export async function getCapitulos(presupuestoId: string): Promise<PresupuestoCapitulo[]> {
  return req<PresupuestoCapitulo[]>(
    'GET',
    `presupuesto_capitulos?presupuesto_id=eq.${presupuestoId}&order=orden.asc`,
  );
}

export async function createCapitulo(data: {
  presupuesto_id: string;
  nombre: string;
  orden: number;
}): Promise<PresupuestoCapitulo> {
  return post<PresupuestoCapitulo>('presupuesto_capitulos', data);
}

export async function updateCapitulo(id: string, data: Partial<Pick<PresupuestoCapitulo, 'nombre' | 'orden'>>): Promise<void> {
  await req('PATCH', `presupuesto_capitulos?id=eq.${id}`, data);
}

export async function deleteCapitulo(id: string): Promise<void> {
  await req('DELETE', `presupuesto_capitulos?id=eq.${id}`);
}

// ── Partidas ──────────────────────────────────────────────────────────────────

export async function getPartidas(presupuestoId: string): Promise<PresupuestoPartida[]> {
  return req<PresupuestoPartida[]>(
    'GET',
    `presupuesto_partidas?presupuesto_id=eq.${presupuestoId}&order=created_at.asc`,
  );
}

export async function createPartida(data: {
  presupuesto_id: string;
  capitulo_id: string;
  descripcion: string;
  importe_presupuestado: number;
  tipo_iva?: number;
  codigo?: string;
  proveedor_esperado?: string;
  notas?: string;
  recurrencia?: RecurrenciaPartida;
  fecha_inicio_recurrencia?: string;
  fecha_fin_recurrencia?: string;
  tipo_flujo_recurrencia?: PagoTipoFlujo;
}): Promise<PresupuestoPartida> {
  const { tipo_flujo_recurrencia, ...partidaData } = data;
  const partida = await post<PresupuestoPartida>('presupuesto_partidas', partidaData);

  // Si es recurrente, generar los pagos automáticamente
  if (data.recurrencia && data.fecha_inicio_recurrencia && data.fecha_fin_recurrencia) {
    const fechas = generarFechasRecurrentes(
      data.fecha_inicio_recurrencia,
      data.fecha_fin_recurrencia,
      data.recurrencia,
    );
    if (fechas.length > 0) {
      const importePorPeriodo = parseFloat(
        (data.importe_presupuestado / fechas.length).toFixed(2)
      );
      await Promise.all(
        fechas.map(fecha =>
          createPago({
            presupuesto_id: data.presupuesto_id,
            partida_id: partida.id,
            importe: importePorPeriodo,
            tipo_iva: (data.tipo_iva as 0 | 4 | 10 | 21) ?? 0,
            fecha_prevista: fecha,
            tipo_flujo: tipo_flujo_recurrencia ?? 'gasto',
            descripcion: `${data.descripcion} (${formatMesAnio(fecha)})`,
          })
        )
      );
    }
  }

  return partida;
}

function generarFechasRecurrentes(
  inicio: string,
  fin: string,
  recurrencia: RecurrenciaPartida,
): string[] {
  const fechas: string[] = [];
  const d = new Date(inicio);
  const finDate = new Date(fin);
  const mesesMap: Record<RecurrenciaPartida, number> = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 };
  const mesesAvance = mesesMap[recurrencia];

  while (d <= finDate) {
    fechas.push(d.toISOString().slice(0, 10));
    d.setMonth(d.getMonth() + mesesAvance);
  }
  return fechas;
}

function formatMesAnio(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
}

export async function updatePartida(id: string, data: Partial<Pick<
  PresupuestoPartida,
  'descripcion' | 'importe_presupuestado' | 'tipo_iva' | 'codigo' | 'proveedor_esperado' | 'notas' |
  'recurrencia' | 'fecha_inicio_recurrencia' | 'fecha_fin_recurrencia'
>>): Promise<void> {
  await req('PATCH', `presupuesto_partidas?id=eq.${id}`, { ...data, updated_at: new Date().toISOString() });
}

export async function deletePartida(id: string): Promise<void> {
  await req('DELETE', `presupuesto_partidas?id=eq.${id}`);
}

// ── Pagos ─────────────────────────────────────────────────────────────────────

export async function getPagos(presupuestoId: string): Promise<PresupuestoPago[]> {
  return req<PresupuestoPago[]>(
    'GET',
    `presupuesto_pagos?presupuesto_id=eq.${presupuestoId}&order=fecha_prevista.asc`,
  );
}

export async function getAllPagos(params?: {
  desde?: string;
  hasta?: string;
  estado?: PagoEstado;
}): Promise<PresupuestoPago[]> {
  const filters: string[] = ['order=fecha_prevista.asc'];
  if (params?.desde)  filters.push(`fecha_prevista=gte.${params.desde}`);
  if (params?.hasta)  filters.push(`fecha_prevista=lte.${params.hasta}`);
  if (params?.estado) filters.push(`estado=eq.${params.estado}`);
  return req<PresupuestoPago[]>('GET', `presupuesto_pagos?${filters.join('&')}&select=*,presupuesto_partidas!presupuesto_pagos_partida_id_fkey(descripcion),presupuestos!presupuesto_pagos_presupuesto_id_fkey(nombre,proyecto_nombre,sociedad_id_ref)`);
}

export async function createPago(data: {
  presupuesto_id: string;
  partida_id: string;
  importe: number;
  tipo_iva?: number;
  fecha_prevista: string;
  tipo_flujo: PagoTipoFlujo;
  descripcion?: string;
  notas?: string;
}): Promise<PresupuestoPago> {
  return post<PresupuestoPago>('presupuesto_pagos', { ...data, estado: 'pendiente' as PagoEstado });
}

export async function updatePago(id: string, data: Partial<Pick<
  PresupuestoPago,
  'descripcion' | 'importe' | 'tipo_iva' | 'fecha_prevista' | 'estado' | 'tipo_flujo' |
  'factura_recibida_id' | 'factura_emitida_id' | 'notas'
>>): Promise<void> {
  await req('PATCH', `presupuesto_pagos?id=eq.${id}`, data);
}

export async function deletePago(id: string): Promise<void> {
  await req('DELETE', `presupuesto_pagos?id=eq.${id}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function calcTotalesPresupuesto(
  partidas: PresupuestoPartida[],
  pagos: PresupuestoPago[],
): { total: number; pagado: number; pendiente: number; pct: number } {
  const total = partidas.reduce((s, p) => s + p.importe_presupuestado, 0);
  const pagado = pagos
    .filter(pg => pg.estado === 'pagado' && pg.tipo_flujo === 'gasto')
    .reduce((s, pg) => s + pg.importe, 0);
  const pendiente = total - pagado;
  const pct = total > 0 ? Math.round((pagado / total) * 100) : 0;
  return { total, pagado, pendiente, pct };
}
