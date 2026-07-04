import { useState } from 'react';
import { RefreshCw, MinusCircle, Ban, User } from 'lucide-react';
import { BONOS, restantes, type BonoMock, type EstadoBono } from './mock/bonos';
import { getCliente } from './mock/clientes';
import { Subvista } from './Subvista';

const fecha = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' });

const ESTADO_TONE: Record<EstadoBono, string> = {
  activo: 'text-emerald-300',
  por_renovar: 'text-amber-300',
  agotado: 'text-rose-300',
  pausado: 'text-zinc-400',
};
const ESTADO_LABEL: Record<EstadoBono, string> = {
  activo: 'Activo',
  por_renovar: 'Por renovar',
  agotado: 'Agotado',
  pausado: 'Pausado',
};

// Vista "Bonos / Programas": paquetes de sesiones por cliente (mock/local). Los
// que están por renovar o agotados generan un cobro pendiente al renovar.
export function Bonos() {
  const [bonos, setBonos] = useState<BonoMock[]>(BONOS);
  const [aviso, setAviso] = useState<string | null>(null);

  const flash = (m: string) => {
    setAviso(m);
    window.setTimeout(() => setAviso(null), 2200);
  };
  const patch = (id: string, cambio: Partial<BonoMock>) =>
    setBonos((prev) => prev.map((b) => (b.id === id ? { ...b, ...cambio } : b)));

  const renovar = (b: BonoMock) => {
    patch(b.id, { sesiones_usadas: 0, estado: 'activo' });
    flash(`${b.nombre} renovado — genera cobro pendiente (mock)`);
  };
  const registrarUso = (b: BonoMock) => {
    const usadas = Math.min(b.sesiones_contratadas, b.sesiones_usadas + 1);
    const agotado = usadas >= b.sesiones_contratadas;
    patch(b.id, { sesiones_usadas: usadas, estado: agotado ? 'agotado' : b.estado });
    flash(agotado ? `${b.nombre}: última sesión — agotado` : 'Sesión registrada');
  };
  const marcarAgotado = (b: BonoMock) => {
    patch(b.id, { estado: 'agotado' });
    flash(`${b.nombre} marcado como agotado`);
  };
  const abrirCliente = (b: BonoMock) => {
    const cl = getCliente(b.cliente_id);
    flash(cl ? `Ficha de ${cl.nombre} · ${cl.telefono} (demo)` : `Ficha de ${b.cliente} (demo)`);
  };

  const activos = bonos.filter((b) => b.estado === 'activo').length;
  const atencion = bonos.filter((b) => b.estado === 'por_renovar' || b.estado === 'agotado').length;

  return (
    <Subvista
      titulo="Bonos / Programas"
      subtitulo="Sesiones contratadas vs usadas por cliente. Renovaciones → cobro pendiente."
      acciones={
        <div className="flex gap-2">
          <Kpi label="Activos" value={String(activos)} tone="text-emerald-300" />
          <Kpi label="Por renovar / agotados" value={String(atencion)} tone="text-amber-300" />
        </div>
      }
    >
      {aviso ? (
        <p className="mb-3 inline-block rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
          {aviso}
        </p>
      ) : null}

      <div className="glass-panel overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="border-b border-white/5 text-2xs uppercase tracking-widest text-zinc-600">
            <tr>
              {['Cliente', 'Tipo', 'Nombre', 'Usadas', 'Restantes', 'Inicio', 'Caducidad', 'Estado', 'Cobro', ''].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bonos.map((b) => {
              const rest = restantes(b);
              const pct = Math.round((b.sesiones_usadas / b.sesiones_contratadas) * 100);
              return (
                <tr key={b.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5 text-zinc-200">{b.cliente}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-2xs uppercase tracking-wide text-violet-300">
                      {b.tipo === 'bono' ? 'Bono' : 'Programa'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-400">{b.nombre}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-300">{b.sesiones_usadas}/{b.sesiones_contratadas}</span>
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/5">
                        <span className="block h-full rounded-full bg-zinc-400" style={{ width: `${pct}%` }} />
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-zinc-200">{rest}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{fecha(b.inicio)}</td>
                  <td className="px-4 py-2.5 text-zinc-400">{fecha(b.caducidad)}</td>
                  <td className={`px-4 py-2.5 ${ESTADO_TONE[b.estado]}`}>{ESTADO_LABEL[b.estado]}</td>
                  <td className="px-4 py-2.5 text-2xs">
                    {b.estado === 'por_renovar' || b.estado === 'agotado' ? (
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 uppercase tracking-wide text-amber-300">
                        Renovación pendiente
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Icono title="Registrar uso de sesión" onClick={() => registrarUso(b)} disabled={b.estado !== 'activo'}>
                        <MinusCircle size={14} />
                      </Icono>
                      <Icono title="Renovar" onClick={() => renovar(b)}>
                        <RefreshCw size={14} />
                      </Icono>
                      <Icono title="Marcar agotado" onClick={() => marcarAgotado(b)} disabled={b.estado === 'agotado'}>
                        <Ban size={14} />
                      </Icono>
                      <Icono title="Abrir cliente" onClick={() => abrirCliente(b)}>
                        <User size={14} />
                      </Icono>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-2xs text-zinc-600">
        Acciones mock/local — la renovación real generará un cobro en la pestaña Cobros cuando haya backend.
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

function Icono({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-200 disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
