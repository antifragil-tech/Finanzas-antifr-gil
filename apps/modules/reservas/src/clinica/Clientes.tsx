import { useState } from 'react';
import { MessageCircle, Copy, User, History } from 'lucide-react';
import { CLIENTES, type ClienteMock } from './mock/clientes';
import { getOrigen } from '../spike/mockData';
import { Subvista } from './Subvista';

const fecha = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—';

// Vista "Clientes": listado mock (nombres y contactos ficticios, sin datos reales).
export function Clientes() {
  const [aviso, setAviso] = useState<string | null>(null);
  const flash = (m: string) => {
    setAviso(m);
    window.setTimeout(() => setAviso(null), 2000);
  };
  const copiar = (c: ClienteMock) =>
    navigator.clipboard?.writeText(`${c.nombre} · ${c.telefono} · ${c.email}`).then(
      () => flash('Datos copiados'),
      () => flash('Datos copiados'),
    );

  return (
    <Subvista
      titulo="Clientes"
      subtitulo="Listado mock — nombres y contactos ficticios, sin datos reales."
      acciones={
        <div className="glass-panel flex items-baseline gap-2 rounded-lg px-3 py-1.5">
          <span className="text-sm font-semibold text-zinc-100">{CLIENTES.length}</span>
          <span className="text-2xs uppercase tracking-widest text-zinc-500">clientes</span>
        </div>
      }
    >
      {aviso ? (
        <p className="mb-3 inline-block rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
          {aviso}
        </p>
      ) : null}

      <div className="glass-panel overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="border-b border-white/5 text-2xs uppercase tracking-widest text-zinc-600">
            <tr>
              {['Cliente', 'Contacto', 'Origen', 'Última', 'Próxima', 'Pago', 'Bono / Programa', ''].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CLIENTES.map((c) => (
              <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                <td className="px-4 py-2.5 text-zinc-200">{c.nombre}</td>
                <td className="px-4 py-2.5 text-zinc-500">
                  <div>{c.telefono}</div>
                  <div className="text-2xs text-zinc-600">{c.email}</div>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full border px-2 py-0.5 text-2xs uppercase tracking-wide ${c.origen !== 'directo' ? 'border-teal-500/30 bg-teal-500/10 text-teal-300' : 'border-white/10 bg-white/5 text-zinc-400'}`}>
                    {getOrigen(c.origen)?.label ?? c.origen}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-zinc-400">{fecha(c.ultima_cita)}</td>
                <td className="px-4 py-2.5 text-zinc-400">{fecha(c.proxima_cita)}</td>
                <td className="px-4 py-2.5">
                  <span className={c.estado_pago === 'pendiente' ? 'text-amber-300' : 'text-emerald-300'}>
                    {c.estado_pago === 'pendiente' ? 'Pendiente' : 'Al día'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-zinc-400">{c.bono ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <Icono title="Ver ficha" onClick={() => flash(`Ficha de ${c.nombre} (demo)`)}><User size={14} /></Icono>
                    <Icono title="WhatsApp" onClick={() => flash(`WhatsApp a ${c.nombre} (demo)`)}><MessageCircle size={14} /></Icono>
                    <Icono title="Copiar datos" onClick={() => copiar(c)}><Copy size={14} /></Icono>
                    <Icono title="Historial" onClick={() => flash(`Historial de ${c.nombre} (demo)`)}><History size={14} /></Icono>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Subvista>
  );
}

function Icono({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={title} onClick={onClick} className="rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-200">
      {children}
    </button>
  );
}
