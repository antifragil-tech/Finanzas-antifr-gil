// ── explotacionInsights.ts ─────────────────────────────────────────────────────
// Lectura ejecutiva para análisis de "Negocio operativo / explotación":
//   · Veredicto automático (Atractivo / Defensivo / Agresivo / Revisar).
//   · Calidad del dato (campos requeridos de explotación).
// Usa el framework común de insights.ts. Ayuda interna, no recomendación.

import type { AnalisisFinanciero, KpisExplotacion } from './analisisFinanciero';
import { evaluarCalidad, tieneValor as tiene, type Veredicto, type CalidadDato, type DefCampo } from './insights';

// ── Veredicto ─────────────────────────────────────────────────────────────────

export function evaluarVeredictoExplotacion(
  a: AnalisisFinanciero,
  k: KpisExplotacion,
  calidadScore: number,
  faltantesCriticos: string[],
): Veredicto {
  const tasa      = k.tasaDescuentoUsada ?? a.tasa_descuento ?? 0.08;
  const tir       = k.tir;
  const van       = k.van;
  const ebitda    = k.ebitdaAnual;
  const margen    = k.margenEbitda;
  const payback   = k.paybackOperativo;
  const fcf        = k.fcfAnual;
  const sinIngresos = !tiene(a.ingresos_anuales_previstos);
  const sinInversion = k.inversionInicial == null;

  // Dependencia del valor terminal: ¿qué parte del valor descansa en el residual?
  const dependeTerminal = k.valorTerminalAplicado && k.valorTerminalPresente != null && van != null && van > 0
    && k.valorTerminalPresente > (van + (k.inversionInicial ?? 0)) * 0.5;
  const crecimientoAlto = (k.crecimientoPct ?? 0) >= 5;

  const bullets: string[] = [];

  // ── Señales de "Revisar" (bloqueantes) ──────────────────────────────────────
  const motivosRevisar: string[] = [];
  if (sinIngresos) motivosRevisar.push('Faltan los ingresos anuales previstos.');
  if (!tiene(a.costes_fijos_anuales)) motivosRevisar.push('Faltan los costes fijos.');
  if (sinInversion) motivosRevisar.push('Falta la inversión inicial: payback/VAN/TIR no son fiables.');
  if (ebitda != null && ebitda <= 0) motivosRevisar.push('El EBITDA es nulo o negativo: el negocio no es rentable a nivel operativo.');
  if (van != null && van < 0) motivosRevisar.push('El VAN es negativo a la tasa exigida.');
  if (fcf != null && fcf <= 0) motivosRevisar.push('La caja libre anual es nula o negativa.');
  if (k.valorTerminalIncompleto) motivosRevisar.push('El valor de continuidad está activado pero faltan datos (múltiplo o valor manual).');
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
  const margenBueno   = margen != null && margen >= 0.20;
  const paybackBueno  = payback != null && payback <= 4;
  const paybackLargo  = payback != null && payback > 6;

  // Agresivo: buena TIR pero muy apoyada en valor terminal o crecimiento, o payback largo
  if (tirSuperaTasa && vanPositivo && (dependeTerminal || crecimientoAlto || paybackLargo)) {
    if (dependeTerminal) bullets.push('Gran parte del valor descansa en el valor de continuidad (residual del negocio).');
    if (crecimientoAlto) bullets.push(`Depende de un crecimiento anual exigente (${(k.crecimientoPct ?? 0).toFixed(0)}%).`);
    if (paybackLargo && payback != null) bullets.push(`Recuperación lenta (${payback.toFixed(1)} años).`);
    if (tir != null) bullets.push(`TIR ${(tir * 100).toFixed(1)}% por encima de la tasa exigida (${(tasa * 100).toFixed(1)}%).`);
    if (margen != null) bullets.push(`Margen EBITDA ${(margen * 100).toFixed(1)}%.`);
    return { tipo: 'Agresivo', motivo: 'Buen retorno, pero muy dependiente de supuestos (valor de continuidad o crecimiento).', bullets: bullets.slice(0, 5) };
  }

  // Atractivo: VAN>0, TIR>tasa, margen bueno, payback razonable
  if (tirSuperaTasa && vanPositivo && margenBueno && paybackBueno) {
    if (tir != null) bullets.push(`TIR ${(tir * 100).toFixed(1)}% supera la tasa exigida (${(tasa * 100).toFixed(1)}%).`);
    if (van != null) bullets.push(`VAN positivo (${Math.round(van).toLocaleString('es-ES')} €): crea valor.`);
    if (margen != null) bullets.push(`Margen EBITDA sólido (${(margen * 100).toFixed(1)}%).`);
    if (payback != null) bullets.push(`Recuperación de la inversión en ${payback.toFixed(1)} años.`);
    if (!k.valorTerminalAplicado) bullets.push('Sin valor de continuidad: el VAN es conservador.');
    return { tipo: 'Atractivo', motivo: 'Negocio rentable con margen sólido y recuperación razonable.', bullets: bullets.slice(0, 5) };
  }

  // Defensivo: margen moderado, payback positivo sin gran upside, poca dependencia de supuestos
  bullets.push(margen != null ? `Margen EBITDA moderado (${(margen * 100).toFixed(1)}%).` : 'Margen moderado.');
  if (payback != null) bullets.push(`Recuperación en ${payback.toFixed(1)} años.`);
  if (ebitda != null) bullets.push(`EBITDA positivo (${Math.round(ebitda).toLocaleString('es-ES')} €).`);
  if (van != null) bullets.push(van >= 0 ? 'VAN en torno a cero o positivo.' : 'VAN ligeramente negativo a la tasa exigida.');
  return { tipo: 'Defensivo', motivo: 'Negocio estable: margen moderado y dependencia de supuestos baja.', bullets: bullets.slice(0, 5) };
}

// ── Calidad del dato (campos requeridos de explotación) ───────────────────────

export function evaluarCalidadExplotacion(a: AnalisisFinanciero): CalidadDato {
  const defs: DefCampo[] = [
    { label: 'Ingresos anuales',       peso: 3, critico: true, estado: a => tiene(a.ingresos_anuales_previstos) ? 'completo' : 'faltante' },
    { label: 'Costes fijos',           peso: 3, critico: true, estado: a => tiene(a.costes_fijos_anuales) ? 'completo' : 'faltante' },
    { label: 'Inversión inicial',      peso: 3, critico: true, estado: a => tiene(a.precio_adquisicion) || tiene(a.inversion_circulante) ? 'completo' : 'faltante' },
    { label: 'Tasa de descuento',      peso: 2, critico: true, estado: a => a.tasa_descuento != null ? 'completo' : 'estimado' },
    { label: 'Costes variables %',     peso: 2,                estado: a => a.costes_variables_pct != null ? 'completo' : 'estimado' },
    { label: 'CAPEX de mantenimiento', peso: 1,                estado: a => tiene(a.capex_mantenimiento_anual) ? 'completo' : 'faltante' },
    { label: 'Capital circulante',     peso: 1,                estado: a => tiene(a.inversion_circulante) ? 'completo' : 'estimado' },
    { label: 'Crecimiento anual',      peso: 1,                estado: a => a.tasa_crecimiento_anual_pct != null ? 'completo' : 'estimado' },
    { label: 'Horizonte de análisis',  peso: 2,                estado: a => a.horizonte_analisis_anios != null ? 'completo' : 'estimado' },
    { label: 'EBITDA objetivo',        peso: 1,                estado: a => tiene(a.ebitda_objetivo_anual) ? 'completo' : 'estimado' },
  ];

  // Fiscalidad: si está activada, sus campos suman; si no, no penaliza
  if (a.aplicar_fiscalidad === true) {
    defs.push({ label: 'Impuesto de sociedades', peso: 1, estado: a => a.impuesto_sociedades_pct != null ? 'completo' : 'estimado' });
  }

  // Valor de continuidad: si está activado, su dato suma
  if (a.aplicar_valor_terminal === true) {
    defs.push({
      label: 'Valor de continuidad', peso: 1,
      estado: a => (a.metodo_valor_terminal === 'multiplo_ebitda' ? tiene(a.multiplo_ebitda_salida) : tiene(a.valor_terminal_manual)) ? 'completo' : 'faltante',
    });
  }

  return evaluarCalidad(a, defs);
}
