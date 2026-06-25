// Lógica PURA (sin red) de las reglas de proveedor recurrente (PR E). La UI la usa
// para SUGERIR campos al revisar una factura; nada se aplica ni valida solo.
// Reglas clave (decisiones de Guille):
//   · Selección: regla específica (contacto+sociedad) > regla global (sociedad null).
//   · Si la factura NO tiene sociedad validada → solo la regla GLOBAL (no se asume
//     sociedad; PR D.1 manda: jamás se pisa la sociedad del OCR).
//   · v1 = solo sugerencias: `auto_validar` es inerte; `requiere_aprobacion_javi`
//     es solo aviso (no fuerza routing).
import type {
  ProveedorRegla, FacturaRecibida, FacturaPago, MetodoPago, TipoOperacion,
  EstadoOperativoDomiciliada,
} from '@alsari/types';
import { normalizeNif } from './sociedadMatch';

// ── Selección de la regla aplicable ───────────────────────────────────────────
export function seleccionarRegla(
  reglas: ProveedorRegla[],
  contactoId: string | null,
  sociedadIdRef: string | null,
  sociedadValidada: boolean,
): ProveedorRegla | null {
  if (!contactoId) return null;
  const activas = reglas.filter(r => r.activa && r.contacto_id === contactoId);
  const global = activas.find(r => r.sociedad_id_ref === null) ?? null;
  // Sociedad pendiente → solo global (no se asume una sociedad concreta).
  if (!sociedadValidada || !sociedadIdRef) return global;
  const especifica = activas.find(r => r.sociedad_id_ref === sociedadIdRef) ?? null;
  return especifica ?? global;
}

// ── Análisis de la regla contra una factura ───────────────────────────────────
export type CampoSugerido =
  | 'cuenta_gasto' | 'tipo_operacion' | 'tipo_iva' | 'retencion_pct'
  | 'concepto' | 'es_domiciliada';

export type Sugerencia = {
  campo: CampoSugerido;
  label: string;
  valor: string | number | boolean;
  yaAplicado: boolean;   // la factura ya tiene ese valor → no hace falta aplicar
};

export type ImporteFueraRango = {
  habitual: number;
  toleranciaPct: number;
  desviacionPct: number;
  actual: number;
};

export type AnalisisRegla = {
  sugerencias: Sugerencia[];
  requiereJavi: boolean;
  domiciliada: boolean;                          // la regla marca el proveedor como domiciliado
  importeFueraRango: ImporteFueraRango | null;
  partidaSugerida: { presupuesto_id: string | null; partida_id: string } | null;
  proyectoSugerido: string | null;
  metodoPagoDefault: MetodoPago | null;
  requiereFactura: boolean;
  requiereJustificantePago: boolean;
};

function num(n: number | null | undefined): number | null {
  return n === null || n === undefined || Number.isNaN(n) ? null : n;
}

export function analizarRegla(regla: ProveedorRegla, factura: FacturaRecibida): AnalisisRegla {
  const sugerencias: Sugerencia[] = [];

  if (regla.cuenta_contable_default) {
    sugerencias.push({
      campo: 'cuenta_gasto', label: 'Cuenta contable', valor: regla.cuenta_contable_default,
      yaAplicado: factura.cuenta_gasto === regla.cuenta_contable_default,
    });
  }
  if (regla.tipo_operacion_default) {
    sugerencias.push({
      campo: 'tipo_operacion', label: 'Tipo de operación', valor: regla.tipo_operacion_default,
      yaAplicado: factura.tipo_operacion === regla.tipo_operacion_default,
    });
  }
  if (num(regla.iva_default) !== null) {
    sugerencias.push({
      campo: 'tipo_iva', label: 'IVA %', valor: regla.iva_default as number,
      yaAplicado: factura.tipo_iva === regla.iva_default,
    });
  }
  if (num(regla.retencion_pct_default) !== null) {
    sugerencias.push({
      campo: 'retencion_pct', label: 'Retención %', valor: regla.retencion_pct_default as number,
      yaAplicado: factura.retencion_pct === regla.retencion_pct_default,
    });
  }
  if (regla.concepto_recurrente) {
    sugerencias.push({
      campo: 'concepto', label: 'Concepto', valor: regla.concepto_recurrente,
      yaAplicado: factura.concepto === regla.concepto_recurrente,
    });
  }
  if (regla.es_domiciliada) {
    sugerencias.push({
      campo: 'es_domiciliada', label: 'Domiciliada', valor: true,
      yaAplicado: factura.es_domiciliada === true,
    });
  }

  // Alerta de importe: solo si hay base (importe_habitual) Y tolerancia.
  let importeFueraRango: ImporteFueraRango | null = null;
  const hab = num(regla.importe_habitual);
  const tol = num(regla.tolerancia_importe_pct);
  if (hab !== null && hab > 0 && tol !== null) {
    const desviacionPct = Math.abs(factura.total - hab) / hab * 100;
    if (desviacionPct > tol) {
      importeFueraRango = {
        habitual: hab, toleranciaPct: tol,
        desviacionPct: Math.round(desviacionPct * 10) / 10, actual: factura.total,
      };
    }
  }

  return {
    sugerencias,
    requiereJavi: regla.requiere_aprobacion_javi,
    domiciliada: regla.es_domiciliada,
    importeFueraRango,
    partidaSugerida: regla.partida_id ? { presupuesto_id: regla.presupuesto_id, partida_id: regla.partida_id } : null,
    proyectoSugerido: regla.proyecto_id_ref,
    metodoPagoDefault: regla.metodo_pago_default,
    requiereFactura: regla.requiere_factura,
    requiereJustificantePago: regla.requiere_justificante_pago,
  };
}

// ¿La regla aporta algo aún no aplicado (sugerencias pendientes o avisos)?
export function tieneSugerenciasPendientes(a: AnalisisRegla): boolean {
  return a.sugerencias.some(s => !s.yaAplicado) || !!a.importeFueraRango || !!a.partidaSugerida;
}

// ── Borrador de regla a partir de una factura existente ───────────────────────
export function reglaDesdeFactura(
  factura: FacturaRecibida,
  contactoId: string,
  metodoPago?: MetodoPago | null,
): Partial<ProveedorRegla> {
  return {
    contacto_id: contactoId,
    nif_normalizado: normalizeNif(factura.proveedor_nif) || null,
    // Solo se fija la sociedad si está validada (PR D.1); si no, regla global.
    sociedad_id_ref: factura.sociedad_validada ? factura.sociedad_id_ref : null,
    cuenta_contable_default: factura.cuenta_gasto,
    proyecto_id_ref: factura.proyecto_id_ref,
    metodo_pago_default: metodoPago ?? null,
    es_domiciliada: factura.es_domiciliada,
    requiere_pago_manual: !factura.es_domiciliada,
    requiere_aprobacion_javi: false,
    requiere_factura: true,
    requiere_justificante_pago: true,
    tipo_operacion_default: (factura.tipo_operacion as TipoOperacion | null) ?? null,
    iva_default: factura.tipo_iva,
    retencion_pct_default: factura.retencion_pct,
    importe_habitual: factura.total,
    tolerancia_importe_pct: null,
    concepto_recurrente: factura.concepto,
    auto_validar: false,
    activa: true,
  };
}

// ── Sub-estado operativo DERIVADO de una factura domiciliada ──────────────────
// No se persiste; refleja el ciclo "pendiente de cargo → cargada → pagada".
export function estadoOperativoFactura(
  factura: FacturaRecibida,
  pagos: FacturaPago[],
): EstadoOperativoDomiciliada | null {
  if (!factura.es_domiciliada) return null;
  if (factura.estado === 'pagada') return 'pagada';
  if (factura.estado !== 'pendiente_pago') return null; // borrador/revisión/rechazada: aún no aplica
  if (pagos.some(p => !p.justificante_storage_path)) return 'cargada_sin_justificante';
  return 'pendiente_cargo';
}
