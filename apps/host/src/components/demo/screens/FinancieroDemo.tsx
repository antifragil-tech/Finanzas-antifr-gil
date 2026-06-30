'use client';

import { Wallet, CalendarClock, AlertTriangle } from 'lucide-react';
import { ScreenShell, RestriccionRol } from './ScreenShell';
import { Bloque, Kpi, Fila, Tag, eur } from '../panel/PanelKit';
import { getFinanciero, acceso, rolLabel } from '../mock/demoData';
import { useDemoContext } from '../context/DemoContext';

export function FinancieroDemo() {
  const { proyecto, periodo, rol } = useDemoContext();
  const { tesoreria, vencimientos, alertas, a1 } = getFinanciero(proyecto, periodo);

  const completa = acceso.tesoreriaCompleta(rol);
  const simplificada = acceso.tesoreriaSimplificada(rol);

  return (
    <ScreenShell icon={Wallet} titulo="Finanzas Operativas" aviso="Datos de demostración · sin conexión a backend">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {completa && (
          <Bloque titulo="Tesorería" icon={Wallet} tag={<Tag>sin backend</Tag>}>
            <div className="grid grid-cols-2 gap-3">
              <Kpi label="Banco operativo" value={eur(tesoreria.banco)} tag={<Tag>mock</Tag>} />
              <Kpi label="Caja efectivo" value={eur(tesoreria.caja)} tag={<Tag>mock</Tag>} />
            </div>
            <Fila label="Cobros pendientes" value={eur(tesoreria.cobros)} tag={<Tag>mock</Tag>} />
            <Fila label="Pagos próximos" value={eur(tesoreria.pagos)} tag={<Tag>mock</Tag>} />
          </Bloque>
        )}

        {simplificada && (
          <Bloque titulo="Tesorería (operativa)" icon={Wallet} tag={<Tag>mock</Tag>}>
            <Fila label="Cobros pendientes" value={eur(tesoreria.cobros)} tag={<Tag>mock</Tag>} />
            <Fila label="Pagos próximos" value={eur(tesoreria.pagos)} tag={<Tag>mock</Tag>} />
            <p className="mt-1 text-2xs uppercase tracking-widest text-zinc-600">Saldos de banco/caja ocultos para tu rol</p>
          </Bloque>
        )}

        {!completa && !simplificada && <RestriccionRol area="Tesorería global" rolLabel={rolLabel(rol)} />}

        <Bloque titulo="Vencimientos próximos" icon={CalendarClock} tag={<Tag>mock</Tag>}>
          {vencimientos.length > 0 ? (
            vencimientos.map((v) => (
              <Fila
                key={v.concepto}
                label={`${v.fecha} · ${v.concepto}`}
                value={
                  <span className={v.tipo === 'cobro' ? 'text-emerald-400' : 'text-zinc-100'}>
                    {v.tipo === 'cobro' ? '+' : '−'}
                    {eur(v.importe)}
                  </span>
                }
              />
            ))
          ) : (
            <span className="text-xs text-zinc-600">Sin vencimientos próximos · proyecto en preparación</span>
          )}
        </Bloque>

        <Bloque titulo="Alertas operativas" icon={AlertTriangle} tag={<Tag>demo</Tag>}>
          <div className="flex flex-col gap-2">
            {alertas.map((a) => (
              <div key={a} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                {a}
              </div>
            ))}
          </div>
          {a1 ? (
            <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-2xs uppercase tracking-widest text-zinc-500">
              {a1}
            </div>
          ) : null}
        </Bloque>
      </div>
      <p className="mt-6 text-2xs uppercase tracking-widest text-amber-400/80">Finanzas operativas demo · cifras mock, no reales</p>
    </ScreenShell>
  );
}
