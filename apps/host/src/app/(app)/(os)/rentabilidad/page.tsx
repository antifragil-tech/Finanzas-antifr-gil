import { TrendingUp, Coins, HandCoins, Hourglass, Scale } from 'lucide-react';
import { formatCurrency } from '@alsari/utils';
import {
  agregarMargen,
  hechosDemo,
  totalesDemo,
  resumenesVentasDemo,
  getProfesional,
  CENTROS,
  MES_DEMO,
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

export default function RentabilidadPage() {
  const hechos = hechosDemo();
  const t = totalesDemo();
  const bonos = resumenesVentasDemo();

  return (
    <div className="pb-10">
      <OSPageHeader
        titulo="Rentabilidad"
        descripcion={`Margen operativo — mes demo ${MES_DEMO}, vista devengo (docs/finanzas/09). Datos ficticios del escenario compartido del MVP.`}
      />

      <div className="grid grid-cols-2 gap-4 px-8 pt-4 lg:grid-cols-5">
        <OSKpiCard
          label="Ingreso devengado"
          valor={formatCurrency(t.ingresoDevengado)}
          icon={TrendingUp}
        />
        <OSKpiCard
          label="Ingreso cobrado"
          valor={formatCurrency(t.ingresoCobrado)}
          hint="vista caja — no se suma al devengo"
          icon={Coins}
          tone="info"
        />
        <OSKpiCard
          label="Coste profesional"
          valor={formatCurrency(t.costeProfesional)}
          icon={HandCoins}
        />
        <OSKpiCard
          label="Margen bruto (M1)"
          valor={formatCurrency(t.margenBruto)}
          icon={Scale}
          tone={t.margenBruto >= 0 ? 'ok' : 'warn'}
        />
        <OSKpiCard
          label="Pendiente de devengar"
          valor={formatCurrency(t.pendienteDeDevengar)}
          hint="bonos cobrados sin consumir"
          icon={Hourglass}
          tone="warn"
        />
      </div>

      <p className="text-2xs mx-8 mt-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2.5 uppercase tracking-widest text-zinc-500">
        Caja no es rentabilidad · Cobrado no es devengado · Coste pagado no es coste devengado
      </p>

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
