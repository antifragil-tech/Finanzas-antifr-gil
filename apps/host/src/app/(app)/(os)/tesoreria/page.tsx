import Link from 'next/link';
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
  cargarCuentasPorCobrar,
  cargarCuentasTesoreria,
  cargarFacturasEmitidasReales,
  cargarFacturasRecibidasReales,
  cargarGastosReales,
  cargarIngresosReales,
  cargarProyectos,
  datosRealesDisponibles,
  separarPorProyecto,
} from '@/lib/datos/fuenteDatos';
import { etiquetaMes, filtrarPorMes, primerValor, resolverMes } from '@/lib/datos/periodo';
import { AvisoIva } from '@/components/os/tesoreria/AvisoIva';
import { CuentasPorCobrarSeccion } from '@/components/os/tesoreria/CuentasPorCobrar';
import { ProyectosFuera } from '@/components/os/tesoreria/ProyectosFuera';
import { SaldoTesoreria } from '@/components/os/tesoreria/SaldoTesoreria';
import {
  OSPageHeader,
  OSSection,
  OSKpiCard,
  OSStatusBadge,
  OSFiltroMes,
  type OSBadgeTone,
} from '@/components/os/ui';

// Tesorería operativa. Con Supabase configurado lee los DATOS REALES
// importados de los Excel (Cash Flow 2025-2026 + ingresos por servicio);
// sin entorno cae al escenario demo (build CI sin secrets sigue verde).

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

export default async function TesoreriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Next 15: searchParams es una Promise — hay que esperarla.
  const params = await searchParams;
  const mesParam = primerValor(params['mes']);
  const avisoOk = primerValor(params['ok']);
  const avisoError = primerValor(params['error']);

  const real = datosRealesDisponibles();

  // Se carga el histórico y se resuelve el mes activo (por defecto, el más
  // reciente con datos) antes de filtrar; ?mes=todo muestra el histórico entero.
  const ingresosTodos = real ? await cargarIngresosReales() : ingresosDemo();
  const gastosTodos = real ? await cargarGastosReales() : gastosDemo();
  const emitidasTodas = real ? await cargarFacturasEmitidasReales() : facturasEmitidasDemo();
  const recibidasTodas = real ? await cargarFacturasRecibidasReales() : facturasRecibidasDemo();

  const mes = resolverMes(
    mesParam,
    [...ingresosTodos.map((i) => i.fecha), ...gastosTodos.map((g) => g.fecha)],
    MES_DEMO,
  );

  const ingresos = filtrarPorMes(ingresosTodos, mes, (i) => i.fecha);
  const gastos = filtrarPorMes(gastosTodos, mes, (g) => g.fecha);
  const emitidas = filtrarPorMes(emitidasTodas, mes, (f) => f.fecha);
  const recibidas = filtrarPorMes(recibidasTodas, mes, (f) => f.fecha);

  // CxC y proyectos: la deuda viva NO se filtra por periodo (es foto de balance).
  const [cuentasPorCobrar, proyectos, cuentasTesoreria] = real
    ? await Promise.all([cargarCuentasPorCobrar(), cargarProyectos(), cargarCuentasTesoreria()])
    : [[], [], []];

  // Segregación: los KPIs de la CLÍNICA excluyen los gastos de proyectos
  // externos (CENS, MENDRA, 9AM…), que se muestran aparte. Nada se oculta.
  const { clinica: gastosClinica, proyectos: gastosProyectos } = separarPorProyecto(gastos);

  const t = totalesCajaDevengo(ingresos, gastosClinica);
  const bloqueados = gastosClinica.filter((g) => estadoValidacion(g) === 'bloqueado_sin_documento');
  // En el Cash Flow real cada gasto está PAGADO en su fecha (informe de caja).
  const pagado = real
    ? gastosClinica.reduce((s, g) => s + g.importe, 0)
    : importePagadoDeFacturas(recibidas);
  const cobrado = real ? t.cobrado : t.cobrado + importeCobradoDeFacturas(emitidas);

  // Saldo de tesorería del periodo (cuánto dinero hay). Caja = cobros en
  // efectivo − pagos con caja; el resto (banco y sin clasificar) va a Banco,
  // de modo que Caja + Banco = saldo total. Cobros reales pendientes (Salonized).
  const entradasEfectivo = ingresos
    .filter((i) => i.metodoPago === 'efectivo')
    .reduce((s, i) => s + i.importeCobrado, 0);
  const salidasCaja = gastosClinica
    .filter((g) => g.cuentaTesoreria === 'caja')
    .reduce((s, g) => s + g.importe, 0);
  const saldoTotal = cobrado - pagado;
  const saldoCaja = entradasEfectivo - salidasCaja;
  const saldoBanco = saldoTotal - saldoCaja;

  // Concepto del gasto vinculado (para no mostrar UUIDs en "Vinculada a").
  const conceptoDeGasto = new Map(gastosTodos.map((g) => [g.id, g.concepto]));

  const porCategoria = new Map<
    CategoriaGasto,
    { importe: number; items: number; bloqueado: number }
  >();
  for (const g of gastosClinica) {
    const cat = CATEGORIA_DE[g.tipo];
    const acc = porCategoria.get(cat) ?? { importe: 0, items: 0, bloqueado: 0 };
    acc.importe += g.importe;
    acc.items += 1;
    if (estadoValidacion(g) === 'bloqueado_sin_documento') acc.bloqueado += g.importe;
    porCategoria.set(cat, acc);
  }

  const gastosVisibles = [...gastosClinica].reverse().slice(0, 60);
  const recibidasVisibles = recibidas.slice(0, 60);

  const periodo = mes ? `Periodo: ${etiquetaMes(mes)}` : 'Todo el histórico';

  return (
    <div className="pb-10">
      <OSPageHeader
        titulo={mes ? `Tesorería — ${etiquetaMes(mes)}` : 'Tesorería'}
        descripcion={
          real
            ? `${periodo} · DATOS REALES — cifras de la CLÍNICA (${gastosClinica.length} gastos, ${ingresos.length} apuntes de ingreso); los proyectos externos (CENS, MENDRA, 9AM) van segregados abajo.`
            : `${periodo} · Ingresos, gastos y facturas del mes demo ${MES_DEMO} — caja y devengo por separado, nunca sumados. Datos ficticios del escenario compartido.`
        }
        acciones={
          <div className="flex flex-wrap items-end gap-4">
            <OSFiltroMes accion="/tesoreria" mes={mes} />
            <Link
              href="/tesoreria/importar"
              className="text-2xs px-1 py-2 uppercase tracking-widest text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-300 hover:underline"
            >
              Importar reporte
            </Link>
          </div>
        }
      />

      {avisoOk || avisoError ? (
        <div className="px-8 pt-2">
          <p
            className={`rounded-xl border px-4 py-2.5 text-xs ${
              avisoError
                ? 'border-rose-400/20 bg-rose-400/5 text-rose-300'
                : 'border-emerald-400/20 bg-emerald-400/5 text-emerald-300'
            }`}
          >
            {avisoError ?? avisoOk}
          </p>
        </div>
      ) : null}

      <SaldoTesoreria
        saldoTotal={saldoTotal}
        saldoCaja={saldoCaja}
        saldoBanco={saldoBanco}
        cuentas={cuentasTesoreria}
        real={real}
      />

      <div className="grid grid-cols-2 gap-4 px-8 pt-4 lg:grid-cols-4">
        <OSKpiCard
          label="Cobrado (caja)"
          valor={formatCurrency(cobrado)}
          hint={real ? 'cobros por importar (Salonized)' : 'sueltas al acto + bonos cobrados'}
          icon={ArrowDownToLine}
          tone="ok"
        />
        <OSKpiCard
          label="Pagado (caja)"
          valor={formatCurrency(pagado)}
          hint={
            real ? 'Cash Flow: todo gasto en su fecha de pago' : 'solo facturas recibidas pagadas'
          }
          icon={ArrowUpFromLine}
        />
        <OSKpiCard
          label="Pendiente de cobro"
          valor={formatCurrency(t.pendienteCobro)}
          hint={
            real
              ? 'cobros reales pendientes de importar (Salonized)'
              : 'partners y sesiones sin cobrar'
          }
          icon={FileText}
          tone="warn"
        />
        <OSKpiCard
          label="Pagos bloqueados"
          valor={formatCurrency(bloqueados.reduce((s, g) => s + g.importe, 0))}
          hint="sin documento/factura: no se validan"
          icon={AlertTriangle}
          tone={bloqueados.length > 0 ? 'warn' : 'ok'}
        />
      </div>

      <AvisoIva ingresos={ingresos} />

      {real ? (
        <OSSection
          titulo="Cuentas por cobrar"
          nota="Deuda viva a favor de la clínica — no se filtra por periodo. Cobrar exige fecha, medio y cuenta"
        >
          <CuentasPorCobrarSeccion
            cuentas={cuentasPorCobrar}
            cuentasTesoreria={cuentasTesoreria}
            mes={mes}
          />
        </OSSection>
      ) : null}

      {real ? (
        <OSSection
          titulo="Proyectos fuera de la operativa"
          nota="Segregados de los KPIs de la clínica — nada se oculta, se muestra aparte"
        >
          <ProyectosFuera
            gastosProyectos={gastosProyectos}
            proyectos={proyectos}
            cuentasPorCobrar={cuentasPorCobrar}
          />
        </OSSection>
      ) : null}

      <OSSection
        titulo={real ? 'Gastos por categoría (clínica)' : 'Gastos por categoría'}
        nota="Sin documento válido, un gasto está calculado pero NO validado para pago"
      >
        <div className="glass-panel overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="text-2xs border-b border-white/5 uppercase tracking-widest text-zinc-500">
              <tr>
                {['Categoría', 'Conceptos', 'Importe', 'Bloqueado sin documento'].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
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

      <OSSection
        plegable
        titulo={
          real
            ? `Últimos gastos de la clínica (${gastosVisibles.length} de ${gastosClinica.length})`
            : 'Detalle de gastos'
        }
      >
        <div className="glass-panel overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="text-2xs border-b border-white/5 uppercase tracking-widest text-zinc-500">
              <tr>
                {['Fecha', 'Concepto', 'Tipo', 'Capa', 'Importe', 'Documento', 'Validación'].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {gastosVisibles.map((g) => {
                const val = estadoValidacion(g);
                return (
                  <tr
                    key={g.id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3 text-zinc-500">{g.fecha}</td>
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
        plegable
        titulo="Facturas emitidas"
        nota={
          real
            ? 'El Nº abre la vista imprimible · emitir no es cobrar'
            : 'Emitir no es cobrar · registros internos, no fiscales'
        }
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
                    {real ? (
                      <Link
                        href={`/tesoreria/factura/${f.id}`}
                        className="underline-offset-4 transition-colors hover:text-zinc-100 hover:underline"
                      >
                        {f.serie}-{f.numero}
                      </Link>
                    ) : (
                      `${f.serie}-${f.numero}`
                    )}
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
        plegable
        titulo={
          real
            ? `Facturas recibidas (${recibidasVisibles.length} de ${recibidas.length})`
            : 'Facturas recibidas'
        }
        nota={
          real
            ? 'Soporte documental de gastos · recibir no es pagar'
            : 'Recibir no es pagar · soporte documental de gastos'
        }
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
              {recibidasVisibles.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3 text-zinc-200">{f.contraparte}</td>
                  <td className="px-4 py-3 text-zinc-400">{f.tipo.replaceAll('_', ' ')}</td>
                  <td className="px-4 py-3 text-zinc-500">{f.fecha}</td>
                  <td className="px-4 py-3 text-zinc-300">{formatCurrency(f.importe)}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {(f.gastoId ? conceptoDeGasto.get(f.gastoId) : undefined) ?? '—'}
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
        plegable
        titulo="Conceptos pendientes de confirmar"
        nota="Marcan el resultado como provisional"
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
