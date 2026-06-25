// Formularios de parámetros por tipo de proyecto
import type { TipoAnalisis } from '../../../../lib/analisisFinanciero';
import { NumInput, PctInput, SelectInput, TextAreaInput, TasaDescuentoInput, Collapsible, lbl, inp } from './shared';

export type FormData = Record<string, string>;
type SetFn = (k: string, v: string) => void;

// Cabecera de bloque dentro de un formulario
function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-white/[0.05] pt-4 space-y-3 first:border-0 first:pt-0">
      <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">{titulo}</p>
      {children}
    </div>
  );
}

// Toggle sí/no para campos booleanos (el form trabaja con 'true'/'false')
function ToggleInput({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const on = value === 'true';
  return (
    <div>
      <label className={lbl}>{label}</label>
      <div className="flex gap-2">
        {([['true', 'Sí'], ['false', 'No']] as const).map(([v, t]) => (
          <button
            key={v} type="button" onClick={() => onChange(v)}
            className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all ${
              (v === 'true') === on
                ? 'bg-violet-600/15 border-violet-500/30 text-violet-300'
                : 'border-white/10 text-zinc-400 hover:border-white/20'
            }`}
          >{t}</button>
        ))}
      </div>
      {hint && <p className="text-2xs text-zinc-600 mt-0.5">{hint}</p>}
    </div>
  );
}

// ── Compra / Reforma / Venta ──────────────────────────────────────────────────

export function FormCV({ form, set }: { form: FormData; set: SetFn }) {
  const total = ['precio_adquisicion','gastos_adquisicion','presupuesto_obra','gastos_venta','coste_financiero_deuda']
    .reduce((s, k) => s + (parseFloat(form[k] ?? '0') || 0), 0);
  const deudaProm = parseFloat(form['deuda_promotora'] ?? '0') || 0;
  const equityC   = Math.max(total - deudaProm, 0);
  const fiscalidadDefault = form['impuesto_sociedades_pct'] ?? '26';
  return (
    <div className="space-y-5">
      {/* 1 · Compra */}
      <Bloque titulo="Compra">
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Precio adquisición *" value={form['precio_adquisicion'] ?? ''} onChange={v => set('precio_adquisicion', v)} hint="Precio escritura / oferta firmada" />
          <NumInput label="Gastos adquisición" value={form['gastos_adquisicion'] ?? ''} onChange={v => set('gastos_adquisicion', v)} hint="ITP/AJD, notaría, registro (~8-12%)" />
          <NumInput label="Gastos financiación / notaría" value={form['gastos_financiacion_notarial'] ?? ''} onChange={v => set('gastos_financiacion_notarial', v)} />
        </div>
      </Bloque>

      {/* 2 · Reforma / CAPEX */}
      <Bloque titulo="Reforma / CAPEX">
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Presupuesto obra / reforma *" value={form['presupuesto_obra'] ?? ''} onChange={v => set('presupuesto_obra', v)} />
          <NumInput label="IVA soportado obra" value={form['iva_soportado_obra'] ?? ''} onChange={v => set('iva_soportado_obra', v)} hint="Si no recuperable (no promotor)" />
          <PctInput label="Contingencia obra %" value={form['contingencia_obra_pct'] ?? ''} onChange={v => set('contingencia_obra_pct', v)} hint="% sobre presupuesto obra (colchón de desviación)" />
        </div>
      </Bloque>

      {/* 3 · Venta */}
      <Bloque titulo="Venta">
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Precio venta previsto *" value={form['precio_venta_previsto'] ?? ''} onChange={v => set('precio_venta_previsto', v)} />
          <NumInput label="Precio venta reservado" value={form['precio_venta_reservado'] ?? ''} onChange={v => set('precio_venta_reservado', v)} hint="Si hay contrato de arras firmado" />
          <NumInput label="Anticipo comprador" value={form['anticipo_comprador'] ?? ''} onChange={v => set('anticipo_comprador', v)} hint="Señal recibida" />
          <NumInput label="Gastos venta" value={form['gastos_venta'] ?? ''} onChange={v => set('gastos_venta', v)} hint="Plusvalía, comunidad, notaría venta — se pagan a la salida" />
          <PctInput label="Comisión agente %" value={form['comision_agente_pct'] ?? ''} onChange={v => set('comision_agente_pct', v)} hint="Sobre precio de venta; se paga a la salida" />
        </div>
      </Bloque>

      {/* 4 · Financiación */}
      <Bloque titulo="Financiación">
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Deuda promotora" value={form['deuda_promotora'] ?? ''} onChange={v => set('deuda_promotora', v)} hint="Préstamo promotor si aplica. Se devuelve a la venta." />
          <NumInput label="Coste financiero deuda" value={form['coste_financiero_deuda'] ?? ''} onChange={v => set('coste_financiero_deuda', v)} hint="Intereses totales del préstamo" />
        </div>
        {total > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 rounded-lg bg-zinc-800/40 border border-white/[0.06] text-xs text-zinc-400">
            <span>Capital propio aportado: <strong className="text-white">{equityC.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €</strong></span>
            <span className="text-zinc-700">·</span>
            <span>Deuda promotora: <strong className="text-zinc-300">{deudaProm.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €</strong></span>
            <span className="text-2xs text-zinc-600 w-full">Capital aportado = costes iniciales − deuda. La deuda se devuelve a la venta (una sola vez).</span>
          </div>
        )}
      </Bloque>

      {/* 5 · Fiscalidad (cerrada por defecto) */}
      <Collapsible title="Fiscalidad" subtitle="Impuesto de sociedades sobre el beneficio">
        <div className="grid grid-cols-2 gap-4">
          <PctInput label="Impuesto de sociedades %" value={fiscalidadDefault} onChange={v => set('impuesto_sociedades_pct', v)} hint="Sobre beneficio bruto positivo. Por defecto 26%. Se paga a la salida." />
        </div>
      </Collapsible>

      {/* 6 · Horizonte y salida */}
      <Bloque titulo="Horizonte y salida">
        <p className="text-xs text-zinc-600">La TIR/VAN usan la duración total desde la entrada hasta la venta, no solo la obra. Introduce las fechas o el plazo total.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Fecha inicio operación</label>
            <input type="date" className={inp}
              value={form['fecha_inicio_operacion'] ?? ''}
              onChange={e => set('fecha_inicio_operacion', e.target.value)} />
            <p className="text-2xs text-zinc-600 mt-0.5">Fecha de firma / entrada en el activo</p>
          </div>
          <div>
            <label className={lbl}>Fecha salida prevista</label>
            <input type="date" className={inp}
              value={form['fecha_salida_prevista'] ?? ''}
              onChange={e => set('fecha_salida_prevista', e.target.value)} />
            <p className="text-2xs text-zinc-600 mt-0.5">Fecha prevista de venta o desinversión</p>
          </div>
          <div>
            <label className={lbl}>Plazo total operación (meses)</label>
            <input type="number" min="1" max="600" step="1" className={inp}
              value={form['plazo_total_operacion_meses'] ?? ''} placeholder="ej. 36"
              onChange={e => set('plazo_total_operacion_meses', e.target.value)} />
            <p className="text-2xs text-zinc-600 mt-0.5">Alternativa si no hay fechas fijas</p>
          </div>
          <div>
            <label className={lbl}>Plazo ejecución obra (meses)</label>
            <input type="number" min="0" step="1" className={inp}
              value={form['plazo_ejecucion_obra_meses'] ?? ''} placeholder="0"
              onChange={e => set('plazo_ejecucion_obra_meses', e.target.value)} />
            <p className="text-2xs text-zinc-600 mt-0.5">Solo fase constructiva — no equivale al plazo total</p>
          </div>
          <TasaDescuentoInput value={form['tasa_descuento'] ?? ''} onChange={v => set('tasa_descuento', v)} hint="Para descontar flujos (VAN / TIR)" />
        </div>
      </Bloque>

      {/* 7 · Supuestos avanzados (cerrada por defecto) */}
      <Collapsible title="Supuestos avanzados" subtitle="Superficie y métricas por m²">
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Superficie m²" value={form['superficie_arrendable_m2'] ?? ''} onChange={v => set('superficie_arrendable_m2', v)} suffix="m²" step="1" hint="Para coste/m² y precio/m²" />
        </div>
      </Collapsible>
    </div>
  );
}

// ── Patrimonial en renta ──────────────────────────────────────────────────────

export function FormRenta({ form, set }: { form: FormData; set: SetFn }) {
  const total = ['precio_adquisicion','gastos_adquisicion','capex_inicial']
    .reduce((s, k) => s + (parseFloat(form[k] ?? '0') || 0), 0);
  const deuda   = parseFloat(form['deuda_hipotecaria'] ?? '0') || 0;
  const capitalAportado = Math.max(total - deuda, 0);
  const metodo  = form['metodo_valor_residual'] ?? 'valor_actual';
  const fiscalidadOn = form['aplicar_fiscalidad'] === 'true';

  return (
    <div className="space-y-5">
      {/* 1 · Básico */}
      <Bloque titulo="Básico">
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Coste histórico / inversión *" value={form['precio_adquisicion'] ?? ''} onChange={v => set('precio_adquisicion', v)} hint="Precio compra + gastos formalización" />
          <NumInput label="Gastos adquisición" value={form['gastos_adquisicion'] ?? ''} onChange={v => set('gastos_adquisicion', v)} hint="ITP/AJD, notaría (~8-10%)" />
          <NumInput label="CAPEX inicial" value={form['capex_inicial'] ?? ''} onChange={v => set('capex_inicial', v)} hint="Reforma antes de arrendar" />
          <NumInput label="Valor actual estimado" value={form['valoracion_actual'] ?? ''} onChange={v => set('valoracion_actual', v)} hint="Tasación / valor de mercado hoy" />
          <div>
            <label className={lbl}>Renta mensual bruta *</label>
            <div className="relative">
              <input type="number" min="0" step="50" className={`${inp} pr-14`}
                value={form['renta_mensual_bruta'] ?? ''} placeholder="0"
                onChange={e => set('renta_mensual_bruta', e.target.value)} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-600">€/mes</span>
            </div>
          </div>
        </div>
      </Bloque>

      {/* 2 · Gastos y ocupación */}
      <Bloque titulo="Gastos y ocupación">
        <div className="grid grid-cols-2 gap-4">
          <PctInput label="Tasa ocupación prevista %" value={form['tasa_ocupacion_prevista_pct'] ?? '100'} onChange={v => set('tasa_ocupacion_prevista_pct', v)} hint="Normalmente 90-100%" />
          <NumInput label="Gastos operativos anuales" value={form['gastos_operativos_anuales'] ?? ''} onChange={v => set('gastos_operativos_anuales', v)} hint="Comunidad, mantenimiento, etc." />
          <NumInput label="IBI anual" value={form['ibi_anual'] ?? ''} onChange={v => set('ibi_anual', v)} />
          <NumInput label="Seguro anual" value={form['seguro_anual'] ?? ''} onChange={v => set('seguro_anual', v)} />
          <NumInput label="CAPEX mantenimiento anual" value={form['capex_mantenimiento_anual'] ?? ''} onChange={v => set('capex_mantenimiento_anual', v)} hint="Dotación anual estimada" />
        </div>
      </Bloque>

      {/* 3 · Financiación */}
      <Bloque titulo="Financiación">
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Deuda hipotecaria" value={form['deuda_hipotecaria'] ?? ''} onChange={v => set('deuda_hipotecaria', v)} hint="Deuda viva actual. El resto es capital propio." />
          <div>
            <label className={lbl}>Cuota hipoteca mensual</label>
            <div className="relative">
              <input type="number" min="0" step="50" className={`${inp} pr-14`}
                value={form['cuota_hipoteca_mensual'] ?? ''} placeholder="0"
                onChange={e => set('cuota_hipoteca_mensual', e.target.value)} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-600">€/mes</span>
            </div>
          </div>
          <PctInput label="Tipo de interés anual %" value={form['tipo_interes_deuda_pct'] ?? ''} onChange={v => set('tipo_interes_deuda_pct', v)} hint="TIN de la hipoteca" />
          <NumInput label="Plazo restante (años)" value={form['plazo_restante_anios'] ?? ''} onChange={v => set('plazo_restante_anios', v)} suffix="años" step="1" hint="Para estimar deuda a salida" />
          <SelectInput label="Sistema de amortización" value={form['sistema_amortizacion_deuda'] ?? 'frances'}
            onChange={v => set('sistema_amortizacion_deuda', v)}
            options={[
              { value: 'frances', label: 'Francés (cuota constante)' },
              { value: 'bullet',  label: 'Interest-only / bullet' },
              { value: 'manual',  label: 'Manual (uso la cuota indicada)' },
            ]}
          />
        </div>
        {total > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 rounded-lg bg-zinc-800/40 border border-white/[0.06] text-xs text-zinc-400">
            <span>Capital propio aportado: <strong className="text-white">{capitalAportado.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €</strong></span>
            <span className="text-zinc-700">·</span>
            <span>Deuda: <strong className="text-zinc-300">{deuda.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €</strong> ({total > 0 ? ((deuda / total) * 100).toFixed(0) : 0}% del coste)</span>
          </div>
        )}
        <p className="text-2xs text-zinc-600">El capital propio aportado se calcula como coste total − deuda. La rentabilidad sobre capital aportado, la TIR y el VAN se calculan sobre ese capital, con los flujos netos de cuota. Si solo conoces la cuota, deja el sistema en "Manual"; el tipo y el plazo permiten estimar intereses, amortización y deuda a la salida.</p>
      </Bloque>

      {/* 4 · Horizonte y salida */}
      <Bloque titulo="Horizonte y salida">
        <p className="text-xs text-zinc-600">Permite calcular TIR/VAN sin una venta real. Se asume un valor residual teórico al final del horizonte.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Horizonte (años)</label>
            <input type="number" min="1" max="50" step="1" className={inp}
              value={form['horizonte_analisis_anios'] ?? '10'}
              onChange={e => set('horizonte_analisis_anios', e.target.value)} />
            <p className="text-2xs text-zinc-600 mt-0.5">Por defecto: 10 años</p>
          </div>
          <div>
            <label className={lbl}>Fecha inicio explotación</label>
            <input type="date" className={inp}
              value={form['fecha_inicio_explotacion'] ?? ''}
              onChange={e => set('fecha_inicio_explotacion', e.target.value)} />
            <p className="text-2xs text-zinc-600 mt-0.5">Si es distinta a la del proyecto</p>
          </div>
          <SelectInput label="Método valor residual" value={metodo === 'crecimiento_anual' ? 'valor_actual' : metodo}
            onChange={v => set('metodo_valor_residual', v)}
            options={[
              { value: 'valor_actual',    label: 'Valor actual estimado + revalorización' },
              { value: 'cap_rate_salida', label: 'Cap rate de salida sobre NOI' },
              { value: 'manual',          label: 'Manual (valor del año final)' },
            ]}
          />
          {(metodo === 'valor_actual' || metodo === 'crecimiento_anual') && (
            <PctInput label="Revalorización anual estimada del activo %" value={form['tasa_crecimiento_anual_pct'] ?? ''} onChange={v => set('tasa_crecimiento_anual_pct', v)} hint="Vacío = 0% (supuesto conservador: mantiene el valor de hoy)" />
          )}
          {metodo === 'manual' && (
            <NumInput label="Valor residual estimado (año final)" value={form['valor_residual_estimado'] ?? ''} onChange={v => set('valor_residual_estimado', v)} hint="Valor esperado del activo en el año final; no se revaloriza, solo se descuenta" />
          )}
          {metodo === 'cap_rate_salida' && (
            <PctInput label="Cap rate de salida %" value={form['cap_rate_salida_pct'] ?? ''} onChange={v => set('cap_rate_salida_pct', v)} hint="NOI / cap_rate = valor residual futuro" />
          )}
          <TasaDescuentoInput value={form['tasa_descuento'] ?? ''} onChange={v => set('tasa_descuento', v)} hint="Para descontar flujos (TIR y VAN)" />
        </div>
      </Bloque>

      {/* 5 · Fiscalidad avanzada (cerrada por defecto) */}
      <Collapsible title="Fiscalidad avanzada" subtitle="Opcional — si no la activas, el análisis es antes de impuestos">
        <div className="space-y-4">
          <ToggleInput label="¿Aplicar fiscalidad?" value={form['aplicar_fiscalidad'] ?? 'false'} onChange={v => set('aplicar_fiscalidad', v)}
            hint="Al activarla, la TIR, el VAN y la caja se calculan después de impuestos" />
          {fiscalidadOn && (
            <div className="grid grid-cols-2 gap-4">
              <PctInput label="Tipo de Impuesto de Sociedades %" value={form['impuesto_sociedades_pct'] ?? '25'} onChange={v => set('impuesto_sociedades_pct', v)} hint="Sobre base imponible. Por defecto 25%" />
              <NumInput label="Amortización fiscal anual" value={form['amortizacion_fiscal_anual'] ?? ''} onChange={v => set('amortizacion_fiscal_anual', v)} hint="Gasto deducible (no es caja)" />
              <PctInput label="Costes de venta %" value={form['costes_venta_pct'] ?? ''} onChange={v => set('costes_venta_pct', v)} hint="Comisión y gastos sobre valor de salida" />
              <PctInput label="Impuesto sobre plusvalía %" value={form['impuesto_plusvalia_pct'] ?? ''} onChange={v => set('impuesto_plusvalia_pct', v)} hint="Sobre la plusvalía en la venta" />
            </div>
          )}
        </div>
      </Collapsible>

      {/* 6 · Supuestos avanzados (cerrada por defecto) */}
      <Collapsible title="Supuestos avanzados" subtitle="Superficie y métricas por m²">
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Superficie arrendable m²" value={form['superficie_arrendable_m2'] ?? ''} onChange={v => set('superficie_arrendable_m2', v)} suffix="m²" step="1" hint="Para métricas €/m²" />
          <div>
            <label className={lbl}>Renta por m²</label>
            <div className="relative">
              <input type="number" min="0" step="0.5" className={`${inp} pr-14`}
                value={form['renta_por_m2'] ?? ''} placeholder="0"
                onChange={e => set('renta_por_m2', e.target.value)} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-600">€/m²</span>
            </div>
          </div>
        </div>
      </Collapsible>
    </div>
  );
}

// ── Negocio operativo (explotación) ──────────────────────────────────────────

export function FormExplotacion({ form, set }: { form: FormData; set: SetFn }) {
  const fiscalidadOn = form['aplicar_fiscalidad'] === 'true';
  const terminalOn   = form['aplicar_valor_terminal'] === 'true';
  const metodoTerminal = form['metodo_valor_terminal'] ?? 'manual';
  return (
    <div className="space-y-5">
      {/* 1 · Inversión inicial */}
      <Bloque titulo="Inversión inicial">
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Inversión inicial *" value={form['precio_adquisicion'] ?? ''} onChange={v => set('precio_adquisicion', v)} hint="Inversión, CAPEX inicial y puesta en marcha" />
          <NumInput label="Capital circulante" value={form['inversion_circulante'] ?? ''} onChange={v => set('inversion_circulante', v)} hint="Stock, tesorería operativa, etc." />
        </div>
      </Bloque>

      {/* 2 · Ingresos */}
      <Bloque titulo="Ingresos">
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Ingresos anuales previstos *" value={form['ingresos_anuales_previstos'] ?? ''} onChange={v => set('ingresos_anuales_previstos', v)} hint="Facturación anual esperada" />
        </div>
      </Bloque>

      {/* 3 · Costes */}
      <Bloque titulo="Costes">
        <div className="grid grid-cols-2 gap-4">
          <PctInput label="Costes variables %" value={form['costes_variables_pct'] ?? ''} onChange={v => set('costes_variables_pct', v)} hint="% sobre ingresos" />
          <NumInput label="Costes fijos anuales *" value={form['costes_fijos_anuales'] ?? ''} onChange={v => set('costes_fijos_anuales', v)} hint="Personal, alquiler, suministros..." />
          <NumInput label="CAPEX mantenimiento anual" value={form['capex_mantenimiento_anual'] ?? ''} onChange={v => set('capex_mantenimiento_anual', v)} hint="Reposición / mantenimiento recurrente" />
        </div>
      </Bloque>

      {/* 4 · Fiscalidad (cerrada por defecto) */}
      <Collapsible title="Fiscalidad" subtitle="Opcional — si no la activas, el análisis es antes de impuestos">
        <div className="space-y-4">
          <ToggleInput label="¿Aplicar fiscalidad?" value={form['aplicar_fiscalidad'] ?? 'false'} onChange={v => set('aplicar_fiscalidad', v)}
            hint="Al activarla, el FCF, el VAN y la TIR se calculan después de impuestos" />
          {fiscalidadOn && (
            <div className="grid grid-cols-2 gap-4">
              <PctInput label="Impuesto de sociedades %" value={form['impuesto_sociedades_pct'] ?? '25'} onChange={v => set('impuesto_sociedades_pct', v)} hint="Sobre EBITDA positivo. Por defecto 25%" />
            </div>
          )}
        </div>
      </Collapsible>

      {/* 5 · Crecimiento */}
      <Bloque titulo="Crecimiento">
        <div className="grid grid-cols-2 gap-4">
          <PctInput label="Crecimiento anual %" value={form['tasa_crecimiento_anual_pct'] ?? ''} onChange={v => set('tasa_crecimiento_anual_pct', v)} hint="Vacío = 0%. Se aplica a la caja libre (simplificación)" />
          <div>
            <label className={lbl}>Año break-even previsto</label>
            <input type="number" min="2020" max="2060" step="1" className={inp}
              value={form['anio_break_even_previsto'] ?? ''} placeholder="ej. 2026"
              onChange={e => set('anio_break_even_previsto', e.target.value)} />
            <p className="text-2xs text-zinc-600 mt-0.5">Referencia de management</p>
          </div>
        </div>
      </Bloque>

      {/* 6 · Horizonte */}
      <Bloque titulo="Horizonte">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Horizonte (años)</label>
            <input type="number" min="1" max="50" step="1" className={inp}
              value={form['horizonte_analisis_anios'] ?? '10'}
              onChange={e => set('horizonte_analisis_anios', e.target.value)} />
            <p className="text-2xs text-zinc-600 mt-0.5">Años proyectados. Por defecto: 10</p>
          </div>
          <TasaDescuentoInput value={form['tasa_descuento'] ?? ''} onChange={v => set('tasa_descuento', v)} hint="Para descontar flujos (VAN / TIR)" />
        </div>
      </Bloque>

      {/* 7 · Valor de continuidad (cerrada y desactivada por defecto) */}
      <Collapsible title="Valor de continuidad" subtitle="Opcional — por defecto sin valor terminal (conservador)">
        <div className="space-y-4">
          <ToggleInput label="¿Aplicar valor de continuidad?" value={form['aplicar_valor_terminal'] ?? 'false'} onChange={v => set('aplicar_valor_terminal', v)}
            hint="Valor del negocio al final del horizonte. Se suma al último año y se descuenta a hoy." />
          {terminalOn && (
            <div className="grid grid-cols-2 gap-4">
              <SelectInput label="Método" value={metodoTerminal}
                onChange={v => set('metodo_valor_terminal', v)}
                options={[
                  { value: 'manual',          label: 'Valor terminal manual' },
                  { value: 'multiplo_ebitda', label: 'Múltiplo de EBITDA' },
                ]}
              />
              {metodoTerminal === 'manual' && (
                <NumInput label="Valor terminal (año final)" value={form['valor_terminal_manual'] ?? ''} onChange={v => set('valor_terminal_manual', v)} hint="Valor esperado del negocio al final del horizonte" />
              )}
              {metodoTerminal === 'multiplo_ebitda' && (
                <NumInput label="Múltiplo de EBITDA de salida" value={form['multiplo_ebitda_salida'] ?? ''} onChange={v => set('multiplo_ebitda_salida', v)} suffix="x" step="0.5" hint="EBITDA del último año × este múltiplo" />
              )}
            </div>
          )}
        </div>
      </Collapsible>

      {/* 8 · Supuestos avanzados (cerrada por defecto) */}
      <Collapsible title="Supuestos avanzados" subtitle="Referencias de management">
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="EBITDA objetivo anual" value={form['ebitda_objetivo_anual'] ?? ''} onChange={v => set('ebitda_objetivo_anual', v)} hint="Referencia de management (no entra en el cálculo)" />
        </div>
      </Collapsible>
    </div>
  );
}

// ── Préstamo / Inversión financiera ──────────────────────────────────────────

export function FormPrestamo({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-5">
      {/* 1 · Capital */}
      <Bloque titulo="Capital">
        <div className="grid grid-cols-2 gap-4">
          <SelectInput label="Tipo de instrumento" value={form['tipo_instrumento'] ?? 'prestamo'} onChange={v => set('tipo_instrumento', v)}
            options={[
              { value: 'prestamo', label: 'Préstamo' },
              { value: 'bono', label: 'Bono / Pagaré' },
              { value: 'participativo', label: 'Préstamo participativo' },
              { value: 'linea_credito', label: 'Línea de crédito' },
              { value: 'otro', label: 'Otro' },
            ]}
          />
          <NumInput label="Capital prestado *" value={form['nominal_prestamo'] ?? ''} onChange={v => set('nominal_prestamo', v)} hint="Capital prestado o invertido (sale en el año 0)" />
        </div>
      </Bloque>

      {/* 2 · Tipo y plazo */}
      <Bloque titulo="Tipo y plazo">
        <div className="grid grid-cols-2 gap-4">
          <PctInput label="Tipo interés anual %" value={form['tipo_interes_pct'] ?? ''} onChange={v => set('tipo_interes_pct', v)} hint="TIN anual" />
          <div>
            <label className={lbl}>Plazo (meses) *</label>
            <input type="number" min="1" max="600" step="1" className={inp}
              value={form['plazo_meses'] ?? ''} placeholder="0"
              onChange={e => set('plazo_meses', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Fecha vencimiento</label>
            <input type="date" className={inp}
              value={form['fecha_vencimiento_instrumento'] ?? ''}
              onChange={e => set('fecha_vencimiento_instrumento', e.target.value)} />
          </div>
        </div>
      </Bloque>

      {/* 3 · Pagos / amortización */}
      <Bloque titulo="Pagos / amortización">
        <div className="grid grid-cols-2 gap-4">
          <SelectInput label="Sistema de amortización" value={form['sistema_amortizacion'] ?? 'frances'} onChange={v => set('sistema_amortizacion', v)}
            options={[
              { value: 'frances', label: 'Francés (cuota constante)' },
              { value: 'aleman', label: 'Alemán (amortización constante)' },
              { value: 'bullet', label: 'Bullet / interest-only (principal al vencimiento)' },
            ]}
          />
        </div>
      </Bloque>

      {/* 4 · Garantías (cerrada por defecto) */}
      <Collapsible title="Garantías" subtitle="Colateral y cobertura">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Colateral / garantía</label>
            <input type="text" className={inp} placeholder="Ej: hipoteca sobre inmueble X"
              value={form['colateral'] ?? ''} onChange={e => set('colateral', e.target.value)} />
          </div>
          <NumInput label="Valor de garantía" value={form['valor_garantia'] ?? ''} onChange={v => set('valor_garantia', v)} hint="Para calcular la cobertura (valor / capital)" />
        </div>
      </Collapsible>

      {/* 5 · Riesgo (cerrada por defecto) */}
      <Collapsible title="Riesgo" subtitle="Probabilidad de impago, LGD y rating">
        <div className="grid grid-cols-2 gap-4">
          <PctInput label="Probabilidad impago %" value={form['probabilidad_impago_pct'] ?? ''} onChange={v => set('probabilidad_impago_pct', v)} hint="PD — necesaria para la pérdida esperada" />
          <PctInput label="LGD % (pérdida en caso de impago)" value={form['lgd_pct'] ?? ''} onChange={v => set('lgd_pct', v)} hint="Loss Given Default — necesaria para la pérdida esperada" />
          <div>
            <label className={lbl}>Rating interno</label>
            <input type="text" className={inp} placeholder="Ej: A, BBB, especulativo..."
              value={form['rating_interno'] ?? ''} onChange={e => set('rating_interno', e.target.value)} />
          </div>
        </div>
      </Collapsible>

      {/* 6 · Supuestos */}
      <Bloque titulo="Supuestos">
        <div className="grid grid-cols-2 gap-4">
          <TasaDescuentoInput value={form['tasa_descuento'] ?? ''} onChange={v => set('tasa_descuento', v)} hint="Para descontar los cobros (VAN)" />
        </div>
      </Bloque>
    </div>
  );
}

// ── CAPEX interno ─────────────────────────────────────────────────────────────

export function FormCapex({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-5">
      {/* 1 · Inversión */}
      <Bloque titulo="Inversión">
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Inversión CAPEX *" value={form['precio_adquisicion'] ?? ''} onChange={v => set('precio_adquisicion', v)} hint="Coste total del activo, mejora o sistema (año 0)" />
        </div>
      </Bloque>

      {/* 2 · Beneficio / ahorro */}
      <Bloque titulo="Beneficio / ahorro">
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Beneficio / ahorro anual esperado *" value={form['beneficio_esperado_anual'] ?? ''} onChange={v => set('beneficio_esperado_anual', v)} hint="Ahorro de coste o ingreso adicional, bruto" />
        </div>
      </Bloque>

      {/* 3 · Mantenimiento */}
      <Bloque titulo="Mantenimiento">
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="CAPEX mantenimiento anual" value={form['capex_mantenimiento_anual'] ?? ''} onChange={v => set('capex_mantenimiento_anual', v)} hint="Coste anual para sostener el ahorro. La caja neta = ahorro − mantenimiento" />
        </div>
      </Bloque>

      {/* 4 · Vida útil */}
      <Bloque titulo="Vida útil">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Vida útil (años) *</label>
            <input type="number" min="1" max="50" step="1" className={inp}
              value={form['vida_util_activo_anios'] ?? ''} placeholder="0"
              onChange={e => set('vida_util_activo_anios', e.target.value)} />
            <p className="text-2xs text-zinc-600 mt-0.5">Horizonte del análisis (VAN/TIR)</p>
          </div>
        </div>
      </Bloque>

      {/* 5 · Valor residual */}
      <Bloque titulo="Valor residual">
        <div className="grid grid-cols-2 gap-4">
          <PctInput label="Valor residual %" value={form['valor_residual_pct'] ?? ''} onChange={v => set('valor_residual_pct', v)} hint="% del coste al final de la vida útil. Vacío = 0% (conservador)" />
        </div>
      </Bloque>

      {/* 6 · Depreciación */}
      <Bloque titulo="Depreciación">
        <div className="grid grid-cols-2 gap-4">
          <SelectInput label="Método de depreciación" value={form['depreciacion_tipo'] ?? 'lineal'} onChange={v => set('depreciacion_tipo', v)}
            options={[
              { value: 'lineal', label: 'Lineal (cuotas iguales)' },
              { value: 'acelerada', label: 'Acelerada (doble saldo decreciente)' },
            ]}
          />
        </div>
        <p className="text-2xs text-zinc-600">Dato contable: no afecta a la caja ni al VAN/TIR (sin fiscalidad).</p>
      </Bloque>

      {/* 7 · Supuestos avanzados (cerrada por defecto) */}
      <Collapsible title="Supuestos avanzados" subtitle="Tasa de descuento interna">
        <div className="grid grid-cols-2 gap-4">
          <PctInput label="Tasa descuento interna %" value={form['tasa_descuento_interna'] ? String(parseFloat(form['tasa_descuento_interna'] ?? '0') * 100) : ''} onChange={v => set('tasa_descuento_interna', String(parseFloat(v) / 100))} hint="WACC o tasa mínima de retorno. Por defecto 8%" />
        </div>
      </Collapsible>
    </div>
  );
}

// ── Alternativo ───────────────────────────────────────────────────────────────

export function FormAlternativo({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-5">
      {/* 1 · Capital */}
      <Bloque titulo="Capital">
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Capital requerido *" value={form['precio_adquisicion'] ?? ''} onChange={v => set('precio_adquisicion', v)} hint="Equity aportado / capital invertido (sale en el año 0)" />
        </div>
      </Bloque>

      {/* 2 · Retorno esperado */}
      <Bloque titulo="Retorno esperado">
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Retorno esperado total *" value={form['retorno_previsto_total'] ?? ''} onChange={v => set('retorno_previsto_total', v)} hint="Importe TOTAL a cobrar a la salida (capital + plusvalía), no solo el beneficio" />
        </div>
      </Bloque>

      {/* 3 · Plazo / salida */}
      <Bloque titulo="Plazo / salida">
        <p className="text-2xs text-zinc-600">El plazo se toma de las fechas de inicio y salida prevista del proyecto. La TIR/VAN las necesitan.</p>
      </Bloque>

      {/* 4 · Valoración actual */}
      <Bloque titulo="Valoración actual">
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Valoración actual" value={form['valoracion_actual'] ?? ''} onChange={v => set('valoracion_actual', v)} hint="Valor de mercado hoy. Para la plusvalía latente; no se suma al VAN" />
        </div>
      </Bloque>

      {/* 5 · Riesgo y liquidez (cerrada por defecto) */}
      <Collapsible title="Riesgo y liquidez" subtitle="Perfil cualitativo de la operación">
        <div className="grid grid-cols-2 gap-4">
          <SelectInput label="Nivel de riesgo" value={form['nivel_riesgo'] ?? ''} onChange={v => set('nivel_riesgo', v)}
            options={[
              { value: '',      label: '— No informado —' },
              { value: 'bajo',  label: 'Bajo (defensiva)' },
              { value: 'medio', label: 'Medio (normal)' },
              { value: 'alto',  label: 'Alto (incertidumbre elevada)' },
            ]}
          />
          <SelectInput label="Nivel de liquidez" value={form['nivel_liquidez'] ?? ''} onChange={v => set('nivel_liquidez', v)}
            options={[
              { value: '',      label: '— No informado —' },
              { value: 'alta',  label: 'Alta (salida sencilla)' },
              { value: 'media', label: 'Media (salida no inmediata)' },
              { value: 'baja',  label: 'Baja (capital bloqueado / salida incierta)' },
            ]}
          />
        </div>
        <p className="text-2xs text-zinc-600">Sin informar baja la calidad del dato y el veredicto se vuelve más prudente.</p>
      </Collapsible>

      {/* 6 · Descripción de la operación */}
      <Bloque titulo="Descripción de la operación">
        <TextAreaInput label="Descripción"
          value={form['descripcion_operacion'] ?? ''} onChange={v => set('descripcion_operacion', v)}
          placeholder="Ej: Participación 30% en empresa X, earn-out vinculado a KPIs…" />
      </Bloque>

      {/* 7 · Supuestos avanzados (cerrada por defecto) */}
      <Collapsible title="Supuestos avanzados" subtitle="Tasa de descuento">
        <div className="grid grid-cols-2 gap-4">
          <TasaDescuentoInput value={form['tasa_descuento'] ?? ''} onChange={v => set('tasa_descuento', v)} hint="Para descontar el retorno (VAN / TIR). Por defecto 8%" />
        </div>
      </Collapsible>
    </div>
  );
}

// ── Selector de tipo ──────────────────────────────────────────────────────────

export const TIPO_LABEL: Record<TipoAnalisis, string> = {
  renta:         'Patrimonial en renta',
  compra_venta:  'Compra / reforma / venta',
  explotacion:   'Negocio operativo',
  prestamo:      'Préstamo / inv. financiera',
  capex_interno: 'CAPEX interno',
  alternativo:   'Alternativo',
};
