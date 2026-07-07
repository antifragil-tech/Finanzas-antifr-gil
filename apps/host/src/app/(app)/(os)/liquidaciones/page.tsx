import { HandCoins, Users, AlertTriangle, Wallet } from 'lucide-react';
import { formatCurrency } from '@alsari/utils';
import {
  liquidacionesDemo,
  cxpDeLiquidaciones,
  getProfesional,
  MES_DEMO,
  type LiquidacionMensual,
} from '@antifragil/operativa';
import {
  cargarLiquidacionesReales,
  datosRealesDisponibles,
  type LiquidacionReal,
} from '@/lib/datos/fuenteDatos';
import {
  OSPageHeader,
  OSSection,
  OSKpiCard,
  OSStatusBadge,
  type OSBadgeTone,
} from '@/components/os/ui';

// Liquidaciones del equipo. Con Supabase: histórico REAL importado del Excel
// Pago de Trabajadores (nov-2024 → dic-2025); sin entorno: escenario demo.

function estadoBadge(liq: LiquidacionMensual): { texto: string; tone: OSBadgeTone } {
  if (liq.estado === 'bloqueada_por_incidencia') {
    return { texto: 'Bloqueada · pendiente regularizar', tone: 'danger' };
  }
  if (liq.requiereRevisionCeo) return { texto: 'Requiere revisión dirección', tone: 'warn' };
  if (liq.estado === 'validada') return { texto: 'Validada · pendiente de pago', tone: 'info' };
  return { texto: 'Calculada', tone: 'neutral' };
}

function TablaReal({ liquidaciones }: { liquidaciones: LiquidacionReal[] }) {
  return (
    <div className="glass-panel overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[860px] text-left text-xs">
        <thead className="text-2xs border-b border-white/5 uppercase tracking-widest text-zinc-500">
          <tr>
            {['Mes', 'Profesional', 'Detalle', 'Importe', 'Estado'].map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {liquidaciones.map((l) => (
            <tr key={l.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
              <td className="px-4 py-3 font-mono text-zinc-400">{l.mes}</td>
              <td className="px-4 py-3 text-zinc-200">
                {l.profesional}
                {!l.activo ? (
                  <span className="text-2xs ml-2 text-zinc-500">ex-trabajador</span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-zinc-400">{l.detalle}</td>
              <td className="px-4 py-3 font-medium text-zinc-100">{formatCurrency(l.importe)}</td>
              <td className="px-4 py-3">
                <OSStatusBadge tone={l.estado === 'pagada' ? 'ok' : 'neutral'}>
                  {l.estado}
                </OSStatusBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function LiquidacionesPage() {
  const real = datosRealesDisponibles();
  const reales = real ? await cargarLiquidacionesReales() : [];

  if (real && reales.length > 0) {
    const total = reales.reduce((s, l) => s + l.importe, 0);
    const meses = new Set(reales.map((l) => l.mes)).size;
    const profesionales = new Set(reales.map((l) => l.profesional)).size;
    const ultimo = reales[0]?.mes ?? '—';
    const totalUltimo = reales.filter((l) => l.mes === ultimo).reduce((s, l) => s + l.importe, 0);

    return (
      <div className="pb-10">
        <OSPageHeader
          titulo="Liquidaciones"
          descripcion={`HISTÓRICO REAL importado del Excel de pagos al equipo (${meses} meses, nov-2024 → dic-2025). Las liquidaciones del mes corriente se generarán desde la agenda cuando entre Salonized.`}
        />
        <div className="grid grid-cols-2 gap-4 px-8 pt-4 lg:grid-cols-4">
          <OSKpiCard label="Total liquidado" valor={formatCurrency(total)} icon={HandCoins} />
          <OSKpiCard label="Meses con datos" valor={String(meses)} icon={Wallet} />
          <OSKpiCard label="Profesionales" valor={String(profesionales)} icon={Users} />
          <OSKpiCard
            label={`Último mes (${ultimo})`}
            valor={formatCurrency(totalUltimo)}
            icon={AlertTriangle}
            tone="info"
          />
        </div>
        <OSSection
          titulo="Histórico por mes y profesional"
          nota="Importado del Excel — cada fila conserva sesiones y formaciones en su detalle; extras por venta de bonos pendientes de regla"
        >
          <TablaReal liquidaciones={reales} />
          <p className="text-2xs mt-3 px-1 text-zinc-500">
            Auditoría automática: 16 de 18 registros verificables cuadran sesiones × tarifa
            (formaciones de Solís a 30 € e IRPF 15%; Cecilia con retención 7% desde sept-2025). Los
            extras por venta de bonos de entrenamiento quedan pendientes de regla.
          </p>
        </OSSection>
      </div>
    );
  }

  const liquidaciones = liquidacionesDemo();
  const cxp = cxpDeLiquidaciones(liquidaciones);
  const total = liquidaciones.reduce((s, l) => s + l.importeFinal, 0);
  const sesiones = liquidaciones.reduce((s, l) => s + l.sesionesIncluidas.length, 0);
  const bloqueadas = liquidaciones.filter((l) => l.estado === 'bloqueada_por_incidencia').length;
  const cxpViva = cxp.reduce((s, c) => s + c.importe, 0);

  return (
    <div className="pb-10">
      <OSPageHeader
        titulo="Liquidaciones"
        descripcion={`Liquidación mensual del equipo — mes demo ${MES_DEMO}. Datos ficticios sobre las reglas operativas reales (docs/finanzas/08). Solo dirección ve importes.`}
      />
      <div className="grid grid-cols-2 gap-4 px-8 pt-4 lg:grid-cols-4">
        <OSKpiCard label="Total a liquidar" valor={formatCurrency(total)} icon={HandCoins} />
        <OSKpiCard label="Sesiones validadas" valor={String(sesiones)} icon={Users} />
        <OSKpiCard
          label="Bloqueadas"
          valor={String(bloqueadas)}
          hint="relación pendiente de regularizar"
          icon={AlertTriangle}
          tone={bloqueadas > 0 ? 'warn' : 'ok'}
        />
        <OSKpiCard
          label="CxP viva"
          valor={formatCurrency(cxpViva)}
          hint="validadas pendientes de pago"
          icon={Wallet}
          tone="info"
        />
      </div>
      <OSSection titulo="Por profesional">
        <div className="glass-panel overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="text-2xs border-b border-white/5 uppercase tracking-widest text-zinc-500">
              <tr>
                {[
                  'Profesional',
                  'Regla aplicada',
                  'Sesiones',
                  'Importe',
                  'Documento',
                  'Estado',
                ].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liquidaciones.map((liq) => {
                const prof = getProfesional(liq.profesionalId);
                const badge = estadoBadge(liq);
                return (
                  <tr
                    key={liq.profesionalId}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3 text-zinc-200">{prof?.nombre ?? liq.profesionalId}</td>
                    <td className="px-4 py-3 text-zinc-400">
                      {liq.lineas.map((l) => l.detalle).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {liq.sesionesIncluidas.length || '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-100">
                      {formatCurrency(liq.importeFinal)}
                    </td>
                    <td className="px-4 py-3">
                      <OSStatusBadge tone={liq.evidencia.recibida ? 'ok' : 'warn'}>
                        {liq.evidencia.tipo === 'nomina' ? 'Nómina' : 'Factura autónomo'}
                        {liq.evidencia.recibida ? ' · recibida' : ' · pendiente'}
                      </OSStatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <OSStatusBadge tone={badge.tone}>{badge.texto}</OSStatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-2xs mt-3 px-1 text-zinc-500">
          Toda liquidación se asocia a su documento: nómina (gestoría) o factura de autónomo — sin
          documento no se valida (R2). El coste se devenga en la fecha de la sesión aunque se pague
          después. Una liquidación validada es cuenta por pagar hasta su pago. Las reglas sin
          confirmar y las relaciones sin regularizar bloquean el avance: nunca se ocultan.
        </p>
      </OSSection>
    </div>
  );
}
