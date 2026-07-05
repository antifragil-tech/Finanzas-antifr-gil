// Vista ejecutiva de análisis "Alternativo" (inversión alternativa genérica).
// Primera lectura: veredicto + calidad + KPIs + VAN/TIR + escenarios.
// Detalle (operación, riesgo/liquidez, supuestos) desplegable.
import type {
  AnalisisFinanciero,
  KpisAlternativo,
  Semaforo,
} from '../../../../lib/analisisFinanciero';
import { calcKpisAlternativo, semaforoTir } from '../../../../lib/analisisFinanciero';
import {
  evaluarCalidadAlternativo,
  evaluarVeredictoAlternativo,
} from '../../../../lib/alternativoInsights';
import type { ProyectoRow } from '../../../../lib/proyectosApi';
import {
  VeredictoBlock,
  CalidadBlock,
  EscenariosResumenTabla,
  type EscenarioFila,
} from './ejecutivo';
import {
  KpiCard,
  KpiGrid,
  Collapsible,
  SectionHint,
  fmt,
  fmtPct,
  fmtX,
  fmtAno,
  safe,
} from './shared';

type Props = { analisis: AnalisisFinanciero; proyecto: ProyectoRow };

const ALT_FILAS: EscenarioFila[] = [
  { label: 'Retorno esperado', key: 'retornoTotal', render: fmt },
  { label: 'Beneficio', key: 'beneficioEsperado', render: fmt },
  { label: 'MOIC', key: 'moic', render: fmtX },
  { label: 'VAN', key: 'van', render: fmt },
  { label: 'TIR', key: 'tirEquity', render: fmtPct },
];

const RIESGO_LABEL: Record<string, string> = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' };
const LIQUIDEZ_LABEL: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };

function semaforoRiesgo(r: string | null | undefined): Semaforo {
  if (r === 'bajo') return 'verde';
  if (r === 'medio') return 'ambar';
  if (r === 'alto') return 'rojo';
  return 'neutro';
}
function semaforoLiquidez(l: string | null | undefined): Semaforo {
  if (l === 'alta') return 'verde';
  if (l === 'media') return 'ambar';
  if (l === 'baja') return 'rojo';
  return 'neutro';
}

// ── Bloques de detalle ────────────────────────────────────────────────────────

function OperacionBlock({ analisis, k }: { analisis: AnalisisFinanciero; k: KpisAlternativo }) {
  return (
    <Collapsible title="Detalle de la operación" subtitle="Descripción y retorno esperado">
      {analisis.descripcion_operacion && (
        <p className="mb-3 rounded-xl border border-white/[0.06] bg-zinc-900/40 px-4 py-3 text-sm text-zinc-400">
          {analisis.descripcion_operacion}
        </p>
      )}
      <KpiGrid cols={3}>
        <KpiCard
          label="Capital requerido"
          value={k.capitalRequerido != null ? fmt(k.capitalRequerido) : '—'}
          sub="Capital invertido (año 0)"
        />
        <KpiCard
          label="Retorno esperado total"
          value={k.retornoTotal != null ? fmt(k.retornoTotal) : '—'}
          sub="Total a cobrar a la salida (capital + plusvalía)"
          tooltip="Importe TOTAL esperado a cobrar a la salida, incluyendo la recuperación del capital más la plusvalía. No es solo el beneficio."
        />
        <KpiCard
          label="Beneficio esperado"
          value={k.beneficioEsperado != null ? fmt(k.beneficioEsperado) : '—'}
          sub="Retorno total − capital"
          tooltip="Ganancia neta esperada: retorno total menos el capital invertido."
        />
      </KpiGrid>
      <SectionHint>
        El "retorno esperado total" es lo que se cobra a la salida (recuperación de capital +
        plusvalía), no solo el beneficio. El beneficio = retorno − capital.
      </SectionHint>
    </Collapsible>
  );
}

function RiesgoLiquidezBlock({ analisis }: { analisis: AnalisisFinanciero }) {
  const riesgo = analisis.nivel_riesgo ?? null;
  const liquidez = analisis.nivel_liquidez ?? null;
  return (
    <Collapsible title="Riesgo y liquidez" subtitle="Perfil cualitativo de la operación">
      <KpiGrid cols={2}>
        <KpiCard
          label="Nivel de riesgo"
          value={riesgo ? (RIESGO_LABEL[riesgo] ?? riesgo) : 'No informado'}
          semaforo={semaforoRiesgo(riesgo)}
          tooltip="Bajo: operación defensiva · Medio: riesgo normal · Alto: incertidumbre elevada (ejecución, contraparte, mercado o salida)."
        />
        <KpiCard
          label="Nivel de liquidez"
          value={liquidez ? (LIQUIDEZ_LABEL[liquidez] ?? liquidez) : 'No informado'}
          semaforo={semaforoLiquidez(liquidez)}
          tooltip="Alta: salida sencilla o instrumento líquido · Media: salida posible pero no inmediata · Baja: capital bloqueado o salida incierta."
        />
      </KpiGrid>
      {(!riesgo || !liquidez) && (
        <SectionHint>
          Riesgo o liquidez sin informar: baja la calidad del dato y el veredicto se vuelve más
          prudente. Complétalos en "Editar parámetros" → "Riesgo y liquidez".
        </SectionHint>
      )}
    </Collapsible>
  );
}

function ValoracionBlock({ analisis, k }: { analisis: AnalisisFinanciero; k: KpisAlternativo }) {
  if (analisis.valoracion_actual == null) return null;
  return (
    <Collapsible title="Valoración actual / plusvalía latente" subtitle="Referencia de mercado hoy">
      <KpiGrid cols={3}>
        <KpiCard
          label="Valoración actual"
          value={fmt(analisis.valoracion_actual)}
          sub="Valor de mercado hoy"
          tooltip="Valoración de mercado actual de la posición. Es una referencia, no necesariamente un cobro realizable de inmediato."
        />
        <KpiCard
          label="Capital requerido"
          value={k.capitalRequerido != null ? fmt(k.capitalRequerido) : '—'}
        />
        <KpiCard
          label="Plusvalía latente"
          value={k.margenLatente != null ? fmt(k.margenLatente) : '—'}
          sub="Valoración actual − capital"
          semaforo={k.margenLatente != null ? (k.margenLatente > 0 ? 'verde' : 'rojo') : 'neutro'}
          tooltip="Diferencia entre la valoración actual y el capital invertido. No se suma al VAN (el VAN usa el retorno esperado a la salida)."
        />
      </KpiGrid>
      <SectionHint>
        La plusvalía latente es una referencia de mercado hoy y no se suma al VAN. No se asume que
        la valoración pueda realizarse de inmediato.
      </SectionHint>
    </Collapsible>
  );
}

function SupuestosBlock({ k }: { k: KpisAlternativo }) {
  return (
    <Collapsible title="Supuestos" subtitle="Tasa y plazo usados">
      <KpiGrid cols={2}>
        <KpiCard
          label="Tasa de descuento"
          value={k.tasaUsada != null ? fmtPct(k.tasaUsada) : '—'}
          sub="Para descontar el retorno"
        />
        <KpiCard
          label="Plazo hasta el retorno"
          value={k.anosUsados != null ? fmtAno(k.anosUsados) : '—'}
          sub="Entrada → salida"
        />
      </KpiGrid>
    </Collapsible>
  );
}

// ── Vista principal ───────────────────────────────────────────────────────────

export function AlternativoView({ analisis, proyecto }: Props) {
  const k = calcKpisAlternativo(analisis, proyecto.fecha_inicio, proyecto.fecha_prevista_salida);
  const tienePlazo = k.anosUsados != null;
  const cal = evaluarCalidadAlternativo(analisis, tienePlazo);
  const ver = evaluarVeredictoAlternativo(analisis, k, cal.score, cal.faltantesCriticos);

  const tieneCapital = k.capitalRequerido != null;
  const tieneRetorno = k.retornoTotal != null;
  const sinTasa = analisis.tasa_descuento == null;

  return (
    <div className="space-y-5">
      {/* 1 · Veredicto */}
      <VeredictoBlock tipo={ver.tipo} motivo={ver.motivo} bullets={ver.bullets} />

      {/* 2 · Calidad del dato */}
      <CalidadBlock calidad={cal} />

      {/* 3 · KPIs principales */}
      <div className="space-y-2">
        <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-600">
          Indicadores clave
        </p>
        <KpiGrid cols={4}>
          <KpiCard
            label="Capital requerido"
            value={safe(k.capitalRequerido, fmt)}
            sub="Capital invertido (año 0)"
            tooltip="Capital propio aportado / invertido en la operación. Sale en el año 0."
          />
          <KpiCard
            label="Retorno esperado total"
            value={safe(k.retornoTotal, fmt)}
            sub="Total a la salida (capital + plusvalía)"
            tooltip="Importe TOTAL esperado a cobrar a la salida, incluyendo recuperación de capital más plusvalía. No confundir con el beneficio."
          />
          <KpiCard
            label="Beneficio esperado"
            value={safe(k.beneficioEsperado, fmt)}
            sub="Retorno total − capital"
            semaforo={
              k.beneficioEsperado != null ? (k.beneficioEsperado > 0 ? 'verde' : 'rojo') : 'neutro'
            }
            tooltip="Ganancia neta esperada: retorno total menos el capital invertido."
          />
          <KpiCard
            label="Rentabilidad estimada (TIR)"
            value={safe(k.tirEquity, fmtPct)}
            sub={k.anosUsados ? `${k.anosUsados.toFixed(1)} años` : 'Falta plazo'}
            semaforo={semaforoTir(k.tirEquity)}
            tooltip="Rentabilidad anualizada estimada: (retorno total / capital)^(1/años) − 1."
          />
          <KpiCard
            label="Múltiplo sobre capital (MOIC)"
            value={safe(k.moic, fmtX)}
            sub="Retorno total / capital"
            semaforo={
              k.moic != null ? (k.moic >= 2 ? 'verde' : k.moic >= 1.5 ? 'ambar' : 'rojo') : 'neutro'
            }
            tooltip="Dinero total recuperado dividido entre dinero invertido. Un MOIC de 2x significa recuperar 2 € por cada € invertido."
          />
          <KpiCard
            label="Valor actual neto (VAN)"
            value={safe(k.van, fmt)}
            sub={k.tasaUsada != null ? `Tasa ${fmtPct(k.tasaUsada)}` : undefined}
            semaforo={k.van != null ? (k.van > 0 ? 'verde' : 'rojo') : 'neutro'}
            tooltip="Valor presente del retorno esperado a la salida descontado a la tasa exigida, menos el capital. La valoración actual no se suma al VAN."
          />
          <KpiCard
            label="Plazo hasta el retorno"
            value={k.anosUsados != null ? fmtAno(k.anosUsados) : '—'}
            sub="Entrada → salida"
            tooltip="Años entre la entrada y la salida prevista. Se toma de las fechas del proyecto."
          />
          <KpiCard
            label="Plusvalía latente"
            value={safe(k.margenLatente, fmt)}
            sub="Valoración actual − capital"
            semaforo={k.margenLatente != null ? (k.margenLatente > 0 ? 'verde' : 'rojo') : 'neutro'}
            tooltip="Diferencia entre la valoración actual estimada y el capital invertido. Referencia de mercado hoy; no se suma al VAN."
          />
          <KpiCard
            label="Nivel de riesgo"
            value={
              analisis.nivel_riesgo
                ? (RIESGO_LABEL[analisis.nivel_riesgo] ?? analisis.nivel_riesgo)
                : 'No informado'
            }
            semaforo={semaforoRiesgo(analisis.nivel_riesgo)}
            tooltip="Riesgo cualitativo de la operación: bajo / medio / alto. Modula el veredicto."
          />
          <KpiCard
            label="Nivel de liquidez"
            value={
              analisis.nivel_liquidez
                ? (LIQUIDEZ_LABEL[analisis.nivel_liquidez] ?? analisis.nivel_liquidez)
                : 'No informado'
            }
            semaforo={semaforoLiquidez(analisis.nivel_liquidez)}
            tooltip="Liquidez cualitativa: alta / media / baja. Liquidez baja → más cautela en el veredicto."
          />
        </KpiGrid>
      </div>

      {/* 4 · Escenarios resumidos */}
      <EscenariosResumenTabla analisis={analisis} proyecto={proyecto} filas={ALT_FILAS} />

      {/* Avisos de validación */}
      {!tieneCapital && (
        <SectionHint>
          Falta el capital requerido: el MOIC, el VAN y la TIR no son definitivos. Añádelo en
          "Editar parámetros" → "Capital".
        </SectionHint>
      )}
      {tieneCapital && !tieneRetorno && (
        <SectionHint>
          Falta el retorno esperado total: el MOIC, el VAN y la TIR no son definitivos. Añádelo en
          "Editar parámetros" → "Retorno esperado".
        </SectionHint>
      )}
      {tieneCapital && tieneRetorno && !tienePlazo && (
        <SectionHint>
          Faltan las fechas de inicio y salida del proyecto: la TIR y el VAN no son definitivos.
        </SectionHint>
      )}
      {sinTasa && tieneCapital && (
        <SectionHint>
          No se ha indicado tasa de descuento: se usa 8% por defecto. Ajústala en "Editar
          parámetros" → "Supuestos avanzados".
        </SectionHint>
      )}

      {/* 5 · Detalle desplegable */}
      <div className="space-y-3">
        <OperacionBlock analisis={analisis} k={k} />
        <RiesgoLiquidezBlock analisis={analisis} />
        <ValoracionBlock analisis={analisis} k={k} />
        <SupuestosBlock k={k} />
      </div>
    </div>
  );
}
