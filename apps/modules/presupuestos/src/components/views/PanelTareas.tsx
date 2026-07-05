import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CheckSquare,
  AlertTriangle,
  Plus,
  X,
  Check,
  Calendar,
  ChevronDown,
  ChevronRight,
  Trash2,
  ArrowRight,
  GripVertical,
  Pencil,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ProyectoTarea, TareaColumna, TareaCategoria, TareaRecurrencia } from '@alsari/types';
import { getAllTareas, createTarea, updateTarea, deleteTarea } from '../../lib/proyectosApi';
import type { ProyectoRow } from '../../lib/proyectosApi';

const ORDER_KEY = 'alsari-panel-tareas-project-order';

function loadOrder(): string[] {
  try {
    return JSON.parse(localStorage.getItem(ORDER_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function saveOrder(ids: string[]) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
}

// ── Columnas Kanban (sin backlog en vista global) ──────────────────────────────

const COLUMNAS: { id: TareaColumna; label: string; color: string; bg: string; dot: string }[] = [
  {
    id: 'todo',
    label: 'Por hacer',
    color: 'text-blue-400',
    bg: 'bg-blue-500/5 border-blue-500/15',
    dot: 'bg-blue-500',
  },
  {
    id: 'doing',
    label: 'En curso',
    color: 'text-amber-400',
    bg: 'bg-amber-500/5 border-amber-500/15',
    dot: 'bg-amber-400 animate-pulse',
  },
  {
    id: 'on_hold',
    label: 'En espera',
    color: 'text-violet-400',
    bg: 'bg-violet-500/5 border-violet-500/15',
    dot: 'bg-violet-500',
  },
  {
    id: 'done',
    label: 'Hecho',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/5 border-emerald-500/15',
    dot: 'bg-emerald-500',
  },
];

const CATEGORIAS: { id: TareaCategoria; label: string; color: string }[] = [
  { id: 'general', label: 'General', color: 'bg-zinc-700/50 text-zinc-400' },
  { id: 'obra', label: 'Obra', color: 'bg-orange-500/15 text-orange-400' },
  { id: 'legal', label: 'Legal', color: 'bg-blue-500/15 text-blue-400' },
  { id: 'financiero', label: 'Financiero', color: 'bg-emerald-500/15 text-emerald-400' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function catColor(cat: TareaCategoria) {
  return CATEGORIAS.find((c) => c.id === cat)?.color ?? 'bg-zinc-700/50 text-zinc-400';
}

function fmtDate(d: string | null) {
  if (!d) return null;
  const days = Math.ceil((new Date(d + 'T00:00:00').getTime() - Date.now()) / 86400000);
  if (days < 0) return `Vencida ${Math.abs(days)}d`;
  if (days === 0) return 'Hoy';
  if (days <= 7) return `${days}d`;
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function dateColor(d: string | null) {
  if (!d) return 'text-zinc-600';
  const days = Math.ceil((new Date(d + 'T00:00:00').getTime() - Date.now()) / 86400000);
  if (days < 0) return 'text-rose-400';
  if (days <= 7) return 'text-amber-400';
  return 'text-zinc-500';
}

// ── Recurrencia ───────────────────────────────────────────────────────────────

const RECURRENCIAS: { id: TareaRecurrencia; label: string }[] = [
  { id: 'diaria', label: 'Diaria' },
  { id: 'semanal', label: 'Semanal' },
  { id: 'quincenal', label: 'Quincenal' },
  { id: 'mensual', label: 'Mensual' },
  { id: 'trimestral', label: 'Trimestral' },
  { id: 'anual', label: 'Anual' },
];

const RECURRENCIA_DIAS: Record<TareaRecurrencia, number> = {
  diaria: 1,
  semanal: 7,
  quincenal: 14,
  mensual: 30,
  trimestral: 91,
  anual: 365,
};

function nextFecha(base: string | null, recurrencia: TareaRecurrencia): string {
  const d = base ? new Date(base + 'T00:00:00') : new Date();
  d.setDate(d.getDate() + RECURRENCIA_DIAS[recurrencia]);
  return d.toISOString().slice(0, 10);
}

function isOverdue(t: ProyectoTarea) {
  return (
    t.columna !== 'done' && t.fecha_limite && new Date(t.fecha_limite + 'T00:00:00') < new Date()
  );
}

// ── Empty form ────────────────────────────────────────────────────────────────

const EMPTY: {
  titulo: string;
  categoria: TareaCategoria;
  fecha_limite: string;
  columna: TareaColumna;
} = {
  titulo: '',
  categoria: 'general',
  fecha_limite: '',
  columna: 'todo',
};

// ── Inline add form dentro de una columna ─────────────────────────────────────

function InlineAddForm({
  onAdd,
  onCancel,
}: {
  onAdd: (titulo: string, categoria: TareaCategoria, fecha_limite: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState<TareaCategoria>('general');
  const [fecha, setFecha] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!titulo.trim()) return;
    setSaving(true);
    await onAdd(titulo.trim(), categoria, fecha);
    setSaving(false);
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-white/[0.1] bg-zinc-900/90 p-2">
      <input
        autoFocus
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Nombre de la tarea..."
        className="w-full bg-transparent text-xs text-white placeholder-zinc-600 outline-none"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as TareaCategoria)}
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
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="text-2xs rounded border border-white/[0.06] bg-zinc-800 px-1.5 py-0.5 text-zinc-400 outline-none"
        />
        <button
          onClick={() => void submit()}
          disabled={saving || !titulo.trim()}
          className="ml-auto text-emerald-400 disabled:opacity-40"
        >
          <Check size={12} />
        </button>
        <button onClick={onCancel} className="text-zinc-600 hover:text-zinc-400">
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Tarjeta arrastrable ───────────────────────────────────────────────────────

function DraggableTaskCard({
  tarea,
  onDelete,
  onEdit,
  ghost = false,
}: {
  tarea: ProyectoTarea;
  onDelete: (id: string) => void;
  onEdit: (
    id: string,
    data: {
      titulo: string;
      categoria: TareaCategoria;
      fecha_limite: string;
      descripcion: string;
      recurrencia: TareaRecurrencia | '';
    },
  ) => Promise<void>;
  ghost?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: tarea.id,
  });
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view');
  const [editTitulo, setEditTitulo] = useState(tarea.titulo);
  const [editCategoria, setEditCategoria] = useState<TareaCategoria>(tarea.categoria);
  const [editFecha, setEditFecha] = useState(tarea.fecha_limite ?? '');
  const [editDesc, setEditDesc] = useState(tarea.descripcion ?? '');
  const [editRecurr, setEditRecurr] = useState<TareaRecurrencia | ''>(tarea.recurrencia ?? '');
  const [saving, setSaving] = useState(false);

  function openEdit() {
    setEditTitulo(tarea.titulo);
    setEditCategoria(tarea.categoria);
    setEditFecha(tarea.fecha_limite ?? '');
    setEditDesc(tarea.descripcion ?? '');
    setEditRecurr(tarea.recurrencia ?? '');
    setMode('edit');
  }

  async function saveEdit() {
    if (!editTitulo.trim()) return;
    setSaving(true);
    await onEdit(tarea.id, {
      titulo: editTitulo.trim(),
      categoria: editCategoria,
      fecha_limite: editFecha,
      descripcion: editDesc,
      recurrencia: editRecurr,
    });
    setSaving(false);
    setMode('view');
  }

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const overdue = isOverdue(tarea);
  const dateStr = fmtDate(tarea.fecha_limite);
  const hasDesc = !ghost && !!tarea.descripcion;

  if (mode === 'edit') {
    return (
      <div className="space-y-1.5 rounded-lg border border-blue-500/30 bg-zinc-900/90 p-2.5">
        <input
          autoFocus
          value={editTitulo}
          onChange={(e) => setEditTitulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setMode('view');
          }}
          placeholder="Título"
          className="w-full bg-transparent text-xs font-medium text-white outline-none"
        />
        <textarea
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          placeholder="Descripción / comentario (opcional)"
          rows={2}
          className="text-2xs w-full resize-none rounded border border-white/[0.06] bg-zinc-800/60 px-1.5 py-1 text-zinc-400 placeholder-zinc-600 outline-none"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={editCategoria}
            onChange={(e) => setEditCategoria(e.target.value as TareaCategoria)}
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
            value={editFecha}
            onChange={(e) => setEditFecha(e.target.value)}
            className="text-2xs rounded border border-white/[0.06] bg-zinc-800 px-1.5 py-0.5 text-zinc-400 outline-none"
          />
          <select
            value={editRecurr}
            onChange={(e) => setEditRecurr(e.target.value as TareaRecurrencia | '')}
            className="text-2xs rounded border border-white/[0.06] bg-zinc-800 px-1.5 py-0.5 text-zinc-400 outline-none"
          >
            <option value="">Sin recurrencia</option>
            {RECURRENCIAS.map((r) => (
              <option key={r.id} value={r.id}>
                ↻ {r.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => void saveEdit()}
            disabled={saving || !editTitulo.trim()}
            className="ml-auto text-emerald-400 disabled:opacity-40"
          >
            <Check size={12} />
          </button>
          <button onClick={() => setMode('view')} className="text-zinc-600 hover:text-zinc-400">
            <X size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative select-none rounded-lg border bg-zinc-900/80 p-2.5 transition-colors ${
        ghost
          ? 'opacity-95 shadow-2xl ring-1 ring-blue-500/40'
          : isDragging
            ? 'opacity-0'
            : overdue
              ? 'border-rose-500/30 bg-rose-500/5'
              : 'border-white/[0.06] hover:border-white/[0.12]'
      }`}
    >
      {/* Tooltip descripción */}
      {hasDesc && (
        <div className="text-2xs pointer-events-none absolute bottom-full left-0 z-50 mb-1.5 w-56 rounded-lg border border-white/[0.1] bg-zinc-800 px-3 py-2 leading-relaxed text-zinc-300 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
          {tarea.descripcion}
          <div className="absolute left-3 top-full -mt-1 h-2 w-2 rotate-45 border-b border-r border-white/[0.1] bg-zinc-800" />
        </div>
      )}
      {mode === 'delete' ? (
        <div className="flex items-center gap-1.5">
          <span className="text-2xs flex-1 text-zinc-500">¿Eliminar?</span>
          <button onClick={() => onDelete(tarea.id)} className="text-2xs font-medium text-rose-400">
            Sí
          </button>
          <button onClick={() => setMode('view')} className="text-2xs text-zinc-600">
            No
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-1.5">
            <span
              {...attributes}
              {...listeners}
              className="mt-0.5 shrink-0 cursor-grab touch-none text-zinc-700 hover:text-zinc-500 active:cursor-grabbing"
            >
              <GripVertical size={11} />
            </span>
            <p className="flex-1 text-xs font-medium leading-snug text-white">{tarea.titulo}</p>
          </div>
          <div className="ml-4 mt-1.5 flex flex-wrap items-center gap-1">
            <span
              className={`text-2xs rounded px-1.5 py-0.5 font-medium uppercase tracking-wider ${catColor(tarea.categoria)}`}
            >
              {tarea.categoria}
            </span>
            {dateStr && (
              <div className={`flex items-center gap-0.5 ${dateColor(tarea.fecha_limite)}`}>
                <Calendar size={9} />
                <span className="text-2xs">{dateStr}</span>
              </div>
            )}
            {tarea.recurrencia && (
              <span className="text-2xs rounded bg-indigo-500/10 px-1.5 py-0.5 font-medium text-indigo-400">
                ↻ {RECURRENCIAS.find((r) => r.id === tarea.recurrencia)?.label}
              </span>
            )}
            {!ghost && (
              <div className="ml-auto flex items-center gap-1 opacity-0 transition-all group-hover:opacity-100">
                <button
                  onClick={openEdit}
                  className="text-zinc-600 transition-colors hover:text-blue-400"
                >
                  <Pencil size={10} />
                </button>
                <button
                  onClick={() => setMode('delete')}
                  className="text-zinc-600 transition-colors hover:text-rose-400"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Columna Kanban (droppable) ────────────────────────────────────────────────

function KanbanColumn({
  col,
  tareas,
  activeId,
  onDelete,
  onEdit,
  onAdd,
}: {
  col: (typeof COLUMNAS)[number];
  tareas: ProyectoTarea[];
  activeId: string | null;
  onDelete: (id: string) => void;
  onEdit: (
    id: string,
    data: {
      titulo: string;
      categoria: TareaCategoria;
      fecha_limite: string;
      descripcion: string;
      recurrencia: TareaRecurrencia | '';
    },
  ) => Promise<void>;
  onAdd: (titulo: string, cat: TareaCategoria, fecha: string) => Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  const [adding, setAdding] = useState(false);
  // "Hecho" arranca colapsado; el resto visible
  const [expanded, setExpanded] = useState(col.id !== 'done');

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border p-2 transition-colors ${
        col.id === 'done' ? 'min-h-[48px]' : 'min-h-[200px]'
      } ${
        isOver && activeId
          ? `${col.bg} ring-1 ring-inset ${col.color.replace('text-', 'ring-')}/40`
          : col.bg
      }`}
    >
      {/* Cabecera */}
      <div className="mb-2 flex shrink-0 items-center justify-between px-1">
        <button
          onClick={() => col.id === 'done' && setExpanded((v) => !v)}
          className={`flex items-center gap-1.5 ${col.id === 'done' ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <div className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
          <span className={`text-2xs font-semibold uppercase tracking-widest ${col.color}`}>
            {col.label}
          </span>
          <span className="text-2xs rounded-full bg-zinc-800/50 px-1.5 font-medium text-zinc-600">
            {tareas.length}
          </span>
          {col.id === 'done' && tareas.length > 0 && (
            <ChevronDown
              size={10}
              className={`text-zinc-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          )}
        </button>
        <button
          onClick={() => setAdding(true)}
          className={`${col.color} opacity-50 transition-opacity hover:opacity-100`}
        >
          <Plus size={11} />
        </button>
      </div>

      {/* Formulario inline */}
      {adding && (
        <div className="mb-1.5">
          <InlineAddForm
            onAdd={async (t, c, f) => {
              await onAdd(t, c, f);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {/* Tarjetas — siempre visibles excepto en columna "done" cuando está colapsada */}
      {(col.id !== 'done' || expanded) && (
        <div className="flex flex-1 flex-col gap-1.5">
          {tareas.map((tarea) => (
            <DraggableTaskCard key={tarea.id} tarea={tarea} onDelete={onDelete} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Kanban de un proyecto (DndContext propio para DnD entre columnas) ─────────

function ProjectKanbanBoard({
  proyectoId,
  tareas,
  filterCat,
  onColumnChange,
  onDelete,
  onEdit,
  onAdd,
}: {
  proyectoId: string;
  tareas: ProyectoTarea[];
  filterCat: TareaCategoria | 'all';
  onColumnChange: (tareaId: string, newCol: TareaColumna) => Promise<void>;
  onDelete: (id: string) => void;
  onEdit: (
    id: string,
    data: {
      titulo: string;
      categoria: TareaCategoria;
      fecha_limite: string;
      descripcion: string;
      recurrencia: TareaRecurrencia | '';
    },
  ) => Promise<void>;
  onAdd: (
    proyectoId: string,
    col: TareaColumna,
    titulo: string,
    cat: TareaCategoria,
    fecha: string,
  ) => Promise<void>;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const activeTarea = activeId ? tareas.find((t) => t.id === activeId) : null;

  // "done" siempre llega a la columna — el desplegable controla su visibilidad
  const filtered = tareas.filter((t) => {
    if (t.columna === 'backlog') return false;
    if (filterCat !== 'all' && t.categoria !== filterCat) return false;
    return true;
  });

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const newCol = String(over.id) as TareaColumna;
    if (!COLUMNAS.find((c) => c.id === newCol)) return; // drop fuera de columna
    const tarea = tareas.find((t) => t.id === String(active.id));
    if (!tarea || tarea.columna === newCol) return;
    await onColumnChange(String(active.id), newCol);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-4 gap-2">
        {COLUMNAS.map((col) => (
          <KanbanColumn
            key={col.id}
            col={col}
            activeId={activeId}
            tareas={filtered
              .filter((t) => t.columna === col.id)
              .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))}
            onDelete={onDelete}
            onEdit={onEdit}
            onAdd={(titulo, cat, fecha) => onAdd(proyectoId, col.id, titulo, cat, fecha)}
          />
        ))}
      </div>

      {/* Ghost card mientras arrastras */}
      <DragOverlay dropAnimation={null}>
        {activeTarea ? (
          <DraggableTaskCard
            tarea={activeTarea}
            onDelete={() => undefined}
            onEdit={async () => undefined}
            ghost
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ── Proyecto sortable (wrapper DnD) ──────────────────────────────────────────

function SortableProject({
  id,
  children,
}: {
  id: string;
  children: (dragHandle: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? ('relative' as const) : undefined,
  };
  const dragHandle = (
    <span
      {...attributes}
      {...listeners}
      className="cursor-grab touch-none rounded p-1 text-zinc-700 transition-colors hover:text-zinc-400 active:cursor-grabbing"
    >
      <GripVertical size={13} />
    </span>
  );
  return (
    <div ref={setNodeRef} style={style}>
      {children(dragHandle)}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type Props = {
  proyectos: ProyectoRow[];
  isPrivateMode: boolean;
  onGoToProject: (id: string) => void;
};

export function PanelTareas({ proyectos, onGoToProject }: Props) {
  const [tareas, setTareas] = useState<ProyectoTarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filterCat, setFilterCat] = useState<TareaCategoria | 'all'>('all');
  const [projectOrder, setProjectOrder] = useState<string[]>(loadOrder);

  // Form global nueva tarea
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState({ ...EMPTY, proyectoId: '' });
  const [saving, setSaving] = useState(false);

  // DnD sensors — umbral de 8px para no interferir con clicks
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    getAllTareas()
      .then(setTareas)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Proyectos con tareas + proyectos sin tareas, aplicando el orden guardado
  const allProyectoIds = useMemo(() => {
    const known = new Set([...tareas.map((t) => t.proyecto_id), ...proyectos.map((p) => p.id_ref)]);
    const savedFirst = projectOrder.filter((id) => known.has(id));
    const rest = Array.from(known).filter((id) => !projectOrder.includes(id));
    return [...savedFirst, ...rest];
  }, [tareas, proyectos, projectOrder]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setProjectOrder((prev) => {
        const current = prev.length > 0 ? prev : allProyectoIds;
        const oldIdx = current.indexOf(String(active.id));
        const newIdx = current.indexOf(String(over.id));
        if (oldIdx === -1 || newIdx === -1) return prev;
        const next = arrayMove(current, oldIdx, newIdx);
        saveOrder(next);
        return next;
      });
    },
    [allProyectoIds],
  );

  const proyectoMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of proyectos) m.set(p.id_ref, p.nombre);
    return m;
  }, [proyectos]);

  const overdueCount = useMemo(() => tareas.filter((t) => isOverdue(t)).length, [tareas]);

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Mutaciones ──────────────────────────────────────────────────────────────

  async function handleAdd(
    proyectoId: string,
    columna: TareaColumna,
    titulo: string,
    categoria: TareaCategoria,
    fecha_limite: string,
  ) {
    const orden = tareas.filter(
      (t) => t.proyecto_id === proyectoId && t.columna === columna,
    ).length;
    const t = await createTarea({
      proyecto_id: proyectoId,
      titulo,
      categoria,
      columna,
      orden,
      ...(fecha_limite && { fecha_limite }),
    });
    setTareas((prev) => [...prev, t]);
  }

  async function handleMoveToColumn(tareaId: string, newCol: TareaColumna) {
    const tarea = tareas.find((t) => t.id === tareaId);
    if (!tarea) return;
    setTareas((prev) => prev.map((t) => (t.id === tareaId ? { ...t, columna: newCol } : t)));
    await updateTarea(tareaId, { columna: newCol }).catch(() => {
      setTareas((prev) => prev.map((t) => (t.id === tareaId ? tarea : t)));
    });
    // Si la tarea es recurrente y acaba de marcarse como Done → crear siguiente ocurrencia
    if (newCol === 'done' && tarea.recurrencia) {
      const nuevaData = {
        proyecto_id: tarea.proyecto_id,
        titulo: tarea.titulo,
        categoria: tarea.categoria,
        columna: 'todo' as const,
        recurrencia: tarea.recurrencia,
        fecha_limite: nextFecha(tarea.fecha_limite, tarea.recurrencia),
        orden: 0,
        ...(tarea.descripcion ? { descripcion: tarea.descripcion } : {}),
      };
      const nueva = await createTarea(nuevaData).catch(() => null);
      if (nueva) setTareas((prev) => [...prev, nueva]);
    }
  }
  async function handleDelete(id: string) {
    setTareas((prev) => prev.filter((t) => t.id !== id));
    await deleteTarea(id).catch(() => {});
  }

  async function handleEdit(
    id: string,
    data: {
      titulo: string;
      categoria: TareaCategoria;
      fecha_limite: string;
      descripcion: string;
      recurrencia: TareaRecurrencia | '';
    },
  ) {
    const prev = tareas.find((t) => t.id === id);
    if (!prev) return;
    const recurrencia = (data.recurrencia || null) as TareaRecurrencia | null;
    const updated = {
      ...prev,
      titulo: data.titulo,
      categoria: data.categoria,
      fecha_limite: data.fecha_limite || null,
      descripcion: data.descripcion || null,
      recurrencia,
    };
    setTareas((list) => list.map((t) => (t.id === id ? updated : t)));
    const patch: Parameters<typeof updateTarea>[1] = {
      titulo: data.titulo,
      categoria: data.categoria,
      descripcion: data.descripcion,
    };
    if (data.fecha_limite) patch.fecha_limite = data.fecha_limite;
    if (data.recurrencia) patch.recurrencia = data.recurrencia as TareaRecurrencia;
    await updateTarea(id, patch).catch(() =>
      setTareas((list) => list.map((t) => (t.id === id ? prev : t))),
    );
  }

  async function handleNewFormSave() {
    if (!newForm.proyectoId || !newForm.titulo.trim()) return;
    setSaving(true);
    try {
      await handleAdd(
        newForm.proyectoId,
        newForm.columna,
        newForm.titulo.trim(),
        newForm.categoria,
        newForm.fecha_limite,
      );
      setNewForm({ ...EMPTY, proyectoId: newForm.proyectoId }); // mantener proyecto seleccionado
      setShowNewForm(false);
      // Abrir el proyecto si estaba colapsado
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(newForm.proyectoId);
        return next;
      });
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-zinc-600">
        Cargando tareas...
      </div>
    );
  }

  const activeCount = tareas.filter((t) => t.columna !== 'done' && t.columna !== 'backlog').length;

  return (
    <div className="animate-fade-in space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Cuadro de tareas</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            {activeCount} tareas activas · {proyectos.length} proyectos
            {overdueCount > 0 && (
              <span className="ml-2 font-medium text-rose-400">{overdueCount} vencidas</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtro categoría */}
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value as TareaCategoria | 'all')}
            className="text-2xs rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-zinc-400 outline-none"
          >
            <option value="all">Todas las categorías</option>
            {CATEGORIAS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {/* Nueva tarea */}
          <button
            onClick={() => {
              setShowNewForm((v) => !v);
              setNewForm({ ...EMPTY, proyectoId: proyectos[0]?.id_ref ?? '' });
            }}
            className="flex items-center gap-1.5 rounded-xl border border-blue-500/25 bg-blue-600/15 px-3 py-1.5 text-xs font-medium text-blue-300 transition-all hover:bg-blue-600/25"
          >
            <Plus size={12} /> Nueva tarea
          </button>
        </div>
      </div>

      {/* ── Alerta vencidas ─────────────────────────────────────────────────── */}
      {overdueCount > 0 && (
        <div className="bg-rose-500/8 flex items-center gap-3 rounded-xl border border-rose-500/20 px-4 py-3">
          <AlertTriangle size={15} className="shrink-0 text-rose-400" />
          <p className="text-sm font-medium text-rose-300">
            {overdueCount} {overdueCount === 1 ? 'tarea vencida' : 'tareas vencidas'} — revisar
            inmediatamente
          </p>
        </div>
      )}

      {/* ── Formulario global nueva tarea ───────────────────────────────────── */}
      {showNewForm && (
        <div className="animate-fade-in space-y-4 rounded-2xl border border-blue-500/20 bg-zinc-900/60 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-300">
              Nueva tarea
            </p>
            <button
              onClick={() => setShowNewForm(false)}
              className="text-zinc-600 hover:text-zinc-400"
            >
              <X size={15} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
                Título *
              </label>
              <input
                autoFocus
                value={newForm.titulo}
                onChange={(e) => setNewForm((f) => ({ ...f, titulo: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleNewFormSave();
                }}
                placeholder="¿Qué hay que hacer?"
                className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-blue-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
                Proyecto *
              </label>
              <select
                value={newForm.proyectoId}
                onChange={(e) => setNewForm((f) => ({ ...f, proyectoId: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-blue-500/50 focus:outline-none"
              >
                <option value="">— Selecciona proyecto —</option>
                {proyectos.map((p) => (
                  <option key={p.id_ref} value={p.id_ref}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
                Columna
              </label>
              <select
                value={newForm.columna}
                onChange={(e) =>
                  setNewForm((f) => ({ ...f, columna: e.target.value as TareaColumna }))
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-blue-500/50 focus:outline-none"
              >
                {COLUMNAS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
                Categoría
              </label>
              <select
                value={newForm.categoria}
                onChange={(e) =>
                  setNewForm((f) => ({ ...f, categoria: e.target.value as TareaCategoria }))
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-blue-500/50 focus:outline-none"
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
                Fecha límite (opcional)
              </label>
              <input
                type="date"
                value={newForm.fecha_limite}
                onChange={(e) => setNewForm((f) => ({ ...f, fecha_limite: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-blue-500/50 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setShowNewForm(false)}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-zinc-400 transition-all hover:border-white/20"
            >
              Cancelar
            </button>
            <button
              onClick={() => void handleNewFormSave()}
              disabled={saving || !newForm.titulo.trim() || !newForm.proyectoId}
              className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-600/20 px-5 py-2 text-sm font-medium text-blue-300 transition-all hover:bg-blue-600/30 disabled:opacity-40"
            >
              {saving ? (
                'Creando...'
              ) : (
                <>
                  <Plus size={13} /> Crear tarea
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Proyectos con Kanban ─────────────────────────────────────────────── */}
      {allProyectoIds.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center text-zinc-600">
          <CheckSquare size={32} className="mb-2" />
          <p className="text-sm font-semibold">Sin proyectos</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={allProyectoIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {allProyectoIds.map((proyectoId) => {
                const nombre = proyectoMap.get(proyectoId) ?? proyectoId;
                const isOpen = !collapsed.has(proyectoId);

                const proyTareas = tareas.filter((t) => {
                  if (t.proyecto_id !== proyectoId) return false;
                  if (t.columna === 'backlog') return false;
                  if (filterCat !== 'all' && t.categoria !== filterCat) return false;
                  return true;
                });

                const overdues = proyTareas.filter((t) => isOverdue(t)).length;
                const doing = proyTareas.filter((t) => t.columna === 'doing').length;
                const doneCount = tareas.filter(
                  (t) => t.proyecto_id === proyectoId && t.columna === 'done',
                ).length;
                const total = tareas.filter(
                  (t) => t.proyecto_id === proyectoId && t.columna !== 'backlog',
                ).length;

                return (
                  <SortableProject key={proyectoId} id={proyectoId}>
                    {(dragHandle) => (
                      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-900/40">
                        {/* ── Cabecera proyecto ─────────────────────────────── */}
                        <div className="flex items-center gap-1 px-3 py-3.5 transition-colors hover:bg-white/[0.02]">
                          {dragHandle}
                          <button
                            onClick={() => toggleCollapse(proyectoId)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            {isOpen ? (
                              <ChevronDown size={13} className="shrink-0 text-zinc-500" />
                            ) : (
                              <ChevronRight size={13} className="shrink-0 text-zinc-500" />
                            )}
                            <span className="flex-1 truncate text-sm font-semibold text-white">
                              {nombre}
                            </span>
                          </button>
                          <div className="flex shrink-0 items-center gap-2">
                            {overdues > 0 && (
                              <span className="text-2xs rounded border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-rose-400">
                                {overdues} vencida{overdues > 1 ? 's' : ''}
                              </span>
                            )}
                            {doing > 0 && (
                              <span className="text-2xs rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-amber-400">
                                {doing} en curso
                              </span>
                            )}
                            <span className="text-2xs font-semibold text-zinc-500">
                              {doneCount}/{total}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onGoToProject(proyectoId);
                              }}
                              className="text-2xs flex items-center gap-0.5 font-medium uppercase tracking-wider text-zinc-600 transition-colors hover:text-blue-400"
                            >
                              Ver <ArrowRight size={9} />
                            </button>
                          </div>
                        </div>

                        {/* ── Kanban del proyecto ─────────────────────────── */}
                        {isOpen && (
                          <div className="px-4 pb-4">
                            <ProjectKanbanBoard
                              proyectoId={proyectoId}
                              tareas={tareas.filter((t) => t.proyecto_id === proyectoId)}
                              filterCat={filterCat}
                              onColumnChange={handleMoveToColumn}
                              onDelete={handleDelete}
                              onEdit={handleEdit}
                              onAdd={handleAdd}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </SortableProject>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
