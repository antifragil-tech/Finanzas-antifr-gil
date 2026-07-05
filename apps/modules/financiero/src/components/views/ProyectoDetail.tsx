import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  FolderOpen,
  TrendingUp,
  Check,
  RefreshCw,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  X,
  Activity,
} from 'lucide-react';
import type { ProyectoRow, KpisProjRow, SociedadRow } from '../../lib/maestroParser';
import type { FlujoCajaRow, TipoFlujo, ProyectoDetalle } from '@alsari/types';
import {
  updateProyecto,
  getKpisProyecto,
  saveKpisProyecto,
  getProyectoDetalle,
  updateProyectoDetalle,
  getFlujosCajaProyecto,
  insertFlujoCaja,
  updateFlujoCaja,
  deleteFlujoCaja,
} from '../../lib/maestroImport';
import { calcularMetricasProyecto } from '@alsari/utils';
import { formatCurrency } from '@alsari/utils';

type Props = {
  proyecto: ProyectoRow;
  sociedades: SociedadRow[];
  onBack: () => void;
  onRefresh?: () => void;
};

const EMPTY_KPIS = (idRef: string, nombre: string, sociedad: string | null): KpisProjRow => ({
  id_ref: idRef,
  nombre,
  tipo: null,
  sociedad_tenedora: sociedad,
  presupuesto: null,
  inversion_inicial: null,
  recapex_acumulado: null,
  capital_expuesto: null,
  deuda: null,
  beneficio_acumulado_bruto: null,
  opex_acumulado: null,
  valoracion: null,
  margen_latente_salida: null,
  margen_latente_salida_pct: null,
  fecha_actualizacion: null,
});

const EMPTY_DETALLE = (p: ProyectoRow): ProyectoDetalle => ({
  id_ref: p.id_ref,
  nombre: p.nombre,
  sociedad_tenedora: p.sociedad_tenedora,
  estado: p.estado,
  fecha_inicio: null,
  fecha_prevista_salida: null,
  fecha_salida_real: null,
  tipo_activo: null,
  ubicacion: null,
  superficie_m2: null,
});

const EMPTY_FLUJO = (
  proyectoId: string,
): Omit<FlujoCajaRow, 'id' | 'created_at' | 'updated_at'> => ({
  proyecto_id: proyectoId,
  fecha: new Date().toISOString().slice(0, 10),
  importe: 0,
  tipo_flujo: 'inversion',
  concepto: null,
});

const TIPO_FLUJO_LABELS: Record<TipoFlujo, string> = {
  inversion: 'Inversión',
  recapex: 'ReCapex',
  venta: 'Venta',
  dividendo: 'Dividendo',
  ingreso_operativo: 'Ingreso Op.',
  gasto_operativo: 'Gasto Op.',
  otro: 'Otro',
};

const TIPO_FLUJO_COLOR: Record<TipoFlujo, string> = {
  inversion: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  recapex: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  venta: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  dividendo: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
  ingreso_operativo: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/20',
  gasto_operativo: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
  otro: 'bg-zinc-700/30 text-zinc-400 border-zinc-600/20',
};

const TASA_DEFAULT = 0.08;

export function ProyectoDetail({ proyecto, sociedades, onBack, onRefresh }: Props) {
  // ── Datos básicos ─────────────────────────────────────────────────────────────
  const [info, setInfo] = useState<ProyectoRow>({ ...proyecto });
  const [savingInfo, setSavingInfo] = useState(false);
  const [savedInfo, setSavedInfo] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  // ── Detalle descriptivo ───────────────────────────────────────────────────────
  const [detalle, setDetalle] = useState<ProyectoDetalle>(EMPTY_DETALLE(proyecto));
  const [loadingDetalle, setLoadingDetalle] = useState(true);
  const [savingDetalle, setSavingDetalle] = useState(false);
  const [savedDetalle, setSavedDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const [kpis, setKpis] = useState<KpisProjRow>(
    EMPTY_KPIS(proyecto.id_ref, proyecto.nombre, proyecto.sociedad_tenedora),
  );
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [savingKpis, setSavingKpis] = useState(false);
  const [savedKpis, setSavedKpis] = useState(false);
  const [errorKpis, setErrorKpis] = useState<string | null>(null);

  // ── Flujos de caja ────────────────────────────────────────────────────────────
  const [flujos, setFlujos] = useState<FlujoCajaRow[]>([]);
  const [loadingFlujos, setLoadingFlujos] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<FlujoCajaRow & { importe_str: string }>>({});
  const [savingFlujo, setSavingFlujo] = useState(false);
  const [errorFlujo, setErrorFlujo] = useState<string | null>(null);

  // ── Métricas ──────────────────────────────────────────────────────────────────
  const [tasa, setTasa] = useState(TASA_DEFAULT);
  const [editingTasa, setEditingTasa] = useState(false);
  const [tasaInput, setTasaInput] = useState('8');

  const metricas = useMemo(
    () => calcularMetricasProyecto(flujos, detalle.fecha_inicio, tasa),
    [flujos, detalle.fecha_inicio, tasa],
  );

  // ── Carga inicial ─────────────────────────────────────────────────────────────
  const recargar = useCallback(async () => {
    setLoadingKpis(true);
    setLoadingDetalle(true);
    setLoadingFlujos(true);
    const [found, det, fl] = await Promise.all([
      getKpisProyecto(proyecto.id_ref).catch(() => null),
      getProyectoDetalle(proyecto.id_ref).catch(() => null),
      getFlujosCajaProyecto(proyecto.id_ref).catch(() => [] as FlujoCajaRow[]),
    ]);
    setKpis(found ?? EMPTY_KPIS(proyecto.id_ref, proyecto.nombre, proyecto.sociedad_tenedora));
    setDetalle(det ?? EMPTY_DETALLE(proyecto));
    setFlujos(fl);
    setLoadingKpis(false);
    setLoadingDetalle(false);
    setLoadingFlujos(false);
  }, [proyecto]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  // ── Guardado ──────────────────────────────────────────────────────────────────
  const saveInfo = async () => {
    setSavingInfo(true);
    setErrorInfo(null);
    try {
      await updateProyecto(proyecto.id_ref, {
        nombre: info.nombre,
        sociedad_tenedora: info.sociedad_tenedora,
        estado: info.estado,
      });
      setSavedInfo(true);
      setTimeout(() => setSavedInfo(false), 2500);
      onRefresh?.();
    } catch (e) {
      setErrorInfo(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingInfo(false);
    }
  };

  const saveDetalle = async () => {
    setSavingDetalle(true);
    setErrorDetalle(null);
    try {
      await updateProyectoDetalle(proyecto.id_ref, {
        fecha_inicio: detalle.fecha_inicio,
        fecha_prevista_salida: detalle.fecha_prevista_salida,
        fecha_salida_real: detalle.fecha_salida_real,
        tipo_activo: detalle.tipo_activo,
        ubicacion: detalle.ubicacion,
        superficie_m2: detalle.superficie_m2,
      });
      setSavedDetalle(true);
      setTimeout(() => setSavedDetalle(false), 2500);
    } catch (e) {
      setErrorDetalle(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingDetalle(false);
    }
  };

  const saveKpis = async () => {
    setSavingKpis(true);
    setErrorKpis(null);
    try {
      await saveKpisProyecto({
        ...kpis,
        id_ref: proyecto.id_ref,
        nombre: info.nombre,
        sociedad_tenedora: info.sociedad_tenedora,
      });
      setSavedKpis(true);
      setTimeout(() => setSavedKpis(false), 2500);
    } catch (e) {
      setErrorKpis(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingKpis(false);
    }
  };

  // ── Flujos CRUD ───────────────────────────────────────────────────────────────
  const startNewFlujo = () => {
    setEditingId('new');
    setEditForm(EMPTY_FLUJO(proyecto.id_ref));
    setErrorFlujo(null);
  };

  const startEditFlujo = (f: FlujoCajaRow) => {
    setEditingId(f.id);
    setEditForm({ ...f, importe_str: String(f.importe) });
    setErrorFlujo(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveFlujo = async () => {
    setSavingFlujo(true);
    setErrorFlujo(null);
    try {
      const importe = parseFloat(String(editForm.importe_str ?? editForm.importe ?? '0'));
      if (isNaN(importe)) throw new Error('Importe inválido');
      if (!editForm.fecha) throw new Error('Fecha obligatoria');

      if (editingId === 'new') {
        const nuevo = await insertFlujoCaja({
          proyecto_id: proyecto.id_ref,
          fecha: editForm.fecha,
          importe,
          tipo_flujo: (editForm.tipo_flujo ?? 'inversion') as TipoFlujo,
          concepto: editForm.concepto ?? null,
        });
        setFlujos((prev) => [...prev, nuevo].sort((a, b) => a.fecha.localeCompare(b.fecha)));
      } else if (editingId) {
        await updateFlujoCaja(editingId, {
          fecha: editForm.fecha,
          importe,
          tipo_flujo: editForm.tipo_flujo as TipoFlujo,
          concepto: editForm.concepto ?? null,
        });
        setFlujos((prev) =>
          prev.map((f) =>
            f.id === editingId
              ? {
                  ...f,
                  fecha: editForm.fecha!,
                  importe,
                  tipo_flujo: editForm.tipo_flujo as TipoFlujo,
                  concepto: editForm.concepto ?? null,
                }
              : f,
          ),
        );
      }
      setEditingId(null);
      setEditForm({});
    } catch (e) {
      setErrorFlujo(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingFlujo(false);
    }
  };

  const deleteFlujo = async (id: string) => {
    try {
      await deleteFlujoCaja(id);
      setFlujos((prev) => prev.filter((f) => f.id !== id));
    } catch (e) {
      setErrorFlujo(e instanceof Error ? e.message : 'Error');
    }
  };

  // ── Totales flujos ────────────────────────────────────────────────────────────
  const totalEntradas = flujos.filter((f) => f.importe > 0).reduce((s, f) => s + f.importe, 0);
  const totalSalidas = flujos.filter((f) => f.importe < 0).reduce((s, f) => s + f.importe, 0);
  const saldoNeto = totalEntradas + totalSalidas;

  const socOptions = sociedades.filter(
    (s) => s.id_ref.startsWith('S-') || s.id_ref.startsWith('H-'),
  );

  return (
    <div className="max-w-4xl space-y-8 p-8">
      {/* Cabecera */}
      <div>
        <button
          onClick={onBack}
          className="mb-5 flex items-center gap-2 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft size={14} />
          Volver a Datos Maestros
        </button>
        <div className="flex items-center gap-4">
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/15 p-3 text-violet-400">
            <FolderOpen size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">{proyecto.nombre}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="font-mono text-xs text-zinc-500">
                {proyecto.id_ref}
                {proyecto.sociedad_tenedora ? ` · ${proyecto.sociedad_tenedora}` : ''}
              </p>
              {detalle.tipo_activo && <Badge color="violet">{detalle.tipo_activo}</Badge>}
              {detalle.ubicacion && <Badge color="zinc">{detalle.ubicacion}</Badge>}
              {metricas.dias_desde_inicio != null && (
                <Badge color="blue">
                  {metricas.dias_desde_inicio}d · {(metricas.dias_desde_inicio / 365.25).toFixed(1)}
                  a
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Datos del Proyecto ─────────────────────────────────────────────── */}
      <Card icon={<FolderOpen size={15} />} title="Datos del Proyecto">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-2xs block font-medium uppercase tracking-widest text-zinc-500">
              Nombre
            </label>
            <input
              value={info.nombre}
              onChange={(e) => setInfo((f) => ({ ...f, nombre: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white transition-colors focus:border-violet-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-2xs block font-medium uppercase tracking-widest text-zinc-500">
              Sociedad Tenedora
            </label>
            <select
              value={info.sociedad_tenedora ?? ''}
              onChange={(e) =>
                setInfo((f) => ({ ...f, sociedad_tenedora: e.target.value || null }))
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white transition-colors focus:border-violet-500/50 focus:outline-none"
            >
              <option value="">— Sin asignar —</option>
              {socOptions.map((s) => (
                <option key={s.id_ref} value={s.id_ref}>
                  {s.id_ref} — {s.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-2xs block font-medium uppercase tracking-widest text-zinc-500">
              Estado
            </label>
            <select
              value={info.estado ?? 'Activo'}
              onChange={(e) => setInfo((f) => ({ ...f, estado: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white transition-colors focus:border-violet-500/50 focus:outline-none"
            >
              <option>Activo</option>
              <option>En venta</option>
              <option>Cerrado</option>
              <option>Inactivo</option>
            </select>
          </div>
        </div>
        {errorInfo && <Err msg={errorInfo} />}
        <SaveBtn onClick={saveInfo} saving={savingInfo} saved={savedInfo} />
      </Card>

      {/* ── Ficha del Activo ───────────────────────────────────────────────── */}
      <Card icon={<FolderOpen size={15} />} title="Ficha del Activo">
        {loadingDetalle ? (
          <Spinner />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-2xs block font-medium uppercase tracking-widest text-zinc-500">
                  Tipo de Activo
                </label>
                <select
                  value={detalle.tipo_activo ?? ''}
                  onChange={(e) =>
                    setDetalle((d) => ({ ...d, tipo_activo: e.target.value || null }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white transition-colors focus:border-violet-500/50 focus:outline-none"
                >
                  <option value="">—</option>
                  <option value="residencial">Residencial</option>
                  <option value="comercial">Comercial</option>
                  <option value="logístico">Logístico</option>
                  <option value="industrial">Industrial</option>
                  <option value="suelo">Suelo</option>
                  <option value="mixto">Mixto</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <FldTxt
                label="Ubicación"
                value={detalle.ubicacion ?? ''}
                onChange={(v) => setDetalle((d) => ({ ...d, ubicacion: v || null }))}
                placeholder="Ciudad o municipio"
              />
              <FldNum
                label="Superficie (m²)"
                value={detalle.superficie_m2}
                onChange={(v) => setDetalle((d) => ({ ...d, superficie_m2: v }))}
              />
              <div className="col-span-2 mt-1 border-t border-white/5 pt-4">
                <p className="text-2xs mb-3 font-semibold uppercase tracking-widest text-zinc-600">
                  Temporalidad
                </p>
              </div>
              <FldDate
                label="Fecha de Inicio"
                value={detalle.fecha_inicio ?? ''}
                onChange={(v) => setDetalle((d) => ({ ...d, fecha_inicio: v || null }))}
              />
              <FldDate
                label="Fecha Prevista Salida"
                value={detalle.fecha_prevista_salida ?? ''}
                onChange={(v) => setDetalle((d) => ({ ...d, fecha_prevista_salida: v || null }))}
              />
              <FldDate
                label="Fecha Salida Real"
                value={detalle.fecha_salida_real ?? ''}
                onChange={(v) => setDetalle((d) => ({ ...d, fecha_salida_real: v || null }))}
              />
            </div>
            {errorDetalle && <Err msg={errorDetalle} />}
            <SaveBtn onClick={saveDetalle} saving={savingDetalle} saved={savedDetalle} />
          </>
        )}
      </Card>

      {/* ── KPIs de Inversión ─────────────────────────────────────────────── */}
      <Card icon={<TrendingUp size={15} />} title="KPIs de Inversión">
        {loadingKpis ? (
          <Spinner />
        ) : (
          <>
            <p className="text-2xs mb-4 font-medium uppercase tracking-widest text-zinc-600">
              Capital y financiación
            </p>
            <div className="grid grid-cols-2 gap-4">
              <FldNum
                label="Presupuesto (€)"
                value={kpis.presupuesto}
                onChange={(v) => setKpis((k) => ({ ...k, presupuesto: v }))}
              />
              <FldNum
                label="Inversión Inicial (€)"
                value={kpis.inversion_inicial}
                onChange={(v) => setKpis((k) => ({ ...k, inversion_inicial: v }))}
              />
              <FldNum
                label="ReCapex Acumulado (€)"
                value={kpis.recapex_acumulado}
                onChange={(v) => setKpis((k) => ({ ...k, recapex_acumulado: v }))}
              />
              <FldNum
                label="Deuda (€)"
                value={kpis.deuda}
                onChange={(v) => setKpis((k) => ({ ...k, deuda: v }))}
              />
            </div>
            <p className="text-2xs mb-4 mt-5 font-medium uppercase tracking-widest text-zinc-600">
              Resultado y valoración
            </p>
            <div className="grid grid-cols-2 gap-4">
              <FldNum
                label="Beneficio Acumulado Bruto (€)"
                value={kpis.beneficio_acumulado_bruto}
                onChange={(v) => setKpis((k) => ({ ...k, beneficio_acumulado_bruto: v }))}
              />
              <FldNum
                label="OPEX Acumulado (€)"
                value={kpis.opex_acumulado}
                onChange={(v) => setKpis((k) => ({ ...k, opex_acumulado: v }))}
              />
              <FldNum
                label="Valoración (€)"
                value={kpis.valoracion}
                onChange={(v) => setKpis((k) => ({ ...k, valoracion: v }))}
              />
              <FldNum
                label="Margen Latente Salida (€)"
                value={kpis.margen_latente_salida}
                onChange={(v) => setKpis((k) => ({ ...k, margen_latente_salida: v }))}
              />
              <FldNum
                label="Margen Latente Salida (%)"
                value={
                  kpis.margen_latente_salida_pct !== null
                    ? kpis.margen_latente_salida_pct * 100
                    : null
                }
                onChange={(v) =>
                  setKpis((k) => ({ ...k, margen_latente_salida_pct: v !== null ? v / 100 : null }))
                }
              />
              <div>
                <label className="text-2xs block font-medium uppercase tracking-widest text-zinc-500">
                  Fecha Actualización
                </label>
                <input
                  type="date"
                  value={kpis.fecha_actualizacion ?? ''}
                  onChange={(e) =>
                    setKpis((k) => ({ ...k, fecha_actualizacion: e.target.value || null }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white transition-colors focus:border-violet-500/50 focus:outline-none"
                />
              </div>
            </div>
            {errorKpis && <Err msg={errorKpis} />}
            <SaveBtn onClick={saveKpis} saving={savingKpis} saved={savedKpis} />
          </>
        )}
      </Card>

      {/* ── Métricas Calculadas ───────────────────────────────────────────── */}
      {flujos.length >= 2 && (
        <Card icon={<Activity size={15} />} title="Métricas Calculadas">
          <div className="mb-4 grid grid-cols-2 gap-4">
            <MetricaCard
              label="TIR (XIRR)"
              sublabel="Tasa Interna de Retorno"
              value={metricas.tir != null ? `${(metricas.tir * 100).toFixed(2)}%` : '—'}
              positive={metricas.tir != null && metricas.tir > 0}
              negative={metricas.tir != null && metricas.tir <= 0}
            />
            <MetricaCard
              label="VAN"
              sublabel={`tasa: ${(tasa * 100).toFixed(2)}%`}
              value={metricas.van != null ? formatCurrency(metricas.van) : '—'}
              positive={metricas.van != null && metricas.van > 0}
              negative={metricas.van != null && metricas.van <= 0}
            />
            <MetricaCard
              label="MOIC"
              sublabel="Múltiplo sobre capital"
              value={metricas.moic != null ? `×${metricas.moic.toFixed(2)}` : '—'}
              positive={metricas.moic != null && metricas.moic > 1}
              negative={metricas.moic != null && metricas.moic <= 1}
            />
            <MetricaCard
              label="Período"
              sublabel={
                metricas.dias_desde_inicio != null
                  ? `${(metricas.dias_desde_inicio / 365.25).toFixed(1)} años desde inicio`
                  : 'Sin fecha de inicio'
              }
              value={
                metricas.periodo_inversion_dias != null
                  ? `${metricas.periodo_inversion_dias}d`
                  : metricas.dias_desde_inicio != null
                    ? `${metricas.dias_desde_inicio}d`
                    : '—'
              }
            />
          </div>
          <div className="mt-2 flex items-center gap-3">
            {editingTasa ? (
              <>
                <span className="text-2xs font-medium uppercase tracking-widest text-zinc-500">
                  Tasa VAN (%)
                </span>
                <input
                  type="number"
                  value={tasaInput}
                  onChange={(e) => setTasaInput(e.target.value)}
                  className="w-24 rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-sm text-white focus:border-violet-500/50 focus:outline-none"
                  step="0.5"
                  min="0"
                  max="100"
                />
                <button
                  onClick={() => {
                    const v = parseFloat(tasaInput);
                    if (!isNaN(v)) setTasa(v / 100);
                    setEditingTasa(false);
                  }}
                  className="rounded p-1 text-emerald-400 transition-colors hover:bg-emerald-500/10"
                >
                  <Check size={13} />
                </button>
                <button
                  onClick={() => setEditingTasa(false)}
                  className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800"
                >
                  <X size={13} />
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setTasaInput(String(tasa * 100));
                  setEditingTasa(true);
                }}
                className="text-2xs rounded-lg border border-white/5 px-3 py-1.5 font-medium uppercase tracking-widest text-zinc-500 transition-colors hover:text-zinc-300"
              >
                Cambiar tasa VAN ({(tasa * 100).toFixed(1)}%)
              </button>
            )}
          </div>
        </Card>
      )}

      {/* ── Flujos de Caja ────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
        <div className="flex items-center justify-between border-b border-white/5 bg-zinc-900/50 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="text-violet-400">
              <TrendingUp size={15} />
            </span>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
              Flujos de Caja
            </h2>
            {flujos.length > 0 && (
              <span className="text-2xs rounded-full border border-white/5 bg-zinc-800 px-2 py-0.5 font-medium text-zinc-400">
                {flujos.length}
              </span>
            )}
          </div>
          <button
            onClick={startNewFlujo}
            disabled={editingId !== null}
            className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/20 px-3 py-1.5 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-500/30 disabled:opacity-40"
          >
            <Plus size={12} />
            Añadir flujo
          </button>
        </div>
        <div className="p-6">
          {loadingFlujos ? (
            <Spinner />
          ) : (
            <>
              {errorFlujo && <Err msg={errorFlujo} />}
              {flujos.length === 0 && editingId !== 'new' ? (
                <p className="py-6 text-center text-xs text-zinc-600">
                  Sin flujos registrados. Añade el primer movimiento de caja para calcular TIR, VAN
                  y MOIC.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-2xs border-b border-white/5 uppercase tracking-widest text-zinc-500">
                        <th className="pb-2 text-left font-medium">Fecha</th>
                        <th className="pb-2 text-left font-medium">Tipo</th>
                        <th className="pb-2 text-left font-medium">Concepto</th>
                        <th className="pb-2 text-right font-medium">Importe (€)</th>
                        <th className="w-16 pb-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {/* Fila nueva */}
                      {editingId === 'new' && (
                        <FilaEdicion
                          form={editForm}
                          onChange={setEditForm}
                          onSave={saveFlujo}
                          onCancel={cancelEdit}
                          saving={savingFlujo}
                        />
                      )}
                      {flujos.map((f) =>
                        editingId === f.id ? (
                          <FilaEdicion
                            key={f.id}
                            form={editForm}
                            onChange={setEditForm}
                            onSave={saveFlujo}
                            onCancel={cancelEdit}
                            saving={savingFlujo}
                          />
                        ) : (
                          <tr
                            key={f.id}
                            className="group border-b border-white/[0.03] transition-colors hover:bg-white/[0.02]"
                          >
                            <td className="py-2.5 pr-4 font-mono text-xs text-zinc-300">
                              {new Date(f.fecha).toLocaleDateString('es-ES')}
                            </td>
                            <td className="py-2.5 pr-4">
                              <span
                                className={`text-2xs rounded-full border px-2 py-0.5 font-medium uppercase tracking-wide ${TIPO_FLUJO_COLOR[f.tipo_flujo]}`}
                              >
                                {TIPO_FLUJO_LABELS[f.tipo_flujo]}
                              </span>
                            </td>
                            <td className="max-w-[180px] truncate py-2.5 pr-4 text-xs text-zinc-400">
                              {f.concepto ?? '—'}
                            </td>
                            <td
                              className={`py-2.5 text-right font-mono text-sm font-medium ${f.importe >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                            >
                              {f.importe >= 0 ? '+' : ''}
                              {formatCurrency(f.importe)}
                            </td>
                            <td className="py-2.5 pl-3">
                              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                  onClick={() => startEditFlujo(f)}
                                  className="rounded p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  onClick={() => {
                                    void deleteFlujo(f.id);
                                  }}
                                  className="rounded p-1 text-zinc-500 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                    {flujos.length > 0 && (
                      <tfoot className="border-t border-white/10">
                        <tr>
                          <td
                            colSpan={3}
                            className="text-2xs pt-3 font-medium uppercase tracking-widest text-zinc-500"
                          >
                            Totales
                          </td>
                          <td className="pt-3 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="font-mono text-xs font-medium text-emerald-400">
                                +{formatCurrency(totalEntradas)}
                              </span>
                              <span className="font-mono text-xs font-medium text-rose-400">
                                {formatCurrency(totalSalidas)}
                              </span>
                              <span
                                className={`font-mono text-sm font-semibold ${saldoNeto >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}
                              >
                                {saldoNeto >= 0 ? '+' : ''}
                                {formatCurrency(saldoNeto)}
                              </span>
                            </div>
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Fila de edición ───────────────────────────────────────────────────────────

type FilaEdicionProps = {
  form: Partial<FlujoCajaRow & { importe_str: string }>;
  onChange: (f: Partial<FlujoCajaRow & { importe_str: string }>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
};

function FilaEdicion({ form, onChange, onSave, onCancel, saving }: FilaEdicionProps) {
  return (
    <tr className="border-b border-violet-500/20 bg-violet-500/[0.03]">
      <td className="py-2 pr-2">
        <input
          type="date"
          value={form.fecha ?? ''}
          onChange={(e) => onChange({ ...form, fecha: e.target.value })}
          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:border-violet-500/50 focus:outline-none"
        />
      </td>
      <td className="py-2 pr-2">
        <select
          value={form.tipo_flujo ?? 'inversion'}
          onChange={(e) => onChange({ ...form, tipo_flujo: e.target.value as TipoFlujo })}
          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:border-violet-500/50 focus:outline-none"
        >
          {(Object.keys(TIPO_FLUJO_LABELS) as TipoFlujo[]).map((t) => (
            <option key={t} value={t}>
              {TIPO_FLUJO_LABELS[t]}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-2">
        <input
          type="text"
          value={form.concepto ?? ''}
          onChange={(e) => onChange({ ...form, concepto: e.target.value || null })}
          placeholder="Concepto (opcional)"
          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none"
        />
      </td>
      <td className="py-2 pr-2">
        <input
          type="number"
          value={form.importe_str ?? form.importe ?? ''}
          onChange={(e) => onChange({ ...form, importe_str: e.target.value })}
          placeholder="Importe (− salida, + entrada)"
          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-right text-xs text-white placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none"
        />
      </td>
      <td className="py-2 pl-1">
        <div className="flex items-center gap-1">
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded p-1.5 text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:opacity-40"
          >
            {saving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
          </button>
          <button
            onClick={onCancel}
            className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800"
          >
            <X size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Helpers de UI ─────────────────────────────────────────────────────────────

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
      <div className="flex items-center gap-2.5 border-b border-white/5 bg-zinc-900/50 px-6 py-4">
        <span className="text-violet-400">{icon}</span>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function MetricaCard({
  label,
  sublabel,
  value,
  positive,
  negative,
}: {
  label: string;
  sublabel: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  const color = positive ? 'text-emerald-400' : negative ? 'text-rose-400' : 'text-zinc-300';
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
      <p className="text-2xs mb-1 font-medium uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      <p className="text-2xs mt-1 text-zinc-600">{sublabel}</p>
    </div>
  );
}

function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: 'violet' | 'blue' | 'zinc';
}) {
  const cls = {
    violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    zinc: 'bg-zinc-800 text-zinc-400 border-white/5',
  }[color];
  return (
    <span className={`text-2xs rounded-full border px-2 py-0.5 font-medium ${cls}`}>
      {children}
    </span>
  );
}

function FldTxt({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-2xs block font-medium uppercase tracking-widest text-zinc-500">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white transition-colors placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none"
      />
    </div>
  );
}

function FldNum({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <label className="text-2xs block font-medium uppercase tracking-widest text-zinc-500">
        {label}
      </label>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
        className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white transition-colors placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none"
      />
    </div>
  );
}

function FldDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-2xs block font-medium uppercase tracking-widest text-zinc-500">
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white transition-colors focus:border-violet-500/50 focus:outline-none"
      />
    </div>
  );
}

function SaveBtn({
  onClick,
  saving,
  saved,
}: {
  onClick: () => void;
  saving: boolean;
  saved: boolean;
}) {
  return (
    <div className="mt-5 flex justify-end">
      <button
        onClick={onClick}
        disabled={saving}
        className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all disabled:opacity-50 ${saved ? 'border border-emerald-500/30 bg-emerald-500/20 text-emerald-300' : 'border border-violet-500/30 bg-violet-500/20 text-violet-200 hover:bg-violet-500/30'}`}
      >
        {saving ? (
          <RefreshCw size={14} className="animate-spin" />
        ) : saved ? (
          <Check size={14} />
        ) : null}
        {saved ? 'Guardado' : saving ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center gap-2 py-4 text-xs text-zinc-500">
      <RefreshCw size={13} className="animate-spin" />
      Cargando...
    </div>
  );
}
function Err({ msg }: { msg: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 text-xs text-rose-400">
      <AlertTriangle size={12} />
      {msg}
    </div>
  );
}
