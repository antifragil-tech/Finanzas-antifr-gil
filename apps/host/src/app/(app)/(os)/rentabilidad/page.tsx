import { TrendingUp, Coins, Hourglass } from 'lucide-react';
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
import { OSPageHeader, OSSection, OSKpiCard, OSStatusBadge } from '@/components/os/ui';

// Rentabilidad operativa (doc 09) sobre el escenario demo compartido.
// Vista devengo por defecto; la caja se muestra aparte y NUNCA se suman.

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

function EscaleraM1M3() {
  const e = escaleraMargen(ingresosDemo(), gastosDemo());
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
      nota="Margen real: facturado por sesiones − pagos a trabajadores − costes propios de la clínica (doc 09)"
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

export default function RentabilidadPage() {
  const hechos = hechosDemo();
  const t = totalesDemo();
  const bonos = resumenesVentasDemo();

  const pctMargen = t.ingresoDevengado > 0 ? (t.margenBruto / t.ingresoDevengado) * 100 : 0;
  const pctCoste = Math.max(0, Math.min(100, 100 - pctMargen));

  return (
    <div className="pb-10">
      <OSPageHeader
        titulo="Rentabilidad"
        descripcion={`Margen operativo — mes demo ${MES_DEMO}, vista devengo (docs/finanzas/09). Datos ficticios del escenario compartido del MVP.`}
      />

      {/* Resultado total del mes: hero + barra de composición
          (coste + margen = ingreso devengado; etiquetas directas siempre visibles) */}
      <div className="glass-panel mx-8 mt-4 rounded-2xl p-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-2xs uppercase tracking-widest text-zinc-500">
              Margen bruto del mes (M1)
            </p>
            <p
              className={`mt-1 text-4xl font-light tracking-tight ${t.margenBruto >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}
            >
              {formatCurrency(t.margenBruto)}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {pctMargen.toFixed(1)}% del ingreso devengado
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xs uppercase tracking-widest text-zinc-500">Ingreso devengado</p>
            <p className="mt-1 text-2xl font-light tracking-tight text-zinc-100">
              {formatCurrency(t.ingresoDevengado)}
            </p>
          </div>
        </div>

        <div className="mt-5 flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-zinc-900">
          <div
            className="rounded-l-full bg-zinc-600"
            style={{ width: `${pctCoste}%` }}
            title={`Coste profesional: ${formatCurrency(t.costeProfesional)}`}
          />
          <div
            className="rounded-r-full bg-emerald-400"
            style={{ width: `${pctMargen}%` }}
            title={`Margen bruto: ${formatCurrency(t.margenBruto)}`}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
          <span className="flex items-center gap-2 text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-zinc-600" />
            Coste profesional −{formatCurrency(t.costeProfesional)} ({pctCoste.toFixed(1)}%)
          </span>
          <span className="flex items-center gap-2 text-zinc-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Margen bruto {formatCurrency(t.margenBruto)} ({pctMargen.toFixed(1)}%)
          </span>
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

      <EscaleraM1M3 />

      <TablaMargen
        titulo="Por profesional"
        filas={agregarMargen(hechos, 'profesionalId')}
        nombreDe={(id) => getProfesional(id)?.nombre ?? id}
      />

      <TablaMargen
        titulo="Por servicio"
        filas={agregarMargen(hechos, 'servicio')}
        nombreDe={(s) => s.charAt(0).toUpperCase() + s.slice(1)}
      />

      <TablaMargen
        titulo="Por centro"
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
    </div>
  );
}
