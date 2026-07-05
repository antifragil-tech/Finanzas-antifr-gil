/// <reference types="vite/client" />
// ── metricasProyectoApi.ts ─────────────────────────────────────────────────────
// Helper de lectura/escritura para el módulo de métricas por proyecto.
// Todas las queries se hacen directamente a Supabase REST API.

import type { FlujoProyectoConsolidado, MetricasProyectoResumen } from '@alsari/types';
import type { AnalisisFinanciero } from './analisisFinanciero';

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

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Devuelve las métricas resumen de un proyecto (vista metricas_proyecto_resumen).
 * Retorna null si el proyecto no existe o no tiene datos.
 */
export async function getMetricasProyectoResumen(
  proyectoId: string,
): Promise<MetricasProyectoResumen | null> {
  const url =
    sbUrl('metricas_proyecto_resumen') +
    `?proyecto_id_ref=eq.${encodeURIComponent(proyectoId)}&limit=1`;
  const rows = await req<MetricasProyectoResumen[]>(url);
  return rows[0] ?? null;
}

/**
 * Devuelve los flujos consolidados de un proyecto (vista flujos_proyecto_consolidados).
 * Opciones de filtrado: soloReales, soloPendientes, fuente.
 */
export async function getFlujosProyectoConsolidados(
  proyectoId: string,
  opciones?: {
    soloReales?: boolean;
    soloPendientes?: boolean;
    fuente?: 'flujo_manual' | 'presupuesto_pago' | 'factura_recibida';
  },
): Promise<FlujoProyectoConsolidado[]> {
  let url =
    sbUrl('flujos_proyecto_consolidados') +
    `?proyecto_id_ref=eq.${encodeURIComponent(proyectoId)}&order=fecha.asc`;
  if (opciones?.soloReales) url += '&es_real=eq.true';
  if (opciones?.soloPendientes) url += '&es_previsto=eq.true';
  if (opciones?.fuente) url += `&fuente=eq.${opciones.fuente}`;
  return req<FlujoProyectoConsolidado[]>(url);
}

/**
 * Devuelve el análisis financiero parametrizado de un proyecto.
 * Retorna null si no existe registro para ese proyecto.
 */
export async function getAnalisisFinancieroProyecto(
  proyectoId: string,
): Promise<AnalisisFinanciero | null> {
  const url =
    sbUrl('proyecto_analisis_financiero') +
    `?proyecto_id=eq.${encodeURIComponent(proyectoId)}&limit=1`;
  const rows = await req<AnalisisFinanciero[]>(url);
  return rows[0] ?? null;
}

/**
 * Crea o actualiza el análisis financiero de un proyecto (upsert por proyecto_id).
 * Retorna el registro guardado con todos sus campos.
 */
export async function upsertAnalisisFinancieroProyecto(
  proyectoId: string,
  data: Partial<AnalisisFinanciero>,
): Promise<AnalisisFinanciero> {
  const url = sbUrl('proyecto_analisis_financiero') + '?on_conflict=proyecto_id';
  const payload = { ...data, proyecto_id: proyectoId };
  const rows = await req<AnalisisFinanciero[]>(url, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
  });
  if (!rows[0]) throw new Error('No se pudo guardar el análisis financiero');
  return rows[0];
}
