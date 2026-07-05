// ── prestamoInsights.ts ────────────────────────────────────────────────────────
// Lectura ejecutiva para "Préstamo / inversión financiera" (Alsari prestamista):
//   · Veredicto automático (Atractivo / Defensivo / Agresivo / Revisar).
//   · Calidad del dato (campos requeridos del instrumento).
// Usa el framework común de insights.ts. Ayuda interna, no recomendación.

import type { AnalisisFinanciero, KpisPrestamo } from './analisisFinanciero';
import {
  evaluarCalidad,
  tieneValor as tiene,
  type Veredicto,
  type CalidadDato,
  type DefCampo,
} from './insights';

// ── Veredicto ─────────────────────────────────────────────────────────────────

export function evaluarVeredictoPrestamo(
  a: AnalisisFinanciero,
  k: KpisPrestamo,
  calidadScore: number,
  faltantesCriticos: string[],
): Veredicto {
  const tasa = k.tasaDescuentoUsada ?? a.tasa_descuento ?? 0.08;
  const tir = k.tirInstrumento;
  const van = k.van;
  const vanAjust = k.vanAjustado;
  const cobertura = k.coberturaGarantia;
  const pd = a.probabilidad_impago_pct;
  const plazoAnos = k.plazoMeses != null ? k.plazoMeses / 12 : null;

  const sinCapital = !tiene(a.nominal_prestamo);
  const sinTipo = !tiene(a.tipo_interes_pct);
  const sinPlazo = !tiene(a.plazo_meses);
  const garantiaDebil = cobertura != null && cobertura < 1;
  const garantiaSinCuantificar = k.garantiaSinValor || cobertura == null;
  const pdAlta = pd != null && pd >= 5;
  const plazoLargo = plazoAnos != null && plazoAnos > 7;

  const bullets: string[] = [];

  // ── Señales de "Revisar" (bloqueantes) ──────────────────────────────────────
  const motivosRevisar: string[] = [];
  if (sinCapital) motivosRevisar.push('Falta el capital prestado.');
  if (sinTipo)
    motivosRevisar.push('Falta el tipo de interés: los intereses y la TIR no son fiables.');
  if (sinPlazo) motivosRevisar.push('Falta el plazo: sin cuadro de amortización no hay VAN/TIR.');
  if (k.tirNoConverge)
    motivosRevisar.push('Los cobros no recuperan el capital: la TIR no es calculable.');
  if (van != null && van < 0) motivosRevisar.push('El VAN base es negativo a la tasa exigida.');
  if (vanAjust != null && vanAjust < 0 && van != null && van >= 0)
    motivosRevisar.push(
      'El VAN ajustado por riesgo es negativo: el riesgo de impago se come la rentabilidad.',
    );
  if (k.perdidaIncompleta)
    motivosRevisar.push('Riesgo incompleto: falta la probabilidad de impago o la LGD.');
  if (faltantesCriticos.length > 0)
    motivosRevisar.push(`Faltan datos clave: ${faltantesCriticos.slice(0, 3).join(', ')}.`);

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

  // ── Clasificación ───────────────────────────────────────────────────────────
  const tirSuperaTasa = tir != null && tir > tasa;
  const vanPositivo = van != null && van > 0;
  const vanAjustOk = vanAjust == null || vanAjust >= 0 || (van != null && vanAjust >= van * 0.5);
  const coberturaRazonable = cobertura != null && cobertura >= 1;
  const coberturaHolgada = cobertura != null && cobertura >= 1.3;
  const pdBaja = pd == null || pd < 3;

  // Agresivo: buena rentabilidad contractual pero garantía débil/no cuantificada, PD alta o plazo largo
  if (
    tirSuperaTasa &&
    vanPositivo &&
    (garantiaDebil || garantiaSinCuantificar || pdAlta || plazoLargo)
  ) {
    if (garantiaDebil && cobertura != null)
      bullets.push(`Cobertura de garantía débil (${cobertura.toFixed(2)}x, por debajo de 1).`);
    else if (garantiaSinCuantificar)
      bullets.push('Garantía no cuantificada: no se puede medir la cobertura.');
    if (pdAlta && pd != null) bullets.push(`Probabilidad de impago alta (${pd}%).`);
    if (plazoLargo && plazoAnos != null)
      bullets.push(
        `Plazo largo (${plazoAnos.toFixed(1)} años): más exposición al riesgo de contraparte.`,
      );
    if (tir != null)
      bullets.push(
        `TIR ${(tir * 100).toFixed(1)}% por encima de la tasa exigida (${(tasa * 100).toFixed(1)}%).`,
      );
    return {
      tipo: 'Agresivo',
      motivo: 'Buena rentabilidad contractual, pero el riesgo (garantía o impago) es elevado.',
      bullets: bullets.slice(0, 5),
    };
  }

  // Atractivo: TIR>tasa, VAN>0, VAN ajustado sano, cobertura razonable, PD baja
  if (tirSuperaTasa && vanPositivo && vanAjustOk && coberturaRazonable && pdBaja) {
    if (tir != null)
      bullets.push(
        `TIR ${(tir * 100).toFixed(1)}% supera la tasa exigida (${(tasa * 100).toFixed(1)}%).`,
      );
    if (van != null)
      bullets.push(`VAN base positivo (${Math.round(van).toLocaleString('es-ES')} €).`);
    if (vanAjust != null)
      bullets.push(
        `VAN ajustado por riesgo ${vanAjust >= 0 ? 'positivo' : 'aún razonable'} (${Math.round(vanAjust).toLocaleString('es-ES')} €).`,
      );
    if (cobertura != null)
      bullets.push(
        `Cobertura de garantía ${coberturaHolgada ? 'holgada' : 'razonable'} (${cobertura.toFixed(2)}x).`,
      );
    if (pd != null) bullets.push(`Probabilidad de impago baja (${pd}%).`);
    return {
      tipo: 'Atractivo',
      motivo: 'Rentabilidad por encima del umbral, con garantía y riesgo de impago controlados.',
      bullets: bullets.slice(0, 5),
    };
  }

  // Defensivo: rentabilidad moderada, buena garantía, bajo riesgo, plazo controlado
  if (tir != null)
    bullets.push(`Rentabilidad contractual moderada (TIR ${(tir * 100).toFixed(1)}%).`);
  bullets.push(
    cobertura != null
      ? `Cobertura de garantía ${cobertura.toFixed(2)}x.`
      : 'Garantía no cuantificada.',
  );
  if (pd != null) bullets.push(`Probabilidad de impago ${pd}%.`);
  if (plazoAnos != null) bullets.push(`Plazo ${plazoAnos.toFixed(1)} años.`);
  return {
    tipo: 'Defensivo',
    motivo: 'Operación conservadora: rentabilidad moderada con riesgo de contraparte contenido.',
    bullets: bullets.slice(0, 5),
  };
}

// ── Calidad del dato (campos requeridos del préstamo) ─────────────────────────

export function evaluarCalidadPrestamo(a: AnalisisFinanciero): CalidadDato {
  const tieneRiesgo = a.probabilidad_impago_pct != null || a.lgd_pct != null;

  const defs: DefCampo[] = [
    {
      label: 'Capital prestado',
      peso: 3,
      critico: true,
      estado: (a) => (tiene(a.nominal_prestamo) ? 'completo' : 'faltante'),
    },
    {
      label: 'Tipo de interés',
      peso: 3,
      critico: true,
      estado: (a) => (tiene(a.tipo_interes_pct) ? 'completo' : 'faltante'),
    },
    {
      label: 'Plazo',
      peso: 3,
      critico: true,
      estado: (a) => (tiene(a.plazo_meses) ? 'completo' : 'faltante'),
    },
    {
      label: 'Tasa de descuento',
      peso: 2,
      critico: true,
      estado: (a) => (a.tasa_descuento != null ? 'completo' : 'estimado'),
    },
    {
      label: 'Sistema de amortización',
      peso: 1,
      estado: (a) => (a.sistema_amortizacion != null ? 'completo' : 'estimado'),
    },
    {
      label: 'Vencimiento / calendario',
      peso: 1,
      estado: (a) => (a.fecha_vencimiento_instrumento != null ? 'completo' : 'estimado'),
    },
    {
      label: 'Garantía / colateral',
      peso: 1,
      estado: (a) => (a.colateral ? 'completo' : 'faltante'),
    },
    {
      label: 'Valor de garantía',
      peso: 1,
      estado: (a) => (tiene(a.valor_garantia) ? 'completo' : 'faltante'),
    },
    {
      label: 'Probabilidad de impago',
      peso: 1,
      estado: (a) => (a.probabilidad_impago_pct != null ? 'completo' : 'estimado'),
    },
    { label: 'LGD', peso: 1, estado: (a) => (a.lgd_pct != null ? 'completo' : 'estimado') },
    {
      label: 'Rating interno',
      peso: 1,
      estado: (a) => (a.rating_interno ? 'completo' : 'estimado'),
    },
  ];

  // Si se ha empezado a informar riesgo, PD y LGD pasan a ser más importantes (crítico parcial)
  if (tieneRiesgo) {
    const pd = defs.find((d) => d.label === 'Probabilidad de impago');
    if (pd) pd.critico = true;
    const lgd = defs.find((d) => d.label === 'LGD');
    if (lgd) lgd.critico = true;
  }

  return evaluarCalidad(a, defs);
}
