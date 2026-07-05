/// <reference types="vite/client" />
import type {
  ProyectoObjetivo,
  ProyectoKR,
  ProyectoTarea,
  TareaColumna,
  TareaRecurrencia,
  ObjetivoEstado,
} from '@alsari/types';

// ── Auth / Supabase client ─────────────────────────────────────────────────────

import { sbHeaders as headers, sbUrl } from '@alsari/supabase-client';

async function req<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: headers(opts.headers as Record<string, string> | undefined),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : []) as T;
}

// ── Proyectos (lectura desde tabla proyectos) ──────────────────────────────────

export type ProyectoRow = {
  id_ref: string;
  nombre: string;
  sociedad_tenedora: string | null;
  estado: string | null;
  fecha_inicio: string | null;
  fecha_prevista_salida: string | null;
  tipo_activo: string | null;
  ubicacion: string | null;
};

export async function getProyectos(): Promise<ProyectoRow[]> {
  const url =
    sbUrl('proyectos') +
    '?select=id_ref,nombre,sociedad_tenedora,estado,fecha_inicio,fecha_prevista_salida,tipo_activo,ubicacion&order=nombre.asc';
  return req<ProyectoRow[]>(url);
}

// ── proyecto_sociedades (propiedad parcial) ────────────────────────────────────

export type ProyectoSociedadRow = {
  proyecto_id_ref: string;
  sociedad_id_ref: string;
  porcentaje: number;
};

export async function getParticipacionesByProyecto(
  proyectoIdRef: string,
): Promise<ProyectoSociedadRow[]> {
  const url =
    sbUrl('proyecto_sociedades') +
    `?proyecto_id_ref=eq.${encodeURIComponent(proyectoIdRef)}&order=porcentaje.desc`;
  return req<ProyectoSociedadRow[]>(url);
}

export async function setParticipaciones(
  proyectoIdRef: string,
  participaciones: { sociedad_id_ref: string; porcentaje: number }[],
): Promise<void> {
  // Borra las existentes y vuelve a insertar (upsert completo)
  await req(sbUrl(`proyecto_sociedades?proyecto_id_ref=eq.${encodeURIComponent(proyectoIdRef)}`), {
    method: 'DELETE',
  });
  if (participaciones.length > 0) {
    const rows = participaciones.map((p) => ({ proyecto_id_ref: proyectoIdRef, ...p }));
    await req(sbUrl('proyecto_sociedades'), {
      method: 'POST',
      body: JSON.stringify(rows),
      headers: { Prefer: 'return=minimal' },
    });
  }
}

// ── Crear / editar / eliminar proyectos ───────────────────────────────────────

export type ProyectoCreate = {
  id_ref: string;
  nombre: string;
  sociedad_tenedora?: string | null;
  tipo_activo?: string | null;
  ubicacion?: string | null;
  estado?: string;
  fecha_inicio?: string | null;
  fecha_prevista_salida?: string | null;
};

export async function createProyecto(data: ProyectoCreate): Promise<ProyectoRow> {
  const url = sbUrl('proyectos');
  const [item] = await req<ProyectoRow[]>(url, {
    method: 'POST',
    body: JSON.stringify({ estado: 'activo', ...data }),
    headers: { Prefer: 'return=representation' },
  });
  return item!;
}

export async function updateProyecto(
  idRef: string,
  data: Partial<Omit<ProyectoCreate, 'id_ref'>>,
): Promise<void> {
  await req(sbUrl(`proyectos?id_ref=eq.${encodeURIComponent(idRef)}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
    headers: { Prefer: 'return=minimal' },
  });
}

export async function deleteProyecto(idRef: string): Promise<void> {
  await req(sbUrl(`proyectos?id_ref=eq.${encodeURIComponent(idRef)}`), { method: 'DELETE' });
}

// Resumen de lo que se borrará/desvinculará al eliminar un proyecto.
// Sirve para que la confirmación sea informada: el borrado es irreversible.
export type ResumenEliminacion = {
  presupuestos: number;
  objetivos: number;
  tareas: number;
  facturasVinculadas: number;
};

export async function getResumenEliminacion(idRef: string): Promise<ResumenEliminacion> {
  const enc = encodeURIComponent(idRef);
  const [pres, objs, tareas, facturas] = await Promise.all([
    req<{ id: string }[]>(sbUrl(`presupuestos?proyecto_id_ref=eq.${enc}&select=id`)),
    req<{ id: string }[]>(sbUrl(`proyecto_objetivos?proyecto_id=eq.${enc}&select=id`)),
    req<{ id: string }[]>(sbUrl(`proyecto_tareas?proyecto_id=eq.${enc}&select=id`)),
    req<{ id: string }[]>(sbUrl(`facturas_recibidas?proyecto_id_ref=eq.${enc}&select=id`)),
  ]);
  return {
    presupuestos: pres.length,
    objetivos: objs.length,
    tareas: tareas.length,
    facturasVinculadas: facturas.length,
  };
}

/**
 * Elimina un proyecto y todo lo que cuelga de él de forma limpia.
 * 1. Borra sus presupuestos explícitamente (la FK es SET NULL, no cascada:
 *    sin esto quedarían huérfanos). Cada presupuesto cascada a sus capítulos,
 *    partidas y pagos; las facturas vinculadas se desvinculan solas (SET NULL).
 * 2. Borra el proyecto: cascada a objetivos, KRs, tareas, escenarios, análisis
 *    financiero y flujos de caja. Las facturas conservan sus datos pero pierden
 *    el vínculo al proyecto (SET NULL).
 */
export async function deleteProyectoCompleto(idRef: string): Promise<void> {
  const enc = encodeURIComponent(idRef);
  await req(sbUrl(`presupuestos?proyecto_id_ref=eq.${enc}`), { method: 'DELETE' });
  await req(sbUrl(`proyectos?id_ref=eq.${enc}`), { method: 'DELETE' });
}

// ── Totales presupuestarios por proyecto ──────────────────────────────────────

export type TotalesProyecto = {
  proyecto_id_ref: string;
  total_presupuestado: number;
  total_pagado: number;
  total_pendiente: number;
};

export async function getTotalesByProyecto(): Promise<TotalesProyecto[]> {
  const url = sbUrl('presupuesto_totales_por_proyecto') + '?select=*';
  return req<TotalesProyecto[]>(url);
}

// ── Objetivos OKR ─────────────────────────────────────────────────────────────

export async function getObjetivos(proyecto_id: string): Promise<ProyectoObjetivo[]> {
  const url =
    sbUrl('proyecto_objetivos') +
    `?proyecto_id=eq.${encodeURIComponent(proyecto_id)}&order=orden.asc,created_at.asc`;
  return req<ProyectoObjetivo[]>(url);
}

export async function createObjetivo(data: {
  proyecto_id: string;
  titulo: string;
  descripcion?: string;
  fecha_objetivo?: string;
  orden?: number;
}): Promise<ProyectoObjetivo> {
  const url = sbUrl('proyecto_objetivos');
  const [item] = await req<ProyectoObjetivo[]>(url, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { Prefer: 'return=representation' },
  });
  return item!;
}

export async function updateObjetivo(
  id: string,
  data: Partial<{
    titulo: string;
    descripcion: string;
    fecha_objetivo: string;
    estado: ObjetivoEstado;
    orden: number;
  }>,
): Promise<void> {
  await req(sbUrl(`proyecto_objetivos?id=eq.${id}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
    headers: { Prefer: 'return=minimal' },
  });
}

export async function deleteObjetivo(id: string): Promise<void> {
  await req(sbUrl(`proyecto_objetivos?id=eq.${id}`), { method: 'DELETE' });
}

// ── Key Results ───────────────────────────────────────────────────────────────

export async function getKRs(objetivo_id: string): Promise<ProyectoKR[]> {
  const url =
    sbUrl('proyecto_kr') + `?objetivo_id=eq.${objetivo_id}&order=orden.asc,created_at.asc`;
  return req<ProyectoKR[]>(url);
}

export async function getKRsByProyecto(proyecto_id: string): Promise<ProyectoKR[]> {
  const url =
    sbUrl('proyecto_kr') + `?proyecto_id=eq.${encodeURIComponent(proyecto_id)}&order=orden.asc`;
  return req<ProyectoKR[]>(url);
}

export async function createKR(data: {
  objetivo_id: string;
  proyecto_id: string;
  titulo: string;
  unidad: string;
  valor_objetivo?: number;
  valor_actual?: number;
  orden?: number;
}): Promise<ProyectoKR> {
  const [item] = await req<ProyectoKR[]>(sbUrl('proyecto_kr'), {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { Prefer: 'return=representation' },
  });
  return item!;
}

export async function updateKR(
  id: string,
  data: Partial<{
    titulo: string;
    unidad: string;
    valor_objetivo: number;
    valor_actual: number;
    completado: boolean;
    orden: number;
  }>,
): Promise<void> {
  await req(sbUrl(`proyecto_kr?id=eq.${id}`), {
    method: 'PATCH',
    body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
    headers: { Prefer: 'return=minimal' },
  });
}

export async function deleteKR(id: string): Promise<void> {
  await req(sbUrl(`proyecto_kr?id=eq.${id}`), { method: 'DELETE' });
}

// ── Tareas Kanban ─────────────────────────────────────────────────────────────

export async function getTareas(proyecto_id: string): Promise<ProyectoTarea[]> {
  const url =
    sbUrl('proyecto_tareas') +
    `?proyecto_id=eq.${encodeURIComponent(proyecto_id)}&order=orden.asc,created_at.asc`;
  return req<ProyectoTarea[]>(url);
}

export async function createTarea(data: {
  proyecto_id: string;
  titulo: string;
  descripcion?: string;
  columna?: TareaColumna;
  categoria?: string;
  fecha_limite?: string;
  recurrencia?: TareaRecurrencia;
  orden?: number;
}): Promise<ProyectoTarea> {
  const [item] = await req<ProyectoTarea[]>(sbUrl('proyecto_tareas'), {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { Prefer: 'return=representation' },
  });
  return item!;
}

export async function updateTarea(
  id: string,
  data: Partial<{
    titulo: string;
    descripcion: string;
    columna: TareaColumna;
    categoria: string;
    fecha_limite: string;
    recurrencia: TareaRecurrencia;
    orden: number;
  }>,
): Promise<void> {
  await req(sbUrl(`proyecto_tareas?id=eq.${id}`), {
    method: 'PATCH',
    body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
    headers: { Prefer: 'return=minimal' },
  });
}

export async function deleteTarea(id: string): Promise<void> {
  await req(sbUrl(`proyecto_tareas?id=eq.${id}`), { method: 'DELETE' });
}

// ── Tareas globales (todas las tareas, sin filtro de proyecto) ────────────────

export async function getAllTareas(): Promise<ProyectoTarea[]> {
  const url = sbUrl('proyecto_tareas') + '?select=*&order=proyecto_id.asc,orden.asc,created_at.asc';
  return req<ProyectoTarea[]>(url);
}

// ── Tesorería ─────────────────────────────────────────────────────────────────

export type SaldoBancario = {
  sociedad_id_ref: string;
  saldo_actual: number;
  num_movimientos: number;
  ultimo_movimiento: string | null;
};

export async function getSaldosBancarios(): Promise<SaldoBancario[]> {
  const url = sbUrl('saldo_bancario_por_sociedad') + '?select=*';
  return req<SaldoBancario[]>(url);
}

export type CompromisoTesoreria = {
  sociedad_id_ref: string | null;
  fecha: string;
  importe: number;
  tipo_flujo: string;
  concepto: string;
  origen: 'presupuesto' | 'vencimiento' | 'factura';
  fuente: 'presupuesto' | 'vencimiento' | 'factura';
  contingente: boolean;
  proyecto_nombre: string | null;
  origen_id: string;
  estado: string | null;
  es_entrada: boolean;
  presupuesto_id: string | null;
  partida_id: string | null;
  factura_id: string | null;
  vencimiento_id: string | null;
};

/**
 * Obtiene compromisos de tesorería consolidados.
 * - Sin parámetros: todos (holding consolidado).
 * - Con sociedadIds: filtra por IN; usa PostgREST in.(v1,v2).
 */
export async function getCompromisosTesoreria(
  sociedadIds?: string[],
): Promise<CompromisoTesoreria[]> {
  let url = sbUrl('compromisos_tesoreria') + '?select=*&order=fecha.asc';
  if (sociedadIds && sociedadIds.length > 0) {
    const encoded = sociedadIds.join(',');
    url += `&sociedad_id_ref=in.(${encoded})`;
  }
  return req<CompromisoTesoreria[]>(url);
}

// ── Sociedades ────────────────────────────────────────────────────────────────

export type SociedadRow = {
  id_ref: string;
  nombre: string;
};

export async function getSociedades(): Promise<SociedadRow[]> {
  const url = sbUrl('sociedades') + '?select=id_ref,nombre&order=nombre.asc';
  return req<SociedadRow[]>(url);
}

// ── Análisis financiero ───────────────────────────────────────────────────────

import type { AnalisisFinanciero } from './analisisFinanciero';
export type { AnalisisFinanciero } from './analisisFinanciero';

export async function getAnalisisFinanciero(
  proyectoId: string,
): Promise<AnalisisFinanciero | null> {
  const url =
    sbUrl('proyecto_analisis_financiero') +
    `?proyecto_id=eq.${encodeURIComponent(proyectoId)}&limit=1`;
  const rows = await req<AnalisisFinanciero[]>(url);
  return rows[0] ?? null;
}

// Detecta el nombre de columna que PostgREST reporta como inexistente.
// Mensajes típicos:
//   PGRST204 "Could not find the 'X' column of '...' in the schema cache"
//   42703    "column \"X\" of relation ... does not exist"
function columnaDesconocida(msg: string): string | null {
  const m =
    msg.match(/Could not find the '([^']+)' column/) ??
    msg.match(/column "?([\w-]+)"? of/i) ??
    msg.match(/'([\w-]+)' column/);
  return m?.[1] ?? null;
}

export async function upsertAnalisisFinanciero(
  data: AnalisisFinanciero,
): Promise<AnalisisFinanciero> {
  const url = sbUrl('proyecto_analisis_financiero') + '?on_conflict=proyecto_id';
  const mk = (body: Record<string, unknown>): RequestInit => ({
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
  });

  // Reintenta eliminando columnas que la BD aún no conozca (migración no aplicada).
  // Así la app no se rompe aunque falte una migración; simplemente no persiste ese campo.
  let payload = { ...data } as Record<string, unknown>;
  for (let intento = 0; intento < 10; intento++) {
    try {
      const [row] = await req<AnalisisFinanciero[]>(url, mk(payload));
      return row!;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const col = columnaDesconocida(msg);
      if (col && col in payload) {
        const { [col]: _omit, ...resto } = payload;
        void _omit;
        payload = resto;
        continue;
      }
      throw e;
    }
  }
  // Último intento sin la red de seguridad (propaga el error real)
  const [row] = await req<AnalisisFinanciero[]>(url, mk(payload));
  return row!;
}
