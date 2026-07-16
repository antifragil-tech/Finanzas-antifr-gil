import { Activity, Coins, Hourglass, Users } from 'lucide-react';
import { formatCurrency } from '@alsari/utils';
import { MES_DEMO, gastosDemo, ingresosDemo, liquidacionesDemo } from '@antifragil/operativa';
import {
  cargarCuentasPorCobrar,
  cargarGastosReales,
  cargarIngresosReales,
  cargarLiquidacionesReales,
  datosRealesDisponibles,
  separarPorProyecto,
  type CuentaPorCobrar,
  type GastoReal,
} from '@/lib/datos/fuenteDatos';
import {
  etiquetaMes,
  mesAnterior,
  mesMasReciente,
  primerValor,
  resolverMes,
  variacionPct,
} from '@/lib/datos/periodo';
import { OSFiltroMes, OSKpiCard, OSPageHeader, OSStatusBadge } from '@/components/os/ui';
import { DashboardHero } from '@/components/os/dashboard/DashboardHero';
import { RequiereAtencion } from '@/components/os/dashboard/RequiereAtencion';
import { TendenciaMensual } from '@/components/os/dashboard/TendenciaMensual';
import {
  avisosRequierenAtencion,
  resumirPanel,
  serieMensual,
} from '@/components/os/dashboard/panel';

// Panel de dirección (server component). Con Supabase configurado lee los
// DATOS REALES de la clínica; sin entorno cae al escenario demo (build de CI
// sin secrets siempre en verde, nunca crash). Jerarquía visual: una banda
// héroe con el resultado del mes, KPIs de apoyo, y detalle (tendencia + avisos).

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const mesParam = primerValor(params['mes']);
  const real = datosRealesDisponibles();

  const [ingresos, gastosTodos, cxc] = real
    ? await Promise.all([cargarIngresosReales(), cargarGastosReales(), cargarCuentasPorCobrar()])
    : [ingresosDemo(), gastosDemo() as GastoReal[], [] as CuentaPorCobrar[]];

  const { clinica: gastosClinica, proyectos: gastosProyectos } = separarPorProyecto(gastosTodos);

  // El Panel es siempre mensual: arranca en el último mes con datos (?mes=todo
  // no aplica aquí — cae al más reciente) para abrir enfocado, no en agregados.
  const fechas = [...ingresos.map((i) => i.fecha), ...gastosTodos.map((g) => g.fecha)];
  const mes = resolverMes(mesParam, fechas, MES_DEMO) ?? mesMasReciente(fechas) ?? MES_DEMO;

  // Coste del equipo del mes: liquidaciones reales del mes activo o total demo.
  const costeEquipoMes = real
    ? (await cargarLiquidacionesReales())
        .filter((l) => l.mes.slice(0, 7) === mes)
        .reduce((s, l) => s + l.importe, 0)
    : liquidacionesDemo().reduce((s, l) => s + l.importeFinal, 0);

  const resumen = resumirPanel(ingresos, gastosClinica, gastosProyectos, cxc, mes);
  const resumenPrevio = resumirPanel(
    ingresos,
    gastosClinica,
    gastosProyectos,
    cxc,
    mesAnterior(mes),
  );
  const deltaResultado = variacionPct(resumen.resultado, resumenPrevio.resultado);
  const deltaFacturado = variacionPct(resumen.facturado, resumenPrevio.facturado);

  const serie = serieMensual(ingresos, gastosClinica, mes, 6);
  const avisos = avisosRequierenAtencion(ingresos, cxc);

  return (
    <div className="pb-12">
      <OSPageHeader
        titulo="Panel"
        descripcion={
          real
            ? `Resultado de la clínica en ${etiquetaMes(mes)} con DATOS REALES. Los proyectos externos (CENS, MENDRA, 9AM) van segregados y no afectan al resultado.`
            : `Resultado de la clínica en ${etiquetaMes(mes)} — escenario demo (sin datos reales conectados).`
        }
        acciones={
          <div className="flex flex-wrap items-end gap-4">
            <OSFiltroMes accion="/dashboard" mes={mes} />
            {real ? (
              <OSStatusBadge tone="info">Datos reales</OSStatusBadge>
            ) : (
              <OSStatusBadge tone="warn">Demo</OSStatusBadge>
            )}
          </div>
        }
      />

      {/* BANDA HÉROE */}
      <DashboardHero
        resumen={resumen}
        real={real}
        deltaResultado={deltaResultado}
        deltaFacturado={deltaFacturado}
      />

      {/* SEGUNDO NIVEL — KPIs de apoyo */}
      <div className="grid grid-cols-2 gap-4 px-8 pt-6 lg:grid-cols-4">
        <OSKpiCard
          label="Pendiente de cobrar"
          valor={formatCurrency(resumen.pendienteCobrar)}
          hint="CxC + partners (AFDH) sin cobrar"
          icon={Hourglass}
          tone={resumen.pendienteCobrar > 0 ? 'warn' : 'neutral'}
        />
        <OSKpiCard
          label="Coste del equipo del mes"
          valor={formatCurrency(costeEquipoMes)}
          hint="liquidaciones del periodo"
          icon={Users}
        />
        <OSKpiCard
          label={real ? 'Ingresos del mes' : 'Sesiones del mes'}
          valor={String(resumen.nIngresos)}
          hint="apuntes de ingreso"
          icon={Activity}
        />
        <OSKpiCard
          label="Ticket medio"
          valor={formatCurrency(resumen.ticketMedio)}
          hint="facturado / nº de ingresos"
          icon={Coins}
        />
      </div>

      {/* TERCER NIVEL — tendencia + avisos */}
      <div className="grid gap-6 px-8 pt-8 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="text-2xs uppercase tracking-[0.25em] text-zinc-600">
              Ingresos vs gastos · 6 meses
            </h3>
            <span className="text-2xs text-zinc-600">devengo</span>
          </div>
          <TendenciaMensual puntos={serie} />
        </div>
        <div>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="text-2xs uppercase tracking-[0.25em] text-zinc-600">
              Requiere atención
            </h3>
            <span className="text-2xs text-zinc-600">{avisos.length || 'sin'} avisos</span>
          </div>
          <RequiereAtencion avisos={avisos} />
        </div>
      </div>

      {/* Proyectos fuera de la operativa — mención discreta */}
      <div className="px-8 pt-8">
        <p className="text-2xs uppercase tracking-widest text-zinc-600">
          {resumen.nProyectosGastos > 0
            ? `Proyectos fuera de la operativa (CENS · MENDRA · 9AM): ${formatCurrency(resumen.gastosProyectos)} en ${resumen.nProyectosGastos} gastos — no computan en el resultado de la clínica.`
            : 'Sin gastos de proyectos externos imputados en el periodo.'}
        </p>
      </div>
    </div>
  );
}
