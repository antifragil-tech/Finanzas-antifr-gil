import { CalendarDays, FileCheck2, FileUp, ReceiptText } from 'lucide-react';
import { formatCurrency } from '@alsari/utils';
import { facturasEmitidasDemo, facturasRecibidasDemo, gastosDemo } from '@antifragil/operativa';
import {
  cargarFacturasEmitidasReales,
  cargarFacturasRecibidasReales,
  cargarGastosReales,
  datosRealesDisponibles,
  type GastoReal,
} from '@/lib/datos/fuenteDatos';
import { primerValor } from '@/lib/datos/periodo';
import { confirmarSaldo } from '@/lib/datos/acciones';
import { EntradaDatos } from '@/components/os/tesoreria/EntradaDatos';
import { OSKpiCard, OSPageHeader, OSSection, OSStatusBadge } from '@/components/os/ui';
import Link from 'next/link';

// OPERATIVA: el diario de entrada de datos del negocio. Aquí se REGISTRA
// (gastos con su factura siempre que exista, ingresos de las líneas que no
// entran solos, facturas) y aquí queda claro DE DÓNDE viene cada dato.
// Tesorería queda como página de CONSULTA (en Dinero se mira; aquí se hace).

const LINEAS_INGRESO = [
  {
    nombre: 'Clínica',
    detalle: 'Entra sola: agenda y cobros (Salonized → OS). No se teclea aquí.',
  },
  { nombre: '9AM (eventos)', detalle: 'Se registra aquí como ingreso del proyecto 9AM.' },
  { nombre: 'AFDH (nuestra app)', detalle: 'Se registra aquí; devenga mensual, cobra trimestral.' },
  { nombre: 'Mayores (Mara)', detalle: 'Servicio a personas mayores. Se registra aquí.' },
];

function esDocumentado(g: GastoReal): boolean {
  return g.documento.recibido || g.documento.tipo === 'no_requerido';
}

export default async function OperativaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const avisoOk = primerValor(params['ok']);
  const avisoError = primerValor(params['error']);
  const confCuenta = primerValor(params['conf_cuenta']);
  const confId = primerValor(params['conf_id']);
  const confSaldo = primerValor(params['conf_saldo']);
  const real = datosRealesDisponibles();

  const mesActual = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' })
    .format(new Date())
    .slice(0, 7);

  const [gastos, recibidas, emitidas] = real
    ? await Promise.all([
        cargarGastosReales(),
        cargarFacturasRecibidasReales(),
        cargarFacturasEmitidasReales(),
      ])
    : [gastosDemo() as GastoReal[], facturasRecibidasDemo(), facturasEmitidasDemo()];

  const gastosMes = gastos.filter((g) => g.fecha.startsWith(mesActual));
  const documentados = gastosMes.filter(esDocumentado).length;
  const pctFactura = gastosMes.length ? Math.round((documentados / gastosMes.length) * 100) : 100;
  const recibidasMes = recibidas.filter((f) => f.fecha.startsWith(mesActual)).length;
  const emitidasMes = emitidas.filter((f) => f.fecha.startsWith(mesActual)).length;
  const totalGastosMes = gastosMes.reduce((s, g) => s + g.importe, 0);

  return (
    <div className="pb-12">
      <OSPageHeader
        titulo="Operativa"
        descripcion="El diario del negocio: registra gastos (con su factura siempre que exista), los ingresos que no entran solos y las facturas. Tesorería y Rentabilidad se alimentan de lo que entra por aquí."
        acciones={
          real ? (
            <OSStatusBadge tone="info">Datos reales</OSStatusBadge>
          ) : (
            <OSStatusBadge tone="warn">Demo</OSStatusBadge>
          )
        }
      />

      {avisoOk || avisoError ? (
        <p
          className={`mx-8 mt-4 rounded-lg border px-4 py-2.5 text-sm ${
            avisoError
              ? 'border-rose-400/20 bg-rose-400/5 text-rose-200'
              : 'border-emerald-400/20 bg-emerald-400/5 text-emerald-200'
          }`}
        >
          {avisoError ?? avisoOk}
        </p>
      ) : null}

      {confId && confSaldo && confCuenta ? (
        <div className="mx-8 mt-3 rounded-2xl border border-blue-400/20 bg-blue-400/5 p-5">
          <p className="text-sm text-zinc-200">
            Saldo restante en <span className="font-medium">{confCuenta}</span> tras este apunte:{' '}
            <span className="text-2xl font-light tracking-tight text-blue-200">
              {formatCurrency(Number(confSaldo))}
            </span>
          </p>
          <p className="text-2xs mt-1 uppercase tracking-widest text-zinc-500">
            ¿Coincide con lo que ves en la cuenta?
          </p>
          <form action={confirmarSaldo} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="cuenta_id" value={confId} />
            <input type="hidden" name="saldo_calculado" value={confSaldo} />
            <button
              type="submit"
              name="coincide"
              value="si"
              className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-4 py-1.5 text-sm text-emerald-300 hover:bg-emerald-400/20"
            >
              Sí, coincide
            </button>
            <button
              type="submit"
              name="coincide"
              value="no"
              className="rounded-lg border border-rose-400/25 bg-rose-400/10 px-4 py-1.5 text-sm text-rose-300 hover:bg-rose-400/20"
            >
              No coincide
            </button>
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              Si no coincide, ¿cuánto hay?
              <input
                type="number"
                step="0.01"
                name="saldo_reportado"
                placeholder="0,00"
                className="w-28 rounded-lg border border-white/10 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
              />
            </label>
          </form>
        </div>
      ) : null}

      {/* Los números del mes en curso — el medidor clave es "% con factura":
          el objetivo del negocio es que la mayoría de gastos la tengan. */}
      <div className="grid grid-cols-2 gap-4 px-8 pt-4 lg:grid-cols-4">
        <OSKpiCard
          label={`Gastos ${mesActual}`}
          valor={formatCurrency(totalGastosMes)}
          hint={`${gastosMes.length} apuntes`}
          icon={ReceiptText}
        />
        <OSKpiCard
          label="Con factura / justificante"
          valor={`${pctFactura}%`}
          hint={
            gastosMes.length
              ? `${documentados} de ${gastosMes.length} — objetivo: la mayoría`
              : 'sin gastos este mes'
          }
          icon={FileCheck2}
          tone={pctFactura >= 80 ? 'neutral' : 'warn'}
        />
        <OSKpiCard
          label="Facturas recibidas"
          valor={String(recibidasMes)}
          hint={`este mes (${mesActual})`}
          icon={FileUp}
        />
        <OSKpiCard
          label="Facturas emitidas"
          valor={String(emitidasMes)}
          hint="serie OPS este mes"
          icon={CalendarDays}
        />
      </div>

      <OSSection
        titulo="Registrar"
        nota={
          real
            ? 'Escribe en las tablas reales — al guardar un gasto, adjunta su referencia de factura'
            : 'Modo demo sin Supabase: el alta devolverá un error legible'
        }
      >
        <EntradaDatos mes={mesActual} />
      </OSSection>

      <OSSection
        titulo="De dónde vienen los datos"
        nota="cada número del OS tiene una fuente clara"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="glass-panel rounded-2xl p-5">
            <p className="text-sm font-medium text-zinc-200">Ingresos por línea de negocio</p>
            <ul className="mt-3 space-y-2 text-xs text-zinc-400">
              {LINEAS_INGRESO.map((l) => (
                <li key={l.nombre} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/70" />
                  <span>
                    <span className="text-zinc-200">{l.nombre}</span> — {l.detalle}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <p className="text-sm font-medium text-zinc-200">Otras entradas de datos</p>
            <ul className="mt-3 space-y-2 text-xs text-zinc-400">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400/70" />
                <span>
                  <span className="text-zinc-200">Agenda y clientes</span> — se sincronizan desde
                  Salonized (citas, catálogo y tarifas), no se teclean.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400/70" />
                <span>
                  <span className="text-zinc-200">Reportes periódicos</span> — Salonized (ventas),
                  efectivo y extracto del banco entran por{' '}
                  <Link
                    href="/tesoreria/importar"
                    className="text-zinc-200 underline underline-offset-4"
                  >
                    Importar reportes
                  </Link>
                  .
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400/70" />
                <span>
                  <span className="text-zinc-200">Contabilidad del Drive</span> — histórico (caja
                  física, pagos a trabajadores, gestoría): se cargará en la fase de datos, con
                  cuadre.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </OSSection>
    </div>
  );
}
