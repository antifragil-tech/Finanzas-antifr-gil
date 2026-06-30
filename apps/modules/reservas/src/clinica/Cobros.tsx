import { useState } from 'react';
import { DayPilot } from '@daypilot/daypilot-lite-react';
import {
  crearCitasMock,
  getServicio,
  getProfesional,
  getOrigen,
  VIVOFACIL_VALOR_SESION,
  type CitaMock,
} from '../spike/mockData';
import { PAGO_SIN_ABONAR } from '../spike/estados';
import { Subvista } from './Subvista';
import { useCitas } from './useCitas';

const hhmm = (iso: string) => iso.slice(11, 16);
const diaCorto = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });

const importeDe = (c: CitaMock) => (c.origen === 'vivofacil' ? VIVOFACIL_VALOR_SESION : c.precio_previsto);
const metodoDe = (c: CitaMock) =>
  c.origen === 'directo' ? 'Datáfono / efectivo' : 'Factura partner';
const esPartner = (c: CitaMock) => c.origen !== 'directo';

// Vista "Cobros pendientes": quién debe, cuánto y desde cuándo. Diferencia
// cliente directo de partners (Vivofácil/Oasis/Lidomare/otro). Acción de pago mock.
// Esta lectura alimentará después Finanzas Operativas / Tesorería (cuando exista).
export function Cobros() {
  const hoy = DayPilot.Date.today().toString('yyyy-MM-dd');
  const hoyMs = new Date(`${hoy}T00:00:00`).getTime();
  const c = useCitas(() => crearCitasMock(hoy));
  const [aviso, setAviso] = useState<string | null>(null);

  const pendientes = c.citas.filter(
    (x) =>
      (x.estado_cita === 'completada' || x.estado_cita === 'no_asiste') &&
      PAGO_SIN_ABONAR.includes(x.estado_pago),
  );

  const diasDe = (x: CitaMock) =>
    Math.max(0, Math.round((hoyMs - new Date(`${x.inicio.slice(0, 10)}T00:00:00`).getTime()) / 86400000));
  const estadoDe = (x: CitaMock) =>
    x.estado_pago === 'pago_parcial' ? 'Parcial' : diasDe(x) > 3 ? 'Reclamado' : 'Pendiente';

  const total = pendientes.reduce((s, x) => s + importeDe(x), 0);
  const totalPartner = pendientes.filter(esPartner).reduce((s, x) => s + importeDe(x), 0);
  const totalDirecto = total - totalPartner;

  const cobrar = (id: string) => {
    c.registrarPago(id);
    setAviso('Pago registrado');
    window.setTimeout(() => setAviso(null), 2000);
  };

  return (
    <Subvista
      titulo="Cobros pendientes"
      subtitulo="Importes por cobrar de clientes directos y partners. Alimentará Tesorería."
      acciones={
        <div className="flex flex-wrap gap-2">
          <Kpi label="Total" value={`${total} €`} />
          <Kpi label="Directo" value={`${totalDirecto} €`} />
          <Kpi label="Partners" value={`${totalPartner} €`} tone="text-teal-300" />
        </div>
      }
    >
      {aviso ? (
        <p className="mb-3 inline-block rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
          {aviso}
        </p>
      ) : null}

      <div className="glass-panel overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead className="border-b border-white/5 text-2xs uppercase tracking-widest text-zinc-600">
            <tr>
              {['Cliente', 'Cita', 'Servicio · Prof.', 'Importe', 'Método', 'Origen', 'Estado', 'Antigüedad', ''].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pendientes.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-zinc-600">No hay cobros pendientes</td></tr>
            ) : (
              pendientes.map((x) => {
                const dias = diasDe(x);
                const estado = estadoDe(x);
                return (
                  <tr key={x.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                    <td className="px-4 py-2.5 text-zinc-200">{x.cliente_nombre}</td>
                    <td className="px-4 py-2.5 text-zinc-400">{diaCorto(x.inicio)} {hhmm(x.inicio)}</td>
                    <td className="px-4 py-2.5 text-zinc-400">
                      {getServicio(x.servicio_id)?.nombre} · {getProfesional(x.profesional_id)?.nombre.split(' ')[0]}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-zinc-200">{importeDe(x)} €</td>
                    <td className="px-4 py-2.5 text-zinc-400">{metodoDe(x)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full border px-2 py-0.5 text-2xs uppercase tracking-wide ${esPartner(x) ? 'border-teal-500/30 bg-teal-500/10 text-teal-300' : 'border-white/10 bg-white/5 text-zinc-400'}`}>
                        {getOrigen(x.origen)?.label ?? x.origen}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={estado === 'Reclamado' ? 'text-amber-300' : estado === 'Parcial' ? 'text-amber-300' : 'text-zinc-400'}>{estado}</span>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500">{dias} d</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => cobrar(x.id)} className="rounded-md border border-white/10 px-2.5 py-1 text-2xs text-zinc-200 hover:bg-white/5">
                        Registrar pago
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-2xs text-zinc-600">
        Partners (Vivofácil/Oasis/Lidomare) se facturan agrupado a fin de mes — ver pestaña Vivofácil para el cierre.
      </p>
    </Subvista>
  );
}

function Kpi({ label, value, tone = 'text-zinc-100' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="glass-panel flex items-baseline gap-2 rounded-lg px-3 py-1.5">
      <span className={`text-sm font-semibold ${tone}`}>{value}</span>
      <span className="text-2xs uppercase tracking-widest text-zinc-500">{label}</span>
    </div>
  );
}
