import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  MapPin,
  Building2,
  Target,
  ListTodo,
  Wallet,
  TrendingUp,
  Pencil,
  Save,
  Loader2,
  X,
  AlertTriangle,
  Plus,
  Trash2,
  Paperclip,
} from 'lucide-react';
import type { ProyectoRow, SociedadRow, ResumenEliminacion } from '../../lib/proyectosApi';
import {
  updateProyecto,
  getParticipacionesByProyecto,
  setParticipaciones,
  getResumenEliminacion,
  deleteProyectoCompleto,
} from '../../lib/proyectosApi';
import { updateNombreProyectoEnPresupuestos } from '../../lib/presupuestosApi';
import type { ProyectoTab } from '../ProyectosSidebar';
import { TabOKRs } from './tabs/TabOKRs';
import { TabKanban } from './tabs/TabKanban';
import { TabPresupuesto } from './tabs/TabPresupuesto';
import { TabNumeros } from './tabs/TabNumeros';
import { TabDocumentos } from './tabs/TabDocumentos';

const TABS: { id: ProyectoTab; label: string; icon: typeof Target }[] = [
  { id: 'objetivos', label: 'Objetivos', icon: Target },
  { id: 'tareas', label: 'Tareas', icon: ListTodo },
  { id: 'presupuesto-gasto', label: 'Presupuesto Gasto', icon: Wallet },
  { id: 'presupuesto-ingreso', label: 'Presupuesto Ingreso', icon: TrendingUp },
  { id: 'numeros', label: 'Números', icon: TrendingUp },
  { id: 'documentos', label: 'Documentos', icon: Paperclip },
];

const TIPOS_ACTIVO = [
  'Inmueble residencial',
  'Inmueble comercial',
  'Suelo',
  'Embarcación',
  'Empresa',
  'Otro',
];

const lbl = 'block text-2xs font-medium text-zinc-500 uppercase tracking-widest mb-1';
const inp =
  'w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors [color-scheme:dark]';

type Part = { sociedad_id_ref: string; porcentaje: string };

function estadoBadge(estado: string | null) {
  const map: Record<string, string> = {
    activo: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    cerrado: 'bg-zinc-700/30 text-zinc-500 border-zinc-600/20',
    pausado: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  };
  return map[estado ?? ''] ?? 'bg-zinc-700/30 text-zinc-500 border-zinc-600/20';
}

type Props = {
  proyecto: ProyectoRow;
  selectedTab: ProyectoTab;
  isPrivateMode: boolean;
  sociedades: SociedadRow[];
  onTabChange: (t: ProyectoTab) => void;
  onBack: () => void;
  onUpdated?: (p: ProyectoRow) => void;
  onDeleted?: (idRef: string) => void;
};

export function DetalleProyecto({
  proyecto,
  selectedTab,
  isPrivateMode,
  sociedades,
  onTabChange,
  onBack,
  onUpdated,
  onDeleted,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState('');
  const [tipoActivo, setTipoActivo] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [estado, setEstado] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaSalida, setFechaSalida] = useState('');
  const [parts, setParts] = useState<Part[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleStartEdit() {
    setNombre(proyecto.nombre);
    setTipoActivo(proyecto.tipo_activo ?? '');
    setUbicacion(proyecto.ubicacion ?? '');
    setEstado(proyecto.estado ?? 'activo');
    setFechaInicio(proyecto.fecha_inicio ?? '');
    setFechaSalida(proyecto.fecha_prevista_salida ?? '');
    setError('');

    // Cargar participaciones actuales
    try {
      const ps = await getParticipacionesByProyecto(proyecto.id_ref);
      setParts(
        ps.length > 0
          ? ps.map((p) => ({
              sociedad_id_ref: p.sociedad_id_ref,
              porcentaje: String(p.porcentaje),
            }))
          : [{ sociedad_id_ref: proyecto.sociedad_tenedora ?? '', porcentaje: '100' }],
      );
    } catch {
      setParts([{ sociedad_id_ref: proyecto.sociedad_tenedora ?? '', porcentaje: '100' }]);
    }

    setEditing(true);
  }

  const setPart = (i: number, field: keyof Part, value: string) =>
    setParts((p) => p.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));

  const totalPct = parts.reduce((s, p) => s + (parseFloat(p.porcentaje) || 0), 0);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }

    const validParts = parts.filter((p) => p.sociedad_id_ref && parseFloat(p.porcentaje) > 0);
    if (validParts.length === 0) {
      setError('Añade al menos una sociedad.');
      return;
    }
    if (totalPct > 100.01) {
      setError(`La suma de participaciones (${totalPct.toFixed(0)}%) supera el 100%.`);
      return;
    }

    const socisPcts = validParts.map((p) => ({
      sociedad_id_ref: p.sociedad_id_ref,
      porcentaje: parseFloat(p.porcentaje),
    }));
    const principal = [...socisPcts].sort((a, b) => b.porcentaje - a.porcentaje)[0]!;

    setSaving(true);
    setError('');
    try {
      const data = {
        nombre: nombre.trim(),
        tipo_activo: tipoActivo || null,
        ubicacion: ubicacion || null,
        estado: estado || 'activo',
        sociedad_tenedora: principal.sociedad_id_ref,
        fecha_inicio: fechaInicio || null,
        fecha_prevista_salida: fechaSalida || null,
      };
      await updateProyecto(proyecto.id_ref, data);
      await setParticipaciones(proyecto.id_ref, socisPcts);
      if (nombre.trim() !== proyecto.nombre) {
        await updateNombreProyectoEnPresupuestos(proyecto.id_ref, nombre.trim());
      }
      onUpdated?.({ ...proyecto, ...data });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-5">
      {confirmDelete && (
        <ModalEliminarProyecto
          proyecto={proyecto}
          onClose={() => setConfirmDelete(false)}
          onDeleted={() => {
            setConfirmDelete(false);
            onDeleted?.(proyecto.id_ref);
          }}
        />
      )}

      {/* Header — modo lectura */}
      {!editing && (
        <div>
          <button
            onClick={onBack}
            className="mb-3 flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <ArrowLeft size={13} /> Todos los proyectos
          </button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-white">{proyecto.nombre}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                {proyecto.sociedad_tenedora && (
                  <div className="flex items-center gap-1 text-zinc-500">
                    <Building2 size={11} />
                    <span className="text-xs">{proyecto.sociedad_tenedora}</span>
                  </div>
                )}
                {proyecto.ubicacion && (
                  <div className="flex items-center gap-1 text-zinc-500">
                    <MapPin size={11} />
                    <span className="text-xs">{proyecto.ubicacion}</span>
                  </div>
                )}
                {proyecto.tipo_activo && (
                  <span className="text-xs capitalize text-zinc-600">{proyecto.tipo_activo}</span>
                )}
                {proyecto.fecha_inicio && (
                  <span className="text-xs text-zinc-600">
                    {new Date(proyecto.fecha_inicio).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {proyecto.fecha_prevista_salida && (
                      <>
                        {' '}
                        →{' '}
                        {new Date(proyecto.fecha_prevista_salida).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => void handleStartEdit()}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-500 transition-all hover:border-white/20 hover:text-white"
              >
                <Pencil size={11} /> Editar
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                title="Eliminar proyecto"
                className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all hover:border-rose-500/30 hover:text-rose-400"
              >
                <Trash2 size={11} /> Eliminar
              </button>
              <span
                className={`text-2xs rounded-lg border px-2 py-1 font-semibold uppercase tracking-wider ${estadoBadge(proyecto.estado)}`}
              >
                {proyecto.estado ?? '—'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Header — modo edición */}
      {editing && (
        <div>
          <button
            onClick={onBack}
            className="mb-3 flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <ArrowLeft size={13} /> Todos los proyectos
          </button>

          <form
            onSubmit={(e) => void handleSave(e)}
            className="space-y-5 rounded-2xl border border-blue-500/20 bg-zinc-900/40 p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
                Editar proyecto
              </p>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="p-1 text-zinc-600 transition-colors hover:text-zinc-300"
              >
                <X size={14} />
              </button>
            </div>

            {/* Datos básicos */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={lbl}>Nombre *</label>
                <input
                  className={inp}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre del proyecto"
                />
              </div>

              <div>
                <label className={lbl}>Tipo de activo</label>
                <select
                  className={inp}
                  value={tipoActivo}
                  onChange={(e) => setTipoActivo(e.target.value)}
                >
                  <option value="">— Seleccionar —</option>
                  {TIPOS_ACTIVO.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={lbl}>Estado</label>
                <select className={inp} value={estado} onChange={(e) => setEstado(e.target.value)}>
                  <option value="activo">Activo</option>
                  <option value="pausado">Pausado</option>
                  <option value="cerrado">Cerrado</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className={lbl}>Ubicación</label>
                <input
                  className={inp}
                  value={ubicacion}
                  onChange={(e) => setUbicacion(e.target.value)}
                  placeholder="Ej: Málaga, Torremolinos..."
                />
              </div>

              <div>
                <label className={lbl}>Fecha de inicio</label>
                <input
                  type="date"
                  className={inp}
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                />
              </div>

              <div>
                <label className={lbl}>Salida prevista</label>
                <input
                  type="date"
                  className={inp}
                  value={fechaSalida}
                  onChange={(e) => setFechaSalida(e.target.value)}
                />
              </div>
            </div>

            {/* Propiedad */}
            <div className="space-y-3 border-t border-white/[0.05] pt-4">
              <div className="flex items-center justify-between">
                <p className={lbl + ' mb-0'}>Propiedad del holding</p>
                {totalPct < 99.9 && totalPct > 0 && (
                  <span className="text-2xs text-zinc-600">
                    {(100 - totalPct).toFixed(0)}% en manos de terceros
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {parts.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      className={`${inp} flex-1`}
                      value={p.sociedad_id_ref}
                      onChange={(e) => setPart(i, 'sociedad_id_ref', e.target.value)}
                    >
                      <option value="">— Sociedad del holding —</option>
                      {sociedades.map((s) => (
                        <option key={s.id_ref} value={s.id_ref}>
                          {s.nombre}
                        </option>
                      ))}
                    </select>
                    <div className="relative w-24 shrink-0">
                      <input
                        type="number"
                        min="0.01"
                        max="100"
                        step="0.01"
                        className={`${inp} pr-7`}
                        placeholder="100"
                        value={p.porcentaje}
                        onChange={(e) => setPart(i, 'porcentaje', e.target.value)}
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                        %
                      </span>
                    </div>
                    {parts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setParts((ps) => ps.filter((_, idx) => idx !== i))}
                        className="shrink-0 text-zinc-600 transition-colors hover:text-rose-400"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {totalPct > 100.01 && (
                <p className="flex items-center gap-1.5 text-xs text-rose-400">
                  <AlertTriangle size={12} /> La suma supera el 100% ({totalPct.toFixed(0)}%)
                </p>
              )}

              <button
                type="button"
                onClick={() => setParts((ps) => [...ps, { sociedad_id_ref: '', porcentaje: '' }])}
                className="flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
              >
                <Plus size={12} /> Añadir otra sociedad del holding
              </button>
            </div>

            {error && (
              <p className="flex items-center gap-1.5 text-xs text-rose-400">
                <AlertTriangle size={12} /> {error}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Guardar cambios
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.06] pb-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = selectedTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-medium transition-all ${
                active
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {selectedTab === 'objetivos' && <TabOKRs proyectoId={proyecto.id_ref} />}
        {selectedTab === 'tareas' && <TabKanban proyectoId={proyecto.id_ref} />}
        {selectedTab === 'presupuesto-gasto' && (
          <TabPresupuesto
            proyectoId={proyecto.id_ref}
            proyectoNombre={proyecto.nombre}
            isPrivateMode={isPrivateMode}
            categoria="gasto"
          />
        )}
        {selectedTab === 'presupuesto-ingreso' && (
          <TabPresupuesto
            proyectoId={proyecto.id_ref}
            proyectoNombre={proyecto.nombre}
            isPrivateMode={isPrivateMode}
            categoria="ingreso"
          />
        )}
        {selectedTab === 'numeros' && <TabNumeros proyecto={proyecto} />}
        {selectedTab === 'documentos' && <TabDocumentos proyectoId={proyecto.id_ref} />}
      </div>
    </div>
  );
}

// ── Modal de eliminación ────────────────────────────────────────────────────────

function ModalEliminarProyecto({
  proyecto,
  onClose,
  onDeleted,
}: {
  proyecto: ProyectoRow;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [resumen, setResumen] = useState<ResumenEliminacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getResumenEliminacion(proyecto.id_ref)
      .then(setResumen)
      .catch(() => setResumen({ presupuestos: 0, objetivos: 0, tareas: 0, facturasVinculadas: 0 }))
      .finally(() => setLoading(false));
  }, [proyecto.id_ref]);

  const puedeEliminar = confirmText.trim() === proyecto.nombre.trim();

  async function handleDelete() {
    if (!puedeEliminar) return;
    setDeleting(true);
    setError('');
    try {
      await deleteProyectoCompleto(proyecto.id_ref);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar el proyecto');
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-rose-500/20 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-6 py-4">
          <div className="rounded-xl bg-rose-500/15 p-2 text-rose-400">
            <Trash2 size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Eliminar proyecto</p>
            <p className="truncate text-xs text-zinc-500">{proyecto.nombre}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 transition-colors hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-zinc-500">
              <Loader2 size={14} className="animate-spin" /> Calculando lo que se eliminará...
            </div>
          ) : (
            <>
              <p className="text-sm text-zinc-300">
                Esta acción es <span className="font-semibold text-rose-400">irreversible</span>. Se
                eliminarán permanentemente:
              </p>

              <div className="space-y-1.5 text-sm">
                <FilaResumen
                  n={resumen?.presupuestos ?? 0}
                  label="presupuestos"
                  sublabel="con sus capítulos, partidas y pagos"
                />
                <FilaResumen
                  n={resumen?.objetivos ?? 0}
                  label="objetivos (OKR)"
                  sublabel="con sus key results"
                />
                <FilaResumen n={resumen?.tareas ?? 0} label="tareas" sublabel="del panel kanban" />
                <FilaResumen
                  n={1}
                  label="ficha del proyecto"
                  sublabel="datos, escenarios y análisis financiero"
                  forzar
                />
              </div>

              {(resumen?.facturasVinculadas ?? 0) > 0 && (
                <div className="flex items-start gap-2.5 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2.5 text-xs text-blue-300">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>
                    {resumen!.facturasVinculadas}{' '}
                    {resumen!.facturasVinculadas === 1
                      ? 'factura vinculada se conservará'
                      : 'facturas vinculadas se conservarán'}{' '}
                    en el módulo de Facturas, pero perderán el vínculo a este proyecto.
                  </span>
                </div>
              )}

              <div>
                <label className="text-2xs mb-1.5 block font-medium uppercase tracking-widest text-zinc-500">
                  Escribe{' '}
                  <span className="font-semibold normal-case tracking-normal text-zinc-300">
                    {proyecto.nombre}
                  </span>{' '}
                  para confirmar
                </label>
                <input
                  autoFocus
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && puedeEliminar) void handleDelete();
                  }}
                  placeholder={proyecto.nombre}
                  className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white transition-colors placeholder:text-zinc-700 focus:border-rose-500/50 focus:outline-none"
                />
              </div>

              {error && (
                <p className="flex items-center gap-1.5 text-xs text-rose-400">
                  <AlertTriangle size={12} /> {error}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-6 py-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-400 transition-colors hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={() => void handleDelete()}
            disabled={!puedeEliminar || deleting}
            className="flex items-center gap-2 rounded-xl bg-rose-600/90 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Eliminar definitivamente
          </button>
        </div>
      </div>
    </div>
  );
}

function FilaResumen({
  n,
  label,
  sublabel,
  forzar,
}: {
  n: number;
  label: string;
  sublabel: string;
  forzar?: boolean;
}) {
  const apagado = n === 0 && !forzar;
  return (
    <div className={`flex items-baseline gap-2 ${apagado ? 'opacity-40' : ''}`}>
      <span
        className={`text-sm font-semibold tabular-nums ${apagado ? 'text-zinc-600' : 'text-rose-400'}`}
      >
        {forzar ? '' : n}
      </span>
      <span className="text-sm text-zinc-300">{label}</span>
      <span className="text-2xs text-zinc-600">{sublabel}</span>
    </div>
  );
}
