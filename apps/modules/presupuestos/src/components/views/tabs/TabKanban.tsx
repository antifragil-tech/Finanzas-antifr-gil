import { useEffect, useState } from 'react';
import { Plus, Trash2, X, Check, Calendar } from 'lucide-react';
import type { ProyectoTarea, TareaColumna, TareaCategoria } from '@alsari/types';
import { getTareas, createTarea, updateTarea, deleteTarea } from '../../../lib/proyectosApi';

const COLUMNAS: { id: TareaColumna; label: string; color: string; bg: string }[] = [
  {
    id: 'backlog',
    label: 'Backlog',
    color: 'text-zinc-400',
    bg: 'bg-zinc-800/30 border-zinc-700/30',
  },
  {
    id: 'todo',
    label: 'Por hacer',
    color: 'text-blue-400',
    bg: 'bg-blue-500/5 border-blue-500/15',
  },
  {
    id: 'doing',
    label: 'En curso',
    color: 'text-amber-400',
    bg: 'bg-amber-500/5 border-amber-500/15',
  },
  {
    id: 'on_hold',
    label: 'En espera',
    color: 'text-violet-400',
    bg: 'bg-violet-500/5 border-violet-500/15',
  },
  {
    id: 'done',
    label: 'Hecho',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/5 border-emerald-500/15',
  },
];

const CATEGORIAS: { id: TareaCategoria; label: string; color: string }[] = [
  { id: 'general', label: 'General', color: 'bg-zinc-700/50 text-zinc-400' },
  { id: 'obra', label: 'Obra', color: 'bg-orange-500/15 text-orange-400' },
  { id: 'legal', label: 'Legal', color: 'bg-blue-500/15 text-blue-400' },
  { id: 'financiero', label: 'Financiero', color: 'bg-emerald-500/15 text-emerald-400' },
];

function categoriaColor(cat: TareaCategoria): string {
  return CATEGORIAS.find((c) => c.id === cat)?.color ?? 'bg-zinc-700/50 text-zinc-400';
}

function fmtDate(d: string | null): string | null {
  if (!d) return null;
  const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (days < 0) return `Vencida hace ${Math.abs(days)}d`;
  if (days === 0) return 'Hoy';
  if (days <= 7) return `${days}d`;
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function dateColor(d: string | null): string {
  if (!d) return 'text-zinc-600';
  const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'text-rose-400';
  if (days <= 7) return 'text-amber-400';
  return 'text-zinc-500';
}

type NewTareaForm = { titulo: string; categoria: TareaCategoria; fecha_limite: string };

type Props = { proyectoId: string };

export function TabKanban({ proyectoId }: Props) {
  const [tareas, setTareas] = useState<ProyectoTarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingCol, setAddingCol] = useState<TareaColumna | null>(null);
  const [newTarea, setNewTarea] = useState<NewTareaForm>({
    titulo: '',
    categoria: 'general',
    fecha_limite: '',
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getTareas(proyectoId)
      .then(setTareas)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [proyectoId]);

  async function handleAddTarea() {
    if (!addingCol || !newTarea.titulo.trim()) return;
    const t = await createTarea({
      proyecto_id: proyectoId,
      titulo: newTarea.titulo.trim(),
      categoria: newTarea.categoria,
      columna: addingCol,
      ...(newTarea.fecha_limite && { fecha_limite: newTarea.fecha_limite }),
      orden: tareas.filter((t) => t.columna === addingCol).length,
    });
    setTareas((prev) => [...prev, t]);
    setNewTarea({ titulo: '', categoria: 'general', fecha_limite: '' });
    setAddingCol(null);
  }

  async function handleMove(tarea: ProyectoTarea, dir: 'prev' | 'next') {
    const idx = COLUMNAS.findIndex((c) => c.id === tarea.columna);
    const nextIdx = dir === 'next' ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= COLUMNAS.length) return;
    const nextCol = COLUMNAS[nextIdx]!.id;
    await updateTarea(tarea.id, { columna: nextCol }).catch(() => {});
    setTareas((prev) => prev.map((t) => (t.id === tarea.id ? { ...t, columna: nextCol } : t)));
  }

  async function handleDelete(id: string) {
    await deleteTarea(id).catch(() => {});
    setTareas((prev) => prev.filter((t) => t.id !== id));
    setDeletingId(null);
  }

  if (loading)
    return (
      <div className="flex h-40 items-center justify-center text-sm text-zinc-600">Cargando...</div>
    );

  const total = tareas.length;
  const done = tareas.filter((t) => t.columna === 'done').length;

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Tablero de tareas</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {done}/{total} completadas
          </p>
        </div>
      </div>

      {/* Kanban columns */}
      <div className="grid min-h-[400px] grid-cols-5 gap-3">
        {COLUMNAS.map((col, colIdx) => {
          const colTareas = tareas.filter((t) => t.columna === col.id);
          return (
            <div
              key={col.id}
              className={`flex flex-col rounded-xl border ${col.bg} min-h-[300px] p-2`}
            >
              {/* Column header */}
              <div className="mb-2 flex shrink-0 items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <span className={`text-2xs font-semibold uppercase tracking-widest ${col.color}`}>
                    {col.label}
                  </span>
                  <span className="text-2xs rounded-full bg-zinc-800/50 px-1.5 font-medium text-zinc-600">
                    {colTareas.length}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setAddingCol(col.id);
                    setNewTarea({ titulo: '', categoria: 'general', fecha_limite: '' });
                  }}
                  className={`${col.color} opacity-60 transition-opacity hover:opacity-100`}
                >
                  <Plus size={12} />
                </button>
              </div>

              {/* Add form */}
              {addingCol === col.id && (
                <div className="mb-2 space-y-1.5 rounded-lg border border-white/[0.08] bg-zinc-900/80 p-2">
                  <input
                    autoFocus
                    value={newTarea.titulo}
                    onChange={(e) => setNewTarea((p) => ({ ...p, titulo: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleAddTarea();
                      if (e.key === 'Escape') setAddingCol(null);
                    }}
                    placeholder="Tarea..."
                    className="w-full bg-transparent text-xs text-white placeholder-zinc-600 outline-none"
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <select
                      value={newTarea.categoria}
                      onChange={(e) =>
                        setNewTarea((p) => ({ ...p, categoria: e.target.value as TareaCategoria }))
                      }
                      className="text-2xs rounded border border-white/[0.06] bg-zinc-800 px-1.5 py-0.5 text-zinc-400 outline-none"
                    >
                      {CATEGORIAS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={newTarea.fecha_limite}
                      onChange={(e) => setNewTarea((p) => ({ ...p, fecha_limite: e.target.value }))}
                      className="text-2xs rounded border border-white/[0.06] bg-zinc-800 px-1.5 py-0.5 text-zinc-400 outline-none"
                    />
                    <button
                      onClick={() => void handleAddTarea()}
                      className="ml-auto text-emerald-400"
                    >
                      <Check size={12} />
                    </button>
                    <button onClick={() => setAddingCol(null)} className="text-zinc-600">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )}

              {/* Cards */}
              <div className="flex flex-1 flex-col gap-1.5">
                {colTareas.map((tarea) => {
                  const dateStr = fmtDate(tarea.fecha_limite);
                  const isDeleting = deletingId === tarea.id;
                  return (
                    <div
                      key={tarea.id}
                      className="group rounded-lg border border-white/[0.06] bg-zinc-900/80 p-2.5 transition-all hover:border-white/[0.12]"
                    >
                      {isDeleting ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-2xs flex-1 text-zinc-500">¿Eliminar?</span>
                          <button
                            onClick={() => void handleDelete(tarea.id)}
                            className="text-2xs font-medium text-rose-400"
                          >
                            Sí
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="text-2xs text-zinc-600"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="mb-1.5 text-xs font-medium leading-snug text-white">
                            {tarea.titulo}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`text-2xs rounded px-1.5 py-0.5 font-medium uppercase tracking-wider ${categoriaColor(tarea.categoria)}`}
                            >
                              {tarea.categoria}
                            </span>
                            {dateStr && (
                              <div
                                className={`flex items-center gap-0.5 ${dateColor(tarea.fecha_limite)}`}
                              >
                                <Calendar size={9} />
                                <span className="text-2xs">{dateStr}</span>
                              </div>
                            )}
                          </div>
                          {/* Move / delete controls */}
                          <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            {colIdx > 0 && (
                              <button
                                onClick={() => void handleMove(tarea, 'prev')}
                                className="text-2xs rounded bg-zinc-800/50 px-1 py-0.5 text-zinc-600 hover:text-zinc-300"
                              >
                                ←
                              </button>
                            )}
                            {colIdx < COLUMNAS.length - 1 && (
                              <button
                                onClick={() => void handleMove(tarea, 'next')}
                                className="text-2xs rounded bg-zinc-800/50 px-1 py-0.5 text-zinc-600 hover:text-zinc-300"
                              >
                                →
                              </button>
                            )}
                            <button
                              onClick={() => setDeletingId(tarea.id)}
                              className="ml-auto text-zinc-700 transition-colors hover:text-rose-400"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
