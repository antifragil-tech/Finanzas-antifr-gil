import { useState, useEffect, lazy, Suspense } from 'react';
import {
  Save, Loader2, AlertTriangle, Pencil,
  TrendingUp, PiggyBank, BarChart3, Building2, Landmark, Wrench,
} from 'lucide-react';
import type { TipoAnalisis, AnalisisFinanciero } from '../../../lib/analisisFinanciero';
import { getAnalisisFinanciero, upsertAnalisisFinanciero } from '../../../lib/proyectosApi';
import type { ProyectoRow } from '../../../lib/proyectosApi';
import { lbl } from './tab-numeros/shared';
import { TIPO_LABEL, FormCV, FormRenta, FormExplotacion, FormPrestamo, FormCapex, FormAlternativo } from './tab-numeros/forms';
import type { FormData } from './tab-numeros/forms';
import { KpisCV, KpisRentaView, KpisExplotacionView, KpisPrestamoView, KpisCapexView, KpisAlternativoView } from './tab-numeros/kpis';
import { Escenarios } from './tab-numeros/Escenarios';
import { Sensibilidad } from './tab-numeros/Sensibilidad';
import { Financiacion } from './tab-numeros/Financiacion';
import { ExportarPDFButton } from './tab-numeros/ExportarPDFButton';

// Lazy-load Recharts heavy section — se carga solo al abrir "Métricas reales"
const MetricasReales = lazy(() =>
  import('./tab-numeros/MetricasReales').then(m => ({ default: m.MetricasReales }))
);

// ── Iconos y metadatos por tipo ───────────────────────────────────────────────

const TIPO_ICON: Record<TipoAnalisis, typeof TrendingUp> = {
  compra_venta:  TrendingUp,
  renta:         PiggyBank,
  alternativo:   BarChart3,
  explotacion:   Building2,
  prestamo:      Landmark,
  capex_interno: Wrench,
};

// Tipos implementados en Fase 2 — muestra badge "Beta" mientras no haya datos reales
const TIPOS_BETA: TipoAnalisis[] = ['explotacion', 'prestamo', 'capex_interno'];

// ── Serialización form ↔ AnalisisFinanciero ──────────────────────────────────

const NUM_FIELDS: (keyof AnalisisFinanciero)[] = [
  'porcentaje_equity','valoracion_actual','tasa_descuento',
  'precio_adquisicion','gastos_adquisicion','presupuesto_obra','gastos_venta',
  'precio_venta_previsto','deuda_promotora','coste_financiero_deuda',
  'precio_compra_escritura','gastos_financiacion_notarial','iva_soportado_obra',
  'precio_venta_reservado','anticipo_comprador','comision_agente_pct',
  'plazo_ejecucion_obra_meses','contingencia_obra_pct','superficie_arrendable_m2',
  'renta_mensual_bruta','gastos_operativos_anuales','capex_inicial',
  'deuda_hipotecaria','cuota_hipoteca_mensual','tasa_ocupacion_prevista_pct',
  'renta_por_m2','cap_rate_salida_pct','ibi_anual','seguro_anual',
  'capex_mantenimiento_anual','retorno_previsto_total',
  'ingresos_anuales_previstos','costes_variables_pct','costes_fijos_anuales',
  'ebitda_objetivo_anual','inversion_circulante','tasa_crecimiento_anual_pct',
  'anio_break_even_previsto',
  'nominal_prestamo','tipo_interes_pct','plazo_meses',
  'probabilidad_impago_pct','lgd_pct','valor_garantia',
  'beneficio_esperado_anual','vida_util_activo_anios','valor_residual_pct',
  'tasa_descuento_interna','equity_aportado',
  'horizonte_analisis_anios','valor_residual_estimado',
  'plazo_total_operacion_meses','impuesto_sociedades_pct',
  // Renta — financiación detallada y fiscalidad opcional
  'tipo_interes_deuda_pct','plazo_restante_anios',
  'amortizacion_fiscal_anual','costes_venta_pct','impuesto_plusvalia_pct',
  // Explotación — valor de continuidad / terminal
  'valor_terminal_manual','multiplo_ebitda_salida',
];

const STR_FIELDS: (keyof AnalisisFinanciero)[] = [
  'descripcion_operacion','tipo_instrumento','sistema_amortizacion',
  'fecha_vencimiento_instrumento','colateral','rating_interno','depreciacion_tipo',
  'metodo_valor_residual','fecha_inicio_explotacion',
  'fecha_inicio_operacion','fecha_salida_prevista',
  'sistema_amortizacion_deuda','metodo_valor_terminal',
  'nivel_riesgo','nivel_liquidez',
];

const BOOL_FIELDS: (keyof AnalisisFinanciero)[] = [
  'aplicar_fiscalidad','aplicar_valor_terminal',
];

function analisisToForm(a: AnalisisFinanciero): FormData {
  const f: FormData = {};
  for (const k of NUM_FIELDS) {
    const v = a[k];
    if (v != null) f[k] = String(v);
  }
  for (const k of STR_FIELDS) {
    const v = a[k];
    if (v != null && typeof v === 'string') f[k] = v;
  }
  for (const k of BOOL_FIELDS) {
    const v = a[k];
    if (v != null) f[k] = v ? 'true' : 'false';
  }
  return f;
}

function formToAnalisis(form: FormData, tipo: TipoAnalisis, proyectoId: string): AnalisisFinanciero {
  const result: AnalisisFinanciero = { proyecto_id: proyectoId, tipo_analisis: tipo };
  for (const k of NUM_FIELDS) {
    const raw = form[k];
    if (raw && raw !== '') {
      const n = parseFloat(raw);
      if (!isNaN(n)) (result as Record<string, unknown>)[k] = n;
    }
  }
  for (const k of STR_FIELDS) {
    const v = form[k];
    if (v) (result as Record<string, unknown>)[k] = v;
  }
  for (const k of BOOL_FIELDS) {
    const v = form[k];
    if (v != null && v !== '') (result as Record<string, unknown>)[k] = v === 'true';
  }
  return result;
}

// ── Selector de tipo ──────────────────────────────────────────────────────────

function TipoSelector({ tipo, onChange }: { tipo: TipoAnalisis; onChange: (t: TipoAnalisis) => void }) {
  return (
    <div>
      <p className={lbl}>Tipo de análisis</p>
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(TIPO_LABEL) as TipoAnalisis[]).map(t => {
          const Icon = TIPO_ICON[t];
          const isBeta = TIPOS_BETA.includes(t);
          return (
            <button
              key={t} type="button"
              onClick={() => onChange(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border transition-all ${
                tipo === t
                  ? 'bg-violet-600/15 border-violet-500/30 text-violet-300'
                  : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
              }`}
            >
              <Icon size={13} />
              {TIPO_LABEL[t]}
              {isBeta && tipo !== t && (
                <span className="ml-1 px-1.5 py-0.5 rounded text-2xs font-semibold bg-zinc-800 text-zinc-500 uppercase tracking-widest">Beta</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Spinner compartido para Suspense ─────────────────────────────────────────

function SpinnerRow() {
  return (
    <div className="flex justify-center py-10">
      <Loader2 size={18} className="animate-spin text-zinc-600" />
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

type Props = { proyecto: ProyectoRow };
type Section = 'analisis' | 'escenarios' | 'financiacion' | 'metricas';

export function TabNumeros({ proyecto }: Props) {
  const [analisis, setAnalisis] = useState<AnalisisFinanciero | null>(null);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [tipo, setTipo]         = useState<TipoAnalisis>('compra_venta');
  const [form, setForm]         = useState<FormData>({});
  const [section, setSection]   = useState<Section>('analisis');

  useEffect(() => {
    setLoading(true);
    getAnalisisFinanciero(proyecto.id_ref)
      .then(a => {
        if (a) { setAnalisis(a); setTipo(a.tipo_analisis); setForm(analisisToForm(a)); }
        else   { setEditing(true); }
      })
      .catch(() => setEditing(true))
      .finally(() => setLoading(false));
  }, [proyecto.id_ref]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    setSaving(true); setError('');
    try {
      const data = formToAnalisis(form, tipo, proyecto.id_ref);
      const saved = await upsertAnalisisFinanciero(data);
      setAnalisis(saved);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 size={20} className="animate-spin text-zinc-600" />
    </div>
  );

  const TipoIcon = TIPO_ICON[tipo];

  return (
    <div className="space-y-6">

      {/* Sub-navegación + exportar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 p-1 bg-zinc-900/60 border border-white/[0.06] rounded-xl w-fit flex-wrap">
          {([
            ['analisis',    'Análisis financiero'],
            ['escenarios',  'Escenarios'],
            ['financiacion','Financiación'],
            ['metricas',    'Métricas reales'],
          ] as [Section, string][]).map(([s, label]) => (
            <button key={s} onClick={() => setSection(s)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                section === s ? 'bg-zinc-700/60 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {analisis && !editing && <ExportarPDFButton analisis={analisis} proyecto={proyecto} />}
      </div>

      {/* ── Sección: Análisis financiero ── */}
      {section === 'analisis' && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <TipoIcon size={16} className="text-violet-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Análisis financiero</h2>
                <p className="text-xs text-zinc-500">{TIPO_LABEL[tipo]}</p>
              </div>
            </div>
            {analisis && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all"
              >
                <Pencil size={11} /> Editar parámetros
              </button>
            )}
          </div>

          {/* Vista KPIs (modo lectura) */}
          {analisis && !editing && (
            <>
              {analisis.tipo_analisis === 'compra_venta'  && <KpisCV analisis={analisis} proyecto={proyecto} />}
              {analisis.tipo_analisis === 'renta'         && <KpisRentaView analisis={analisis} proyecto={proyecto} />}
              {analisis.tipo_analisis === 'explotacion'   && <KpisExplotacionView analisis={analisis} proyecto={proyecto} />}
              {analisis.tipo_analisis === 'prestamo'      && <KpisPrestamoView analisis={analisis} proyecto={proyecto} />}
              {analisis.tipo_analisis === 'capex_interno' && <KpisCapexView analisis={analisis} proyecto={proyecto} />}
              {analisis.tipo_analisis === 'alternativo'   && <KpisAlternativoView analisis={analisis} proyecto={proyecto} />}
              {/* compra_venta: aviso solo cuando no hay ninguna fuente de duración */}
              {analisis.tipo_analisis === 'compra_venta' && (
                !analisis.fecha_inicio_operacion &&
                !analisis.plazo_total_operacion_meses &&
                !analisis.plazo_ejecucion_obra_meses &&
                !proyecto.fecha_inicio
              ) && (
                <p className="text-xs text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle size={12} />
                  Añade fecha de inicio y salida prevista, o plazo total de operación, para calcular la TIR.
                </p>
              )}
              {/* alternativo: necesita fechas del proyecto */}
              {analisis.tipo_analisis === 'alternativo' && (!proyecto.fecha_inicio || !proyecto.fecha_prevista_salida) && (
                <p className="text-xs text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle size={12} />
                  Añade fechas de inicio y salida prevista al proyecto para calcular la TIR.
                </p>
              )}
            </>
          )}

          {/* Formulario de edición */}
          {editing && (
            <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/40 p-6 space-y-6">
              <TipoSelector tipo={tipo} onChange={t => setTipo(t)} />

              <div className="border-t border-white/[0.05] pt-5">
                {tipo === 'compra_venta'  && <FormCV form={form} set={set} />}
                {tipo === 'renta'         && <FormRenta form={form} set={set} />}
                {tipo === 'explotacion'   && <FormExplotacion form={form} set={set} />}
                {tipo === 'prestamo'      && <FormPrestamo form={form} set={set} />}
                {tipo === 'capex_interno' && <FormCapex form={form} set={set} />}
                {tipo === 'alternativo'   && <FormAlternativo form={form} set={set} />}
              </div>

              {error && (
                <p className="text-xs text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle size={12} /> {error}
                </p>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Guardar análisis
                </button>
                {analisis && (
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-2.5 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Sección: Escenarios ── */}
      {section === 'escenarios' && analisis && (
        <Escenarios analisis={analisis} proyecto={proyecto} />
      )}
      {section === 'escenarios' && !analisis && (
        <div className="flex flex-col items-center justify-center py-10 rounded-2xl border border-white/[0.06] bg-zinc-900/20">
          <p className="text-sm text-zinc-500">Guarda primero un análisis financiero para generar escenarios.</p>
        </div>
      )}

      {/* ── Sección: Financiación ── */}
      {section === 'financiacion' && analisis && (
        <Financiacion analisis={analisis} proyecto={proyecto} />
      )}
      {section === 'financiacion' && !analisis && (
        <div className="flex flex-col items-center justify-center py-10 rounded-2xl border border-white/[0.06] bg-zinc-900/20">
          <p className="text-sm text-zinc-500">Guarda primero un análisis financiero para simular la financiación.</p>
        </div>
      )}

      {/* ── Sección: Análisis financiero — Sensibilidad (extra, debajo de KPIs) ── */}
      {section === 'analisis' && analisis && !editing && (
        <Sensibilidad analisis={analisis} proyecto={proyecto} />
      )}

      {/* ── Sección: Métricas reales (lazy) ── */}
      {section === 'metricas' && (
        <Suspense fallback={<SpinnerRow />}>
          <MetricasReales proyectoId={proyecto.id_ref} />
        </Suspense>
      )}
    </div>
  );
}
