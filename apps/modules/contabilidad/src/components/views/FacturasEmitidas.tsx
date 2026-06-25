import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Loader2, Send, FileText, CheckCircle, Clock, XCircle, RefreshCw,
} from 'lucide-react';
import { getFacturasEmitidas, getContactos } from '../../lib/contabilidadApi';
import type { FacturaEmitida, EstadoFacturaEmitida, Contacto, SociedadContabilidad } from '@alsari/types';
import { FacturaEmitidaEditor } from './FacturaEmitidaEditor';

// ── Status metadata ───────────────────────────────────────────────────────────

const ESTADO_META: Record<EstadoFacturaEmitida, { label: string; color: string; icon: React.ComponentType<{ size?: number }> }> = {
  borrador: { label: 'Borrador',  color: 'text-zinc-300    bg-zinc-500/15    border-zinc-500/20',   icon: FileText },
  emitida:  { label: 'Emitida',   color: 'text-blue-300    bg-blue-500/15    border-blue-500/20',   icon: Send },
  cobrada:  { label: 'Cobrada',   color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/20', icon: CheckCircle },
  vencida:  { label: 'Vencida',   color: 'text-amber-300   bg-amber-500/15   border-amber-500/20',  icon: Clock },
  anulada:  { label: 'Anulada',   color: 'text-rose-400     bg-rose-500/15     border-rose-500/20',    icon: XCircle },
};

const FILTROS: Array<{ key: EstadoFacturaEmitida | 'todas'; label: string }> = [
  { key: 'todas',    label: 'Todas' },
  { key: 'borrador', label: 'Borradores' },
  { key: 'emitida',  label: 'Emitidas' },
  { key: 'cobrada',  label: 'Cobradas' },
  { key: 'vencida',  label: 'Vencidas' },
  { key: 'anulada',  label: 'Anuladas' },
];

// ── Main Component ────────────────────────────────────────────────────────────

type Props = {
  isPrivateMode: boolean;
  sociedades: SociedadContabilidad[];
  reglas: unknown[];
  userEmail: string | null;
};

export function FacturasEmitidas({ isPrivateMode, sociedades }: Props) {
  const [facturas, setFacturas]             = useState<FacturaEmitida[]>([]);
  const [contactos, setContactos]           = useState<Contacto[]>([]);
  const [loading, setLoading]               = useState(true);
  const [filtro, setFiltro]                 = useState<EstadoFacturaEmitida | 'todas'>('todas');
  const [view, setView]                     = useState<'list' | 'editor'>('list');
  const [editingFactura, setEditingFactura] = useState<FacturaEmitida | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fs, cs] = await Promise.allSettled([
        getFacturasEmitidas(),
        getContactos(),
      ]);
      if (fs.status === 'fulfilled') setFacturas(fs.value);
      if (cs.status === 'fulfilled') setContactos(cs.value);
    } catch { /* silently */ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = filtro === 'todas'
    ? facturas
    : facturas.filter(f => f.estado === filtro);

  const counts = (['borrador', 'emitida', 'cobrada', 'vencida'] as EstadoFacturaEmitida[])
    .reduce<Partial<Record<EstadoFacturaEmitida, number>>>((acc, e) => {
      acc[e] = facturas.filter(f => f.estado === e).length;
      return acc;
    }, {});

  function handleSave(f: FacturaEmitida) {
    setFacturas(prev => {
      const exists = prev.find(x => x.id === f.id);
      return exists ? prev.map(x => x.id === f.id ? f : x) : [f, ...prev];
    });
    setView('list');
  }

  function openEditor(f: FacturaEmitida | null) {
    setEditingFactura(f);
    setView('editor');
  }

  const fmt = (n: number) => isPrivateMode ? '€ ****'
    : n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  if (view === 'editor') {
    return (
      <FacturaEmitidaEditor
        factura={editingFactura}
        facturasList={facturas}
        contactos={contactos}
        sociedades={sociedades}
        isPrivateMode={isPrivateMode}
        onBack={() => setView('list')}
        onSave={handleSave}
      />
    );
  }

  return (
    <div className="space-y-5">

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => openEditor(null)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors"
        >
          <Plus size={13} />Nueva factura
        </button>
        <button
          onClick={() => { void load(); }}
          className="ml-auto text-zinc-600 hover:text-zinc-300 transition-colors"
          title="Recargar"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {FILTROS.map(({ key, label }) => {
          const count = key !== 'todas' ? counts[key as EstadoFacturaEmitida] : undefined;
          return (
            <button
              key={key}
              onClick={() => setFiltro(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all
                ${filtro === key ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'}`}
            >
              {label}
              {count !== undefined && count > 0 && (
                <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={20} className="animate-spin text-zinc-600" />
        </div>
      ) : visible.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-3 text-zinc-600">
          <Send size={32} className="opacity-30" />
          <p className="text-sm">
            {filtro === 'todas'
              ? 'Sin facturas emitidas. Crea la primera.'
              : `Sin facturas en "${ESTADO_META[filtro as EstadoFacturaEmitida]?.label ?? filtro}".`}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-zinc-900/60">
                {['Número', 'Cliente', 'Fecha', 'Total', 'Estado'].map(h => (
                  <th key={h} className={`text-2xs font-semibold text-zinc-500 uppercase tracking-widest px-4 py-3 text-left
                    ${h === 'Total' ? 'text-right' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {visible.map(f => {
                const meta = ESTADO_META[f.estado];
                const Icon = meta.icon;
                return (
                  <tr
                    key={f.id}
                    onClick={() => openEditor(f)}
                    className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-zinc-200 font-mono">{f.numero_factura}</p>
                      <p className="text-2xs text-zinc-600">Serie {f.serie}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="text-xs font-medium text-zinc-200 truncate">{f.cliente_nombre}</p>
                      {f.cliente_nif && (
                        <p className="text-2xs text-zinc-500 font-mono">{isPrivateMode ? '****' : f.cliente_nif}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-zinc-400 font-mono">{f.fecha_factura}</p>
                      {f.fecha_vencimiento && (
                        <p className="text-2xs text-zinc-600">Vence {f.fecha_vencimiento}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-medium font-mono ${isPrivateMode ? 'text-zinc-500' : 'text-white'}`}>
                        {fmt(f.total_a_cobrar)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-2xs font-medium px-2 py-0.5 rounded-full border ${meta.color}`}>
                        <Icon size={9} />{meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-zinc-600 text-right">{visible.length} facturas</p>
    </div>
  );
}
