import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Loader2,
  X,
  Pencil,
  Users,
  Check,
  AlertTriangle,
  Settings2,
  Building2,
  Power,
} from 'lucide-react';
import {
  getContactos,
  insertContacto,
  updateContacto,
  deleteContacto,
  getReglasByContacto,
  insertProveedorRegla,
  updateProveedorRegla,
  deleteProveedorRegla,
  type NuevaProveedorRegla,
} from '../../lib/contabilidadApi';
import type { Contacto, ProveedorRegla, MetodoPago, TipoOperacion } from '@alsari/types';
import { METODO_PAGO_LABEL } from '@alsari/types';
import { SelectField } from '../SelectField';

// ── Badge helpers ─────────────────────────────────────────────────────────────

const TIPO_BADGE: Record<Contacto['tipo'], string> = {
  proveedor: 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/20',
  cliente: 'bg-sky-500/15    text-sky-300    ring-1 ring-sky-500/20',
  ambos: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20',
};
const TIPO_LABEL: Record<Contacto['tipo'], string> = {
  proveedor: 'Proveedor',
  cliente: 'Cliente',
  ambos: 'Ambos',
};

// ── ContactoForm ──────────────────────────────────────────────────────────────

type FormData = {
  nombre: string;
  nif: string;
  tipo: Contacto['tipo'];
  email: string;
  telefono: string;
  direccion: string;
  notas: string;
};

const EMPTY_FORM: FormData = {
  nombre: '',
  nif: '',
  tipo: 'proveedor',
  email: '',
  telefono: '',
  direccion: '',
  notas: '',
};

function ContactoModal({
  contacto,
  onSave,
  onClose,
}: {
  contacto: Contacto | null;
  onSave: (c: Contacto) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormData>(
    contacto
      ? {
          nombre: contacto.nombre,
          nif: contacto.nif ?? '',
          tipo: contacto.tipo,
          email: contacto.email ?? '',
          telefono: contacto.telefono ?? '',
          direccion: contacto.direccion ?? '',
          notas: contacto.notas ?? '',
        }
      : { ...EMPTY_FORM },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof FormData) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (contacto) {
        await updateContacto(contacto.id, {
          nombre: form.nombre.trim(),
          nif: form.nif || null,
          tipo: form.tipo,
          email: form.email || null,
          telefono: form.telefono || null,
          direccion: form.direccion || null,
          notas: form.notas || null,
        });
        onSave({
          ...contacto,
          ...form,
          nif: form.nif || null,
          email: form.email || null,
          telefono: form.telefono || null,
          direccion: form.direccion || null,
          notas: form.notas || null,
        });
      } else {
        const created = await insertContacto({
          nombre: form.nombre.trim(),
          nif: form.nif || null,
          tipo: form.tipo,
          email: form.email || null,
          telefono: form.telefono || null,
          direccion: form.direccion || null,
          notas: form.notas || null,
        });
        onSave(created);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const lbl = 'block text-2xs font-medium text-zinc-500 uppercase tracking-widest mb-1';
  const inp =
    'w-full bg-transparent border-b border-white/[0.08] focus:border-white/20 text-sm text-white placeholder:text-zinc-700 focus:outline-none transition-colors py-1.5 [color-scheme:dark]';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <h3 className="text-sm font-medium text-white">
            {contacto ? 'Editar contacto' : 'Nuevo contacto'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-5 px-6 py-5"
        >
          {error && (
            <div className="bg-rose-500/8 flex items-center gap-2 rounded-lg border border-rose-500/20 px-3 py-2.5">
              <AlertTriangle size={12} className="shrink-0 text-rose-400" />
              <p className="text-xs text-rose-300">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={lbl}>
                Nombre <span className="text-rose-400/70">*</span>
              </label>
              <input
                value={form.nombre}
                onChange={(e) => set('nombre')(e.target.value)}
                className={inp}
                placeholder="Empresa o persona"
                autoFocus
              />
            </div>
            <div>
              <label className={lbl}>NIF / CIF</label>
              <input
                value={form.nif}
                onChange={(e) => set('nif')(e.target.value)}
                className={inp}
                placeholder="B12345678"
              />
            </div>
            <div>
              <label className={lbl}>Tipo</label>
              <div className="mt-1 flex gap-2">
                {(['proveedor', 'cliente', 'ambos'] as Contacto['tipo'][]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('tipo')(t)}
                    className={`flex-1 rounded-lg border py-1 text-xs font-medium transition-all ${form.tipo === t ? TIPO_BADGE[t] : 'border-white/[0.08] text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {TIPO_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email')(e.target.value)}
                className={inp}
                placeholder="contacto@empresa.com"
              />
            </div>
            <div>
              <label className={lbl}>Teléfono</label>
              <input
                value={form.telefono}
                onChange={(e) => set('telefono')(e.target.value)}
                className={inp}
                placeholder="+34 600 000 000"
              />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Dirección</label>
              <input
                value={form.direccion}
                onChange={(e) => set('direccion')(e.target.value)}
                className={inp}
                placeholder="Calle, Ciudad, CP"
              />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Notas</label>
              <textarea
                value={form.notas}
                onChange={(e) => set('notas')(e.target.value)}
                rows={2}
                className="w-full resize-none border-b border-white/[0.08] bg-transparent py-1.5 text-sm text-white transition-colors placeholder:text-zinc-700 focus:border-white/20 focus:outline-none"
                placeholder="Condiciones de pago, observaciones…"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/[0.08] py-2.5 text-xs font-medium text-zinc-500 transition-all hover:border-white/15 hover:text-zinc-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {contacto ? 'Guardar cambios' : 'Crear contacto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Reglas de facturación (PR E) ──────────────────────────────────────────────

type ReglaForm = {
  sociedad_id_ref: string; // '' = global (todas las sociedades)
  cuenta_contable_default: string;
  metodo_pago_default: string; // '' = sin método por defecto
  tipo_operacion_default: string; // '' = sin régimen por defecto
  iva_default: string;
  retencion_pct_default: string;
  importe_habitual: string;
  tolerancia_importe_pct: string;
  concepto_recurrente: string;
  proyecto_id_ref: string;
  es_domiciliada: boolean;
  requiere_pago_manual: boolean;
  requiere_aprobacion_javi: boolean;
  requiere_factura: boolean;
  requiere_justificante_pago: boolean;
  activa: boolean;
  notas: string;
};

function reglaToForm(r: ProveedorRegla): ReglaForm {
  const s = (v: string | number | null) => (v === null || v === undefined ? '' : String(v));
  return {
    sociedad_id_ref: r.sociedad_id_ref ?? '',
    cuenta_contable_default: s(r.cuenta_contable_default),
    metodo_pago_default: r.metodo_pago_default ?? '',
    tipo_operacion_default: r.tipo_operacion_default ?? '',
    iva_default: s(r.iva_default),
    retencion_pct_default: s(r.retencion_pct_default),
    importe_habitual: s(r.importe_habitual),
    tolerancia_importe_pct: s(r.tolerancia_importe_pct),
    concepto_recurrente: s(r.concepto_recurrente),
    proyecto_id_ref: s(r.proyecto_id_ref),
    es_domiciliada: r.es_domiciliada,
    requiere_pago_manual: r.requiere_pago_manual,
    requiere_aprobacion_javi: r.requiere_aprobacion_javi,
    requiere_factura: r.requiere_factura,
    requiere_justificante_pago: r.requiere_justificante_pago,
    activa: r.activa,
    notas: s(r.notas),
  };
}

const EMPTY_REGLA: ReglaForm = {
  sociedad_id_ref: '',
  cuenta_contable_default: '',
  metodo_pago_default: '',
  tipo_operacion_default: '',
  iva_default: '',
  retencion_pct_default: '',
  importe_habitual: '',
  tolerancia_importe_pct: '',
  concepto_recurrente: '',
  proyecto_id_ref: '',
  es_domiciliada: false,
  requiere_pago_manual: false,
  requiere_aprobacion_javi: false,
  requiere_factura: true,
  requiere_justificante_pago: true,
  activa: true,
  notas: '',
};

const TIPO_OP_OPCIONES: { value: string; label: string }[] = [
  { value: '', label: '—' },
  { value: 'normal', label: 'Normal' },
  { value: 'exenta', label: 'Exenta' },
  { value: 'no_sujeta', label: 'No sujeta' },
  { value: 'inversion_sujeto_pasivo', label: 'Inversión sujeto pasivo' },
  { value: 'suplido', label: 'Suplido' },
];

function ReglasFacturacionModal({
  contacto,
  sociedades,
  onClose,
}: {
  contacto: Contacto;
  sociedades: { id: string; nombre: string }[];
  onClose: () => void;
}) {
  const [reglas, setReglas] = useState<ProveedorRegla[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<'new' | ProveedorRegla | null>(null);
  const [form, setForm] = useState<ReglaForm>({ ...EMPTY_REGLA });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getReglasByContacto(contacto.id)
      .then((rs) => {
        setReglas(rs);
        setLoading(false);
      })
      .catch(() => {
        setError('No se pudieron cargar las reglas.');
        setLoading(false);
      });
  }, [contacto.id]);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const sociedadLabel = (id: string | null) =>
    id === null
      ? 'Global · todas las sociedades'
      : (sociedades.find((s) => s.id === id)?.nombre ?? id);

  function abrirEditor(r: 'new' | ProveedorRegla) {
    setError(null);
    setForm(r === 'new' ? { ...EMPTY_REGLA } : reglaToForm(r));
    setEditing(r);
  }

  function buildPayload(): NuevaProveedorRegla {
    const n = (v: string) => (v.trim() === '' ? null : Number(v));
    return {
      contacto_id: contacto.id,
      nif_normalizado: contacto.nif ? contacto.nif.toUpperCase().replace(/[^A-Z0-9]/g, '') : null,
      sociedad_id_ref: form.sociedad_id_ref || null,
      cuenta_contable_default: form.cuenta_contable_default.trim() || null,
      proyecto_id_ref: form.proyecto_id_ref.trim() || null,
      metodo_pago_default: (form.metodo_pago_default || null) as MetodoPago | null,
      tipo_operacion_default: (form.tipo_operacion_default || null) as TipoOperacion | null,
      iva_default: n(form.iva_default),
      retencion_pct_default: n(form.retencion_pct_default),
      importe_habitual: n(form.importe_habitual),
      tolerancia_importe_pct: n(form.tolerancia_importe_pct),
      concepto_recurrente: form.concepto_recurrente.trim() || null,
      es_domiciliada: form.es_domiciliada,
      requiere_pago_manual: form.requiere_pago_manual,
      requiere_aprobacion_javi: form.requiere_aprobacion_javi,
      requiere_factura: form.requiere_factura,
      requiere_justificante_pago: form.requiere_justificante_pago,
      activa: form.activa,
      notas: form.notas.trim() || null,
    };
  }

  async function handleGuardar() {
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (editing && editing !== 'new') {
        await updateProveedorRegla(editing.id, payload);
      } else {
        await insertProveedorRegla(payload);
      }
      setEditing(null);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(
        /duplicate|unique|23505/i.test(msg)
          ? 'Ya existe una regla activa para esa sociedad (o una regla global). Desactívala o edítala.'
          : msg || 'No se pudo guardar la regla.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActiva(r: ProveedorRegla) {
    setError(null);
    try {
      await updateProveedorRegla(r.id, { activa: !r.activa });
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(
        /duplicate|unique|23505/i.test(msg)
          ? 'No se puede reactivar: ya hay otra regla activa para esa sociedad.'
          : msg || 'No se pudo cambiar el estado.',
      );
    }
  }

  async function eliminar(r: ProveedorRegla) {
    if (!confirm('¿Eliminar esta regla?')) return;
    setError(null);
    try {
      await deleteProveedorRegla(r.id);
      load();
    } catch {
      setError('No se pudo eliminar la regla.');
    }
  }

  const lbl = 'block text-2xs font-medium text-zinc-400 uppercase tracking-widest mb-1';
  const selLbl = 'text-2xs font-medium text-zinc-400 uppercase tracking-widest leading-none';
  const inp =
    'w-full bg-transparent border-b border-white/[0.08] focus:border-white/20 text-sm text-white placeholder:text-zinc-700 focus:outline-none transition-colors py-1.5 [color-scheme:dark]';
  const sw = (k: keyof ReglaForm, label: string, hint?: string) => (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="min-w-0">
        <span className="text-xs text-zinc-300">{label}</span>
        {hint && <span className="text-2xs block text-zinc-600">{hint}</span>}
      </span>
      <input
        type="checkbox"
        checked={form[k] as boolean}
        onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.checked }))}
        className="h-4 w-4 shrink-0 accent-zinc-200"
      />
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div>
            <h3 className="text-sm font-medium text-white">Reglas de facturación</h3>
            <p className="text-2xs mt-0.5 text-zinc-500">
              {contacto.nombre} · solo sugerencias, no automatiza nada
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          {error && (
            <div className="bg-rose-500/8 flex items-start gap-2 rounded-lg border border-rose-500/20 px-3 py-2.5">
              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-rose-400" />
              <p className="text-xs text-rose-300">{error}</p>
            </div>
          )}

          {/* Lista de reglas */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={18} className="animate-spin text-zinc-600" />
            </div>
          ) : reglas.length === 0 && !editing ? (
            <p className="py-4 text-center text-xs text-zinc-600">
              Sin reglas. Crea la primera regla para este proveedor.
            </p>
          ) : (
            <div className="space-y-2">
              {reglas.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-lg border px-3 py-2.5 ${r.activa ? 'border-white/[0.08] bg-white/[0.02]' : 'border-white/[0.04] bg-transparent opacity-60'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-xs text-zinc-200">
                      <Building2 size={11} className="shrink-0 text-zinc-500" />
                      <span className="truncate">{sociedadLabel(r.sociedad_id_ref)}</span>
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => toggleActiva(r)}
                        title={r.activa ? 'Desactivar' : 'Activar'}
                        className={`rounded-md p-1.5 transition-colors hover:bg-white/5 ${r.activa ? 'text-emerald-400/70 hover:text-emerald-300' : 'text-zinc-600 hover:text-zinc-300'}`}
                      >
                        <Power size={11} />
                      </button>
                      <button
                        onClick={() => abrirEditor(r)}
                        title="Editar"
                        className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-300"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => eliminar(r)}
                        title="Eliminar"
                        className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-white/5 hover:text-rose-400"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.cuenta_contable_default && <Tag>Cuenta {r.cuenta_contable_default}</Tag>}
                    {r.metodo_pago_default && <Tag>{METODO_PAGO_LABEL[r.metodo_pago_default]}</Tag>}
                    {r.es_domiciliada && <Tag tone="blue">Domiciliada</Tag>}
                    {r.requiere_aprobacion_javi && <Tag tone="amber">Revisión Javi</Tag>}
                    {r.iva_default !== null && <Tag>IVA {r.iva_default}%</Tag>}
                    {r.importe_habitual !== null && r.tolerancia_importe_pct !== null && (
                      <Tag>
                        ≈{r.importe_habitual}€ ±{r.tolerancia_importe_pct}%
                      </Tag>
                    )}
                    {!r.activa && <Tag>Inactiva</Tag>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Editor */}
          {editing && (
            <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
              <p className="text-2xs uppercase tracking-widest text-zinc-500">
                {editing === 'new' ? 'Nueva regla' : 'Editar regla'}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="col-span-2">
                  <SelectField
                    label="Sociedad"
                    labelClassName={selLbl}
                    value={form.sociedad_id_ref}
                    onChange={(v) => setForm((f) => ({ ...f, sociedad_id_ref: v }))}
                    options={[
                      { value: '', label: 'Global · todas las sociedades' },
                      ...sociedades.map((s) => ({ value: s.id, label: s.nombre })),
                    ]}
                  />
                </div>
                <div>
                  <label className={lbl}>Cuenta contable</label>
                  <input
                    value={form.cuenta_contable_default}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cuenta_contable_default: e.target.value }))
                    }
                    className={inp}
                    placeholder="628"
                  />
                </div>
                <SelectField
                  label="Método de pago"
                  labelClassName={selLbl}
                  value={form.metodo_pago_default}
                  onChange={(v) => setForm((f) => ({ ...f, metodo_pago_default: v }))}
                  options={[
                    { value: '', label: '—' },
                    ...(Object.keys(METODO_PAGO_LABEL) as MetodoPago[]).map((m) => ({
                      value: m,
                      label: METODO_PAGO_LABEL[m],
                    })),
                  ]}
                />
                <SelectField
                  label="Régimen IVA"
                  labelClassName={selLbl}
                  value={form.tipo_operacion_default}
                  onChange={(v) => setForm((f) => ({ ...f, tipo_operacion_default: v }))}
                  options={TIPO_OP_OPCIONES}
                />
                <div>
                  <label className={lbl}>IVA %</label>
                  <input
                    type="number"
                    value={form.iva_default}
                    onChange={(e) => setForm((f) => ({ ...f, iva_default: e.target.value }))}
                    className={inp}
                    placeholder="21"
                  />
                </div>
                <div>
                  <label className={lbl}>Retención %</label>
                  <input
                    type="number"
                    value={form.retencion_pct_default}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, retencion_pct_default: e.target.value }))
                    }
                    className={inp}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className={lbl}>Importe habitual €</label>
                  <input
                    type="number"
                    value={form.importe_habitual}
                    onChange={(e) => setForm((f) => ({ ...f, importe_habitual: e.target.value }))}
                    className={inp}
                    placeholder="500"
                  />
                </div>
                <div>
                  <label className={lbl}>Tolerancia %</label>
                  <input
                    type="number"
                    value={form.tolerancia_importe_pct}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tolerancia_importe_pct: e.target.value }))
                    }
                    className={inp}
                    placeholder="15"
                  />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Concepto recurrente</label>
                  <input
                    value={form.concepto_recurrente}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, concepto_recurrente: e.target.value }))
                    }
                    className={inp}
                    placeholder="Suministro eléctrico mensual"
                  />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Proyecto (id_ref, opcional)</label>
                  <input
                    value={form.proyecto_id_ref}
                    onChange={(e) => setForm((f) => ({ ...f, proyecto_id_ref: e.target.value }))}
                    className={inp}
                  />
                </div>
              </div>

              <div className="border-t border-white/[0.06] pt-2">
                {sw('es_domiciliada', 'Domiciliada', 'Se carga en banco, sin transferencia manual')}
                {sw('requiere_pago_manual', 'Requiere pago manual')}
                {sw(
                  'requiere_aprobacion_javi',
                  'Requiere revisión de Javi',
                  'v1: solo aviso, no fuerza el flujo',
                )}
                {sw('requiere_factura', 'Requiere factura')}
                {sw('requiere_justificante_pago', 'Requiere justificante de pago')}
                {sw('activa', 'Regla activa')}
              </div>

              <div>
                <label className={lbl}>Notas</label>
                <input
                  value={form.notas}
                  onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                  className={inp}
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => setEditing(null)}
                  className="flex-1 rounded-xl border border-white/[0.08] py-2 text-xs font-medium text-zinc-500 transition-all hover:text-zinc-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    void handleGuardar();
                  }}
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Guardar regla
                </button>
              </div>
            </div>
          )}

          {!editing && (
            <button
              onClick={() => abrirEditor('new')}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 py-2.5 text-xs font-medium text-zinc-300 transition-all hover:border-white/30 hover:text-white"
            >
              <Plus size={12} />
              Nueva regla
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Tag({
  children,
  tone = 'zinc',
}: {
  children: React.ReactNode;
  tone?: 'zinc' | 'blue' | 'amber';
}) {
  const cls =
    tone === 'blue'
      ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
      : tone === 'amber'
        ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
        : 'bg-white/[0.04] text-zinc-400 border-white/10';
  return (
    <span className={`text-2xs inline-flex items-center rounded border px-1.5 py-0.5 ${cls}`}>
      {children}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type Props = {
  isPrivateMode: boolean;
  sociedades: { id: string; nombre: string }[];
  reglas: unknown[];
  userEmail: string | null;
};

export function Contactos({ isPrivateMode, sociedades }: Props) {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'new' | Contacto | null>(null);
  const [reglasModal, setReglasModal] = useState<Contacto | null>(null); // PR E
  const [filtroTipo, setFiltroTipo] = useState<Contacto['tipo'] | 'todos'>('todos');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getContactos();
      setContactos(data);
    } catch {
      /* silently */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible =
    filtroTipo === 'todos'
      ? contactos
      : contactos.filter((c) => c.tipo === filtroTipo || c.tipo === 'ambos');

  function handleSave(c: Contacto) {
    setContactos((prev) => {
      const exists = prev.find((x) => x.id === c.id);
      return exists ? prev.map((x) => (x.id === c.id ? c : x)) : [c, ...prev];
    });
    setModal(null);
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este contacto?')) return;
    try {
      await deleteContacto(id);
      setContactos((prev) => prev.filter((c) => c.id !== id));
    } catch {
      /* silently */
    }
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setModal('new')}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-blue-500"
        >
          <Plus size={13} />
          Nuevo contacto
        </button>

        {/* Tipo filter */}
        <div className="ml-auto flex items-center gap-1">
          {(['todos', 'proveedor', 'cliente', 'ambos'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFiltroTipo(t)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${filtroTipo === t ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300'}`}
            >
              {t === 'todos' ? 'Todos' : TIPO_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={20} className="animate-spin text-zinc-600" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-zinc-600">
          <Users size={32} className="opacity-30" />
          <p className="text-sm">
            {contactos.length === 0
              ? 'Sin contactos. Los proveedores se guardan automáticamente al procesar facturas.'
              : 'Sin contactos en esta categoría.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-zinc-900/60">
                {['Nombre', 'NIF', 'Tipo', 'Email', 'Teléfono', ''].map((h) => (
                  <th
                    key={h}
                    className={`text-2xs px-4 py-3 text-left font-semibold uppercase tracking-widest text-zinc-500 ${h === '' ? 'w-16 text-center' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {visible.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setModal(c)}
                  className="group cursor-pointer transition-colors hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-zinc-200">{c.nombre}</p>
                    {c.direccion && (
                      <p className="text-2xs max-w-[180px] truncate text-zinc-600">{c.direccion}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-zinc-400">{c.nif ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-2xs inline-flex items-center rounded-full px-2 py-0.5 font-medium ${TIPO_BADGE[c.tipo]}`}
                    >
                      {TIPO_LABEL[c.tipo]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-zinc-500">
                      {isPrivateMode ? '****' : (c.email ?? '—')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-zinc-500">
                      {isPrivateMode ? '****' : (c.telefono ?? '—')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {(c.tipo === 'proveedor' || c.tipo === 'ambos') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setReglasModal(c);
                          }}
                          className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-300"
                          title="Reglas de facturación"
                        >
                          <Settings2 size={11} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setModal(c);
                        }}
                        className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-300"
                        title="Editar"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(c.id);
                        }}
                        className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-white/5 hover:text-rose-400"
                        title="Eliminar"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-right text-xs text-zinc-600">{visible.length} contactos</p>

      {/* Modal */}
      {modal !== null && (
        <ContactoModal
          contacto={modal === 'new' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {/* Reglas de facturación (PR E) */}
      {reglasModal && (
        <ReglasFacturacionModal
          contacto={reglasModal}
          sociedades={sociedades}
          onClose={() => setReglasModal(null)}
        />
      )}
    </div>
  );
}
