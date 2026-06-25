import { useEffect, useState } from 'react';
import { FolderOpen, PlusCircle, Trash2, Archive, Star } from 'lucide-react';
import type { Presupuesto } from '@alsari/types';
import { getPresupuestos, deletePresupuesto } from '../../lib/presupuestosApi';
import type { PresupuestosView } from '../PresupuestosSidebar';

const TIPO_LABEL: Record<string, string> = {
  obra: 'Obra', explotacion: 'Explotación', capex: 'CAPEX',
  corporativo: 'Corporativo', tesoreria: 'Tesorería',
};

const ESTADO_STYLES: Record<string, string> = {
  borrador: 'text-zinc-500 bg-zinc-800/60',
  activo:   'text-emerald-400 bg-emerald-500/10',
  cerrado:  'text-zinc-600 bg-zinc-900/60',
};

function fmt(n: number, priv: boolean) {
  if (priv) return '•••• €';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

type Props = {
  isPrivateMode: boolean;
  onNavigate: (v: PresupuestosView) => void;
  onSelectPresupuesto: (id: string) => void;
};

export function ListaPresupuestos({ isPrivateMode, onNavigate, onSelectPresupuesto }: Props) {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [filtro,       setFiltro]       = useState<'todos' | 'activo' | 'borrador' | 'cerrado'>('todos');

  useEffect(() => {
    getPresupuestos()
      .then(setPresupuestos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este presupuesto y todos sus capítulos, partidas y pagos?')) return;
    await deletePresupuesto(id).catch(() => {});
    setPresupuestos(prev => prev.filter(p => p.id !== id));
  }

  const filtered = filtro === 'todos'
    ? presupuestos
    : presupuestos.filter(p => p.estado === filtro);

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">Cargando...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-zinc-900/60 border border-white/[0.06] rounded-xl p-1">
          {(['todos','activo','borrador','cerrado'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                filtro === f
                  ? 'bg-zinc-800 border border-white/10 text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {f === 'todos' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={() => onNavigate('nuevo')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-600/30 transition-colors"
        >
          <PlusCircle size={14} /> Nuevo presupuesto
        </button>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl">
          <FolderOpen size={32} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm font-semibold">
            {filtro === 'todos' ? 'No hay presupuestos' : `No hay presupuestos en estado "${filtro}"`}
          </p>
          <button
            onClick={() => onNavigate('nuevo')}
            className="mt-4 px-4 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-600/30 transition-colors"
          >
            Crear presupuesto
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const total  = p.importe_total  ?? 0;
            const pagado = p.importe_pagado ?? 0;
            const pct    = total > 0 ? Math.round((pagado / total) * 100) : 0;
            return (
              <div
                key={p.id}
                className="flex items-center gap-4 px-5 py-4 bg-zinc-900/60 border border-white/[0.06] rounded-2xl hover:border-white/[0.12] hover:bg-zinc-900/80 transition-all group"
              >
                <div className="w-9 h-9 rounded-xl bg-zinc-800/60 flex items-center justify-center shrink-0">
                  {p.estado === 'cerrado'
                    ? <Archive size={15} className="text-zinc-600" />
                    : <FolderOpen size={15} className="text-emerald-400" />
                  }
                </div>

                <button
                  className="flex-1 min-w-0 text-left"
                  onClick={() => onSelectPresupuesto(p.id)}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white group-hover:text-emerald-300 transition-colors">
                      {p.nombre}
                    </span>
                    <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-widest ${ESTADO_STYLES[p.estado]}`}>
                      {TIPO_LABEL[p.tipo] ?? p.tipo}
                    </span>
                    {p.es_presupuesto_maestro && (
                      <span className="flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Star size={8} className="fill-current" /> Maestro
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                    {p.proyecto_nombre && <span>{p.proyecto_nombre}</span>}
                    {p.fecha_inicio && <span>{new Date(p.fecha_inicio).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}</span>}
                    {total > 0 && <span>{fmt(total, isPrivateMode)}</span>}
                  </div>
                </button>

                {/* Barra progreso */}
                {total > 0 && (
                  <div className="hidden md:flex flex-col items-end gap-1 w-32 shrink-0">
                    <span className="text-xs text-zinc-500">{pct}%</span>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}

                {/* Estado */}
                <span className={`hidden md:block text-2xs font-semibold px-2 py-1 rounded-full uppercase tracking-widest shrink-0 ${ESTADO_STYLES[p.estado]}`}>
                  {p.estado}
                </span>

                {/* Eliminar */}
                <button
                  onClick={() => void handleDelete(p.id)}
                  className="shrink-0 p-1.5 rounded-lg text-zinc-700 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
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
