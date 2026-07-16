import { BarChart3, Coins, Hourglass, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@alsari/utils';
import {
  agregarMargen,
  hechosDemo,
  totalesDemo,
  resumenesVentasDemo,
  getProfesional,
  CENTROS,
  MES_DEMO,
  escaleraMargen,
  ingresosDemo,
  gastosDemo,
} from '@antifragil/operativa';
import {
  OSDelta,
  OSFiltroMes,
  OSHeroMetric,
  OSKpiCard,
  OSPageHeader,
  OSSection,
  OSStatusBadge,
} from '@/components/os/ui';
import {
  cargarCuentasPorCobrar,
  cargarGastosReales,
  cargarIngresosReales,
  cargarProyectos,
  datosRealesDisponibles,
  separarPorProyecto,
} from '@/lib/datos/fuenteDatos';
import {
  etiquetaMes,
  filtrarPorMes,
  mesAnterior,
  primerValor,
  resolverMes,
  variacionPct,
} from '@/lib/datos/periodo';
import { ProyectosFuera } from '@/components/os/tesoreria/ProyectosFuera';

// Rentabilidad operativa: margen de la clínica en vista devengo. La caja se
// muestra aparte y NUNCA se suma al devengo. El héroe es M3 (margen operativo,
// tras alquiler y estructura); M1 (bruto) queda como cifra secundaria.

const NOMBRE_CENTRO: Record<string, string> = Object.fromEntries(
  CENTROS.map((c) => [c.id, c.nombre]),
);

function TablaMargen({
  titulo,
  filas,
  nombreDe,
}: {
  titulo: string;
  filas: ReturnType<typeof agregarMargen>;
  nombreDe: (clave: string) => string;
}) {
  return (
    <OSSection titulo={titulo}>
      <div className="glass-panel overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="text-2xs border-b border-white/5 uppercase tracking-widest text-zinc-500">
            <tr>
              {['', 'Sesiones', 'Ingreso devengado', 'Coste profesional', 'Margen bruto (M1)'].map(
                (h, i) => (
                  <th key={i} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr
                key={f.clave}
                className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3 text-zinc-200">{nombreDe(f.clave)}</td>
                <td className="px-4 py-3 text-zinc-400">{f.sesiones}</td>
                <td className="px-4 py-3 text-zinc-300">{formatCurrency(f.ingresoDevengado)}</td>
                <td className="px-4 py-3 text-zinc-400">−{formatCurrency(f.costeProfesional)}</td>
                <td
                  className={`px-4 py-3 font-medium ${f.m1 >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}
                >
                  {formatCurrency(f.m1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OSSection>
  );
}

function EscaleraM1M3({ e, real }: { e: ReturnType<typeof escaleraMargen>; real: boolean }) {
  const filas: { etiqueta: string; importe: number; esMargen?: boolean }[] = [
    { etiqueta: 'Ingreso devengado', importe: e.ingresoDevengado },
    { etiqueta: '− Coste profesional variable', importe: -e.costeProfesionalVariable },
    { etiqueta: 'M1 · Margen bruto', importe: e.m1, esMargen: true },
    { etiqueta: '− Otros costes directos (TPV, material)', importe: -e.otrosCostesDirectos },
    { etiqueta: 'M2 · Margen de contribución', importe: e.m2, esMargen: true },
    { etiqueta: '− Costes fijos (nóminas, SS, clínica, compartidos)', importe: -e.costesFijos },
    { etiqueta: 'M3 · Margen operativo', importe: e.m3, esMargen: true },
  ];
  return (
    <OSSection
      titulo="Escalera de márgenes M1 → M3"
      nota={
        real
          ? 'Datos reales importados (Cash Flow 2025–2026 + ingresos por servicio)'
          : 'Margen real: facturado por sesiones − pagos al equipo − costes propios de la clínica'
      }
    >
      <div className="glass-panel rounded-2xl px-5 py-2">
        {filas.map((f) => (
          <div
            key={f.etiqueta}
            className={`flex items-baseline justify-between border-b border-white/5 py-2.5 last:border-0 ${f.esMargen ? '' : 'pl-4'}`}
          >
            <span className={f.esMargen ? 'text-sm text-zinc-200' : 'text-xs text-zinc-500'}>
              {f.etiqueta}
            </span>
            <span
              className={
                f.esMargen
                  ? `text-base font-medium ${f.importe >= 0 ? 'text-emerald-300' : 'text-rose-300'}`
                  : 'text-xs text-zinc-400'
              }
            >
              {formatCurrency(f.importe)}
            </span>
          </div>
        ))}
      </div>
      <p className="text-2xs mt-3 px-1 text-zinc-500">
        Amortizables/inversiones fuera del M3 mensual: {formatCurrency(e.amortizablesFueraDeM3)}.
        {e.provisional
          ? ' Resultado PROVISIONAL: hay conceptos pendientes de confirmar (UG/PM, formaciones, GEA/AFDH).'
          : ''}
        {e.gastosBloqueados > 0
          ? ` Pagos bloqueados sin documento: ${formatCurrency(e.gastosBloqueados)}.`
          : ''}
      </p>
    </OSSection>
  );
}

export default async function RentabilidadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Next 15: searchParams es una Promise — hay que esperarla.
  const params = await searchParams;
  const mesParam = primerValor(params['mes']);
  const real = datosRealesDisponibles();

  // Histórico sin filtrar → se resuelve el mes activo (por defecto, el más
  // reciente con datos) → se filtra. ?mes=todo muestra el histórico entero.
  const ingresosTodos = real ? await cargarIngresosReales() : ingresosDemo();
  const gastosTodos = real ? await cargarGastosReales() : gastosDemo();
  const mes = resolverMes(
    mesParam,
    [...ingresosTodos.map((i) => i.fecha), ...gastosTodos.map((g) => g.fecha)],
    MES_DEMO,
  );

  const ingresos = filtrarPorMes(ingresosTodos, mes, (i) => i.fecha);
  const gastos = filtrarPorMes(gastosTodos, mes, (g) => g.fecha);
  // La escalera es de la CLÍNICA: los gastos de proyectos externos (CENS,
  // MENDRA, 9AM…) se segregan y se muestran aparte — nada se oculta.
  const { clinica: gastosClinica, proyectos: gastosProyectos } = separarPorProyecto(gastos);
  const e = escaleraMargen(ingresos, gastosClinica);

  // Escalera del mes anterior para el delta del héroe (M3).
  const mesPrev = mes ? mesAnterior(mes) : undefined;
  const ePrev = mesPrev
    ? escaleraMargen(
        filtrarPorMes(ingresosTodos, mesPrev, (i) => i.fecha),
        separarPorProyecto(filtrarPorMes(gastosTodos, mesPrev, (g) => g.fecha)).clinica,
      )
    : null;

  const [proyectos, cuentasPorCobrar] = real
    ? await Promise.all([cargarProyectos(), cargarCuentasPorCobrar()])
    : [[], []];

  const hechos = hechosDemo();
  const t = totalesDemo();
  const bonos = resumenesVentasDemo();

  // Héroe M3 (dominante) y M1 (secundario), ambos desde la escalera `e`.
  const pctM3 = e.ingresoDevengado > 0 ? (e.m3 / e.ingresoDevengado) * 100 : 0;
  const pctM1 = e.ingresoDevengado > 0 ? (e.m1 / e.ingresoDevengado) * 100 : 0;
  const pctCoste = Math.max(0, Math.min(100, 100 - Math.max(0, pctM1)));
  const deltaM3 = ePrev ? variacionPct(e.m3, ePrev.m3) : null;

  return (
    <div className="pb-10">
      <OSPageHeader
        titulo={mes ? `Rentabilidad — ${etiquetaMes(mes)}` : 'Rentabilidad'}
        descripcion={
          real
            ? `${mes ? `Periodo: ${etiquetaMes(mes)}` : 'Todo el histórico'} · Margen operativo de la clínica con datos reales (vista devengo). Los proyectos externos van segregados abajo; el desglose por sesión llega al importar Salonized.`
            : `${mes ? `Periodo: ${etiquetaMes(mes)}` : 'Todo el histórico'} · Margen operativo del mes demo ${MES_DEMO} (vista devengo). Datos ficticios del escenario del MVP.`
        }
        acciones={<OSFiltroMes accion="/rentabilidad" mes={mes} />}
      />

      {/* BANDA HÉROE — M3 (margen operativo) dominante con delta mensual; M1 e
          ingreso devengado como apoyo. Debajo, la barra de composición del M1
          (coste profesional + margen bruto = ingreso devengado). */}
      <div className="px-8 pt-4">
        <div
          className={`glass-panel rounded-3xl bg-gradient-to-br to-transparent p-8 ${
            e.m3 >= 0 ? 'from-emerald-500/[0.08]' : 'from-rose-500/[0.08]'
          }`}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <OSHeroMetric
              bare
              label="Margen operativo (M3)"
              valor={formatCurrency(e.m3)}
              tono={e.m3 >= 0 ? 'positivo' : 'negativo'}
              icon={BarChart3}
              delta={<OSDelta pct={deltaM3} />}
              hint={`${pctM3.toFixed(1)}% del ingreso devengado · tras equipo, alquiler y estructura`}
            />
            <div className="grid grid-cols-2 gap-8 sm:gap-12">
              <div>
                <p className="text-2xs uppercase tracking-widest text-zinc-500">
                  Margen bruto (M1)
                </p>
                <p className="mt-2 text-3xl font-light tracking-tight text-zinc-100">
                  {formatCurrency(e.m1)}
                </p>
                <p className="mt-1 text-xs text-zinc-600">
                  {Math.max(0, pctM1).toFixed(1)}% del ingreso
                </p>
              </div>
              <div>
                <p className="text-2xs uppercase tracking-widest text-zinc-500">
                  Ingreso devengado
                </p>
                <p className="mt-2 text-3xl font-light tracking-tight text-zinc-100">
                  {formatCurrency(e.ingresoDevengado)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-zinc-900">
            <div
              className="rounded-l-full bg-zinc-600"
              style={{ width: `${pctCoste}%` }}
              title={`Coste profesional: ${formatCurrency(e.costeProfesionalVariable)}`}
            />
            <div
              className="rounded-r-full bg-emerald-400"
              style={{ width: `${Math.max(0, pctM1)}%` }}
              title={`Margen bruto: ${formatCurrency(e.m1)}`}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
            <span className="flex items-center gap-2 text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-zinc-600" />
              Coste profesional −{formatCurrency(e.costeProfesionalVariable)} ({pctCoste.toFixed(1)}
              %)
            </span>
            <span className="flex items-center gap-2 text-zinc-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Margen bruto {formatCurrency(e.m1)} ({Math.max(0, pctM1).toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 px-8 pt-4 lg:grid-cols-3">
        <OSKpiCard
          label="Ingreso cobrado (caja)"
          valor={formatCurrency(t.ingresoCobrado)}
          hint="vista caja — no se suma al devengo"
          icon={Coins}
          tone="info"
        />
        <OSKpiCard
          label="Pendiente de devengar"
          valor={formatCurrency(t.pendienteDeDevengar)}
          hint="bonos cobrados sin consumir"
          icon={Hourglass}
          tone="warn"
        />
        <OSKpiCard
          label="Sesiones del mes"
          valor={String(hechos.length)}
          hint={`margen medio ${formatCurrency(hechos.length ? t.margenBruto / hechos.length : 0)}/sesión`}
          icon={TrendingUp}
        />
      </div>

      <p className="text-2xs mx-8 mt-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2.5 uppercase tracking-widest text-zinc-500">
        Caja no es rentabilidad · Cobrado no es devengado · Coste pagado no es coste devengado
      </p>

      <EscaleraM1M3 e={e} real={real} />

      <TablaMargen
        titulo={real ? 'Por profesional (demo hasta importar Salonized)' : 'Por profesional'}
        filas={agregarMargen(hechos, 'profesionalId')}
        nombreDe={(id) => getProfesional(id)?.nombre ?? id}
      />

      <TablaMargen
        titulo={real ? 'Por servicio (demo)' : 'Por servicio'}
        filas={agregarMargen(hechos, 'servicio')}
        nombreDe={(s) => s.charAt(0).toUpperCase() + s.slice(1)}
      />

      <TablaMargen
        titulo={real ? 'Por centro (demo)' : 'Por centro'}
        filas={agregarMargen(hechos, 'centroId')}
        nombreDe={(id) => NOMBRE_CENTRO[id] ?? id}
      />

      <OSSection
        titulo="Bonos: devengo y pendiente"
        nota="Invariante: devengado + pendiente + devuelto + caducado = cobrado"
      >
        <div className="glass-panel overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="text-2xs border-b border-white/5 uppercase tracking-widest text-zinc-500">
              <tr>
                {['Bono', 'Cobrado', 'Consumidas', 'Saldo', 'Devengado', 'Pendiente', 'Cuadre'].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {bonos.map((b) => (
                <tr key={b.ventaId} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 text-zinc-200">Bono fisio 5 sesiones</td>
                  <td className="px-4 py-3 text-zinc-300">{formatCurrency(b.importeCobrado)}</td>
                  <td className="px-4 py-3 text-zinc-400">{b.unidadesConsumidas}</td>
                  <td className="px-4 py-3 text-zinc-400">{b.saldoUnidades}</td>
                  <td className="px-4 py-3 text-zinc-300">{formatCurrency(b.devengado)}</td>
                  <td className="px-4 py-3 text-amber-300">
                    {formatCurrency(b.pendienteDeDevengar)}
                  </td>
                  <td className="px-4 py-3">
                    <OSStatusBadge tone={b.cuadra ? 'ok' : 'danger'}>
                      {b.cuadra ? 'Cuadra' : 'Descuadre'}
                    </OSStatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OSSection>

      {real ? (
        <OSSection
          titulo="Proyectos fuera de la operativa"
          nota="Excluidos de la escalera M1→M3 de la clínica — segregados, nunca ocultos"
        >
          <ProyectosFuera
            gastosProyectos={gastosProyectos}
            proyectos={proyectos}
            cuentasPorCobrar={cuentasPorCobrar}
          />
        </OSSection>
      ) : null}
    </div>
  );
}
