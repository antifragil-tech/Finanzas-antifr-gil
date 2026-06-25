import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Building2, BarChart3, BookOpen, Check, RefreshCw, AlertTriangle, Wallet, ExternalLink, Table2, History } from 'lucide-react';
import type { SociedadRow, KpisSocRow } from '../../lib/maestroParser';
import type { ActivoPatrimonio } from '@alsari/types';
import { updateSociedad, getKpisSociedad, saveKpisSociedad } from '../../lib/maestroImport';
import { getActivosBySociedad } from '../../lib/patrimonioImport';
import { BssSaldosSection } from './BssSaldosSection';
import { HistoricoKpisSection } from './HistoricoKpisSection';
import { BalanceView } from './BalanceView';
import { formatCurrency } from '@alsari/utils';

type Props = { sociedad: SociedadRow; onBack: () => void; onRefresh?: () => void; onNavigateToPatrimonio?: () => void; backLabel?: string };

const EMPTY_KPIS = (idRef: string, nombre: string): KpisSocRow => ({
  id_ref: idRef, nombre, tipo: 'Sociedad',
  caja_disponible: null, deuda_bancaria_cp: null, deuda_bancaria_lp: null,
  deuda_bancaria: null, deuda_socios: null, deuda_financiera_neta: null,
  activo_corriente: null, activo_no_corriente: null, activo_total: null,
  pasivo_corriente: null, pasivo_no_corriente: null, pasivo_total: null,
  fondo_maniobra: null, patrimonio_neto: null, fecha_actualizacion: null,
});

export function SociedadDetail({ sociedad, onBack, onRefresh, onNavigateToPatrimonio, backLabel = 'Volver a Datos Maestros' }: Props) {
  const [info, setInfo]         = useState<SociedadRow>({ ...sociedad });
  const [savingInfo, setSavingInfo]   = useState(false);
  const [savedInfo, setSavedInfo]     = useState(false);
  const [errorInfo, setErrorInfo]     = useState<string | null>(null);

  const [activos, setActivos]     = useState<ActivoPatrimonio[]>([]);
  const [loadingActivos, setLoadingActivos] = useState(true);

  const [kpis, setKpis]         = useState<KpisSocRow>(EMPTY_KPIS(sociedad.id_ref, sociedad.nombre));
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [savingKpis, setSavingKpis]   = useState(false);
  const [savedKpis, setSavedKpis]     = useState(false);
  const [errorKpis, setErrorKpis]     = useState<string | null>(null);

  const reloadKpis = useCallback(async () => {
    setLoadingKpis(true);
    try {
      const found = await getKpisSociedad(sociedad.id_ref, sociedad.nombre);
      setKpis(found ?? EMPTY_KPIS(sociedad.id_ref, sociedad.nombre));
    } finally { setLoadingKpis(false); }
  }, [sociedad.id_ref, sociedad.nombre]);

  useEffect(() => { void reloadKpis(); }, [reloadKpis]);

  useEffect(() => {
    setLoadingActivos(true);
    getActivosBySociedad(sociedad.id_ref)
      .then(setActivos)
      .catch(() => setActivos([]))
      .finally(() => setLoadingActivos(false));
  }, [sociedad.id_ref]);

  const saveInfo = async () => {
    setSavingInfo(true); setErrorInfo(null);
    try {
      const { id_ref, ...data } = info;
      void id_ref;
      await updateSociedad(sociedad.id_ref, data);
      setSavedInfo(true); setTimeout(() => setSavedInfo(false), 2500);
      onRefresh?.();
    } catch (e) { setErrorInfo(e instanceof Error ? e.message : 'Error'); }
    finally { setSavingInfo(false); }
  };

  const saveKpis = async () => {
    setSavingKpis(true); setErrorKpis(null);
    try {
      await saveKpisSociedad({ ...kpis, id_ref: sociedad.id_ref, nombre: info.nombre });
      setSavedKpis(true); setTimeout(() => setSavedKpis(false), 2500);
    } catch (e) { setErrorKpis(e instanceof Error ? e.message : 'Error'); }
    finally { setSavingKpis(false); }
  };

  return (
    <div className="p-8 max-w-4xl space-y-8">
      {/* Cabecera */}
      <div>
        <button onClick={onBack} className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-5">
          <ArrowLeft size={14} />{backLabel}
        </button>
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/20">
            <Building2 size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">{sociedad.nombre}</h1>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">{sociedad.id_ref}{sociedad.cif ? ` · ${sociedad.cif}` : ''}</p>
          </div>
        </div>
      </div>

      {/* ── Datos básicos ─────────────────────────────────────────────────── */}
      <Card icon={<Building2 size={15} />} title="Datos Básicos">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombre" value={info.nombre} onChange={v => setInfo(f => ({ ...f, nombre: v }))} />
          <Field label="CIF" value={info.cif ?? ''} onChange={v => setInfo(f => ({ ...f, cif: v || null }))} placeholder="B-00000000" />
          <Field label="Holding Principal" value={info.holding_principal ?? ''} onChange={v => setInfo(f => ({ ...f, holding_principal: v || null }))} />
          <div>
            <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-widest">Estado</label>
            <select value={info.estado ?? 'Activo'} onChange={e => setInfo(f => ({ ...f, estado: e.target.value }))}
              className="mt-1 w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors">
              <option>Activo</option><option>Inactivo</option><option>Liquidada</option>
            </select>
          </div>
          <Field label="% Pavier (0–1)" value={String(info.pct_pavier ?? '')} onChange={v => setInfo(f => ({ ...f, pct_pavier: v ? parseFloat(v) : null }))} type="number" placeholder="0.5" />
          <Field label="% Armia (0–1)"  value={String(info.pct_armia  ?? '')} onChange={v => setInfo(f => ({ ...f, pct_armia:  v ? parseFloat(v) : null }))} type="number" placeholder="0.5" />
          <div className="col-span-2 border-t border-white/5 pt-4 mt-1">
            <p className="text-2xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Participación intermedia (si no es filial directa del holding)</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Sociedad Matriz (ID-Ref)" value={info.parent_sociedad_id ?? ''} onChange={v => setInfo(f => ({ ...f, parent_sociedad_id: v || null }))} placeholder="ej: S-PERISUR" />
              <Field label="% Propiedad de la Matriz (0–1)" value={String(info.pct_en_sociedad_padre ?? '')} onChange={v => setInfo(f => ({ ...f, pct_en_sociedad_padre: v ? parseFloat(v) : null }))} type="number" placeholder="0.5" />
            </div>
          </div>
        </div>
        {errorInfo && <Err msg={errorInfo} />}
        <SaveBtn onClick={saveInfo} saving={savingInfo} saved={savedInfo} />
      </Card>

      {/* ── KPIs financieros ───────────────────────────────────────────────── */}
      <Card icon={<BarChart3 size={15} />} title="KPIs Financieros">
        {loadingKpis ? <Spinner /> : (
          <>
            <p className="text-2xs text-zinc-600 mb-4 uppercase tracking-widest font-medium">Posición de liquidez y deuda</p>
            <div className="grid grid-cols-2 gap-4">
              <NumField label="Caja Disponible (€)"    value={kpis.caja_disponible}    onChange={v => setKpis(k => ({ ...k, caja_disponible: v }))} />
              <NumField label="Deuda de Socios (€)"    value={kpis.deuda_socios}        onChange={v => setKpis(k => ({ ...k, deuda_socios: v }))} />
              <NumField label="Deuda Bancaria C/P (€)" value={kpis.deuda_bancaria_cp}   onChange={v => setKpis(k => ({ ...k, deuda_bancaria_cp: v }))} />
              <NumField label="Deuda Bancaria L/P (€)" value={kpis.deuda_bancaria_lp}   onChange={v => setKpis(k => ({ ...k, deuda_bancaria_lp: v }))} />
            </div>
            <div className="flex items-center gap-2 mt-5 mb-4">
              <p className="text-2xs text-zinc-600 uppercase tracking-widest font-medium">Balance simplificado</p>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800 border border-white/5 text-2xs text-zinc-500 font-medium uppercase tracking-wider">
                <BookOpen size={9} />Desde libro mayor
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ReadField label="Activo Corriente (€)"    value={kpis.activo_corriente} />
              <ReadField label="Activo No Corriente (€)" value={kpis.activo_no_corriente} />
              <ReadField label="Pasivo Corriente (€)"    value={kpis.pasivo_corriente} />
              <ReadField label="Pasivo No Corriente (€)" value={kpis.pasivo_no_corriente} />
              <ReadField label="Patrimonio Neto (€)"     value={kpis.patrimonio_neto} />
              <ReadField label="Fecha Actualización"     value={null} dateValue={kpis.fecha_actualizacion} />
            </div>
            {errorKpis && <Err msg={errorKpis} />}
            <SaveBtn onClick={saveKpis} saving={savingKpis} saved={savedKpis} />
          </>
        )}
      </Card>

      {/* ── Histórico de KPIs ─────────────────────────────────────────────── */}
      <Card icon={<History size={15} />} title="Histórico de KPIs">
        <p className="text-xs text-zinc-500 mb-5">
          Evolución de la sociedad período a período, derivada de los balances de sumas y saldos importados.
        </p>
        <HistoricoKpisSection societyIdRef={sociedad.id_ref} />
      </Card>

      {/* ── Activos Patrimoniales ─────────────────────────────────────────── */}
      <Card icon={<Wallet size={15} />} title="Activos Patrimoniales">
        {loadingActivos ? <Spinner /> : activos.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-3 text-zinc-600">
            <Wallet size={32} className="text-zinc-700" />
            <p className="text-xs font-medium uppercase tracking-widest">Sin activos registrados</p>
            {onNavigateToPatrimonio && (
              <button onClick={onNavigateToPatrimonio}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all">
                <ExternalLink size={12} /> Añadir en Patrimonio
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4 pb-3 border-b border-white/5">
              <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3 text-center">
                <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Activos totales</p>
                <p className="text-lg font-semibold text-white mt-1">
                  {formatCurrency(activos.reduce((s, a) => s + (a.valor_actual * a.porcentaje_propiedad / 100), 0))}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3 text-center">
                <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Deuda viva</p>
                <p className="text-lg font-semibold text-rose-400 mt-1">
                  {formatCurrency(activos.reduce((s, a) => s + (a.deuda_viva ?? 0), 0))}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3 text-center">
                <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Valor neto</p>
                <p className="text-lg font-semibold text-emerald-400 mt-1">
                  {formatCurrency(activos.reduce((s, a) => s + (a.valor_actual * a.porcentaje_propiedad / 100) - (a.deuda_viva ?? 0), 0))}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {activos.map(a => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/10 transition-all">
                  <div>
                    <span className="text-sm font-medium text-white">{a.nombre}</span>
                    {a.subcategoria && <span className="ml-2 text-2xs font-semibold uppercase tracking-widest text-zinc-500">{a.subcategoria}</span>}
                  </div>
                  <span className="text-sm font-semibold text-zinc-300">{formatCurrency(a.valor_actual)}</span>
                </div>
              ))}
            </div>
            {onNavigateToPatrimonio && (
              <button onClick={onNavigateToPatrimonio}
                className="flex items-center gap-2 mt-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all">
                <ExternalLink size={12} /> Gestionar en Patrimonio
              </button>
            )}
          </div>
        )}
      </Card>

      {/* ── Libro Mayor ───────────────────────────────────────────────────── */}
      <Card icon={<BookOpen size={15} />} title="Libro de Contabilidad — Balance PGC">
        <p className="text-xs text-zinc-500 mb-4">Sube el libro mayor de esta sociedad para calcular el balance PGC completo y guardarlo en Supabase.</p>
        <BalanceView
          {...(sociedad.id_ref ? { entityId: sociedad.id_ref } : {})}
          entityName={sociedad.nombre}
          onSaved={() => { void reloadKpis(); onRefresh?.(); }}
        />
      </Card>

      {/* ── Balance de Sumas y Saldos ─────────────────────────────────────── */}
      <Card icon={<Table2 size={15} />} title="Balance de Sumas y Saldos">
        <BssSaldosSection societyIdRef={sociedad.id_ref} />
      </Card>
    </div>
  );
}

// ── Componentes compartidos ────────────────────────────────────────────────────

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-white/5 bg-zinc-900/50">
        <span className="text-blue-400">{icon}</span>
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-widest">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors" />
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div>
      <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-widest">{label}</label>
      <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value ? parseFloat(e.target.value) : null)}
        className="mt-1 w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors" />
    </div>
  );
}

function SaveBtn({ onClick, saving, saved }: { onClick: () => void; saving: boolean; saved: boolean }) {
  return (
    <div className="flex justify-end mt-5">
      <button onClick={onClick} disabled={saving}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-50 ${saved ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300' : 'bg-blue-500/20 border border-blue-500/30 text-blue-200 hover:bg-blue-500/30'}`}>
        {saving ? <RefreshCw size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
        {saved ? 'Guardado' : saving ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </div>
  );
}

function ReadField({ label, value, dateValue }: { label: string; value: number | null; dateValue?: string | null }) {
  const display = dateValue !== undefined
    ? (dateValue ?? '—')
    : (value != null ? value.toLocaleString('es-ES', { maximumFractionDigits: 0 }) : '—');
  return (
    <div>
      <label className="block text-2xs font-medium text-zinc-600 uppercase tracking-widest">{label}</label>
      <div className="mt-1 w-full bg-zinc-900/40 border border-white/[0.04] rounded-lg px-3 py-2 text-sm text-zinc-500 select-none">
        {display}
      </div>
    </div>
  );
}

function Spinner() { return <div className="flex items-center gap-2 text-zinc-500 text-xs py-4"><RefreshCw size={13} className="animate-spin" />Cargando...</div>; }
function Err({ msg }: { msg: string }) { return <div className="flex items-center gap-2 text-rose-400 text-xs mt-3"><AlertTriangle size={12} />{msg}</div>; }
