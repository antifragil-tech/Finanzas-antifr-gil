// ── cvInsights.ts ──────────────────────────────────────────────────────────────
// Lectura ejecutiva para análisis de "Compra / reforma / venta":
//   · Veredicto automático (Atractivo / Defensivo / Agresivo / Revisar).
//   · Calidad del dato (campos requeridos de CV).
// Usa el framework común de insights.ts. Ayuda interna, no recomendación.

import type { AnalisisFinanciero, KpisCompraVenta } from './analisisFinanciero';
import { evaluarCalidad, tieneValor as tiene, type Veredicto, type CalidadDato, type DefCampo } from './insights';

// ── Veredicto ─────────────────────────────────────────────────────────────────

// `kPes` = KPIs en escenario pesimista (precio de venta −10%), para medir cuánto
// depende la operación del precio de venta.
export function evaluarVeredictoCV(
  a: AnalisisFinanciero,
  k: KpisCompraVenta,
  kPes: KpisCompraVenta,
  calidadScore: number,
  faltantesCriticos: string[],
): Veredicto {
  const tasa        = a.tasa_descuento ?? 0.08;
  const tieneDeuda  = (a.deuda_promotora ?? 0) > 0;
  const tir         = k.tirEquity;
  const van         = k.van;
  const margen      = k.margenPct;
  const beneficio   = k.beneficioNeto;
  const anos        = k.anosUsados;
  const ltv         = k.ltvDeudaBancaria;
  const sinVenta    = !tiene(a.precio_venta_previsto);
  const sinPlazo    = anos == null;

  // Sensibilidad al precio de venta: ¿el escenario pesimista destruye la operación?
  const benPes      = kPes.beneficioNeto;
  const vanPes      = kPes.van;
  const pesimistaRompe = (benPes != null && benPes < 0) || (vanPes != null && vanPes < 0);
  const muySensible    = beneficio != null && benPes != null && beneficio > 0 && benPes < beneficio * 0.4;

  const bullets: string[] = [];

  // ── Señales de "Revisar" (bloqueantes) ──────────────────────────────────────
  const motivosRevisar: string[] = [];
  if (sinVenta) motivosRevisar.push('Falta el precio de venta previsto.');
  if (sinPlazo) motivosRevisar.push('Falta el plazo de la operación: la TIR/VAN no son fiables.');
  if (!tiene(a.presupuesto_obra)) motivosRevisar.push('Falta el coste de reforma/obra.');
  if (van != null && van < 0) motivosRevisar.push('El VAN es negativo a la tasa exigida.');
  if (beneficio != null && beneficio <= 0) motivosRevisar.push('El beneficio neto es nulo o negativo.');
  if (pesimistaRompe && !sinVenta) motivosRevisar.push('En escenario pesimista (venta −10%) la operación entra en pérdidas.');
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
  const margenBueno   = margen != null && margen >= 0.15;
  const plazoLargo    = anos != null && anos > 3;
  const ltvAlto       = ltv != null && ltv > 0.6;

  // Agresivo: buen retorno pero depende del precio de venta / deuda alta / plazo largo
  if (tirSuperaTasa && vanPositivo && (muySensible || ltvAlto || plazoLargo)) {
    if (muySensible) bullets.push('El resultado depende mucho del precio de venta (cae con fuerza en el pesimista).');
    if (ltvAlto && ltv != null) bullets.push(`Apalancamiento alto (LTV ${(ltv * 100).toFixed(0)}%): amplifica retorno y riesgo.`);
    if (plazoLargo && anos != null) bullets.push(`Plazo largo (${anos.toFixed(1)} años): más exposición a desviaciones.`);
    if (tir != null) bullets.push(`TIR ${(tir * 100).toFixed(1)}% por encima de la tasa exigida (${(tasa * 100).toFixed(1)}%).`);
    if (beneficio != null) bullets.push(`Beneficio neto estimado ${Math.round(beneficio).toLocaleString('es-ES')} €.`);
    return { tipo: 'Agresivo', motivo: 'Buen retorno, pero muy dependiente del precio de venta o del apalancamiento.', bullets: bullets.slice(0, 5) };
  }

  // Atractivo: VAN>0, TIR>tasa, margen suficiente, beneficio claro, pesimista no rompe
  if (tirSuperaTasa && vanPositivo && margenBueno && beneficio != null && beneficio > 0 && !pesimistaRompe) {
    if (tir != null) bullets.push(`TIR ${(tir * 100).toFixed(1)}% supera la tasa exigida (${(tasa * 100).toFixed(1)}%).`);
    if (van != null) bullets.push(`VAN positivo (${Math.round(van).toLocaleString('es-ES')} €): crea valor.`);
    if (margen != null) bullets.push(`Margen sobre venta del ${(margen * 100).toFixed(1)}%.`);
    bullets.push(`Beneficio neto estimado ${Math.round(beneficio).toLocaleString('es-ES')} €.`);
    if (anos != null) bullets.push(`Plazo ${anos.toFixed(1)} años; el escenario pesimista no destruye la operación.`);
    return { tipo: 'Atractivo', motivo: 'Rentabilidad por encima del umbral exigido, con margen y beneficio claros.', bullets: bullets.slice(0, 5) };
  }

  // Defensivo: margen moderado, poco apalancamiento, plazo controlado, beneficio positivo sin gran upside
  bullets.push(margen != null ? `Margen sobre venta moderado (${(margen * 100).toFixed(1)}%).` : 'Margen moderado.');
  bullets.push(tieneDeuda ? (ltv != null ? `Apalancamiento contenido (LTV ${(ltv * 100).toFixed(0)}%).` : 'Apalancamiento contenido.') : 'Sin deuda: riesgo financiero bajo.');
  if (anos != null) bullets.push(`Plazo controlado (${anos.toFixed(1)} años).`);
  if (beneficio != null) bullets.push(beneficio > 0 ? `Beneficio positivo (${Math.round(beneficio).toLocaleString('es-ES')} €) pero sin gran upside.` : 'Beneficio ajustado.');
  return { tipo: 'Defensivo', motivo: 'Perfil conservador: margen moderado, riesgo y plazo controlados.', bullets: bullets.slice(0, 5) };
}

// ── Calidad del dato (campos requeridos de compra/reforma/venta) ──────────────

export function evaluarCalidadCV(a: AnalisisFinanciero): CalidadDato {
  const tieneDeuda = (a.deuda_promotora ?? 0) > 0;
  const tienePlazo = !!(a.fecha_inicio_operacion && a.fecha_salida_prevista)
    || (a.plazo_total_operacion_meses ?? 0) > 0
    || (a.plazo_ejecucion_obra_meses ?? 0) > 0;

  const defs: DefCampo[] = [
    { label: 'Precio de adquisición',     peso: 3, critico: true, estado: a => tiene(a.precio_adquisicion) ? 'completo' : 'faltante' },
    { label: 'Presupuesto obra / reforma', peso: 3, critico: true, estado: a => tiene(a.presupuesto_obra) ? 'completo' : 'faltante' },
    { label: 'Precio de venta previsto',  peso: 3, critico: true, estado: a => tiene(a.precio_venta_previsto) ? 'completo' : 'faltante' },
    { label: 'Plazo de la operación',     peso: 2, critico: true, estado: () => tienePlazo ? 'completo' : 'faltante' },
    { label: 'Tasa de descuento',         peso: 2, critico: true, estado: a => a.tasa_descuento != null ? 'completo' : 'estimado' },
    { label: 'Gastos de adquisición',     peso: 1,                estado: a => tiene(a.gastos_adquisicion) ? 'completo' : 'faltante' },
    { label: 'Contingencia de obra',      peso: 1,                estado: a => a.contingencia_obra_pct != null ? 'completo' : 'estimado' },
    { label: 'Gastos de venta',           peso: 1,                estado: a => tiene(a.gastos_venta) ? 'completo' : 'faltante' },
    { label: 'Comisión de agente',        peso: 1,                estado: a => a.comision_agente_pct != null ? 'completo' : 'estimado' },
    { label: 'Impuesto de sociedades',    peso: 1,                estado: a => a.impuesto_sociedades_pct != null ? 'completo' : 'estimado' },
    { label: 'Estructura de financiación', peso: 1,               estado: a => a.deuda_promotora != null ? 'completo' : 'estimado' },
    { label: 'Superficie (m²)',           peso: 1,                estado: a => tiene(a.superficie_arrendable_m2) ? 'completo' : 'faltante' },
  ];

  // Si hay deuda, el coste financiero suma a la calidad
  if (tieneDeuda) {
    defs.push({ label: 'Coste financiero de la deuda', peso: 1, estado: a => tiene(a.coste_financiero_deuda) ? 'completo' : 'estimado' });
  }

  return evaluarCalidad(a, defs);
}
