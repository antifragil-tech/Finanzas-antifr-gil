import { useState, useEffect } from 'react';
import { Save, ChevronRight } from 'lucide-react';
import type { PresupuestoTipo } from '@alsari/types';
import { createPresupuesto } from '../../lib/presupuestosApi';
import { getSociedades, type SociedadRow } from '../../lib/proyectosApi';
import type { PresupuestosView } from '../PresupuestosSidebar';

const TIPOS: { value: PresupuestoTipo; label: string; desc: string }[] = [
  {
    value: 'obra',
    label: 'Obra',
    desc: 'Construcción, reforma o promoción inmobiliaria con fases y certificaciones.',
  },
  {
    value: 'capex',
    label: 'CAPEX',
    desc: 'Inversión en activos, mejoras o equipamiento (villa, embarcación, maquinaria...).',
  },
  {
    value: 'explotacion',
    label: 'Explotación',
    desc: 'Ingresos y gastos operativos de un activo estabilizado (alquiler, mantenimiento...).',
  },
  {
    value: 'corporativo',
    label: 'Corporativo',
    desc: 'Gastos de estructura del holding: asesoría, contabilidad, seguros, licencias.',
  },
  {
    value: 'tesoreria',
    label: 'Tesorería',
    desc: 'Proyección de caja con entradas y salidas previstas (earn-outs, fondos pignorados, etc.).',
  },
];

type Props = {
  onCreated: (id: string) => void;
  onNavigate: (v: PresupuestosView) => void;
};

export function NuevoPresupuesto({ onCreated, onNavigate }: Props) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<PresupuestoTipo>('capex');
  const [proyectoNombre, setProyectoNombre] = useState('');
  const [sociedadId, setSociedadId] = useState('');
  const [sociedades, setSociedades] = useState<SociedadRow[]>([]);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getSociedades()
      .then(setSociedades)
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const p = await createPresupuesto({
        nombre: nombre.trim(),
        tipo,
        ...(proyectoNombre.trim() && { proyecto_nombre: proyectoNombre.trim() }),
        ...(sociedadId && { sociedad_id_ref: sociedadId }),
        ...(fechaInicio && { fecha_inicio: fechaInicio }),
        ...(fechaFin && { fecha_fin: fechaFin }),
        ...(notas.trim() && { notas: notas.trim() }),
      });
      onCreated(p.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el presupuesto.');
    } finally {
      setSaving(false);
    }
  }

  const tipoSel = TIPOS.find((t) => t.value === tipo);

  return (
    <div className="animate-fade-in max-w-2xl space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-xs text-zinc-500">
        <button
          onClick={() => onNavigate('lista')}
          className="font-semibold transition-colors hover:text-zinc-300"
        >
          Mis Presupuestos
        </button>
        <ChevronRight size={10} />
        <span className="font-semibold text-zinc-300">Nuevo presupuesto</span>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        {/* Tipo */}
        <div>
          <label className="field-label">Tipo de presupuesto</label>
          <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TIPOS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                className={`rounded-xl border px-4 py-3 text-left transition-all ${
                  tipo === t.value
                    ? 'border-emerald-500/30 bg-emerald-600/10 text-emerald-200'
                    : 'border-white/[0.06] bg-zinc-900/40 text-zinc-400 hover:border-white/[0.12] hover:text-zinc-300'
                }`}
              >
                <p className="text-sm font-medium">{t.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed opacity-70">{t.desc}</p>
              </button>
            ))}
          </div>
          {tipoSel && <p className="mt-2 text-xs italic text-zinc-600">{tipoSel.desc}</p>}
        </div>

        {/* Nombre */}
        <div>
          <label className="field-label">Nombre del presupuesto *</label>
          <input
            className="field-input"
            placeholder={`Ej. ${tipo === 'obra' ? 'Presupuesto Obra Alborán Living' : tipo === 'capex' ? "Reforma King's Haven" : tipo === 'corporativo' ? 'Gastos Estructura 2026' : 'Presupuesto ' + (tipoSel?.label ?? '')}`}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
          />
        </div>

        {/* Proyecto */}
        <div>
          <label className="field-label">
            Proyecto / Activo asociado <span className="font-normal normal-case">(opcional)</span>
          </label>
          <input
            className="field-input"
            placeholder="Ej. Alborán Living, Campanillas, King's Haven..."
            value={proyectoNombre}
            onChange={(e) => setProyectoNombre(e.target.value)}
          />
          <p className="mt-1 text-xs text-zinc-600">
            Este campo es libre — escribe el nombre del proyecto o activo que conoces.
          </p>
        </div>

        {/* Sociedad */}
        <div>
          <label className="field-label">
            Sociedad <span className="font-normal normal-case">(opcional)</span>
          </label>
          <select
            className="field-input"
            value={sociedadId}
            onChange={(e) => setSociedadId(e.target.value)}
          >
            <option value="">Sin sociedad asignada</option>
            {sociedades.map((s) => (
              <option key={s.id_ref} value={s.id_ref}>
                {s.nombre}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-600">
            Necesario para el cálculo de cashflow por sociedad.
          </p>
        </div>

        {/* Periodo */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">
              Fecha inicio <span className="font-normal normal-case">(opcional)</span>
            </label>
            <input
              className="field-input"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">
              Fecha fin estimada <span className="font-normal normal-case">(opcional)</span>
            </label>
            <input
              className="field-input"
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="field-label">
            Notas <span className="font-normal normal-case">(opcional)</span>
          </label>
          <textarea
            className="field-input h-20 resize-none"
            placeholder="Contexto, condiciones, referencias..."
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-400">
            {error}
          </p>
        )}

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || !nombre.trim()}
            className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-600/20 px-6 py-2.5 font-medium text-emerald-300 transition-colors hover:bg-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={15} />
            {saving ? 'Creando...' : 'Crear presupuesto'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('lista')}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
