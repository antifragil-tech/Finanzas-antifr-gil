import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Upload,
  RefreshCw,
  Database,
  Building2,
  FolderOpen,
  AlertTriangle,
  ChevronRight,
  BookOpen,
  Trash,
  GitBranch,
} from 'lucide-react';
import type { SociedadRow, ProyectoRow } from '../../lib/maestroParser';
import {
  getSociedades,
  getProyectos,
  insertSociedad,
  updateSociedad,
  deleteSociedad,
  insertProyecto,
  updateProyecto,
  deleteProyecto,
} from '../../lib/maestroImport';
import { parseSumasSaldos } from '../../lib/sumasSaldosParser';
import type { BalanceParseResult } from '../../lib/sumasSaldosParser';
import {
  uploadSumasSaldos,
  getPeriodosImportados,
  deletePeriodo,
  fmtPeriodo,
  PERIODO_INICIAL,
} from '../../lib/sumasSaldosImport';
import type { PeriodoImportado } from '../../lib/sumasSaldosImport';
import { SociedadDetail } from './SociedadDetail';
import { ProyectoDetail } from './ProyectoDetail';

type Tab = 'sociedades' | 'proyectos' | 'contabilidad' | 'estructura';
type DetailState = { type: 'sociedad'; idRef: string } | { type: 'proyecto'; idRef: string } | null;

const EMPTY_SOC: SociedadRow = {
  id_ref: '',
  nombre: '',
  cif: null,
  holding_principal: null,
  pct_pavier: null,
  pct_armia: null,
  estado: 'Activo',
  parent_sociedad_id: null,
  pct_en_sociedad_padre: null,
};
const EMPTY_PROJ: ProyectoRow = {
  id_ref: '',
  nombre: '',
  sociedad_tenedora: null,
  estado: 'Activo',
};

type Props = { onRefresh?: () => void; onNavigateToPatrimonio?: () => void };

export function MaestroView({ onRefresh, onNavigateToPatrimonio }: Props) {
  const [tab, setTab] = useState<Tab>('sociedades');
  const [sociedades, setSociedades] = useState<SociedadRow[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [soc, proj] = await Promise.all([getSociedades(), getProyectos()]);
      setSociedades(soc);
      setProyectos(proj);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const refresh = () => {
    void loadData();
    onRefresh?.();
  };

  // Limpiar detail si la entidad ya no existe tras un refresco (nunca durante render)
  useEffect(() => {
    if (loading || detail === null) return;
    const found =
      detail.type === 'sociedad'
        ? sociedades.some((s) => s.id_ref === detail.idRef)
        : proyectos.some((p) => p.id_ref === detail.idRef);
    if (!found) setDetail(null);
  }, [loading, detail, sociedades, proyectos]);

  if (!loading && detail !== null) {
    if (detail.type === 'sociedad') {
      const soc = sociedades.find((s) => s.id_ref === detail.idRef);
      if (soc)
        return (
          <SociedadDetail
            sociedad={soc}
            onBack={() => setDetail(null)}
            onRefresh={refresh}
            {...(onNavigateToPatrimonio ? { onNavigateToPatrimonio } : {})}
          />
        );
    }
    if (detail.type === 'proyecto') {
      const proj = proyectos.find((p) => p.id_ref === detail.idRef);
      if (proj)
        return (
          <ProyectoDetail
            proyecto={proj}
            sociedades={sociedades}
            onBack={() => setDetail(null)}
            onRefresh={refresh}
          />
        );
    }
  }

  return (
    <div className="max-w-6xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-3">
            <Database size={20} className="text-blue-400" />
            <h1 className="text-xl font-semibold uppercase tracking-wider text-white">
              Datos Maestros
            </h1>
          </div>
          <p className="text-xs text-zinc-500">
            Gestión directa del holding en Supabase — fuente única de verdad
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-400 transition-all hover:border-white/20 hover:text-white"
        >
          <RefreshCw size={13} />
          Recargar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex w-fit gap-1 rounded-xl border border-white/5 bg-zinc-900 p-1">
        {(
          [
            ['sociedades', Building2, 'Sociedades'],
            ['proyectos', FolderOpen, 'Proyectos'],
            ['contabilidad', BookOpen, 'Contabilidad'],
            ['estructura', GitBranch, 'Estructura'],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all ${tab === id ? 'border border-blue-500/30 bg-blue-500/20 text-blue-300' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-950/40 px-4 py-3 text-xs text-rose-400">
          <AlertTriangle size={13} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-12 text-sm text-zinc-500">
          <RefreshCw size={16} className="animate-spin" />
          Cargando...
        </div>
      ) : (
        <>
          {tab === 'sociedades' && (
            <SociedadesTab
              sociedades={sociedades}
              onRefresh={refresh}
              onDetail={(id) => setDetail({ type: 'sociedad', idRef: id })}
            />
          )}
          {tab === 'proyectos' && (
            <ProyectosTab
              proyectos={proyectos}
              sociedades={sociedades}
              onRefresh={refresh}
              onDetail={(id) => setDetail({ type: 'proyecto', idRef: id })}
            />
          )}
          {tab === 'contabilidad' && <ContabilidadTab sociedades={sociedades} onDone={refresh} />}
          {tab === 'estructura' && (
            <EstructuraTab
              sociedades={sociedades}
              onDetail={(id) => setDetail({ type: 'sociedad', idRef: id })}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Sociedades ────────────────────────────────────────────────────────────────

function SociedadesTab({
  sociedades,
  onRefresh,
  onDetail,
}: {
  sociedades: SociedadRow[];
  onRefresh: () => void;
  onDetail: (idRef: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<SociedadRow>>({});
  const [addingNew, setAddingNew] = useState(false);
  const [newForm, setNewForm] = useState<SociedadRow>({ ...EMPTY_SOC });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = (s: SociedadRow) => {
    setEditingId(s.id_ref);
    setEditForm({ ...s });
    setAddingNew(false);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const { id_ref, ...data } = editForm as SociedadRow;
      void id_ref;
      await updateSociedad(editingId, data);
      cancelEdit();
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

  const saveNew = async () => {
    if (!newForm.id_ref.trim() || !newForm.nombre.trim()) {
      alert('ID-Ref y Nombre son obligatorios');
      return;
    }
    setSaving(true);
    try {
      await insertSociedad(newForm);
      setAddingNew(false);
      setNewForm({ ...EMPTY_SOC });
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error creando');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (idRef: string) => {
    setSaving(true);
    try {
      await deleteSociedad(idRef);
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error eliminando');
    } finally {
      setSaving(false);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">{sociedades.length} entidades</span>
        <button
          onClick={() => {
            setAddingNew(true);
            setEditingId(null);
          }}
          className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-300 transition-all hover:bg-blue-500/20"
        >
          <Plus size={13} />
          Nueva Sociedad
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/5">
        {/* Header */}
        <div className="text-2xs grid grid-cols-[110px_1fr_110px_64px_64px_90px_80px_60px_16px] gap-2 border-b border-white/5 bg-zinc-900/80 px-4 py-2.5 font-medium uppercase tracking-widest text-zinc-500">
          <span>ID-Ref</span>
          <span>Nombre</span>
          <span>Matriz</span>
          <span>% Pav.</span>
          <span>% Arm.</span>
          <span>% en Matriz</span>
          <span>Estado</span>
          <span></span>
          <span></span>
        </div>

        {/* Add new row */}
        {addingNew && (
          <div className="grid grid-cols-[110px_1fr_110px_64px_64px_90px_80px_60px_16px] items-center gap-2 border-b border-blue-500/20 bg-blue-500/5 px-4 py-3">
            <SocInput
              value={newForm.id_ref}
              onChange={(v) => setNewForm((f) => ({ ...f, id_ref: v }))}
              placeholder="S-003"
            />
            <SocInput
              value={newForm.nombre}
              onChange={(v) => setNewForm((f) => ({ ...f, nombre: v }))}
              placeholder="Nombre sociedad"
            />
            <SocInput
              value={newForm.parent_sociedad_id ?? ''}
              onChange={(v) => setNewForm((f) => ({ ...f, parent_sociedad_id: v || null }))}
              placeholder="S-RIALSA"
            />
            <SocInput
              value={String(newForm.pct_pavier ?? '')}
              onChange={(v) => setNewForm((f) => ({ ...f, pct_pavier: v ? parseFloat(v) : null }))}
              placeholder="0.25"
              type="number"
            />
            <SocInput
              value={String(newForm.pct_armia ?? '')}
              onChange={(v) => setNewForm((f) => ({ ...f, pct_armia: v ? parseFloat(v) : null }))}
              placeholder="0.25"
              type="number"
            />
            <SocInput
              value={String(newForm.pct_en_sociedad_padre ?? '')}
              onChange={(v) =>
                setNewForm((f) => ({ ...f, pct_en_sociedad_padre: v ? parseFloat(v) : null }))
              }
              placeholder="0.5"
              type="number"
            />
            <EstadoSelect
              value={newForm.estado ?? 'Activo'}
              onChange={(v) => setNewForm((f) => ({ ...f, estado: v }))}
            />
            <div className="flex gap-1">
              <ActionBtn
                onClick={saveNew}
                disabled={saving}
                icon={<Check size={13} />}
                color="green"
              />
              <ActionBtn
                onClick={() => {
                  setAddingNew(false);
                  setNewForm({ ...EMPTY_SOC });
                }}
                icon={<X size={13} />}
                color="red"
              />
            </div>
            <span />
          </div>
        )}

        {sociedades.map((s, i) => (
          <div
            key={s.id_ref}
            className={`border-b border-white/[0.03] last:border-0 ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
          >
            {editingId === s.id_ref ? (
              <div className="grid grid-cols-[110px_1fr_110px_64px_64px_90px_80px_60px_16px] items-center gap-2 border-l-2 border-blue-500/50 bg-blue-500/5 px-4 py-3">
                <span className="text-2xs font-mono text-zinc-400">{s.id_ref}</span>
                <SocInput
                  value={editForm.nombre ?? ''}
                  onChange={(v) => setEditForm((f) => ({ ...f, nombre: v }))}
                />
                <SocInput
                  value={editForm.parent_sociedad_id ?? ''}
                  onChange={(v) => setEditForm((f) => ({ ...f, parent_sociedad_id: v || null }))}
                  placeholder="S-RIALSA"
                />
                <SocInput
                  value={String(editForm.pct_pavier ?? '')}
                  onChange={(v) =>
                    setEditForm((f) => ({ ...f, pct_pavier: v ? parseFloat(v) : null }))
                  }
                  type="number"
                />
                <SocInput
                  value={String(editForm.pct_armia ?? '')}
                  onChange={(v) =>
                    setEditForm((f) => ({ ...f, pct_armia: v ? parseFloat(v) : null }))
                  }
                  type="number"
                />
                <SocInput
                  value={String(editForm.pct_en_sociedad_padre ?? '')}
                  onChange={(v) =>
                    setEditForm((f) => ({ ...f, pct_en_sociedad_padre: v ? parseFloat(v) : null }))
                  }
                  type="number"
                />
                <EstadoSelect
                  value={editForm.estado ?? 'Activo'}
                  onChange={(v) => setEditForm((f) => ({ ...f, estado: v }))}
                />
                <div className="flex gap-1">
                  <ActionBtn
                    onClick={saveEdit}
                    disabled={saving}
                    icon={<Check size={13} />}
                    color="green"
                  />
                  <ActionBtn onClick={cancelEdit} icon={<X size={13} />} color="red" />
                </div>
                <span />
              </div>
            ) : (
              <div
                onClick={() => onDetail(s.id_ref)}
                className="group grid cursor-pointer grid-cols-[110px_1fr_110px_64px_64px_90px_80px_60px_16px] items-center gap-2 px-4 py-3 transition-colors hover:bg-white/[0.03]"
              >
                <span className="text-2xs font-mono text-zinc-500">{s.id_ref}</span>
                <span className="truncate text-sm font-semibold text-zinc-200">{s.nombre}</span>
                <span
                  className="text-2xs truncate font-mono text-zinc-600"
                  title={s.parent_sociedad_id ?? ''}
                >
                  {s.parent_sociedad_id ?? <span className="text-zinc-700">—</span>}
                </span>
                <span
                  className={`text-xs font-medium ${s.pct_pavier ? 'text-blue-400' : 'text-zinc-700'}`}
                >
                  {s.pct_pavier != null ? `${(s.pct_pavier * 100).toFixed(0)}%` : '—'}
                </span>
                <span
                  className={`text-xs font-medium ${s.pct_armia ? 'text-amber-400' : 'text-zinc-700'}`}
                >
                  {s.pct_armia != null ? `${(s.pct_armia * 100).toFixed(0)}%` : '—'}
                </span>
                <span
                  className={`text-xs font-medium ${s.pct_en_sociedad_padre ? 'text-violet-400' : 'text-zinc-700'}`}
                >
                  {s.pct_en_sociedad_padre != null
                    ? `${(s.pct_en_sociedad_padre * 100).toFixed(0)}%`
                    : '—'}
                </span>
                <EstadoBadge estado={s.estado} />
                {confirmDelete === s.id_ref ? (
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <ActionBtn
                      onClick={() => {
                        void doDelete(s.id_ref);
                      }}
                      disabled={saving}
                      icon={<Check size={13} />}
                      color="red"
                    />
                    <ActionBtn
                      onClick={() => setConfirmDelete(null)}
                      icon={<X size={13} />}
                      color="zinc"
                    />
                  </div>
                ) : (
                  <div
                    className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ActionBtn
                      onClick={() => startEdit(s)}
                      icon={<Pencil size={13} />}
                      color="zinc"
                    />
                    <ActionBtn
                      onClick={() => setConfirmDelete(s.id_ref)}
                      icon={<Trash2 size={13} />}
                      color="red"
                    />
                  </div>
                )}
                <ChevronRight
                  size={14}
                  className="text-zinc-700 transition-colors group-hover:text-zinc-400"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Proyectos ─────────────────────────────────────────────────────────────────

function ProyectosTab({
  proyectos,
  sociedades,
  onRefresh,
  onDetail,
}: {
  proyectos: ProyectoRow[];
  sociedades: SociedadRow[];
  onRefresh: () => void;
  onDetail: (idRef: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProyectoRow>>({});
  const [addingNew, setAddingNew] = useState(false);
  const [newForm, setNewForm] = useState<ProyectoRow>({ ...EMPTY_PROJ });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = (p: ProyectoRow) => {
    setEditingId(p.id_ref);
    setEditForm({ ...p });
    setAddingNew(false);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const { id_ref, ...data } = editForm as ProyectoRow;
      void id_ref;
      await updateProyecto(editingId, data);
      cancelEdit();
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

  const saveNew = async () => {
    if (!newForm.id_ref.trim() || !newForm.nombre.trim()) {
      alert('ID-Ref y Nombre son obligatorios');
      return;
    }
    setSaving(true);
    try {
      await insertProyecto(newForm);
      setAddingNew(false);
      setNewForm({ ...EMPTY_PROJ });
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error creando');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (idRef: string) => {
    setSaving(true);
    try {
      await deleteProyecto(idRef);
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error eliminando');
    } finally {
      setSaving(false);
      setConfirmDelete(null);
    }
  };

  const socOptions = sociedades.filter(
    (s) => s.id_ref.startsWith('S-') || s.id_ref.startsWith('H-'),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">{proyectos.length} proyectos</span>
        <button
          onClick={() => {
            setAddingNew(true);
            setEditingId(null);
          }}
          className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-300 transition-all hover:bg-blue-500/20"
        >
          <Plus size={13} />
          Nuevo Proyecto
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/5">
        <div className="text-2xs grid grid-cols-[100px_1fr_1fr_80px_60px_20px] gap-3 border-b border-white/5 bg-zinc-900/80 px-4 py-2.5 font-medium uppercase tracking-widest text-zinc-500">
          <span>ID-Ref</span>
          <span>Nombre</span>
          <span>Sociedad Tenedora</span>
          <span>Estado</span>
          <span></span>
          <span></span>
        </div>

        {addingNew && (
          <div className="grid grid-cols-[100px_1fr_1fr_80px_60px_20px] items-center gap-3 border-b border-blue-500/20 bg-blue-500/5 px-4 py-3">
            <SocInput
              value={newForm.id_ref}
              onChange={(v) => setNewForm((f) => ({ ...f, id_ref: v }))}
              placeholder="P-005"
            />
            <SocInput
              value={newForm.nombre}
              onChange={(v) => setNewForm((f) => ({ ...f, nombre: v }))}
              placeholder="Nombre proyecto"
            />
            <SociedadSelect
              value={newForm.sociedad_tenedora ?? ''}
              onChange={(v) => setNewForm((f) => ({ ...f, sociedad_tenedora: v || null }))}
              options={socOptions}
            />
            <EstadoSelect
              value={newForm.estado ?? 'Activo'}
              onChange={(v) => setNewForm((f) => ({ ...f, estado: v }))}
            />
            <div className="flex gap-1">
              <ActionBtn
                onClick={saveNew}
                disabled={saving}
                icon={<Check size={13} />}
                color="green"
              />
              <ActionBtn
                onClick={() => {
                  setAddingNew(false);
                  setNewForm({ ...EMPTY_PROJ });
                }}
                icon={<X size={13} />}
                color="red"
              />
            </div>
            <span />
          </div>
        )}

        {proyectos.map((p, i) => (
          <div
            key={p.id_ref}
            className={`border-b border-white/[0.03] last:border-0 ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
          >
            {editingId === p.id_ref ? (
              <div className="grid grid-cols-[100px_1fr_1fr_80px_60px_20px] items-center gap-3 border-l-2 border-blue-500/50 bg-blue-500/5 px-4 py-3">
                <span className="font-mono text-xs text-zinc-400">{p.id_ref}</span>
                <SocInput
                  value={editForm.nombre ?? ''}
                  onChange={(v) => setEditForm((f) => ({ ...f, nombre: v }))}
                />
                <SociedadSelect
                  value={editForm.sociedad_tenedora ?? ''}
                  onChange={(v) => setEditForm((f) => ({ ...f, sociedad_tenedora: v || null }))}
                  options={socOptions}
                />
                <EstadoSelect
                  value={editForm.estado ?? 'Activo'}
                  onChange={(v) => setEditForm((f) => ({ ...f, estado: v }))}
                />
                <div className="flex gap-1">
                  <ActionBtn
                    onClick={saveEdit}
                    disabled={saving}
                    icon={<Check size={13} />}
                    color="green"
                  />
                  <ActionBtn onClick={cancelEdit} icon={<X size={13} />} color="red" />
                </div>
                <span />
              </div>
            ) : (
              <div
                onClick={() => onDetail(p.id_ref)}
                className="group grid cursor-pointer grid-cols-[100px_1fr_1fr_80px_60px_20px] items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
              >
                <span className="font-mono text-xs text-zinc-400">{p.id_ref}</span>
                <span className="truncate text-sm font-semibold text-zinc-200">{p.nombre}</span>
                <span className="truncate text-xs text-zinc-400">{p.sociedad_tenedora ?? '—'}</span>
                <EstadoBadge estado={p.estado} />
                {confirmDelete === p.id_ref ? (
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <ActionBtn
                      onClick={() => {
                        void doDelete(p.id_ref);
                      }}
                      disabled={saving}
                      icon={<Check size={13} />}
                      color="red"
                    />
                    <ActionBtn
                      onClick={() => setConfirmDelete(null)}
                      icon={<X size={13} />}
                      color="zinc"
                    />
                  </div>
                ) : (
                  <div
                    className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ActionBtn
                      onClick={() => startEdit(p)}
                      icon={<Pencil size={13} />}
                      color="zinc"
                    />
                    <ActionBtn
                      onClick={() => setConfirmDelete(p.id_ref)}
                      icon={<Trash2 size={13} />}
                      color="red"
                    />
                  </div>
                )}
                <ChevronRight
                  size={14}
                  className="text-zinc-700 transition-colors group-hover:text-zinc-400"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Estructura Corporativa ────────────────────────────────────────────────────

function pctLabel(v: number | null): string {
  if (!v) return '—';
  const p = v > 1 ? v : v * 100;
  return `${p.toFixed(0)}%`;
}

function EstructuraTab({
  sociedades,
  onDetail,
}: {
  sociedades: SociedadRow[];
  onDetail: (id: string) => void;
}) {
  // Detectar holdings por nombre
  const pavier = sociedades.find((s) => s.nombre?.toLowerCase().includes('pavier'));
  const armia = sociedades.find((s) => s.nombre?.toLowerCase().includes('armia'));
  const PAVIER_ID = pavier?.id_ref ?? '';
  const ARMIA_ID = armia?.id_ref ?? '';

  // Nivel 2: filiales directas de Pavier/Armia (sin parent, con % > 0)
  const directas = sociedades.filter(
    (s) =>
      s.id_ref !== PAVIER_ID &&
      s.id_ref !== ARMIA_ID &&
      !s.parent_sociedad_id &&
      ((s.pct_pavier ?? 0) > 0 || (s.pct_armia ?? 0) > 0),
  );

  // Subsidiarias agrupadas por parent
  const subs = (parentId: string) => sociedades.filter((s) => s.parent_sociedad_id === parentId);

  const NodeRow = ({ s, indent = 0 }: { s: SociedadRow; indent?: number }) => {
    const pTot = (s.pct_pavier ?? 0) + (s.pct_armia ?? 0);
    const isDirecta = !s.parent_sociedad_id && pTot > 0;
    const pct = isDirecta ? pTot : (s.pct_en_sociedad_padre ?? 0);
    const unconfigured = !isDirecta && !s.pct_en_sociedad_padre && !s.parent_sociedad_id;
    const children = subs(s.id_ref);

    return (
      <>
        <div
          onClick={() => onDetail(s.id_ref)}
          className="flex cursor-pointer items-center gap-3 border-b border-white/[0.03] px-4 py-2.5 transition-colors last:border-0 hover:bg-white/[0.03]"
          style={{ paddingLeft: `${16 + indent * 24}px` }}
        >
          {indent > 0 && <span className="shrink-0 text-xs text-zinc-700">└─</span>}
          <span className="text-2xs w-20 shrink-0 font-mono text-zinc-600">{s.id_ref}</span>
          <span className="flex-1 text-sm font-semibold text-zinc-200">{s.nombre}</span>
          {isDirecta && (
            <div className="flex shrink-0 items-center gap-2">
              {(s.pct_pavier ?? 0) > 0 && (
                <span className="text-2xs rounded bg-blue-500/10 px-2 py-0.5 font-medium text-blue-400">
                  P: {pctLabel(s.pct_pavier)}
                </span>
              )}
              {(s.pct_armia ?? 0) > 0 && (
                <span className="text-2xs rounded bg-amber-500/10 px-2 py-0.5 font-medium text-amber-400">
                  A: {pctLabel(s.pct_armia)}
                </span>
              )}
              <span className="text-2xs font-medium text-emerald-400">{pctLabel(pTot)} grupo</span>
            </div>
          )}
          {!isDirecta && pct > 0 && (
            <span className="text-2xs shrink-0 font-medium text-violet-400">
              {pctLabel(pct)} de {s.parent_sociedad_id}
            </span>
          )}
          {unconfigured && (
            <span className="text-2xs shrink-0 rounded bg-amber-500/10 px-2 py-0.5 font-medium text-amber-500">
              ⚠ sin % configurado
            </span>
          )}
          <ChevronRight size={13} className="shrink-0 text-zinc-700" />
        </div>
        {children.map((child) => (
          <NodeRow key={child.id_ref} s={child} indent={indent + 1} />
        ))}
      </>
    );
  };

  const HoldingSection = ({ s, wCol }: { s: SociedadRow; wCol: string }) => {
    const direct = directas.filter((d) => {
      const pct = wCol === 'pct_pavier' ? (d.pct_pavier ?? 0) : (d.pct_armia ?? 0);
      return pct > 0;
    });
    return (
      <div className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.02]">
        <div
          onClick={() => onDetail(s.id_ref)}
          className="flex cursor-pointer items-center gap-3 bg-zinc-900/50 px-4 py-3 transition-colors hover:bg-white/[0.04]"
        >
          <Building2 size={15} className="shrink-0 text-blue-400" />
          <span className="text-2xs w-20 shrink-0 font-mono text-zinc-600">{s.id_ref}</span>
          <span className="flex-1 text-sm font-semibold text-white">{s.nombre}</span>
          <span className="text-2xs rounded bg-blue-500/10 px-2 py-0.5 font-medium text-blue-300">
            Holding 100%
          </span>
        </div>
        {direct.map((d) => (
          <NodeRow key={d.id_ref} s={d} indent={1} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <GitBranch size={14} className="text-blue-400" />
        <p className="text-xs font-medium text-zinc-400">
          Estructura corporativa — fuente: Supabase
        </p>
      </div>

      {/* Alsari Capital virtual root */}
      <div className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
        <span className="text-sm font-semibold text-blue-300">Antifrágil</span>
        <span className="text-2xs font-medium text-blue-400/60">
          Entidad virtual consolidada — Pavier + Armia
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {pavier && <HoldingSection s={pavier} wCol="pct_pavier" />}
        {armia && <HoldingSection s={armia} wCol="pct_armia" />}
      </div>

      {!pavier && !armia && (
        <div className="py-12 text-center text-sm text-zinc-600">
          No se detectaron holdings. Asegúrate de que Pavier y Armia están en la tabla.
        </div>
      )}
    </div>
  );
}

// ── Contabilidad (Sumas y Saldos) ─────────────────────────────────────────────

type SSPhase = 'idle' | 'parsing' | 'preview' | 'uploading' | 'done' | 'error';

function lastDayOfMonth(yyyyMM: string): string {
  const [y, m] = yyyyMM.split('-').map(Number);
  return new Date(y!, m!, 0).toISOString().split('T')[0]!;
}

function KpiMini({ label, value, color }: { label: string; value: number; color?: string }) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(n);
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
      <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${color ?? 'text-white'}`}>{fmt(value)}</p>
    </div>
  );
}

function ContabilidadTab({
  sociedades,
  onDone,
}: {
  sociedades: SociedadRow[];
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<SSPhase>('idle');
  const [selectedId, setSelectedId] = useState('');
  const [periodo, setPeriodo] = useState(''); // 'YYYY-MM'
  const [parsed, setParsed] = useState<BalanceParseResult | null>(null);
  const [periodos, setPeriodos] = useState<PeriodoImportado[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadPeriodos = async () => {
    try {
      setPeriodos(await getPeriodosImportados());
    } catch {
      /* silently ignore */
    }
  };

  useEffect(() => {
    void loadPeriodos();
  }, []);

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError('Solo se aceptan archivos .xlsx o .xls');
      return;
    }
    setPhase('parsing');
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      setParsed(parseSumasSaldos(buf));
      setPhase('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error analizando el archivo');
      setPhase('error');
    }
  };

  const doUpload = async () => {
    if (!parsed || !selectedId || !periodo) return;
    const soc = sociedades.find((s) => s.id_ref === selectedId);
    if (!soc) return;
    setPhase('uploading');
    try {
      await uploadSumasSaldos(
        selectedId,
        soc.nombre,
        lastDayOfMonth(periodo),
        parsed.lines,
        parsed.kpis,
      );
      setPhase('done');
      onDone();
      await loadPeriodos();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error subiendo a Supabase');
      setPhase('error');
    }
  };

  const doDelete = async (sId: string, per: string) => {
    const key = `${sId}|${per}`;
    setDeleting(key);
    setConfirmDel(null);
    try {
      await deletePeriodo(sId, per);
      await loadPeriodos();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error eliminando');
    } finally {
      setDeleting(null);
    }
  };

  // Agrupar el historial por sociedad para que sea fácil ver y borrar los de cada una.
  // Dentro de cada sociedad: "Inicial" primero, luego meses de más reciente a más antiguo.
  const periodosPorSociedad = (() => {
    const bySoc = new Map<string, PeriodoImportado[]>();
    for (const p of periodos) {
      if (!bySoc.has(p.sociedad_id)) bySoc.set(p.sociedad_id, []);
      bySoc.get(p.sociedad_id)!.push(p);
    }
    const nombre = (id: string) => sociedades.find((s) => s.id_ref === id)?.nombre ?? id;
    return [...bySoc.entries()]
      .map(([sociedadId, lista]) => ({
        sociedadId,
        sociedadNombre: nombre(sociedadId),
        periodos: [...lista].sort((a, b) => {
          if (a.periodo === PERIODO_INICIAL) return -1;
          if (b.periodo === PERIODO_INICIAL) return 1;
          return b.periodo.localeCompare(a.periodo);
        }),
      }))
      .sort((a, b) => a.sociedadNombre.localeCompare(b.sociedadNombre));
  })();

  const reset = () => {
    setPhase('idle');
    setParsed(null);
    setError(null);
  };

  const canUpload = selectedId && periodo;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="mb-1 text-sm font-medium text-zinc-200">Importar Balance de Sumas y Saldos</p>
        <p className="text-xs text-zinc-500">
          Sube el export de tu software contable (Sage, A3, ContaPlus…). Los KPIs se calculan
          automáticamente y se actualizan en todas las vistas.
        </p>
      </div>

      {/* Selectores */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-2xs mb-1.5 font-semibold uppercase tracking-widest text-zinc-500">
            Sociedad
          </p>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-blue-500/50 focus:outline-none"
          >
            <option value="">— Selecciona sociedad —</option>
            {sociedades.map((s) => (
              <option key={s.id_ref} value={s.id_ref}>
                {s.id_ref} — {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-2xs mb-1.5 font-semibold uppercase tracking-widest text-zinc-500">
            Período (mes/año)
          </p>
          <input
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-blue-500/50 focus:outline-none"
          />
        </div>
      </div>

      {/* Upload area */}
      <div className="space-y-4 rounded-xl border border-white/5 bg-white/[0.02] p-5">
        {(phase === 'idle' || phase === 'error') && (
          <>
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) void handleFile(f);
              }}
              className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/10 p-8 transition-all hover:border-blue-500/40 hover:bg-blue-500/5"
            >
              <BookOpen
                size={26}
                className="text-zinc-600 transition-colors group-hover:text-blue-400"
              />
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-400 group-hover:text-zinc-200">
                  Suelta el balance de sumas y saldos aquí
                </p>
                <p className="mt-1 text-xs text-zinc-600">o haz clic · formatos .xlsx / .xls</p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
            </label>
            {!canUpload && (
              <p className="flex items-center gap-1.5 text-xs text-amber-500/70">
                <AlertTriangle size={11} />
                Selecciona sociedad y período antes de subir el archivo.
              </p>
            )}
            {error && (
              <p className="flex items-start gap-2 whitespace-pre-line text-xs text-rose-400">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}
          </>
        )}

        {phase === 'parsing' && (
          <div className="flex items-center justify-center gap-3 py-8 text-sm text-zinc-400">
            <RefreshCw size={15} className="animate-spin" />
            Analizando archivo…
          </div>
        )}

        {phase === 'preview' && parsed && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-300">
                {parsed.lines.length} cuentas detectadas
                <span className="ml-2 font-normal text-zinc-600">· hoja "{parsed.sheetUsed}"</span>
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <KpiMini
                label="Caja disponible"
                value={parsed.kpis.caja_disponible}
                color="text-emerald-400"
              />
              <KpiMini
                label="Deuda bancaria"
                value={parsed.kpis.deuda_bancaria}
                color="text-rose-400"
              />
              <KpiMini
                label="Patrimonio neto"
                value={parsed.kpis.patrimonio_neto}
                color={parsed.kpis.patrimonio_neto >= 0 ? 'text-emerald-400' : 'text-rose-400'}
              />
              <KpiMini label="Activo total" value={parsed.kpis.activo_total} />
              <KpiMini label="Pasivo total" value={parsed.kpis.pasivo_total} />
              <KpiMini
                label="Fondo de maniobra"
                value={parsed.kpis.fondo_maniobra}
                color={parsed.kpis.fondo_maniobra >= 0 ? 'text-emerald-400' : 'text-rose-400'}
              />
            </div>
            {!canUpload && (
              <p className="flex items-center gap-1.5 text-xs text-amber-500/70">
                <AlertTriangle size={11} />
                Selecciona sociedad y período antes de confirmar.
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  void doUpload();
                }}
                disabled={!canUpload}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/20 py-3 text-sm font-medium text-blue-200 transition-all hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Upload size={15} />
                Subir a Supabase
              </button>
              <button
                onClick={reset}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-500 transition-all hover:text-zinc-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {phase === 'uploading' && (
          <div className="flex items-center justify-center gap-3 py-8 text-sm text-blue-400">
            <RefreshCw size={15} className="animate-spin" />
            Subiendo a Supabase…
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-950/40 px-4 py-4 text-emerald-400">
              <Check size={18} />
              <div>
                <p className="text-sm font-medium">Balance importado correctamente</p>
                <p className="mt-0.5 text-xs opacity-70">
                  KPIs actualizados · {parsed?.lines.length ?? 0} cuentas
                </p>
              </div>
            </div>
            <button
              onClick={reset}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-xs text-zinc-500 transition-all hover:text-zinc-300"
            >
              Importar otro balance
            </button>
          </div>
        )}
      </div>

      {/* Balances importados, agrupados por sociedad */}
      {periodosPorSociedad.length > 0 && (
        <div className="space-y-3">
          <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
            Balances importados por sociedad
          </p>
          <div className="space-y-3">
            {periodosPorSociedad.map(({ sociedadId, sociedadNombre, periodos: ps }) => (
              <div key={sociedadId} className="overflow-hidden rounded-xl border border-white/5">
                <div className="flex items-center justify-between border-b border-white/5 bg-zinc-900/60 px-4 py-2.5">
                  <p className="text-xs font-semibold text-zinc-200">{sociedadNombre}</p>
                  <span className="text-2xs uppercase tracking-widest text-zinc-600">
                    {ps.length} {ps.length === 1 ? 'balance' : 'balances'}
                  </span>
                </div>
                <div>
                  {ps.map((p, i) => {
                    const key = `${p.sociedad_id}|${p.periodo}`;
                    const esInicial = p.periodo === PERIODO_INICIAL;
                    return (
                      <div
                        key={key}
                        className={`flex items-center justify-between border-b border-white/[0.03] px-4 py-2.5 last:border-0 ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-medium ${esInicial ? 'text-blue-300' : 'text-zinc-300'}`}
                          >
                            {fmtPeriodo(p.periodo)}
                          </span>
                          {esInicial && (
                            <span className="text-2xs rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-blue-400/70">
                              Partida
                            </span>
                          )}
                          <span className="text-2xs text-zinc-600">· {p.lineas} cuentas</span>
                        </div>
                        {confirmDel === key ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-2xs mr-1 font-medium text-rose-400">
                              ¿Borrar?
                            </span>
                            <button
                              onClick={() => {
                                void doDelete(p.sociedad_id, p.periodo);
                              }}
                              disabled={deleting === key}
                              className="text-2xs rounded-lg border border-rose-500/30 bg-rose-500/15 px-2 py-1 font-semibold text-rose-300 transition-all hover:bg-rose-500/25 disabled:opacity-40"
                            >
                              {deleting === key ? (
                                <RefreshCw size={11} className="animate-spin" />
                              ) : (
                                'Sí, borrar'
                              )}
                            </button>
                            <button
                              onClick={() => setConfirmDel(null)}
                              className="text-2xs rounded-lg px-2 py-1 font-medium text-zinc-500 transition-colors hover:text-zinc-300"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDel(key)}
                            title="Eliminar este balance"
                            className="rounded-lg p-1.5 text-zinc-700 transition-all hover:bg-rose-500/10 hover:text-rose-400"
                          >
                            <Trash size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function SocInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-blue-500/50 focus:outline-none"
    />
  );
}

function EstadoSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:border-blue-500/50 focus:outline-none"
    >
      <option>Activo</option>
      <option>Inactivo</option>
      <option>Liquidada</option>
    </select>
  );
}

function SociedadSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SociedadRow[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:border-blue-500/50 focus:outline-none"
    >
      <option value="">— Sin asignar —</option>
      {options.map((s) => (
        <option key={s.id_ref} value={s.id_ref}>
          {s.id_ref} — {s.nombre}
        </option>
      ))}
    </select>
  );
}

function EstadoBadge({ estado }: { estado: string | null }) {
  const color =
    estado === 'Activo'
      ? 'text-emerald-400 bg-emerald-500/10'
      : estado === 'Liquidada'
        ? 'text-rose-400 bg-rose-500/10'
        : 'text-zinc-400 bg-zinc-800';
  return (
    <span
      className={`text-2xs rounded-full px-2 py-0.5 font-medium uppercase tracking-wider ${color}`}
    >
      {estado ?? '—'}
    </span>
  );
}

function ActionBtn({
  onClick,
  icon,
  color,
  disabled,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  color: 'green' | 'red' | 'zinc';
  disabled?: boolean;
}) {
  const colors = {
    green: 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30',
    red: 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30',
    zinc: 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all disabled:opacity-40 ${colors[color]}`}
    >
      {icon}
    </button>
  );
}
