import { useState, Fragment } from 'react';
import { DayPilot } from '@daypilot/daypilot-lite-react';
import { Copy, Building2, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { crearCitasMock, getProfesional, getServicio, VIVOFACIL_VALOR_SESION } from '../spike/mockData';
import { Subvista } from './Subvista';
import { CitaPanel } from './CitaPanel';
import { useCitas } from './useCitas';

type EstadoCierre = 'abierto' | 'listo' | 'facturado' | 'cobrado';
const FLUJO: EstadoCierre[] = ['abierto', 'listo', 'facturado', 'cobrado'];
const LABEL: Record<EstadoCierre, string> = {
  abierto: 'Abierto',
  listo: 'Listo para facturar',
  facturado: 'Facturado',
  cobrado: 'Cobrado',
};
const ACCION_SIGUIENTE: Record<EstadoCierre, string> = {
  abierto: 'Marcar listo para facturar',
  listo: 'Marcar facturado',
  facturado: 'Marcar cobrado',
  cobrado: '',
};
const TONE: Record<EstadoCierre, string> = {
  abierto: 'border-white/10 bg-white/5 text-zinc-400',
  listo: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  facturado: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  cobrado: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
};

const hhmm = (iso: string) => iso.slice(11, 16);
const diaCorto = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });

// Vista "Vivofácil": cierre mensual MOCK de las derivaciones. Cada sesión completada
// vale 45 €; se factura agrupado a fin de mes → cobro B2B. NO crea facturas reales.
export function Vivofacil() {
  const hoy = DayPilot.Date.today().toString('yyyy-MM-dd');
  const mesLabel = new Date(`${hoy}T00:00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const c = useCitas(() => crearCitasMock(hoy).filter((x) => x.origen === 'vivofacil'));
  const completadas = c.citas.filter((x) => x.estado_cita === 'completada');
  const pendientesValidar = c.citas.filter((x) => x.estado_cita !== 'completada' && x.estado_cita !== 'cancelada');
  const total = completadas.length * VIVOFACIL_VALOR_SESION;

  const porPaciente = new Map<string, number>();
  completadas.forEach((x) => porPaciente.set(x.cliente_nombre, (porPaciente.get(x.cliente_nombre) ?? 0) + 1));
  const pacientes = [...porPaciente.entries()]
    .map(([nombre, sesiones]) => ({ nombre, sesiones, importe: sesiones * VIVOFACIL_VALOR_SESION }))
    .sort((a, b) => b.importe - a.importe);

  const [cierre, setCierre] = useState<EstadoCierre>('abierto');
  const [detalle, setDetalle] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const flash = (m: string) => {
    setAviso(m);
    window.setTimeout(() => setAviso(null), 2200);
  };
  const avanzar = () => {
    const next = FLUJO[FLUJO.indexOf(cierre) + 1];
    if (next) setCierre(next);
  };
  const copiarResumen = () => {
    const lineas = pacientes.map((p) => `${p.nombre}: ${p.sesiones} ses · ${p.importe} €`).join('\n');
    const txt = `Cierre Vivofácil — ${mesLabel}\n${completadas.length} sesiones × ${VIVOFACIL_VALOR_SESION} € = ${total} €\n${lineas}`;
    navigator.clipboard?.writeText(txt).then(() => flash('Resumen copiado'), () => flash('Resumen copiado'));
  };

  return (
    <Subvista
      titulo="Vivofácil"
      subtitulo={`Cierre mensual de derivaciones · ${mesLabel}`}
      acciones={
        <div className="flex flex-wrap gap-2">
          <Kpi label="Pacientes" value={String(pacientes.length)} />
          <Kpi label="Sesiones" value={String(completadas.length)} />
          <Kpi label="Por validar" value={String(pendientesValidar.length)} tone="text-amber-300" />
          <Kpi label="A facturar" value={`${total} €`} tone="text-teal-300" />
        </div>
      }
    >
      {aviso ? (
        <p className="mb-3 inline-block rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
          {aviso}
        </p>
      ) : null}

      {/* Estado del cierre */}
      <div className="glass-panel mb-4 flex flex-wrap items-center gap-3 rounded-2xl p-4">
        <Building2 size={16} className="text-teal-300" />
        <span className="text-sm text-zinc-300">Estado del cierre</span>
        <span className={`rounded-full border px-2.5 py-0.5 text-2xs uppercase tracking-wide ${TONE[cierre]}`}>
          {LABEL[cierre]}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {cierre !== 'cobrado' ? (
            <button onClick={avanzar} className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5">
              {ACCION_SIGUIENTE[cierre]}
            </button>
          ) : null}
          <button onClick={() => flash('Cierre marcado como revisado')} className="flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5">
            <CheckCircle2 size={13} /> Marcar revisado
          </button>
          <button onClick={copiarResumen} className="flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5">
            <Copy size={13} /> Copiar resumen
          </button>
        </div>
      </div>

      {/* Resumen por paciente, con detalle de sesiones desplegable */}
      <div className="glass-panel overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="border-b border-white/5 text-2xs uppercase tracking-widest text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">Paciente</th>
              <th className="px-4 py-3 font-medium">Sesiones completadas</th>
              <th className="px-4 py-3 font-medium">Importe ({VIVOFACIL_VALOR_SESION} €/sesión)</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {pacientes.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-zinc-600">Sin sesiones Vivofácil este mes</td></tr>
            ) : (
              pacientes.map((p) => (
                <Fragment key={p.nombre}>
                  <tr className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                    <td className="px-4 py-2.5 text-zinc-200">{p.nombre}</td>
                    <td className="px-4 py-2.5 text-zinc-400">{p.sesiones}</td>
                    <td className="px-4 py-2.5 font-medium text-zinc-200">{p.importe} €</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => setDetalle((d) => (d === p.nombre ? null : p.nombre))}
                        className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-2xs text-zinc-300 hover:bg-white/5"
                      >
                        {detalle === p.nombre ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                  {detalle === p.nombre ? (
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <td colSpan={4} className="px-4 py-2">
                        <ul className="space-y-1">
                          {completadas
                            .filter((x) => x.cliente_nombre === p.nombre)
                            .map((x) => (
                              <li key={x.id}>
                                <button
                                  onClick={() => c.setSelectedId(x.id)}
                                  className="flex w-full items-center gap-3 rounded-lg px-2 py-1 text-left text-2xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                                >
                                  <span className="font-mono text-zinc-500">
                                    {diaCorto(x.inicio)} {hhmm(x.inicio)}
                                  </span>
                                  <span>{getServicio(x.servicio_id)?.nombre}</span>
                                  <span className="text-zinc-600">{getProfesional(x.profesional_id)?.nombre}</span>
                                  <span className="ml-auto text-zinc-500">{VIVOFACIL_VALOR_SESION} €</span>
                                </button>
                              </li>
                            ))}
                        </ul>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
          {pacientes.length > 0 ? (
            <tfoot>
              <tr className="border-t border-white/10">
                <td className="px-4 py-2.5 text-2xs uppercase tracking-widest text-zinc-500">Total a facturar</td>
                <td className="px-4 py-2.5 text-zinc-400">{completadas.length}</td>
                <td className="px-4 py-2.5 font-semibold text-teal-300">{total} €</td>
                <td />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <p className="mt-3 text-2xs text-zinc-600">Mock — no genera factura ni documento fiscal real.</p>

      <CitaPanel
        cita={c.seleccionada}
        onClose={() => c.setSelectedId(null)}
        onAccion={c.onAccion}
        onPago={c.onPago}
        onOrigen={c.onOrigen}
      />
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
