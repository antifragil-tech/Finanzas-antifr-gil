import { CATEGORIA_DE, type CategoriaGasto, type TipoGasto } from '@antifragil/operativa';
import {
  crearFacturaRecibida,
  crearGasto,
  crearIngreso,
  emitirFacturaOperativa,
} from '@/lib/datos/acciones';

// Entrada manual de datos de Tesorería: cuatro paneles colapsables (<details>)
// que envían server actions con validación en servidor. Server component puro:
// funciona sin JS de cliente (formularios nativos + redirect con aviso).

const NOMBRE_CATEGORIA: Record<CategoriaGasto, string> = {
  coste_profesional_variable: 'Coste profesional variable',
  nominas_laboral: 'Nóminas y costes laborales',
  gasto_clinica: 'Gastos de clínica',
  amortizable: 'Amortizables / inversiones',
};

const CAPAS_COSTE = ['directo', 'fijo', 'compartido', 'general', 'amortizable'] as const;
const ORIGENES_INGRESO = ['suelta', 'bono', 'programa', 'plan', 'partner'] as const;
const ORIGENES_FACTURA = ['sesion', 'bono', 'programa', 'partner'] as const;

const ESTADOS_FACTURA_RECIBIDA: { valor: string; etiqueta: string }[] = [
  { valor: 'revision_javi', etiqueta: 'En revisión' },
  { valor: 'borrador_ocr', etiqueta: 'Borrador (OCR)' },
  { valor: 'pendiente_pago', etiqueta: 'Pendiente de pago' },
  { valor: 'pagada', etiqueta: 'Pagada' },
  { valor: 'rechazada', etiqueta: 'Rechazada' },
];

function tiposPorCategoria(): [CategoriaGasto, TipoGasto[]][] {
  const grupos = new Map<CategoriaGasto, TipoGasto[]>();
  for (const [tipo, cat] of Object.entries(CATEGORIA_DE) as [TipoGasto, CategoriaGasto][]) {
    grupos.set(cat, [...(grupos.get(cat) ?? []), tipo]);
  }
  return [...grupos.entries()];
}

function Panel({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota: string;
  children: React.ReactNode;
}) {
  return (
    <details className="glass-panel rounded-2xl">
      <summary className="cursor-pointer select-none px-5 py-4 text-sm text-zinc-200 transition-colors hover:text-white">
        {titulo}
        <span className="text-2xs ml-3 uppercase tracking-widest text-zinc-600">{nota}</span>
      </summary>
      <div className="border-t border-white/5 px-5 py-4">{children}</div>
    </details>
  );
}

function BotonEnviar({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="text-2xs rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 uppercase tracking-widest text-zinc-200 transition-colors hover:bg-white/10"
    >
      {children}
    </button>
  );
}

export function EntradaDatos({ mes }: { mes?: string | undefined }) {
  const campoMes = <input type="hidden" name="_mes" value={mes ?? ''} />;

  return (
    <div className="space-y-3">
      <Panel titulo="Nuevo gasto" nota="gastos_operativos · taxonomía A–D">
        <form action={crearGasto} className="grid gap-3 md:grid-cols-3">
          {campoMes}
          <label>
            <span className="field-label">Fecha (de pago)</span>
            <input type="date" name="fecha" required className="field-input" />
          </label>
          <label>
            <span className="field-label">Pagado con</span>
            <select name="pagado_con" className="field-input">
              <option value="banco">Banco</option>
              <option value="caja">Caja (efectivo)</option>
              <option value="">Aún no pagado</option>
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="field-label">Concepto</span>
            <input
              type="text"
              name="concepto"
              required
              placeholder="Alquiler clínica, nómina María…"
              className="field-input"
            />
          </label>
          <label>
            <span className="field-label">Tipo (categoría A–D)</span>
            <select name="tipo" required className="field-input">
              {tiposPorCategoria().map(([cat, tipos]) => (
                <optgroup key={cat} label={NOMBRE_CATEGORIA[cat]}>
                  {tipos.map((t) => (
                    <option key={t} value={t}>
                      {t.replaceAll('_', ' ')}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Capa de coste</span>
            <select name="capa" required defaultValue="general" className="field-input">
              {CAPAS_COSTE.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Importe (€)</span>
            <input
              type="number"
              name="importe"
              required
              step="0.01"
              min="0.01"
              placeholder="0,00"
              className="field-input"
            />
          </label>
          <label className="md:col-span-2">
            <span className="field-label">Nota (opcional)</span>
            <input type="text" name="nota" className="field-input" />
          </label>
          <label className="flex items-end gap-2 pb-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              name="documento_recibido"
              className="h-4 w-4 accent-emerald-400"
            />
            Documento recibido
          </label>
          <div className="md:col-span-3">
            <BotonEnviar>Registrar gasto</BotonEnviar>
            <span className="text-2xs ml-3 uppercase tracking-widest text-zinc-600">
              sin documento queda bloqueado para pago
            </span>
          </div>
        </form>
      </Panel>

      <Panel titulo="Nuevo ingreso / cobro" nota="ingresos_devengados · caja y devengo separados">
        <form action={crearIngreso} className="grid gap-3 md:grid-cols-3">
          {campoMes}
          <label>
            <span className="field-label">Fecha de devengo</span>
            <input type="date" name="fecha" required className="field-input" />
          </label>
          <label className="md:col-span-2">
            <span className="field-label">Concepto</span>
            <input
              type="text"
              name="concepto"
              required
              placeholder="Fisioterapia — sesiones de la semana…"
              className="field-input"
            />
          </label>
          <label>
            <span className="field-label">Origen</span>
            <select name="origen" required defaultValue="suelta" className="field-input">
              {ORIGENES_INGRESO.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Importe devengado (€)</span>
            <input
              type="number"
              name="importe_devengado"
              required
              step="0.01"
              min="0.01"
              placeholder="0,00"
              className="field-input"
            />
          </label>
          <label>
            <span className="field-label">Importe cobrado (€, opcional)</span>
            <input
              type="number"
              name="importe_cobrado"
              step="0.01"
              min="0.01"
              placeholder="se anota en el libro de cobros"
              className="field-input"
            />
          </label>
          <div className="md:col-span-3">
            <BotonEnviar>Registrar ingreso</BotonEnviar>
            <span className="text-2xs ml-3 uppercase tracking-widest text-zinc-600">
              el cobro va al libro de cobros — jamás se suma al devengo
            </span>
          </div>
        </form>
      </Panel>

      <Panel titulo="Nueva factura recibida" nota="facturas_recibidas · soporte documental">
        <form action={crearFacturaRecibida} className="grid gap-3 md:grid-cols-3">
          {campoMes}
          <label>
            <span className="field-label">Fecha de emisión</span>
            <input type="date" name="fecha_emision" required className="field-input" />
          </label>
          <label className="md:col-span-2">
            <span className="field-label">Proveedor</span>
            <input type="text" name="proveedor" required className="field-input" />
          </label>
          <label className="md:col-span-2">
            <span className="field-label">Concepto</span>
            <input type="text" name="concepto" required className="field-input" />
          </label>
          <label>
            <span className="field-label">Total (€)</span>
            <input
              type="number"
              name="total"
              required
              step="0.01"
              min="0.01"
              placeholder="0,00"
              className="field-input"
            />
          </label>
          <label>
            <span className="field-label">Estado</span>
            <select name="estado" required defaultValue="revision_javi" className="field-input">
              {ESTADOS_FACTURA_RECIBIDA.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="field-label">Referencia gasto / liquidación (opcional)</span>
            <input
              type="text"
              name="referencia"
              placeholder="a qué gasto o liquidación da soporte"
              className="field-input"
            />
          </label>
          <div className="md:col-span-3">
            <BotonEnviar>Registrar factura recibida</BotonEnviar>
          </div>
        </form>
      </Panel>

      <Panel titulo="Emitir factura operativa" nota="serie OPS · registro precontable, no fiscal">
        <form action={emitirFacturaOperativa} className="grid gap-3 md:grid-cols-3">
          {campoMes}
          <label>
            <span className="field-label">Fecha</span>
            <input type="date" name="fecha" required className="field-input" />
          </label>
          <label className="md:col-span-2">
            <span className="field-label">Cliente / partner</span>
            <input type="text" name="contraparte" required className="field-input" />
          </label>
          <label>
            <span className="field-label">Origen</span>
            <select name="origen" required defaultValue="sesion" className="field-input">
              {ORIGENES_FACTURA.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="field-label">Concepto</span>
            <input type="text" name="concepto" required className="field-input" />
          </label>
          <label>
            <span className="field-label">Base (€)</span>
            <input
              type="number"
              name="base"
              required
              step="0.01"
              min="0.01"
              placeholder="0,00"
              className="field-input"
            />
          </label>
          <label>
            <span className="field-label">IVA (€, opcional)</span>
            <input
              type="number"
              name="iva"
              step="0.01"
              min="0"
              placeholder="0,00"
              className="field-input"
            />
          </label>
          <p className="text-2xs self-end pb-2 uppercase tracking-widest text-zinc-500 md:col-span-1">
            Por defecto 0 € — Servicios sanitarios exentos de IVA (art. 20.Uno.3º Ley 37/1992)
          </p>
          <div className="md:col-span-3">
            <BotonEnviar>Emitir factura OPS</BotonEnviar>
            <span className="text-2xs ml-3 uppercase tracking-widest text-zinc-600">
              numeración OPS-N automática · abre la vista imprimible
            </span>
          </div>
        </form>
      </Panel>
    </div>
  );
}
