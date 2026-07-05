import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
  Loader2,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import {
  getSociedadesContabilidad,
  updateSociedad,
  getCuentasBancarias,
  createCuentaBancaria,
  deleteCuentaBancaria,
} from '../../lib/contabilidadApi';
import type { SociedadContabilidad, CuentaBancariaSociedad } from '@alsari/types';

// ── Field input ───────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  mono = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <p className="text-2xs mb-1 font-semibold uppercase tracking-widest text-zinc-600">{label}</p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '—'}
        className={`h-8 w-full rounded-lg border border-white/[0.08] bg-zinc-800/80 px-2.5 text-xs text-white transition-colors hover:border-white/15 focus:border-blue-500/50 focus:outline-none ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}

// ── Cuenta bancaria row ───────────────────────────────────────────────────────

function CuentaRow({
  cuenta,
  onDelete,
}: {
  cuenta: CuentaBancariaSociedad;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteCuentaBancaria(cuenta.id);
      onDelete(cuenta.id);
    } catch {
      /* silent */
    }
    setDeleting(false);
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-zinc-800/40 px-3 py-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-700/60">
        <CreditCard size={12} className="text-zinc-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-zinc-200">{cuenta.alias}</p>
        <p className="text-2xs truncate font-mono text-zinc-500">
          {cuenta.iban.replace(/(.{4})/g, '$1 ').trim()}
        </p>
        {cuenta.banco && (
          <p className="text-2xs text-zinc-600">
            {cuenta.banco}
            {cuenta.swift ? ` · ${cuenta.swift}` : ''}
          </p>
        )}
      </div>
      <p className="text-2xs hidden max-w-[120px] truncate text-zinc-600 sm:block">
        {cuenta.titular}
      </p>
      <button
        type="button"
        onClick={() => {
          void handleDelete();
        }}
        disabled={deleting}
        className="shrink-0 text-zinc-700 transition-colors hover:text-rose-400 disabled:opacity-40"
        title="Eliminar cuenta"
      >
        {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
      </button>
    </div>
  );
}

// ── Add cuenta form ───────────────────────────────────────────────────────────

function AddCuentaForm({
  sociedadIdRef,
  onAdded,
  onCancel,
}: {
  sociedadIdRef: string;
  onAdded: (c: CuentaBancariaSociedad) => void;
  onCancel: () => void;
}) {
  const [alias, setAlias] = useState('');
  const [titular, setTitular] = useState('');
  const [iban, setIban] = useState('');
  const [banco, setBanco] = useState('');
  const [swift, setSwift] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleSave() {
    if (!alias.trim() || !titular.trim() || !iban.trim()) {
      setErr('Alias, titular e IBAN son obligatorios');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const nueva = await createCuentaBancaria({
        sociedad_id_ref: sociedadIdRef,
        alias: alias.trim(),
        titular: titular.trim(),
        banco: banco.trim() || null,
        iban: iban.trim().replace(/\s+/g, '').toUpperCase(),
        swift: swift.trim() || null,
        activa: true,
      });
      onAdded(nueva);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al guardar');
    }
    setSaving(false);
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-white/[0.08] bg-zinc-800/60 p-3">
      <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
        Nueva cuenta bancaria
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Alias" value={alias} onChange={setAlias} placeholder="ej. BBVA Principal" />
        <Field label="Titular" value={titular} onChange={setTitular} />
      </div>
      <Field
        label="IBAN"
        value={iban}
        onChange={setIban}
        mono
        placeholder="ES00 0000 0000 0000 0000 0000"
      />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Banco" value={banco} onChange={setBanco} placeholder="Opcional" />
        <Field label="SWIFT / BIC" value={swift} onChange={setSwift} mono placeholder="Opcional" />
      </div>
      {err && <p className="text-2xs text-rose-400">{err}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            void handleSave();
          }}
          disabled={saving}
          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Guardar
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-8 rounded-lg border border-white/[0.08] px-3 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Society card ──────────────────────────────────────────────────────────────

function SociedadCard({
  sociedad,
  onUpdated,
}: {
  sociedad: SociedadContabilidad;
  onUpdated: (s: SociedadContabilidad) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [showAddCuenta, setShowAdd] = useState(false);
  const [cuentas, setCuentas] = useState<CuentaBancariaSociedad[] | null>(null);
  const [loadingCuentas, setLoadingCuentas] = useState(false);

  // Edit form state
  const [nombre, setNombre] = useState(sociedad.nombre);
  const [cif, setCif] = useState(sociedad.cif ?? '');
  const [domicilio, setDomicilio] = useState(sociedad.domicilio ?? '');
  const [localidad, setLocalidad] = useState(sociedad.localidad ?? '');
  const [cp, setCp] = useState(sociedad.codigo_postal ?? '');
  const [pais, setPais] = useState(sociedad.pais ?? 'España');
  const [email, setEmail] = useState(sociedad.email ?? '');
  const [telefono, setTelefono] = useState(sociedad.telefono ?? '');

  const loadCuentas = useCallback(async () => {
    setLoadingCuentas(true);
    try {
      setCuentas(await getCuentasBancarias(sociedad.id));
    } catch {
      setCuentas([]);
    }
    setLoadingCuentas(false);
  }, [sociedad.id]);

  useEffect(() => {
    void loadCuentas();
  }, [loadCuentas]);

  function cancelEdit() {
    setEditing(false);
    setErr('');
    setNombre(sociedad.nombre);
    setCif(sociedad.cif ?? '');
    setDomicilio(sociedad.domicilio ?? '');
    setLocalidad(sociedad.localidad ?? '');
    setCp(sociedad.codigo_postal ?? '');
    setPais(sociedad.pais ?? 'España');
    setEmail(sociedad.email ?? '');
    setTelefono(sociedad.telefono ?? '');
  }

  async function handleSave() {
    setSaving(true);
    setErr('');
    try {
      await updateSociedad(sociedad.id, {
        nombre: nombre.trim(),
        cif: cif.trim() || null,
        domicilio: domicilio.trim() || null,
        localidad: localidad.trim() || null,
        codigo_postal: cp.trim() || null,
        pais: pais.trim() || null,
        email: email.trim() || null,
        telefono: telefono.trim() || null,
      });
      onUpdated({
        ...sociedad,
        nombre: nombre.trim(),
        cif: cif.trim() || null,
        domicilio: domicilio.trim() || null,
        localidad: localidad.trim() || null,
        codigo_postal: cp.trim() || null,
        pais: pais.trim() || null,
        email: email.trim() || null,
        telefono: telefono.trim() || null,
      });
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al guardar');
    }
    setSaving(false);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-900/40">
      {/* Card header */}
      <div className="flex items-center gap-3 border-b border-white/[0.05] px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-zinc-800">
          <Building2 size={15} className="text-zinc-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{sociedad.nombre}</p>
          {sociedad.cif && <p className="text-2xs font-mono text-zinc-500">CIF: {sociedad.cif}</p>}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-2xs flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 font-medium text-zinc-500 transition-all hover:border-white/15 hover:text-zinc-200"
          >
            <Pencil size={10} />
            Editar
          </button>
        )}
      </div>

      {/* Details / edit form */}
      <div className="p-5">
        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre legal" value={nombre} onChange={setNombre} />
              <Field
                label="CIF / NIF"
                value={cif}
                onChange={setCif}
                mono
                placeholder="B-XXXXXXXX"
              />
            </div>
            <Field
              label="Domicilio social"
              value={domicilio}
              onChange={setDomicilio}
              placeholder="Calle, número"
            />
            <div className="grid grid-cols-3 gap-3">
              <Field label="Localidad" value={localidad} onChange={setLocalidad} />
              <Field label="Código postal" value={cp} onChange={setCp} mono />
              <Field label="País" value={pais} onChange={setPais} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                placeholder="facturacion@empresa.com"
              />
              <Field label="Teléfono" value={telefono} onChange={setTelefono} mono />
            </div>
            {err && <p className="text-2xs text-rose-400">{err}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  void handleSave();
                }}
                disabled={saving}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Guardar cambios
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
              >
                <X size={11} />
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            {[
              ['Domicilio', sociedad.domicilio],
              ['Localidad', [sociedad.localidad, sociedad.codigo_postal].filter(Boolean).join(' ')],
              ['País', sociedad.pais],
              ['Email', sociedad.email],
              ['Teléfono', sociedad.telefono],
            ].map(([label, val]) =>
              val ? (
                <div key={label as string}>
                  <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-600">
                    {label}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-300">{val}</p>
                </div>
              ) : null,
            )}
            {!sociedad.domicilio && !sociedad.email && (
              <p className="col-span-2 text-xs text-zinc-600">
                Sin datos — pulsa Editar para rellenar la ficha.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bank accounts section */}
      <div className="space-y-3 border-t border-white/[0.05] px-5 pb-5 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
            Cuentas bancarias
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void loadCuentas();
              }}
              className="text-zinc-700 transition-colors hover:text-zinc-400"
            >
              <RefreshCw size={11} />
            </button>
          </div>
        </div>

        {loadingCuentas && (
          <div className="flex justify-center py-3">
            <Loader2 size={14} className="animate-spin text-zinc-600" />
          </div>
        )}

        {!loadingCuentas && cuentas && cuentas.length > 0 && (
          <div className="space-y-2">
            {cuentas.map((c) => (
              <CuentaRow
                key={c.id}
                cuenta={c}
                onDelete={(id) => setCuentas((prev) => prev?.filter((x) => x.id !== id) ?? [])}
              />
            ))}
          </div>
        )}

        {!loadingCuentas && cuentas && cuentas.length === 0 && !showAddCuenta && (
          <p className="text-xs text-zinc-600">Sin cuentas bancarias registradas.</p>
        )}

        {showAddCuenta ? (
          <AddCuentaForm
            sociedadIdRef={sociedad.id}
            onAdded={(c) => {
              setCuentas((prev) => [...(prev ?? []), c]);
              setShowAdd(false);
            }}
            onCancel={() => setShowAdd(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 text-xs text-blue-400 transition-colors hover:text-blue-300"
          >
            <Plus size={11} />
            Añadir cuenta bancaria
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

type Props = {
  sociedades: SociedadContabilidad[];
  onSociedadesChange: (s: SociedadContabilidad[]) => void;
};

export function MisEmpresas({ sociedades, onSociedadesChange }: Props) {
  const [loading, setLoading] = useState(sociedades.length === 0);

  useEffect(() => {
    if (sociedades.length === 0) {
      void getSociedadesContabilidad()
        .then((s) => {
          onSociedadesChange(s);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleUpdated(updated: SociedadContabilidad) {
    onSociedadesChange(sociedades.map((s) => (s.id === updated.id ? updated : s)));
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Mis Empresas</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Ficha legal y cuentas bancarias de cada sociedad emisora de facturas.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={20} className="animate-spin text-zinc-600" />
        </div>
      ) : sociedades.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-zinc-600">
          <Building2 size={32} className="opacity-30" />
          <p className="text-sm">No hay sociedades configuradas.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sociedades.map((s) => (
            <SociedadCard key={s.id} sociedad={s} onUpdated={handleUpdated} />
          ))}
        </div>
      )}
    </div>
  );
}
