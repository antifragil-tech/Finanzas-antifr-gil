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
  OSPageHeader,
  OSSection,
  OSKpiCard,
  OSStatusBadge,
  type OSBadgeTone,
} from '@/components/os/ui';

// Liquidaciones del equipo (doc 08) sobre el escenario demo compartido.
// Datos ficticios con las reglas operativas reales; sin backend.

function estadoBadge(liq: LiquidacionMensual): { texto: string; tone: OSBadgeTone } {
  if (liq.estado === 'bloqueada_por_incidencia') {
    return { texto: 'Bloqueada · pendiente regularizar', tone: 'danger' };
  }
  if (liq.requiereRevisionCeo) return { texto: 'Requiere revisión dirección', tone: 'warn' };
  if (liq.estado === 'validada') return { texto: 'Validada · pendiente de pago', tone: 'info' };
  return { texto: 'Calculada', tone: 'neutral' };
}

export default function LiquidacionesPage() {
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
                {['Profesional', 'Regla aplicada', 'Sesiones', 'Importe', 'Estado'].map((h) => (
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
                      <OSStatusBadge tone={badge.tone}>{badge.texto}</OSStatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-2xs mt-3 px-1 text-zinc-500">
          El coste se devenga en la fecha de la sesión aunque se pague después. Una liquidación
          validada es cuenta por pagar hasta su pago. Las reglas sin confirmar y las relaciones sin
          regularizar bloquean el avance: nunca se ocultan.
        </p>
      </OSSection>
    </div>
  );
}
