// ── capexInsights.ts ───────────────────────────────────────────────────────────
// Lectura ejecutiva para "CAPEX interno" (inversión interna que genera ahorro):
//   · Veredicto automático (Atractivo / Defensivo / Agresivo / Revisar).
//   · Calidad del dato (campos requeridos del CAPEX).
// Usa el framework común de insights.ts. Ayuda interna, no recomendación.

import type { AnalisisFinanciero, KpisCapexInterno } from './analisisFinanciero';
import {
  evaluarCalidad,
  tieneValor as tiene,
  type Veredicto,
  type CalidadDato,
  type DefCampo,
} from './insights';

// ── Veredicto ─────────────────────────────────────────────────────────────────

export function evaluarVeredictoCapex(
  a: AnalisisFinanciero,
  k: KpisCapexInterno,
  calidadScore: number,
  faltantesCriticos: string[],
): Veredicto {
  const tasa = k.tasaUsada ?? a.tasa_descuento_interna ?? a.tasa_descuento ?? 0.08;
  const tir = k.tirCapex;
  const van = k.vanCapex;
  const payback = k.paybackCapex;
  const cajaNeta = k.cajaNetaAnual;
  const vida = k.vidaUtilUsada;

  const sinInversion = k.inversionCapex == null;
  const sinAhorro = !tiene(a.beneficio_esperado_anual);
  const sinVida = vida == null;

  // Dependencia del valor residual: ¿qué parte del valor positivo viene del residual?
  const vrPresente =
    k.valorResidual != null && vida != null && tasa != null
      ? k.valorResidual / Math.pow(1 + tasa, vida)
      : null;
  const dependeResidual =
    vrPresente != null &&
    van != null &&
    van > 0 &&
    k.inversionCapex != null &&
    vrPresente > (van + k.inversionCapex) * 0.5;
  const vidaLarga = vida != null && vida > 10;

  const bullets: string[] = [];

  // ── Señales de "Revisar" (bloqueantes) ──────────────────────────────────────
  const motivosRevisar: string[] = [];
  if (sinInversion) motivosRevisar.push('Falta la inversión CAPEX.');
  if (sinAhorro) motivosRevisar.push('Falta el beneficio/ahorro anual esperado.');
  if (sinVida) motivosRevisar.push('Falta la vida útil: sin ella no hay VAN ni TIR.');
  if (k.cajaNetaNegativa)
    motivosRevisar.push('La caja neta anual es ≤ 0: el mantenimiento se come el ahorro.');
  if (van != null && van < 0) motivosRevisar.push('El VAN es negativo a la tasa exigida.');
  if (tir != null && tir < tasa) motivosRevisar.push('La TIR está por debajo de la tasa exigida.');
  if (k.tirNoConverge)
    motivosRevisar.push('Los flujos no recuperan la inversión: la TIR no es calculable.');
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
  const cajaOk = cajaNeta != null && cajaNeta > 0;
  const paybackBueno = payback != null && payback <= 4;
  const paybackLargo = payback != null && payback > 7;

  // Agresivo: retorno bueno pero muy apoyado en el valor residual, ahorro poco probado o vida larga
  if (tirSuperaTasa && vanPositivo && (dependeResidual || paybackLargo || vidaLarga)) {
    if (dependeResidual)
      bullets.push('Gran parte del valor descansa en el valor residual del activo.');
    if (paybackLargo && payback != null)
      bullets.push(`Recuperación lenta (${payback.toFixed(1)} años).`);
    if (vidaLarga && vida != null)
      bullets.push(
        `Vida útil larga (${vida} años): el retorno depende de mantener el ahorro mucho tiempo.`,
      );
    if (tir != null)
      bullets.push(
        `TIR ${(tir * 100).toFixed(1)}% por encima de la tasa exigida (${(tasa * 100).toFixed(1)}%).`,
      );
    if (cajaOk && cajaNeta != null)
      bullets.push(`Caja neta anual ${Math.round(cajaNeta).toLocaleString('es-ES')} €.`);
    return {
      tipo: 'Agresivo',
      motivo: 'Buen retorno, pero depende del valor residual o de sostener el ahorro mucho tiempo.',
      bullets: bullets.slice(0, 5),
    };
  }

  // Atractivo: VAN>0, TIR>tasa, payback razonable, caja neta positiva, baja dependencia del residual
  if (tirSuperaTasa && vanPositivo && cajaOk && paybackBueno) {
    if (tir != null)
      bullets.push(
        `TIR ${(tir * 100).toFixed(1)}% supera la tasa exigida (${(tasa * 100).toFixed(1)}%).`,
      );
    if (van != null)
      bullets.push(`VAN positivo (${Math.round(van).toLocaleString('es-ES')} €): crea valor.`);
    if (payback != null) bullets.push(`Recuperación del CAPEX en ${payback.toFixed(1)} años.`);
    if (cajaNeta != null)
      bullets.push(`Caja neta anual positiva (${Math.round(cajaNeta).toLocaleString('es-ES')} €).`);
    bullets.push('Baja dependencia del valor residual.');
    return {
      tipo: 'Atractivo',
      motivo: 'Inversión rentable con recuperación rápida y caja neta positiva.',
      bullets: bullets.slice(0, 5),
    };
  }

  // Defensivo: ahorro estable, payback moderado, bajo riesgo
  if (cajaNeta != null)
    bullets.push(
      `Caja neta anual ${cajaNeta > 0 ? 'positiva' : 'ajustada'} (${Math.round(cajaNeta).toLocaleString('es-ES')} €).`,
    );
  if (payback != null) bullets.push(`Recuperación en ${payback.toFixed(1)} años.`);
  if (vida != null) bullets.push(`Vida útil ${vida} años.`);
  if (van != null)
    bullets.push(
      van >= 0 ? 'VAN en torno a cero o positivo.' : 'VAN ligeramente negativo a la tasa exigida.',
    );
  return {
    tipo: 'Defensivo',
    motivo: 'Inversión estable: ahorro sostenido y riesgo operativo bajo.',
    bullets: bullets.slice(0, 5),
  };
}

// ── Calidad del dato (campos requeridos del CAPEX) ────────────────────────────

export function evaluarCalidadCapex(a: AnalisisFinanciero): CalidadDato {
  const defs: DefCampo[] = [
    {
      label: 'Inversión CAPEX',
      peso: 3,
      critico: true,
      estado: (a) => (tiene(a.precio_adquisicion) ? 'completo' : 'faltante'),
    },
    {
      label: 'Beneficio / ahorro anual',
      peso: 3,
      critico: true,
      estado: (a) => (tiene(a.beneficio_esperado_anual) ? 'completo' : 'faltante'),
    },
    {
      label: 'Vida útil',
      peso: 3,
      critico: true,
      estado: (a) => (tiene(a.vida_util_activo_anios) ? 'completo' : 'faltante'),
    },
    {
      label: 'Tasa de descuento',
      peso: 2,
      critico: true,
      estado: (a) =>
        a.tasa_descuento_interna != null || a.tasa_descuento != null ? 'completo' : 'estimado',
    },
    {
      label: 'Valor residual %',
      peso: 1,
      estado: (a) => (a.valor_residual_pct != null ? 'completo' : 'estimado'),
    },
    {
      label: 'CAPEX de mantenimiento',
      peso: 1,
      estado: (a) => (a.capex_mantenimiento_anual != null ? 'completo' : 'estimado'),
    },
    {
      label: 'Método de depreciación',
      peso: 1,
      estado: (a) => (a.depreciacion_tipo != null ? 'completo' : 'estimado'),
    },
  ];

  return evaluarCalidad(a, defs);
}
