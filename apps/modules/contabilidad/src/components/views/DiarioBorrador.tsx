import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  BookOpen,
} from 'lucide-react';
import { getAsientosBorrador, updateAsientoBorrador } from '../../lib/contabilidadApi';
import type { AsientoBorrador, LineaAsiento } from '@alsari/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, priv: boolean) {
  if (priv) return '****';
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ESTADO_STYLE: Record<AsientoBorrador['estado'], string> = {
  borrador: 'bg-zinc-700/40 text-zinc-400',
  confirmado: 'bg-emerald-500/20 text-emerald-300',
  rechazado: 'bg-rose-500/20 text-rose-400',
};

const ESTADO_LABEL: Record<AsientoBorrador['estado'], string> = {
  borrador: 'Borrador',
  confirmado: 'Confirmado',
  rechazado: 'Rechazado',
};

// ── Fila de asiento ───────────────────────────────────────────────────────────

type RowProps = {
  asiento: AsientoBorrador;
  isPrivateMode: boolean;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
};

function AsientoRow({ asiento, isPrivateMode, onConfirm, onReject }: RowProps) {
  const [open, setOpen] = useState(false);
  const lineas: LineaAsiento[] = Array.isArray(asiento.lineas)
    ? (asiento.lineas as LineaAsiento[])
    : [];

  return (
    <div className="overflow-hidden rounded-xl border border-white/5">
      {/* Header row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        {open ? (
          <ChevronDown size={14} className="shrink-0 text-zinc-500" />
        ) : (
          <ChevronRight size={14} className="shrink-0 text-zinc-500" />
        )}

        <div className="grid min-w-0 flex-1 grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4">
          <span className="whitespace-nowrap font-mono text-xs text-zinc-500">{asiento.fecha}</span>
          <span className="truncate text-xs text-zinc-200">{asiento.concepto}</span>
          <span
            className={`text-2xs whitespace-nowrap rounded-full px-2 py-0.5 font-medium ${ESTADO_STYLE[asiento.estado]}`}
          >
            {ESTADO_LABEL[asiento.estado]}
          </span>
          <span className="whitespace-nowrap font-mono text-xs text-zinc-400">
            D: {isPrivateMode ? '****' : fmt(asiento.total_debe, false)} €
          </span>
          <span className="whitespace-nowrap font-mono text-xs text-zinc-400">
            H: {isPrivateMode ? '****' : fmt(asiento.total_haber, false)} €
          </span>
        </div>

        {asiento.estado === 'borrador' && (
          <div
            className="ml-3 flex shrink-0 items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => onConfirm(asiento.id)}
              className="text-2xs flex items-center gap-1 rounded-lg border border-emerald-500/20 px-2 py-1 font-medium text-emerald-400 transition-all hover:border-emerald-400/40 hover:text-emerald-300"
            >
              <CheckCircle size={10} />
              Confirmar
            </button>
            <button
              onClick={() => onReject(asiento.id)}
              className="text-2xs flex items-center gap-1 rounded-lg border border-rose-500/20 px-2 py-1 font-medium text-rose-400 transition-all hover:border-rose-400/40 hover:text-rose-300"
            >
              <XCircle size={10} />
              Rechazar
            </button>
          </div>
        )}
      </button>

      {/* Lineas */}
      {open && lineas.length > 0 && (
        <div className="border-t border-white/5 bg-zinc-950/40">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.04]">
                <th className="text-2xs px-5 py-2 text-left font-semibold uppercase tracking-widest text-zinc-600">
                  Cuenta
                </th>
                <th className="text-2xs px-3 py-2 text-left font-semibold uppercase tracking-widest text-zinc-600">
                  Descripción
                </th>
                <th className="text-2xs px-3 py-2 text-right font-semibold uppercase tracking-widest text-zinc-600">
                  Debe
                </th>
                <th className="text-2xs px-5 py-2 text-right font-semibold uppercase tracking-widest text-zinc-600">
                  Haber
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {lineas.map((l, i) => (
                <tr key={i}>
                  <td className="px-5 py-1.5 font-mono text-zinc-500">{l.cuenta_codigo}</td>
                  <td className="px-3 py-1.5 text-zinc-400">{l.cuenta_descripcion}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-emerald-400/80">
                    {l.debe > 0 ? fmt(l.debe, isPrivateMode) : '—'}
                  </td>
                  <td className="px-5 py-1.5 text-right font-mono text-rose-400/80">
                    {l.haber > 0 ? fmt(l.haber, isPrivateMode) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Balance check */}
          <div className="text-2xs flex justify-end gap-6 border-t border-white/[0.04] px-5 py-2 font-mono">
            <span className="text-zinc-600">
              Σ Debe:{' '}
              <span className="text-zinc-400">{fmt(asiento.total_debe, isPrivateMode)}</span>
            </span>
            <span className="text-zinc-600">
              Σ Haber:{' '}
              <span className="text-zinc-400">{fmt(asiento.total_haber, isPrivateMode)}</span>
            </span>
            {Math.abs(asiento.total_debe - asiento.total_haber) > 0.01 && (
              <span className="font-medium text-rose-400">
                ⚠ Descuadre:{' '}
                {fmt(Math.abs(asiento.total_debe - asiento.total_haber), isPrivateMode)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type Props = {
  isPrivateMode: boolean;
  sociedades: { id: string; nombre: string }[];
  reglas: unknown[];
};

type Filters = {
  sociedad: string;
  desde: string;
  hasta: string;
  estado: '' | AsientoBorrador['estado'];
};

export function DiarioBorrador({ isPrivateMode, sociedades }: Props) {
  const [asientos, setAsientos] = useState<AsientoBorrador[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    sociedad: '',
    desde: '',
    hasta: '',
    estado: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAsientosBorrador(
        filters.sociedad || undefined,
        filters.desde || undefined,
        filters.hasta || undefined,
      );
      setAsientos(data);
    } catch {
      /* ignore */
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = (id: string) => {
    void updateAsientoBorrador(id, { estado: 'confirmado' });
    setAsientos((prev) => prev.map((a) => (a.id === id ? { ...a, estado: 'confirmado' } : a)));
  };

  const reject = (id: string) => {
    void updateAsientoBorrador(id, { estado: 'rechazado' });
    setAsientos((prev) => prev.map((a) => (a.id === id ? { ...a, estado: 'rechazado' } : a)));
  };

  const visible = filters.estado ? asientos.filter((a) => a.estado === filters.estado) : asientos;
  const borradoresCount = asientos.filter((a) => a.estado === 'borrador').length;
  const confirmadosCount = asientos.filter((a) => a.estado === 'confirmado').length;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Borrador', v: borradoresCount, c: 'text-zinc-400' },
          { label: 'Confirmados', v: confirmadosCount, c: 'text-emerald-400' },
          { label: 'Total', v: asientos.length, c: 'text-zinc-300' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-3">
            <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-600">
              {s.label}
            </p>
            <p className={`text-2xl font-semibold ${s.c}`}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 items-end gap-3 rounded-2xl border border-white/5 bg-zinc-900/40 p-4 xl:grid-cols-4">
        <div>
          <label className="field-label">Sociedad</label>
          <select
            value={filters.sociedad}
            onChange={(e) => setFilters((f) => ({ ...f, sociedad: e.target.value }))}
            className="field-input"
          >
            <option value="">Todas</option>
            {sociedades.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Estado</label>
          <select
            value={filters.estado}
            onChange={(e) =>
              setFilters((f) => ({ ...f, estado: e.target.value as Filters['estado'] }))
            }
            className="field-input"
          >
            <option value="">Todos</option>
            <option value="borrador">Borrador</option>
            <option value="confirmado">Confirmado</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </div>
        <div>
          <label className="field-label">Desde</label>
          <input
            type="date"
            value={filters.desde}
            onChange={(e) => setFilters((f) => ({ ...f, desde: e.target.value }))}
            className="field-input"
          />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="field-label">Hasta</label>
            <input
              type="date"
              value={filters.hasta}
              onChange={(e) => setFilters((f) => ({ ...f, hasta: e.target.value }))}
              className="field-input"
            />
          </div>
          <button
            onClick={() => {
              void load();
            }}
            className="shrink-0 rounded-xl border border-white/5 p-2.5 text-zinc-600 transition-all hover:border-white/10 hover:text-zinc-300"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={20} className="animate-spin text-zinc-600" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center text-zinc-600">
          <BookOpen size={32} className="opacity-30" />
          <p className="text-sm">No hay asientos. Se generan al importar movimientos.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((a) => (
            <AsientoRow
              key={a.id}
              asiento={a}
              isPrivateMode={isPrivateMode}
              onConfirm={confirm}
              onReject={reject}
            />
          ))}
        </div>
      )}

      <p className="text-right text-xs text-zinc-600">{visible.length} asientos</p>
    </div>
  );
}
