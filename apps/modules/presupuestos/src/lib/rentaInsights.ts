// ── rentaInsights.ts ───────────────────────────────────────────────────────────
// Capa de "lectura ejecutiva" para análisis de renta patrimonial:
//   · Veredicto automático (Atractivo / Defensivo / Agresivo / Revisar)
//   · Calidad del dato (Alta / Media / Baja + desglose completos/estimados/faltantes)
// Es una ayuda interna de análisis, NO una recomendación de inversión definitiva.

import type { AnalisisFinanciero } from './analisisFinanciero';
import type { KpisRentaExtended } from './analisisFinanciero';
import {
  evaluarCalidad,
  tieneValor as tiene,
  type Veredicto,
  type CalidadDato,
  type DefCampo,
} from './insights';

// Re-export de tipos comunes para compatibilidad con importadores existentes.
export type { Veredicto, VeredictoTipo, CalidadDato, CalidadNivel, CampoCalidad } from './insights';

export function evaluarVeredictoRenta(
  a: AnalisisFinanciero,
  k: KpisRentaExtended,
  calidadScore: number,
  faltantesCriticos: string[],
): Veredicto {
  const tasa = k.tasaDescuentoUsada ?? a.tasa_descuento ?? 0.08;
  const tieneDeuda = (a.deuda_hipotecaria ?? 0) > 0;
  const tir = k.tirConResidual;
  const van = k.van;
  const vanSinResidual = k.vanSinResidual;
  const dscr = k.dscr;
  const cashflow = k.noIAnual != null ? k.noIAnual - (k.servicioDeudaAnual ?? 0) : null;
  const ltv = k.ltv;
  const yieldNeto = k.yieldNetoCoste;

  const bullets: string[] = [];

  // ── Señales de "Revisar" (bloqueantes) ──────────────────────────────────────
  const motivosRevisar: string[] = [];
  if (van != null && van < 0)
    motivosRevisar.push('El VAN es negativo: no crea valor por encima de la tasa exigida.');
  if (cashflow != null && cashflow < 0)
    motivosRevisar.push('La caja anual es negativa: el activo no se autofinancia.');
  if (tieneDeuda && dscr != null && dscr < 1.1)
    motivosRevisar.push('El DSCR es bajo: la renta apenas cubre la cuota de deuda.');
  if (faltantesCriticos.length > 0)
    motivosRevisar.push(`Faltan datos clave: ${faltantesCriticos.slice(0, 3).join(', ')}.`);
  if (k.tirSinDatos)
    motivosRevisar.push(
      'No hay datos suficientes (horizonte o valor residual) para una TIR fiable.',
    );

  if (motivosRevisar.length > 0 || calidadScore < 45) {
    return {
      tipo: 'Revisar',
      motivo: motivosRevisar[0] ?? 'Faltan datos importantes para fiarse del análisis.',
      bullets: [
        ...motivosRevisar.slice(0, 4),
        ...(calidadScore < 45
          ? [`Calidad del dato baja (${calidadScore}%): completa el análisis antes de decidir.`]
          : []),
      ].slice(0, 5),
    };
  }

  // ── Renta operativa vs componente patrimonial ───────────────────────────────
  const tirSuperaTasa = tir != null && tir > tasa;
  const vanPositivo = van != null && van > 0;
  const cashflowOk = cashflow != null && cashflow >= 0;
  const dscrHolgado = !tieneDeuda || (dscr != null && dscr >= 1.3);
  const ltvAlto = tieneDeuda && ltv != null && ltv > 0.7;
  const dscrAjustado = tieneDeuda && dscr != null && dscr >= 1.1 && dscr < 1.3;
  // ¿La operación funciona por la renta, al margen del valor residual?
  const operativaFuerte = yieldNeto != null && yieldNeto > tasa + 0.03; // NOI/coste supera la tasa + 3 puntos
  const funcionaPorRenta = (vanSinResidual != null && vanSinResidual >= 0) || operativaFuerte;
  const dependeDelResidual = vanSinResidual != null && vanSinResidual < 0; // sin el residual no crea valor
  // Peso del residual en el VAN total (aporte del residual / VAN)
  const aporteResidual = van != null && vanSinResidual != null ? van - vanSinResidual : null;
  const residualPesoAlto =
    aporteResidual != null && van != null && van > 0 && aporteResidual > van * 0.5;

  // ── Agresivo ────────────────────────────────────────────────────────────────
  // Solo si el retorno descansa casi exclusivamente en el valor residual (la renta
  // no carga la operación) o hay tensión real de apalancamiento (deuda informada).
  if (tirSuperaTasa && ((dependeDelResidual && !operativaFuerte) || ltvAlto || dscrAjustado)) {
    if (dependeDelResidual && !operativaFuerte)
      bullets.push(
        'La rentabilidad depende casi por completo del valor residual estimado: conviene validarlo.',
      );
    if (ltvAlto && ltv != null)
      bullets.push(
        `Apalancamiento alto (LTV ${(ltv * 100).toFixed(0)}%): amplifica retorno y riesgo.`,
      );
    if (dscrAjustado && dscr != null)
      bullets.push(`DSCR ajustado (${dscr.toFixed(2)}x): poco margen ante imprevistos.`);
    if (tir != null)
      bullets.push(
        `TIR ${(tir * 100).toFixed(1)}% por encima de la tasa exigida (${(tasa * 100).toFixed(1)}%).`,
      );
    if (cashflowOk) bullets.push('La caja anual es positiva.');
    return {
      tipo: 'Agresivo',
      motivo: 'Buen retorno, pero apoyado sobre todo en el valor residual o en el apalancamiento.',
      bullets: bullets.slice(0, 5),
    };
  }

  // ── Atractivo ───────────────────────────────────────────────────────────────
  // TIR > tasa, VAN > 0, caja positiva, DSCR holgado (o sin deuda) y la operación
  // funciona por la renta. Si además el residual aporta mucho, se matiza.
  if (tirSuperaTasa && vanPositivo && cashflowOk && dscrHolgado && funcionaPorRenta) {
    if (yieldNeto != null)
      bullets.push(
        `Rentabilidad neta sobre coste del ${(yieldNeto * 100).toFixed(1)}% (por encima de la tasa exigida del ${(tasa * 100).toFixed(1)}%).`,
      );
    bullets.push('La caja anual es positiva: el activo se autofinancia.');
    if (van != null)
      bullets.push(
        `VAN positivo (${Math.round(van).toLocaleString('es-ES')} €)${residualPesoAlto ? ', con parte relevante aportada por el valor residual' : ''}.`,
      );
    if (tieneDeuda && dscr != null)
      bullets.push(`DSCR holgado (${dscr.toFixed(2)}x): la renta cubre la deuda con margen.`);
    if (residualPesoAlto)
      bullets.push(
        'Conviene validar el valor actual estimado, porque aporta una parte relevante del retorno total.',
      );
    else if (tir != null) bullets.push(`TIR ${(tir * 100).toFixed(1)}% con valor residual.`);
    return {
      tipo: 'Atractivo',
      motivo: residualPesoAlto
        ? 'Alta rentabilidad operativa y fuerte componente patrimonial. La renta por sí sola ofrece una rentabilidad neta elevada; conviene validar el valor actual estimado, que aporta una parte relevante del retorno.'
        : 'Rentabilidad por encima del umbral exigido, con caja sana.',
      bullets: bullets.slice(0, 5),
    };
  }

  // ── Defensivo ───────────────────────────────────────────────────────────────
  bullets.push(
    yieldNeto != null
      ? `Rentabilidad neta moderada (${(yieldNeto * 100).toFixed(1)}% sobre coste).`
      : 'Rentabilidad moderada.',
  );
  bullets.push(
    tieneDeuda
      ? ltv != null
        ? `Apalancamiento contenido (LTV ${(ltv * 100).toFixed(0)}%).`
        : 'Apalancamiento contenido.'
      : 'Sin deuda: riesgo financiero bajo.',
  );
  if (cashflowOk) bullets.push('Caja anual estable y positiva.');
  if (van != null)
    bullets.push(
      van >= 0 ? 'VAN en torno a cero o positivo.' : 'VAN ligeramente negativo a la tasa exigida.',
    );
  return {
    tipo: 'Defensivo',
    motivo: 'Perfil conservador: rentabilidad moderada y riesgo bajo.',
    bullets: bullets.slice(0, 5),
  };
}

// ── Calidad del dato (campos requeridos de renta) ─────────────────────────────

export function evaluarCalidadRenta(a: AnalisisFinanciero): CalidadDato {
  const tieneDeuda = (a.deuda_hipotecaria ?? 0) > 0;

  const defs: DefCampo[] = [
    {
      label: 'Coste de compra',
      peso: 3,
      critico: true,
      estado: (a) => (tiene(a.precio_adquisicion) ? 'completo' : 'faltante'),
    },
    {
      label: 'Gastos de adquisición',
      peso: 1,
      estado: (a) => (tiene(a.gastos_adquisicion) ? 'completo' : 'faltante'),
    },
    {
      label: 'CAPEX inicial',
      peso: 1,
      estado: (a) => (tiene(a.capex_inicial) ? 'completo' : 'faltante'),
    },
    {
      label: 'Valor actual estimado',
      peso: 2,
      estado: (a) => (tiene(a.valoracion_actual) ? 'completo' : 'faltante'),
    },
    {
      label: 'Renta mensual',
      peso: 3,
      critico: true,
      estado: (a) => (tiene(a.renta_mensual_bruta) ? 'completo' : 'faltante'),
    },
    {
      label: 'Ocupación',
      peso: 1,
      estado: (a) => (a.tasa_ocupacion_prevista_pct != null ? 'completo' : 'estimado'),
    },
    {
      label: 'Gastos operativos',
      peso: 2,
      estado: (a) => (tiene(a.gastos_operativos_anuales) ? 'completo' : 'faltante'),
    },
    { label: 'IBI', peso: 1, estado: (a) => (tiene(a.ibi_anual) ? 'completo' : 'faltante') },
    { label: 'Seguro', peso: 1, estado: (a) => (tiene(a.seguro_anual) ? 'completo' : 'faltante') },
    {
      label: 'CAPEX de mantenimiento',
      peso: 1,
      estado: (a) => (tiene(a.capex_mantenimiento_anual) ? 'completo' : 'faltante'),
    },
    {
      label: 'Estructura de capital (deuda)',
      peso: 1,
      estado: (a) => (a.deuda_hipotecaria != null ? 'completo' : 'estimado'),
    },
    {
      label: 'Tasa de descuento',
      peso: 2,
      critico: true,
      estado: (a) => (a.tasa_descuento != null ? 'completo' : 'estimado'),
    },
    {
      label: 'Horizonte de análisis',
      peso: 2,
      estado: (a) => (a.horizonte_analisis_anios != null ? 'completo' : 'estimado'),
    },
    {
      label: 'Método de valor residual',
      peso: 2,
      critico: true,
      estado: (a) => (a.metodo_valor_residual != null ? 'completo' : 'estimado'),
    },
    {
      label: 'Superficie (m²)',
      peso: 1,
      estado: (a) => (tiene(a.superficie_arrendable_m2) ? 'completo' : 'faltante'),
    },
  ];

  // Campos de deuda solo cuentan si hay deuda registrada
  if (tieneDeuda) {
    defs.push(
      {
        label: 'Cuota / servicio de deuda',
        peso: 2,
        critico: true,
        estado: (a) =>
          tiene(a.cuota_hipoteca_mensual) || tiene(a.tipo_interes_deuda_pct)
            ? 'completo'
            : 'faltante',
      },
      {
        label: 'Tipo de interés de deuda',
        peso: 1,
        estado: (a) => (tiene(a.tipo_interes_deuda_pct) ? 'completo' : 'estimado'),
      },
      {
        label: 'Plazo restante',
        peso: 1,
        estado: (a) => (tiene(a.plazo_restante_anios) ? 'completo' : 'estimado'),
      },
    );
  }

  // Fiscalidad: si está activada, sus campos suman; si no, no penaliza
  if (a.aplicar_fiscalidad === true) {
    defs.push(
      {
        label: 'Tipo de IS',
        peso: 1,
        estado: (a) => (tiene(a.impuesto_sociedades_pct) ? 'completo' : 'estimado'),
      },
      {
        label: 'Amortización fiscal',
        peso: 1,
        estado: (a) => (tiene(a.amortizacion_fiscal_anual) ? 'completo' : 'faltante'),
      },
      {
        label: 'Costes de venta',
        peso: 1,
        estado: (a) => (tiene(a.costes_venta_pct) ? 'completo' : 'estimado'),
      },
    );
  }

  return evaluarCalidad(a, defs);
}

// ── Explotar vs liquidar ──────────────────────────────────────────────────────
// Compara la rentabilidad neta sobre el VALOR ACTUAL (NOI / valor actual) con la
// tasa exigida, para ayudar a decidir si conviene seguir explotando el activo o
// estudiar su venta/liquidación. No es una recomendación definitiva.

export type ExplotarLiquidarNivel = 'explotar' | 'neutral' | 'revisar' | 'na';

export type ExplotarLiquidar = {
  nivel: ExplotarLiquidarNivel;
  titulo: string;
  mensaje: string;
  nota: string;
};

export function lecturaExplotarLiquidar(
  yieldNetoValorActual: number | null,
  tasa: number,
): ExplotarLiquidar {
  const nota =
    'No es una recomendación de venta: hay que considerar impuestos, costes de venta, deuda, liquidez, revalorización esperada y alternativas disponibles.';
  if (yieldNetoValorActual == null) {
    return {
      nivel: 'na',
      titulo: 'Sin valor actual',
      mensaje: 'Falta el valor actual estimado para comparar explotación vs liquidación.',
      nota,
    };
  }
  const yp = (yieldNetoValorActual * 100).toFixed(1);
  const tp = (tasa * 100).toFixed(1);
  if (yieldNetoValorActual >= tasa) {
    return {
      nivel: 'explotar',
      titulo: 'Explotación atractiva',
      mensaje: `La rentabilidad neta sobre el valor actual (${yp}%) iguala o supera la tasa exigida (${tp}%): la explotación sigue siendo atractiva frente al valor actual estimado.`,
      nota,
    };
  }
  if (yieldNetoValorActual >= tasa - 0.01) {
    return {
      nivel: 'neutral',
      titulo: 'Cerca de la tasa exigida',
      mensaje: `La rentabilidad neta sobre el valor actual (${yp}%) está cerca de la tasa exigida (${tp}%): conviene comparar con alternativas y coste de oportunidad.`,
      nota,
    };
  }
  return {
    nivel: 'revisar',
    titulo: 'Estudiar rotación de capital',
    mensaje: `La rentabilidad neta sobre el valor actual (${yp}%) es inferior a la tasa exigida (${tp}%): podría tener sentido estudiar venta, refinanciación o rotación de capital.`,
    nota,
  };
}
