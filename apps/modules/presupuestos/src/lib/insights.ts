// ── insights.ts ────────────────────────────────────────────────────────────────
// Framework común del "patrón ejecutivo" de los análisis financieros:
//   · Tipos del veredicto (Atractivo / Defensivo / Agresivo / Revisar).
//   · Framework de "calidad del dato": cada tipo de análisis define su lista de
//     campos requeridos (ponderados) y este módulo calcula score, nivel y desglose.
// La LÓGICA específica por tipo (qué campos, qué reglas de veredicto) vive en los
// módulos `*Insights.ts` de cada tipo; aquí solo lo genérico y reutilizable.

import type { AnalisisFinanciero } from './analisisFinanciero';

// ── Veredicto ─────────────────────────────────────────────────────────────────

export type VeredictoTipo = 'Atractivo' | 'Defensivo' | 'Agresivo' | 'Revisar';

export type Veredicto = {
  tipo: VeredictoTipo;
  motivo: string;       // una línea en lenguaje simple
  bullets: string[];    // 3-5 razones
};

// ── Calidad del dato ──────────────────────────────────────────────────────────

export type CalidadNivel = 'Alta' | 'Media' | 'Baja';

export type EstadoCampo = 'completo' | 'estimado' | 'faltante';

export type CampoCalidad = { label: string; estado: EstadoCampo; critico: boolean };

export type CalidadDato = {
  score: number;            // 0-100
  nivel: CalidadNivel;
  campos: CampoCalidad[];
  completos: string[];
  estimados: string[];
  faltantes: string[];
  faltantesCriticos: string[];
};

// Definición de un campo que compone la calidad de un tipo de análisis.
// `peso` pondera su importancia; `critico` marca los que, si faltan, impiden
// fiarse del análisis.
export type DefCampo = {
  label: string;
  peso: number;
  critico?: boolean;
  estado: (a: AnalisisFinanciero) => EstadoCampo;
};

// Un valor numérico se considera presente si no es null/undefined y no es 0.
export const tieneValor = (v: number | null | undefined): boolean => v != null && v !== 0;

// Calcula la calidad del dato a partir de la lista de campos del tipo.
// Puntuación: completo = peso · estimado = 60% del peso · faltante = 0.
export function evaluarCalidad(a: AnalisisFinanciero, defs: DefCampo[]): CalidadDato {
  const campos: CampoCalidad[] = defs.map(d => ({ label: d.label, estado: d.estado(a), critico: !!d.critico }));

  const pesoTotal = defs.reduce((s, d) => s + d.peso, 0);
  const pesoObtenido = defs.reduce((s, d) => {
    const e = d.estado(a);
    return s + (e === 'completo' ? d.peso : e === 'estimado' ? d.peso * 0.6 : 0);
  }, 0);
  const score = pesoTotal > 0 ? Math.round((pesoObtenido / pesoTotal) * 100) : 0;
  const nivel: CalidadNivel = score >= 80 ? 'Alta' : score >= 55 ? 'Media' : 'Baja';

  const completos = campos.filter(c => c.estado === 'completo').map(c => c.label);
  const estimados = campos.filter(c => c.estado === 'estimado').map(c => c.label);
  const faltantes = campos.filter(c => c.estado === 'faltante').map(c => c.label);
  const faltantesCriticos = campos.filter(c => c.estado === 'faltante' && c.critico).map(c => c.label);

  return { score, nivel, campos, completos, estimados, faltantes, faltantesCriticos };
}
