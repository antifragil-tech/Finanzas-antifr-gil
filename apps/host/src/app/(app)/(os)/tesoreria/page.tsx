import { ArrowDownToLine, ArrowUpFromLine, FileText, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@alsari/utils';
import {
  ingresosDemo,
  gastosDemo,
  facturasEmitidasDemo,
  facturasRecibidasDemo,
  totalesCajaDevengo,
  importeCobradoDeFacturas,
  importePagadoDeFacturas,
  estadoValidacion,
  CATEGORIA_DE,
  CONCEPTOS_PENDIENTES,
  MES_DEMO,
  type CategoriaGasto,
  type EstadoFacturaEmitida,
  type EstadoFacturaRecibida,
} from '@antifragil/operativa';
import {
  OSPageHeader,
  OSSection,
  OSKpiCard,
  OSStatusBadge,
  type OSBadgeTone,
} from '@/components/os/ui';

// Tesorería operativa: ingresos y gastos diferenciados, facturas emitidas y
// recibidas, caja vs devengo por separado. Escenario demo compartido del MVP.

const NOMBRE_CATEGORIA: Record<CategoriaGasto, string> = {
  coste_profesional_variable: 'Coste profesional variable',
  nominas_laboral: 'Nóminas y costes laborales',
  gasto_clinica: 'Gastos de clínica',
  amortizable: 'Amortizables / inversiones',
};

const TONO_FE: Record<EstadoFacturaEmitida, OSBadgeTone> = {
  borrador: 'neutral',
  emitida_operativa: 'info',
  cobrada: 'ok',
  pendiente_documento_oficial: 'warn',
  vinculada_factura_externa: 'ok',
};

const TONO_FR: Record<EstadoFacturaRecibida, OSBadgeTone> = {
  pendiente_recibir: 'warn',
  recibida: 'info',
  validada: 'info',
  pendiente_pago: 'warn',
  pagada: 'ok',
  bloqueada: 'danger',
};

export default function TesoreriaPage() {
  const ingresos = ingresosDemo();
  const gastos = gastosDemo();
  const emitidas = facturasEmitidasDemo();
  const recibidas = facturasRecibidasDemo();

  const t = totalesCajaDevengo(ingresos, gastos);
  const cobradoFacturas = importeCobradoDeFacturas(emitidas);
  const pagado = importePagadoDeFacturas(recibidas);
  const bloqueados = gastos.filter((g) => estadoValidacion(g) === 'bloqueado_sin_documento');

  const porCategoria = new Map<
    CategoriaGasto,
    { importe: number; items: number; bloqueado: number }
  >();
  for (const g of gastos) {
    const cat = CATEGORIA_DE[g.tipo];
    const acc = porCategoria.get(cat) ?? { importe: 0, items: 0, bloqueado: 0 };
    acc.importe += g.importe;
    acc.items += 1;
    if (estadoValidacion(g) === 'bloqueado_sin_documento') acc.bloqueado += g.importe;
    porCategoria.set(cat, acc);
  }

  return (
    <div className="pb-10">
      <OSPageHeader
        titulo="Tesorería"
        descripcion={`Ingresos, gastos y facturas del mes demo ${MES_DEMO} — caja y devengo por separado, nunca sumados. Datos ficticios del escenario compartido.`}
      />

      <div className="grid grid-cols-2 gap-4 px-8 pt-4 lg:grid-cols-4">
        <OSKpiCard
          label="Cobrado (caja)"
          valor={formatCurrency(t.cobrado + cobradoFacturas)}
          hint="sueltas al acto + bonos cobrados"
          icon={ArrowDownToLine}
          tone="ok"
        />
        <OSKpiCard
          label="Pagado (caja)"
          valor={formatCurrency(pagado)}
          hint="solo facturas recibidas pagadas"
          icon={ArrowUpFromLine}
        />
        <OSKpiCard
          label="Pendiente de cobro"
          valor={formatCurrency(t.pendienteCobro)}
          hint="partners y sesiones sin cobrar"
          icon={FileText}
          tone="warn"
        />
        <OSKpiCard
          label="Pagos bloqueados"
          valor={formatCurrency(bloqueados.reduce((s, g) => s + g.importe, 0))}
          hint="sin documento: no se validan"
          icon={AlertTriangle}
          tone={bloqueados.length > 0 ? 'warn' : 'ok'}
        />
      </div>

      <OSSection
        titulo="Gastos por categoría"
        nota="Sin documento válido, un gasto está calculado pero NO validado para pago"
      >
        <div className="glass-panel overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="text-2xs border-b border-white/5 uppercase tracking-widest text-zinc-500">
              <tr>
                {['Categoría', 'Conceptos', 'Importe devengado', 'Bloqueado sin documento'].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {[...porCategoria.entries()].map(([cat, acc]) => (
                <tr
                  key={cat}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3 text-zinc-200">{NOMBRE_CATEGORIA[cat]}</td>
                  <td className="px-4 py-3 text-zinc-400">{acc.items}</td>
                  <td className="px-4 py-3 text-zinc-300">{formatCurrency(acc.importe)}</td>
                  <td
                    className={`px-4 py-3 ${acc.bloqueado > 0 ? 'text-amber-300' : 'text-zinc-500'}`}
                  >
                    {acc.bloqueado > 0 ? formatCurrency(acc.bloqueado) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OSSection>

      <OSSection titulo="Detalle de gastos">
        <div className="glass-panel overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="text-2xs border-b border-white/5 uppercase tracking-widest text-zinc-500">
              <tr>
                {['Concepto', 'Tipo', 'Capa', 'Importe', 'Documento', 'Validación'].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gastos.map((g) => {
                const val = estadoValidacion(g);
                return (
                  <tr
                    key={g.id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3 text-zinc-200">
                      {g.concepto}
                      {g.pendienteConfirmacion ? (
                        <span className="text-2xs ml-2 text-amber-400/80">
                          pendiente confirmación
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{g.tipo.replaceAll('_', ' ')}</td>
                    <td className="px-4 py-3 text-zinc-500">{g.capa}</td>
                    <td className="px-4 py-3 text-zinc-300">{formatCurrency(g.importe)}</td>
                    <td className="px-4 py-3 text-zinc-400">
                      {g.documento.tipo === 'no_requerido'
                        ? '—'
                        : `${g.documento.tipo.replaceAll('_', ' ')}${g.documento.recibido ? ' ✓' : ' pendiente'}`}
                    </td>
                    <td className="px-4 py-3">
                      <OSStatusBadge
                        tone={
                          val === 'validado'
                            ? 'ok'
                            : val === 'bloqueado_sin_documento'
                              ? 'warn'
                              : 'neutral'
                        }
                      >
                        {val === 'bloqueado_sin_documento' ? 'Bloqueado' : 'Validado'}
                      </OSStatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </OSSection>

      <OSSection
        titulo="Facturas emitidas operativas"
        nota="Factura emitida no implica cobro — internas, no fiscales (doc 02)"
      >
        <div className="glass-panel overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="text-2xs border-b border-white/5 uppercase tracking-widest text-zinc-500">
              <tr>
                {['Nº', 'Origen', 'Contraparte', 'Fecha', 'Importe', 'Estado'].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {emitidas.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3 font-mono text-zinc-400">
                    {f.serie}-{f.numero}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{f.origenTipo}</td>
                  <td className="px-4 py-3 text-zinc-200">{f.contraparte}</td>
                  <td className="px-4 py-3 text-zinc-500">{f.fecha}</td>
                  <td className="px-4 py-3 text-zinc-300">{formatCurrency(f.importe)}</td>
                  <td className="px-4 py-3">
                    <OSStatusBadge tone={TONO_FE[f.estado]}>
                      {f.estado.replaceAll('_', ' ')}
                    </OSStatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OSSection>

      <OSSection
        titulo="Facturas recibidas"
        nota="Factura recibida no implica pago — soporte documental de gastos y liquidaciones"
      >
        <div className="glass-panel overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="text-2xs border-b border-white/5 uppercase tracking-widest text-zinc-500">
              <tr>
                {['Contraparte', 'Tipo', 'Fecha', 'Importe', 'Vinculada a', 'Estado'].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recibidas.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3 text-zinc-200">{f.contraparte}</td>
                  <td className="px-4 py-3 text-zinc-400">{f.tipo.replaceAll('_', ' ')}</td>
                  <td className="px-4 py-3 text-zinc-500">{f.fecha}</td>
                  <td className="px-4 py-3 text-zinc-300">{formatCurrency(f.importe)}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {f.liquidacionRef ?? f.gastoId ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <OSStatusBadge tone={TONO_FR[f.estado]}>
                      {f.estado.replaceAll('_', ' ')}
                    </OSStatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OSSection>

      <OSSection
        titulo="Conceptos pendientes de confirmar"
        nota="No rompen los cálculos: los marcan como provisionales"
      >
        <ul className="glass-panel rounded-2xl px-5 py-4 text-xs text-zinc-400">
          {CONCEPTOS_PENDIENTES.map((c) => (
            <li key={c.clave} className="flex items-start gap-2 py-1">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/70" />
              {c.descripcion}
            </li>
          ))}
        </ul>
      </OSSection>
    </div>
  );
}
