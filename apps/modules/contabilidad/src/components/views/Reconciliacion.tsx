import { useState } from 'react';
import { Loader2, GitMerge, CheckCircle, AlertTriangle, HelpCircle, X } from 'lucide-react';
import { getReconciliacion, resolverItem } from '../../lib/contabilidadApi';
import type { ReconciliacionItem } from '@alsari/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIPO_STYLE: Record<
  ReconciliacionItem['tipo'],
  { label: string; color: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  coincide: { label: 'Coincide', color: 'bg-emerald-500/20 text-emerald-300', icon: CheckCircle },
  diferencia_importe: {
    label: 'Dif. importe',
    color: 'bg-amber-500/20 text-amber-300',
    icon: AlertTriangle,
  },
  diferencia_cuenta: {
    label: 'Dif. cuenta',
    color: 'bg-orange-500/20 text-orange-300',
    icon: AlertTriangle,
  },
  diferencia_fecha: {
    label: 'Dif. fecha',
    color: 'bg-yellow-500/20 text-yellow-300',
    icon: AlertTriangle,
  },
  sin_borrador: { label: 'Sin borrador', color: 'bg-zinc-700/40 text-zinc-400', icon: HelpCircle },
  sin_oficial: {
    label: 'Sin asiento ofic.',
    color: 'bg-violet-500/20 text-violet-300',
    icon: HelpCircle,
  },
};

// ── Resolve modal ─────────────────────────────────────────────────────────────

function ResolverModal({
  item,
  onClose,
  onResolved,
}: {
  item: ReconciliacionItem;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await resolverItem(item.id, notas);
      onResolved();
    } catch {
      /* ignore */
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-white">
            Resolver diferencia
          </h2>
          <button onClick={onClose}>
            <X size={18} className="text-zinc-600 hover:text-zinc-300" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div className="space-y-2 rounded-xl border border-white/5 bg-zinc-900/60 p-4 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Tipo</span>
              <span className="text-zinc-200">{TIPO_STYLE[item.tipo].label}</span>
            </div>
            {item.score_similitud !== null && item.score_similitud !== undefined && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Similitud</span>
                <span className="text-zinc-200">{(item.score_similitud * 100).toFixed(0)}%</span>
              </div>
            )}
            {item.diferencias && Object.keys(item.diferencias).length > 0 && (
              <div>
                <span className="mb-1 block text-zinc-500">Diferencias</span>
                <pre className="text-2xs overflow-x-auto rounded bg-zinc-950 p-2 text-zinc-400">
                  {JSON.stringify(item.diferencias, null, 2)}
                </pre>
              </div>
            )}
          </div>
          <div>
            <label className="field-label">Notas de resolución</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              className="field-input resize-none"
              placeholder="Explica por qué se acepta/ignora esta diferencia…"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-white/5 px-6 py-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              void handleSave();
            }}
            disabled={saving || !notas.trim()}
            className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : 'Marcar resuelto'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type Props = {
  isPrivateMode: boolean;
  sociedades: { id: string; nombre: string }[];
  reglas: unknown[];
};

export function Reconciliacion({ sociedades }: Props) {
  const [sociedad, setSociedad] = useState(sociedades[0]?.id ?? '');
  const [periodo, setPeriodo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [items, setItems] = useState<ReconciliacionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [resolving, setResolving] = useState<ReconciliacionItem | null>(null);

  const load = async () => {
    if (!sociedad || !periodo) return;
    setLoading(true);
    try {
      const data = await getReconciliacion(sociedad, periodo);
      setItems(data);
      setHasLoaded(true);
    } catch {
      /* ignore */
    }
    setLoading(false);
  };

  const handleResolved = () => {
    setResolving(null);
    void load();
  };

  const pendientes = items.filter((i) => !i.resuelto && i.tipo !== 'coincide');
  const coinciden = items.filter((i) => i.tipo === 'coincide').length;
  const diferencias = items.filter((i) => i.tipo !== 'coincide' && !i.resuelto).length;
  const resueltos = items.filter((i) => i.resuelto).length;

  return (
    <div className="space-y-6">
      {/* Selector */}
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-4 rounded-2xl border border-white/5 bg-zinc-900/40 p-5">
        <div>
          <label className="field-label">Sociedad</label>
          <select
            value={sociedad}
            onChange={(e) => setSociedad(e.target.value)}
            className="field-input"
          >
            {sociedades.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Período (YYYY-MM)</label>
          <input
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="field-input"
          />
        </div>
        <button
          onClick={() => {
            void load();
          }}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />}
          Cargar
        </button>
      </div>

      {!hasLoaded && !loading && (
        <div className="flex flex-col items-center gap-3 py-20 text-center text-zinc-600">
          <GitMerge size={40} className="opacity-30" />
          <p className="text-sm">Selecciona sociedad y período para ver la reconciliación.</p>
          <p className="text-xs text-zinc-700">
            Los datos provienen de los asientos importados desde la gestoría.
          </p>
        </div>
      )}

      {hasLoaded && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Coinciden', v: coinciden, c: 'text-emerald-400' },
              { label: 'Diferencias', v: diferencias, c: 'text-amber-400' },
              { label: 'Resueltos', v: resueltos, c: 'text-zinc-400' },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-3"
              >
                <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-600">
                  {s.label}
                </p>
                <p className={`text-2xl font-semibold ${s.c}`}>{s.v}</p>
              </div>
            ))}
          </div>

          {/* Items */}
          {items.length === 0 ? (
            <div className="py-16 text-center text-sm text-zinc-600">
              No hay datos de reconciliación para este período. Importa los asientos de la gestoría.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 bg-zinc-900/60">
                    {['Tipo', 'Borrador', 'Oficial', 'Similitud', 'Estado', ''].map((h) => (
                      <th
                        key={h}
                        className="text-2xs px-4 py-3 text-left font-semibold uppercase tracking-widest text-zinc-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {items.map((item) => {
                    const tipo = TIPO_STYLE[item.tipo];
                    const TipoIcon = tipo.icon;
                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors hover:bg-white/[0.02] ${item.resuelto ? 'opacity-50' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <span
                            className={`text-2xs inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${tipo.color}`}
                          >
                            <TipoIcon size={9} />
                            {tipo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                          {item.asiento_borrador_id
                            ? item.asiento_borrador_id.slice(0, 8) + '…'
                            : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                          {item.asiento_oficial_id
                            ? item.asiento_oficial_id.slice(0, 8) + '…'
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {item.score_similitud !== null && item.score_similitud !== undefined ? (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-800">
                                <div
                                  className={`h-full rounded-full ${item.score_similitud >= 0.9 ? 'bg-emerald-500' : item.score_similitud >= 0.6 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                  style={{ width: `${item.score_similitud * 100}%` }}
                                />
                              </div>
                              <span className="text-2xs font-mono text-zinc-500">
                                {(item.score_similitud * 100).toFixed(0)}%
                              </span>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {item.resuelto ? (
                            <span className="text-2xs font-medium text-emerald-400">Resuelto</span>
                          ) : (
                            <span className="text-2xs text-zinc-600">Pendiente</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {!item.resuelto && item.tipo !== 'coincide' && (
                            <button
                              onClick={() => setResolving(item)}
                              className="text-2xs font-medium text-blue-400 transition-colors hover:text-blue-300"
                            >
                              Resolver
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {pendientes.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-950/10 px-4 py-3">
              <AlertTriangle size={14} className="shrink-0 text-amber-400" />
              <p className="text-xs text-amber-300">
                Hay <strong>{pendientes.length}</strong> diferencias pendientes de resolver. Revisa
                con tu gestoría.
              </p>
            </div>
          )}
        </>
      )}

      {resolving && (
        <ResolverModal
          item={resolving}
          onClose={() => setResolving(null)}
          onResolved={handleResolved}
        />
      )}
    </div>
  );
}
