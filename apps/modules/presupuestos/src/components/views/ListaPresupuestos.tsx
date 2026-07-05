import { useEffect, useState } from 'react';
import { FolderOpen, PlusCircle, Trash2, Archive, Star } from 'lucide-react';
import type { Presupuesto } from '@alsari/types';
import { getPresupuestos, deletePresupuesto } from '../../lib/presupuestosApi';
import type { PresupuestosView } from '../PresupuestosSidebar';

const TIPO_LABEL: Record<string, string> = {
  obra: 'Obra',
  explotacion: 'Explotación',
  capex: 'CAPEX',
  corporativo: 'Corporativo',
  tesoreria: 'Tesorería',
};

const ESTADO_STYLES: Record<string, string> = {
  borrador: 'text-zinc-500 bg-zinc-800/60',
  activo: 'text-emerald-400 bg-emerald-500/10',
  cerrado: 'text-zinc-600 bg-zinc-900/60',
};

function fmt(n: number, priv: boolean) {
  if (priv) return '•••• €';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

type Props = {
  isPrivateMode: boolean;
  onNavigate: (v: PresupuestosView) => void;
  onSelectPresupuesto: (id: string) => void;
};

export function ListaPresupuestos({ isPrivateMode, onNavigate, onSelectPresupuesto }: Props) {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todos' | 'activo' | 'borrador' | 'cerrado'>('todos');

  useEffect(() => {
    getPresupuestos()
      .then(setPresupuestos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este presupuesto y todos sus capítulos, partidas y pagos?')) return;
    await deletePresupuesto(id).catch(() => {});
    setPresupuestos((prev) => prev.filter((p) => p.id !== id));
  }

  const filtered =
    filtro === 'todos' ? presupuestos : presupuestos.filter((p) => p.estado === filtro);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-zinc-600">Cargando...</div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-zinc-900/60 p-1">
          {(['todos', 'activo', 'borrador', 'cerrado'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                filtro === f
                  ? 'border border-white/10 bg-zinc-800 text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {f === 'todos' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={() => onNavigate('nuevo')}
          className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-600/20 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-600/30"
        >
          <PlusCircle size={14} /> Nuevo presupuesto
        </button>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
          <FolderOpen size={32} className="mx-auto mb-3 text-zinc-700" />
          <p className="text-sm font-semibold text-zinc-500">
            {filtro === 'todos'
              ? 'No hay presupuestos'
              : `No hay presupuestos en estado "${filtro}"`}
          </p>
          <button
            onClick={() => onNavigate('nuevo')}
            className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-600/20 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-600/30"
          >
            Crear presupuesto
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const total = p.importe_total ?? 0;
            const pagado = p.importe_pagado ?? 0;
            const pct = total > 0 ? Math.round((pagado / total) * 100) : 0;
            return (
              <div
                key={p.id}
                className="group flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-zinc-900/60 px-5 py-4 transition-all hover:border-white/[0.12] hover:bg-zinc-900/80"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800/60">
                  {p.estado === 'cerrado' ? (
                    <Archive size={15} className="text-zinc-600" />
                  ) : (
                    <FolderOpen size={15} className="text-emerald-400" />
                  )}
                </div>

                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onSelectPresupuesto(p.id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-white transition-colors group-hover:text-emerald-300">
                      {p.nombre}
                    </span>
                    <span
                      className={`text-2xs rounded-full px-2 py-0.5 font-semibold uppercase tracking-widest ${ESTADO_STYLES[p.estado]}`}
                    >
                      {TIPO_LABEL[p.tipo] ?? p.tipo}
                    </span>
                    {p.es_presupuesto_maestro && (
                      <span className="text-2xs flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-400">
                        <Star size={8} className="fill-current" /> Maestro
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                    {p.proyecto_nombre && <span>{p.proyecto_nombre}</span>}
                    {p.fecha_inicio && (
                      <span>
                        {new Date(p.fecha_inicio).toLocaleDateString('es-ES', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                    {total > 0 && <span>{fmt(total, isPrivateMode)}</span>}
                  </div>
                </button>

                {/* Barra progreso */}
                {total > 0 && (
                  <div className="hidden w-32 shrink-0 flex-col items-end gap-1 md:flex">
                    <span className="text-xs text-zinc-500">{pct}%</span>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Estado */}
                <span
                  className={`text-2xs hidden shrink-0 rounded-full px-2 py-1 font-semibold uppercase tracking-widest md:block ${ESTADO_STYLES[p.estado]}`}
                >
                  {p.estado}
                </span>

                {/* Eliminar */}
                <button
                  onClick={() => void handleDelete(p.id)}
                  className="shrink-0 rounded-lg p-1.5 text-zinc-700 opacity-0 transition-all hover:bg-rose-500/10 hover:text-rose-400 group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
