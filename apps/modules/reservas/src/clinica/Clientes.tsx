import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Copy, User, History, ExternalLink, Search } from 'lucide-react';
import { CLIENTES, type ClienteMock } from './mock/clientes';
import { getOrigen } from '../spike/mockData';
import { Subvista } from './Subvista';
import { CitaPanel, type CitaPanelMode } from './CitaPanel';
import { useCitasStore, type ClienteBusqueda } from './CitasStore';

const fecha = (d: string | null) =>
  d
    ? new Date(`${d}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    : '—';

// Vista "Clientes": ficha ADMINISTRATIVA mock (nombres y contactos ficticios,
// sin datos reales). La ficha completa vive en un sistema externo (enlace mock);
// aquí solo agenda, pagos y bonos.
export function Clientes({ panelMode = 'fixed' }: { panelMode?: CitaPanelMode } = {}) {
  const c = useCitasStore();
  if (c.real) return <ClientesReales />;
  return <ClientesDemo panelMode={panelMode} />;
}

// ── Modo REAL: los clientes de la base (sincronizados desde Salonized) ──────
function ClientesReales() {
  const c = useCitasStore();
  const [q, setQ] = useState('');
  const [filas, setFilas] = useState<ClienteBusqueda[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const flash = (m: string) => {
    setAviso(m);
    window.setTimeout(() => setAviso(null), 2200);
  };

  useEffect(() => {
    void c.buscarClientes('').then(setFilas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alEscribir = (v: string) => {
    setQ(v);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void c.buscarClientes(v).then(setFilas);
    }, 250);
  };

  const abrirWhatsApp = (tel: string | null) => {
    const bruto = (tel ?? '').replace(/[^\d]/g, '');
    if (!bruto) {
      flash('Sin teléfono en la ficha');
      return;
    }
    window.open(`https://wa.me/${bruto.length === 9 ? `34${bruto}` : bruto}`, '_blank', 'noopener');
  };

  return (
    <Subvista
      titulo="Clientes"
      subtitulo="Ficha administrativa (sincronizada desde Salonized). Sin datos clínicos."
      acciones={
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-2.5 text-zinc-500" />
          <input
            value={q}
            onChange={(e) => alEscribir(e.target.value)}
            placeholder="Buscar por nombre o teléfono…"
            className="w-64 rounded-lg border border-white/10 bg-zinc-950 py-1.5 pl-8 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-white/25 focus:outline-none"
          />
        </div>
      }
    >
      {aviso ? (
        <p className="mb-3 inline-block rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
          {aviso}
        </p>
      ) : null}
      <div className="glass-panel overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="text-2xs border-b border-white/5 uppercase tracking-widest text-zinc-500">
            <tr>
              {['Cliente', 'Teléfono', 'Email', ''].map((h, i) => (
                <th key={i} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr
                key={f.id}
                className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
              >
                <td className="px-4 py-2.5 text-zinc-200">
                  {f.nombre}
                  {f.apellidos ? ` ${f.apellidos}` : ''}
                </td>
                <td className="px-4 py-2.5 text-zinc-400">{f.telefono ?? '—'}</td>
                <td className="px-4 py-2.5 text-zinc-400">{f.email ?? '—'}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className="inline-flex gap-1">
                    <button
                      onClick={() => abrirWhatsApp(f.telefono)}
                      title="Abrir WhatsApp"
                      className="text-2xs rounded-md border border-white/10 px-2 py-1 text-zinc-300 hover:bg-white/5"
                    >
                      <MessageCircle size={12} />
                    </button>
                    <button
                      onClick={() =>
                        navigator.clipboard
                          ?.writeText(
                            `${f.nombre}${f.apellidos ? ` ${f.apellidos}` : ''} · ${f.telefono ?? ''} · ${f.email ?? ''}`,
                          )
                          .then(
                            () => flash('Datos copiados'),
                            () => flash('Datos copiados'),
                          )
                      }
                      title="Copiar datos"
                      className="text-2xs rounded-md border border-white/10 px-2 py-1 text-zinc-300 hover:bg-white/5"
                    >
                      <Copy size={12} />
                    </button>
                  </span>
                </td>
              </tr>
            ))}
            {filas.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                  Sin resultados
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="text-2xs mt-2 text-zinc-600">
        {q ? 'Máx. 20 resultados por búsqueda.' : 'Mostrando los primeros 100 por nombre.'}
      </p>
    </Subvista>
  );
}

// ── Modo DEMO: la maqueta original con datos ficticios ──────────────────────
function ClientesDemo({ panelMode = 'fixed' }: { panelMode?: CitaPanelMode } = {}) {
  const c = useCitasStore();
  const [aviso, setAviso] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const flash = (m: string) => {
    setAviso(m);
    window.setTimeout(() => setAviso(null), 2200);
  };
  const copiar = (cl: ClienteMock) =>
    navigator.clipboard?.writeText(`${cl.nombre} · ${cl.telefono} · ${cl.email}`).then(
      () => flash('Datos copiados'),
      () => flash('Datos copiados'),
    );
  // "Historial": abre el panel sobre la última cita del cliente en la semana mock.
  const verHistorial = (cl: ClienteMock) => {
    const suyas = c.citas.filter((x) => x.cliente_nombre === cl.nombre);
    const ultima = suyas[suyas.length - 1];
    if (ultima) c.setSelectedId(ultima.id);
    else flash(`Sin citas de ${cl.nombre} esta semana (mock)`);
  };

  const q = busqueda.trim().toLowerCase();
  const visibles = q ? CLIENTES.filter((cl) => cl.nombre.toLowerCase().includes(q)) : CLIENTES;

  return (
    <Subvista
      titulo="Clientes"
      subtitulo="Ficha administrativa mock — sin datos reales. Registro externo: solo enlace."
      acciones={
        <div className="flex flex-wrap items-center gap-2">
          <label className="glass-panel flex items-center gap-2 rounded-lg border border-transparent px-3 py-1.5 focus-within:border-blue-500/50">
            <Search size={13} className="text-zinc-500" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar cliente…"
              className="w-36 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none"
            />
          </label>
          <div className="glass-panel flex items-baseline gap-2 rounded-lg px-3 py-1.5">
            <span className="text-sm font-semibold text-zinc-100">{visibles.length}</span>
            <span className="text-2xs uppercase tracking-widest text-zinc-500">clientes</span>
          </div>
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
          <thead className="text-2xs border-b border-white/5 uppercase tracking-widest text-zinc-500">
            <tr>
              {[
                'Cliente',
                'Contacto',
                'Origen',
                'Servicio',
                'Última',
                'Próxima',
                'Pago',
                'Bono / Programa',
                '',
              ].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-zinc-500">
                  Sin resultados para «{busqueda}»
                </td>
              </tr>
            ) : (
              visibles.map((cl) => (
                <tr
                  key={cl.id}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-2.5 text-zinc-200">{cl.nombre}</td>
                  <td className="px-4 py-2.5 text-zinc-500">
                    <div>{cl.telefono}</div>
                    <div className="text-2xs text-zinc-500">{cl.email}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-2xs rounded-full border px-2 py-0.5 uppercase tracking-wide ${cl.origen !== 'directo' ? 'border-teal-500/30 bg-teal-500/10 text-teal-300' : 'border-white/10 bg-white/5 text-zinc-400'}`}
                    >
                      {getOrigen(cl.origen)?.label ?? cl.origen}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-400">{cl.servicio}</td>
                  <td className="px-4 py-2.5 text-zinc-400">{fecha(cl.ultima_cita)}</td>
                  <td className="px-4 py-2.5 text-zinc-400">{fecha(cl.proxima_cita)}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={
                        cl.estado_pago === 'pendiente' ? 'text-amber-300' : 'text-emerald-300'
                      }
                    >
                      {cl.estado_pago === 'pendiente' ? 'Pendiente' : 'Al día'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-400">{cl.bono ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Icono
                        title="Ver ficha"
                        onClick={() => flash(`Ficha de ${cl.nombre} (demo)`)}
                      >
                        <User size={14} />
                      </Icono>
                      <Icono
                        title="WhatsApp"
                        onClick={() => flash(`WhatsApp a ${cl.nombre} (demo)`)}
                      >
                        <MessageCircle size={14} />
                      </Icono>
                      <Icono title="Copiar datos" onClick={() => copiar(cl)}>
                        <Copy size={14} />
                      </Icono>
                      <Icono title="Historial de citas" onClick={() => verHistorial(cl)}>
                        <History size={14} />
                      </Icono>
                      <Icono
                        title="Abrir registro externo (mock)"
                        onClick={() => flash(`Abriría ${cl.registro_externo_url} (mock)`)}
                      >
                        <ExternalLink size={14} />
                      </Icono>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-2xs mt-3 text-zinc-500">
        El registro completo del cliente vive en un sistema externo (Notion): el OS solo guarda el
        enlace.
      </p>

      <CitaPanel
        cita={c.seleccionada}
        onClose={() => c.setSelectedId(null)}
        onAccion={c.onAccion}
        onPago={c.onPago}
        onCobrar={(m) => c.seleccionada && c.cobrar(c.seleccionada.id, m)}
        onOrigen={c.onOrigen}
        mode={panelMode}
      />
    </Subvista>
  );
}

function Icono({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
    >
      {children}
    </button>
  );
}
