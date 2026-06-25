// ── alternativoInsights.ts ─────────────────────────────────────────────────────
// Lectura ejecutiva para "Alternativo" (inversión alternativa genérica):
//   · Veredicto automático, modulado por riesgo y liquidez.
//   · Calidad del dato (campos requeridos).
// Usa el framework común de insights.ts. Ayuda interna, no recomendación.

import type { AnalisisFinanciero, KpisAlternativo } from './analisisFinanciero';
import { evaluarCalidad, tieneValor as tiene, type Veredicto, type CalidadDato, type DefCampo } from './insights';

// ── Veredicto ─────────────────────────────────────────────────────────────────

export function evaluarVeredictoAlternativo(
  a: AnalisisFinanciero,
  k: KpisAlternativo,
  calidadScore: number,
  faltantesCriticos: string[],
): Veredicto {
  const tasa      = k.tasaUsada ?? a.tasa_descuento ?? 0.08;
  const tir       = k.tirEquity;
  const van       = k.van;
  const moic      = k.moic;
  const beneficio = k.beneficioEsperado;
  const anos      = k.anosUsados;

  const sinCapital = k.capitalRequerido == null;
  const sinRetorno = k.retornoTotal == null;
  const sinPlazo   = anos == null;

  const riesgo   = a.nivel_riesgo ?? null;     // 'bajo' | 'medio' | 'alto'
  const liquidez = a.nivel_liquidez ?? null;   // 'alta' | 'media' | 'baja'
  const riesgoAlto    = riesgo === 'alto';
  const liquidezBaja  = liquidez === 'baja';
  const riesgoLiquidezSinInformar = riesgo == null || liquidez == null;
  const plazoLargo    = anos != null && anos > 7;

  const bullets: string[] = [];

  // ── Señales de "Revisar" (bloqueantes) ──────────────────────────────────────
  const motivosRevisar: string[] = [];
  if (sinCapital) motivosRevisar.push('Falta el capital requerido.');
  if (sinRetorno) motivosRevisar.push('Falta el retorno esperado total.');
  if (sinPlazo) motivosRevisar.push('Falta el plazo (fechas de inicio y salida): sin él no hay VAN ni TIR.');
  if (beneficio != null && beneficio <= 0) motivosRevisar.push('El retorno esperado no supera el capital invertido: la operación no genera beneficio.');
  if (van != null && van < 0) motivosRevisar.push('El VAN es negativo a la tasa exigida.');
  if (tir != null && tir < tasa) motivosRevisar.push('La TIR está por debajo de la tasa exigida.');
  if (riesgoAlto && liquidezBaja && !(tir != null && tir > tasa * 1.5)) motivosRevisar.push('Riesgo alto y liquidez baja sin un retorno que lo compense con holgura.');
  if (faltantesCriticos.length > 0) motivosRevisar.push(`Faltan datos clave: ${faltantesCriticos.slice(0, 3).join(', ')}.`);

  if (motivosRevisar.length > 0 || calidadScore < 45) {
    return {
      tipo: 'Revisar',
      motivo: motivosRevisar[0] ?? 'Faltan datos importantes para fiarse del análisis.',
      bullets: [
        ...motivosRevisar.slice(0, 4),
        ...(calidadScore < 45 ? [`Calidad del dato baja (${calidadScore}%): completa el análisis antes de decidir.`] : []),
      ].slice(0, 5),
    };
  }

  // ── Clasificación ───────────────────────────────────────────────────────────
  const tirSuperaTasa = tir != null && tir > tasa;
  const vanPositivo   = van != null && van > 0;
  const moicBueno     = moic != null && moic >= 1.5;
  const plazoRazonable = anos != null && anos <= 7;

  // Agresivo: buen retorno pero riesgo alto, liquidez baja, plazo largo o sin informar riesgo/liquidez
  if (tirSuperaTasa && vanPositivo && (riesgoAlto || liquidezBaja || plazoLargo || riesgoLiquidezSinInformar)) {
    if (riesgoAlto) bullets.push('Riesgo alto: la operación depende de ejecución, contraparte o mercado.');
    if (liquidezBaja) bullets.push('Liquidez baja: capital bloqueado, salida incierta o dependiente de un evento futuro.');
    if (riesgoLiquidezSinInformar) bullets.push('Riesgo o liquidez sin informar: el veredicto es prudente por falta de contexto.');
    if (plazoLargo && anos != null) bullets.push(`Plazo largo (${anos.toFixed(1)} años) con el retorno concentrado en un único cobro a la salida.`);
    if (tir != null) bullets.push(`TIR ${(tir * 100).toFixed(1)}% por encima de la tasa exigida (${(tasa * 100).toFixed(1)}%).`);
    return { tipo: 'Agresivo', motivo: 'Buen retorno, pero con riesgo, liquidez o plazo que exigen cautela.', bullets: bullets.slice(0, 5) };
  }

  // Atractivo: VAN>0, TIR>tasa, MOIC atractivo, plazo razonable, riesgo bajo/medio, liquidez alta/media
  if (tirSuperaTasa && vanPositivo && moicBueno && plazoRazonable && !riesgoAlto && !liquidezBaja && !riesgoLiquidezSinInformar) {
    if (tir != null) bullets.push(`TIR ${(tir * 100).toFixed(1)}% supera la tasa exigida (${(tasa * 100).toFixed(1)}%).`);
    if (van != null) bullets.push(`VAN positivo (${Math.round(van).toLocaleString('es-ES')} €): crea valor.`);
    if (moic != null) bullets.push(`MOIC ${moic.toFixed(2)}x sobre el capital.`);
    bullets.push(`Riesgo ${riesgo} y liquidez ${liquidez}: perfil controlado.`);
    if (anos != null) bullets.push(`Plazo ${anos.toFixed(1)} años con hipótesis de salida clara.`);
    return { tipo: 'Atractivo', motivo: 'Buen retorno con riesgo y liquidez controlados y plazo razonable.', bullets: bullets.slice(0, 5) };
  }

  // Defensivo: rentabilidad moderada, riesgo bajo, liquidez razonable
  if (moic != null) bullets.push(`MOIC ${moic.toFixed(2)}x sobre el capital.`);
  bullets.push(riesgo ? `Riesgo ${riesgo}.` : 'Riesgo no informado.');
  bullets.push(liquidez ? `Liquidez ${liquidez}.` : 'Liquidez no informada.');
  if (van != null) bullets.push(van >= 0 ? 'VAN en torno a cero o positivo.' : 'VAN ligeramente negativo a la tasa exigida.');
  return { tipo: 'Defensivo', motivo: 'Operación moderada: rentabilidad contenida y riesgo bajo.', bullets: bullets.slice(0, 5) };
}

// ── Calidad del dato (campos requeridos del alternativo) ──────────────────────

export function evaluarCalidadAlternativo(a: AnalisisFinanciero, tienePlazo: boolean): CalidadDato {
  const defs: DefCampo[] = [
    { label: 'Capital requerido',       peso: 3, critico: true, estado: a => tiene(a.precio_adquisicion) ? 'completo' : 'faltante' },
    { label: 'Retorno esperado total',  peso: 3, critico: true, estado: a => tiene(a.retorno_previsto_total) ? 'completo' : 'faltante' },
    { label: 'Plazo / fechas',          peso: 2, critico: true, estado: () => tienePlazo ? 'completo' : 'faltante' },
    { label: 'Tasa de descuento',       peso: 2, critico: true, estado: a => a.tasa_descuento != null ? 'completo' : 'estimado' },
    { label: 'Valoración actual',       peso: 1,                estado: a => tiene(a.valoracion_actual) ? 'completo' : 'faltante' },
    { label: 'Nivel de riesgo',         peso: 1,                estado: a => a.nivel_riesgo ? 'completo' : 'faltante' },
    { label: 'Nivel de liquidez',       peso: 1,                estado: a => a.nivel_liquidez ? 'completo' : 'faltante' },
    { label: 'Descripción de la operación', peso: 1,            estado: a => a.descripcion_operacion ? 'completo' : 'estimado' },
  ];

  return evaluarCalidad(a, defs);
}
