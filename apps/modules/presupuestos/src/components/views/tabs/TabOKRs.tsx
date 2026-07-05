import { useEffect, useState } from 'react';
import {
  Target,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  X,
  Check,
} from 'lucide-react';
import type { ProyectoObjetivo, ProyectoKR, KRUnidad } from '@alsari/types';
import {
  getObjetivos,
  createObjetivo,
  updateObjetivo,
  deleteObjetivo,
  getKRsByProyecto,
  createKR,
  updateKR,
  deleteKR,
} from '../../../lib/proyectosApi';

function krProgress(kr: ProyectoKR): number {
  if (kr.completado) return 100;
  if (kr.unidad === 'booleano') return 0;
  if (!kr.valor_objetivo || kr.valor_objetivo === 0) return 0;
  return Math.min(Math.round((kr.valor_actual / kr.valor_objetivo) * 100), 100);
}

function objetivoProgress(krs: ProyectoKR[]): number {
  if (krs.length === 0) return 0;
  return Math.round(krs.reduce((s, kr) => s + krProgress(kr), 0) / krs.length);
}

function fmtKRValue(kr: ProyectoKR): string {
  if (kr.unidad === 'booleano') return kr.completado ? 'Completado' : 'Pendiente';
  if (kr.unidad === 'porcentaje') return `${kr.valor_actual}% / ${kr.valor_objetivo ?? '?'}%`;
  if (kr.unidad === 'euros') {
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(n);
    return `${fmt(kr.valor_actual)} / ${kr.valor_objetivo != null ? fmt(kr.valor_objetivo) : '?'}`;
  }
  if (kr.unidad === 'fecha') return `${kr.valor_actual} / objetivo: ${kr.valor_objetivo ?? '?'}`;
  return `${kr.valor_actual} / ${kr.valor_objetivo ?? '?'}`;
}

const UNIDADES: { value: KRUnidad; label: string }[] = [
  { value: 'porcentaje', label: '%' },
  { value: 'euros', label: '€' },
  { value: 'numero', label: 'Número' },
  { value: 'booleano', label: 'Sí/No' },
  { value: 'fecha', label: 'Fecha' },
];

type Props = { proyectoId: string };

export function TabOKRs({ proyectoId }: Props) {
  const [objetivos, setObjetivos] = useState<ProyectoObjetivo[]>([]);
  const [krs, setKRs] = useState<ProyectoKR[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [newObjTitulo, setNewObjTitulo] = useState('');
  const [addingObj, setAddingObj] = useState(false);
  const [addingKR, setAddingKR] = useState<string | null>(null); // objetivo_id
  const [newKR, setNewKR] = useState({
    titulo: '',
    unidad: 'porcentaje' as KRUnidad,
    valor_objetivo: '',
  });
  const [editingKR, setEditingKR] = useState<string | null>(null);
  const [editKRVal, setEditKRVal] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([getObjetivos(proyectoId), getKRsByProyecto(proyectoId)])
      .then(([objs, ks]) => {
        setObjetivos(objs);
        setKRs(ks);
        setExpanded(new Set(objs.map((o) => o.id)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [proyectoId]);

  async function handleAddObjetivo() {
    if (!newObjTitulo.trim()) return;
    const obj = await createObjetivo({
      proyecto_id: proyectoId,
      titulo: newObjTitulo.trim(),
      orden: objetivos.length,
    });
    setObjetivos((prev) => [...prev, obj]);
    setExpanded((prev) => new Set([...prev, obj.id]));
    setNewObjTitulo('');
    setAddingObj(false);
  }

  async function handleDeleteObjetivo(id: string) {
    await deleteObjetivo(id).catch(() => {});
    setObjetivos((prev) => prev.filter((o) => o.id !== id));
    setKRs((prev) => prev.filter((k) => k.objetivo_id !== id));
  }

  async function handleAddKR() {
    if (!addingKR || !newKR.titulo.trim()) return;
    const obj = objetivos.find((o) => o.id === addingKR);
    if (!obj) return;
    const kr = await createKR({
      objetivo_id: addingKR,
      proyecto_id: proyectoId,
      titulo: newKR.titulo.trim(),
      unidad: newKR.unidad,
      ...(newKR.valor_objetivo && { valor_objetivo: Number(newKR.valor_objetivo) }),
      orden: krs.filter((k) => k.objetivo_id === addingKR).length,
    });
    setKRs((prev) => [...prev, kr]);
    setNewKR({ titulo: '', unidad: 'porcentaje', valor_objetivo: '' });
    setAddingKR(null);
  }

  async function handleToggleKR(kr: ProyectoKR) {
    const next = !kr.completado;
    await updateKR(kr.id, { completado: next }).catch(() => {});
    setKRs((prev) => prev.map((k) => (k.id === kr.id ? { ...k, completado: next } : k)));
  }

  async function handleUpdateKRValue(kr: ProyectoKR) {
    const val = Number(editKRVal);
    await updateKR(kr.id, { valor_actual: val }).catch(() => {});
    setKRs((prev) => prev.map((k) => (k.id === kr.id ? { ...k, valor_actual: val } : k)));
    setEditingKR(null);
  }

  async function handleDeleteKR(id: string) {
    await deleteKR(id).catch(() => {});
    setKRs((prev) => prev.filter((k) => k.id !== id));
  }

  async function handleToggleEstadoObj(obj: ProyectoObjetivo) {
    const next = obj.estado === 'completado' ? 'activo' : 'completado';
    await updateObjetivo(obj.id, { estado: next }).catch(() => {});
    setObjetivos((prev) => prev.map((o) => (o.id === obj.id ? { ...o, estado: next } : o)));
  }

  if (loading)
    return (
      <div className="flex h-40 items-center justify-center text-sm text-zinc-600">Cargando...</div>
    );

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Objetivos y KRs</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {objetivos.length} objetivos · {krs.length} key results
          </p>
        </div>
        <button
          onClick={() => setAddingObj(true)}
          className="flex items-center gap-1.5 rounded-lg border border-blue-500/25 bg-blue-600/15 px-3 py-1.5 text-xs font-medium text-blue-300 transition-all hover:bg-blue-600/25"
        >
          <Plus size={12} /> Nuevo objetivo
        </button>
      </div>

      {/* Form nuevo objetivo */}
      {addingObj && (
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-zinc-900/60 p-3">
          <input
            autoFocus
            value={newObjTitulo}
            onChange={(e) => setNewObjTitulo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleAddObjetivo();
              if (e.key === 'Escape') setAddingObj(false);
            }}
            placeholder="Título del objetivo..."
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none"
          />
          <button
            onClick={() => void handleAddObjetivo()}
            className="p-1 text-emerald-400 hover:text-emerald-300"
          >
            <Check size={14} />
          </button>
          <button
            onClick={() => setAddingObj(false)}
            className="p-1 text-zinc-600 hover:text-zinc-400"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Empty state */}
      {objetivos.length === 0 && !addingObj && (
        <div className="rounded-2xl border border-dashed border-white/[0.08] py-16 text-center">
          <Target size={32} className="mx-auto mb-3 text-zinc-700" />
          <p className="text-sm font-semibold text-zinc-500">Sin objetivos definidos</p>
          <p className="mt-1 text-xs text-zinc-600">
            Define qué quieres conseguir con este proyecto
          </p>
        </div>
      )}

      {/* Lista objetivos */}
      {objetivos.map((obj) => {
        const objKRs = krs.filter((k) => k.objetivo_id === obj.id);
        const pct = objetivoProgress(objKRs);
        const isExp = expanded.has(obj.id);

        return (
          <div
            key={obj.id}
            className="overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-900/50"
          >
            {/* Objetivo header */}
            <div className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => handleToggleEstadoObj(obj)} className="shrink-0">
                {obj.estado === 'completado' ? (
                  <CheckCircle2 size={16} className="text-emerald-400" />
                ) : (
                  <Circle size={16} className="text-zinc-600 hover:text-zinc-400" />
                )}
              </button>

              <button
                className="flex flex-1 items-center gap-2 text-left"
                onClick={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(obj.id)) next.delete(obj.id);
                    else next.add(obj.id);
                    return next;
                  })
                }
              >
                <span
                  className={`flex-1 text-sm font-medium ${obj.estado === 'completado' ? 'text-zinc-500 line-through' : 'text-white'}`}
                >
                  {obj.titulo}
                </span>
                <span className="text-xs font-semibold text-zinc-400">{pct}%</span>
                {isExp ? (
                  <ChevronDown size={13} className="text-zinc-600" />
                ) : (
                  <ChevronRight size={13} className="text-zinc-600" />
                )}
              </button>

              {/* Mini progress bar */}
              <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <button
                onClick={() => handleDeleteObjetivo(obj.id)}
                className="shrink-0 text-zinc-700 transition-colors hover:text-rose-400"
              >
                <Trash2 size={13} />
              </button>
            </div>

            {/* KRs */}
            {isExp && (
              <div className="space-y-1 border-t border-white/[0.05] px-4 py-2">
                {objKRs.map((kr) => {
                  const kpct = krProgress(kr);
                  return (
                    <div key={kr.id} className="group flex items-center gap-3 py-1.5">
                      <button
                        onClick={() => kr.unidad === 'booleano' && void handleToggleKR(kr)}
                        className="shrink-0"
                      >
                        {kr.completado ? (
                          <CheckCircle2 size={13} className="text-emerald-400" />
                        ) : (
                          <Circle size={13} className="text-zinc-700 hover:text-zinc-500" />
                        )}
                      </button>

                      <span
                        className={`flex-1 text-xs ${kr.completado ? 'text-zinc-600 line-through' : 'text-zinc-300'}`}
                      >
                        {kr.titulo}
                      </span>

                      {/* Valor editable */}
                      {editingKR === kr.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            value={editKRVal}
                            onChange={(e) => setEditKRVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void handleUpdateKRValue(kr);
                              if (e.key === 'Escape') setEditingKR(null);
                            }}
                            className="w-20 rounded border border-white/10 bg-zinc-800 px-2 py-0.5 text-xs text-white outline-none"
                          />
                          <button
                            onClick={() => void handleUpdateKRValue(kr)}
                            className="text-emerald-400"
                          >
                            <Check size={12} />
                          </button>
                          <button onClick={() => setEditingKR(null)} className="text-zinc-600">
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingKR(kr.id);
                            setEditKRVal(String(kr.valor_actual));
                          }}
                          className="text-2xs font-mono text-zinc-500 hover:text-zinc-300"
                        >
                          {fmtKRValue(kr)}
                        </button>
                      )}

                      {/* Mini bar */}
                      <div className="h-1 w-12 shrink-0 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className={`h-full rounded-full ${kpct === 100 ? 'bg-emerald-500' : 'bg-blue-500/60'}`}
                          style={{ width: `${kpct}%` }}
                        />
                      </div>

                      <button
                        onClick={() => void handleDeleteKR(kr.id)}
                        className="shrink-0 text-zinc-800 transition-colors hover:!text-rose-400 group-hover:text-zinc-600"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })}

                {/* Form nuevo KR */}
                {addingKR === obj.id ? (
                  <div className="mt-2 flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-zinc-800/40 p-2">
                    <input
                      autoFocus
                      value={newKR.titulo}
                      onChange={(e) => setNewKR((p) => ({ ...p, titulo: e.target.value }))}
                      placeholder="Key result..."
                      className="bg-transparent text-xs text-white placeholder-zinc-600 outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <select
                        value={newKR.unidad}
                        onChange={(e) =>
                          setNewKR((p) => ({ ...p, unidad: e.target.value as KRUnidad }))
                        }
                        className="rounded border border-white/[0.08] bg-zinc-800 px-2 py-1 text-xs text-zinc-300 outline-none"
                      >
                        {UNIDADES.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                      {newKR.unidad !== 'booleano' && (
                        <input
                          value={newKR.valor_objetivo}
                          onChange={(e) =>
                            setNewKR((p) => ({ ...p, valor_objetivo: e.target.value }))
                          }
                          placeholder="Target"
                          type="number"
                          className="w-20 rounded border border-white/[0.08] bg-zinc-800 px-2 py-1 text-xs text-zinc-300 outline-none"
                        />
                      )}
                      <button
                        onClick={() => void handleAddKR()}
                        className="ml-auto text-emerald-400 hover:text-emerald-300"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        onClick={() => setAddingKR(null)}
                        className="text-zinc-600 hover:text-zinc-400"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingKR(obj.id)}
                    className="text-2xs mt-1 flex items-center gap-1.5 text-zinc-600 transition-colors hover:text-zinc-400"
                  >
                    <Plus size={11} /> Añadir key result
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
