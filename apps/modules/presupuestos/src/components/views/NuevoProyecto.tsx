import { useState } from 'react';
import { Plus, Trash2, ChevronRight, Save, Loader2, AlertTriangle } from 'lucide-react';
import { createProyecto, setParticipaciones, type SociedadRow } from '../../lib/proyectosApi';

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

type Participacion = { sociedad_id_ref: string; porcentaje: string };

type Props = {
  sociedades: SociedadRow[];
  onCreated: (idRef: string) => void;
  onCancel: () => void;
};

export function NuevoProyecto({ sociedades, onCreated, onCancel }: Props) {
  const [nombre, setNombre] = useState('');
  const [idRef, setIdRef] = useState('');
  const [tipoActivo, setTipoActivo] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaSalida, setFechaSalida] = useState('');
  const [parts, setParts] = useState<Participacion[]>([{ sociedad_id_ref: '', porcentaje: '100' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Genera id_ref sugerido a partir del nombre
  const sugerirId = (n: string) =>
    'P-' +
    n
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 12);

  const addPart = () => setParts((p) => [...p, { sociedad_id_ref: '', porcentaje: '' }]);
  const removePart = (i: number) => setParts((p) => p.filter((_, idx) => idx !== i));
  const setPart = (i: number, field: keyof Participacion, value: string) =>
    setParts((p) => p.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));

  const totalPct = parts.reduce((s, p) => s + (parseFloat(p.porcentaje) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (!idRef.trim()) {
      setError('El código de referencia es obligatorio.');
      return;
    }

    const validParts = parts.filter((p) => p.sociedad_id_ref && parseFloat(p.porcentaje) > 0);
    if (validParts.length === 0) {
      setError('Añade al menos una sociedad del holding.');
      return;
    }
    if (totalPct > 100) {
      setError(`La suma de participaciones (${totalPct}%) supera el 100%.`);
      return;
    }

    const socisPcts = validParts.map((p) => ({
      sociedad_id_ref: p.sociedad_id_ref,
      porcentaje: parseFloat(p.porcentaje),
    }));
    // Sociedad principal = la de mayor % (o la primera)
    const principal = [...socisPcts].sort((a, b) => b.porcentaje - a.porcentaje)[0]!;

    setSaving(true);
    try {
      await createProyecto({
        id_ref: idRef.trim().toUpperCase(),
        nombre: nombre.trim(),
        sociedad_tenedora: principal.sociedad_id_ref,
        tipo_activo: tipoActivo || null,
        ubicacion: ubicacion || null,
        estado: 'activo',
        ...(fechaInicio && { fecha_inicio: fechaInicio }),
        ...(fechaSalida && { fecha_prevista_salida: fechaSalida }),
      });
      await setParticipaciones(idRef.trim().toUpperCase(), socisPcts);
      onCreated(idRef.trim().toUpperCase());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el proyecto.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-xs text-zinc-500">
        <button onClick={onCancel} className="font-semibold transition-colors hover:text-zinc-300">
          Proyectos
        </button>
        <ChevronRight size={10} />
        <span className="font-semibold text-zinc-300">Nuevo proyecto</span>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        {/* Básicos */}
        <div className="space-y-4 rounded-2xl border border-white/[0.06] bg-zinc-900/40 p-6">
          <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
            Información básica
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={lbl}>Nombre del proyecto *</label>
              <input
                className={inp}
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  if (!idRef) setIdRef(sugerirId(e.target.value));
                }}
                placeholder="Ej: Alboran Living, Villa El Chorro..."
              />
            </div>

            <div>
              <label className={lbl}>Código de referencia *</label>
              <input
                className={inp}
                value={idRef}
                onChange={(e) => setIdRef(e.target.value.toUpperCase())}
                placeholder="Ej: P-ALBORAN"
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
        </div>

        {/* Propiedad */}
        <div className="space-y-4 rounded-2xl border border-white/[0.06] bg-zinc-900/40 p-6">
          <div className="flex items-center justify-between">
            <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-500">
              Propiedad del holding
            </p>
            {totalPct < 100 && (
              <span className="text-2xs text-zinc-600">
                {(100 - totalPct).toFixed(0)}% restante en manos de terceros
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
                    onClick={() => removePart(i)}
                    className="shrink-0 text-zinc-600 transition-colors hover:text-rose-400"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {totalPct > 100 && (
            <p className="flex items-center gap-1.5 text-xs text-rose-400">
              <AlertTriangle size={12} />
              La suma supera el 100% ({totalPct.toFixed(0)}%)
            </p>
          )}

          <button
            type="button"
            onClick={addPart}
            className="flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <Plus size={12} />
            Añadir otra sociedad del holding
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-400">
            <AlertTriangle size={13} />
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Crear proyecto
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
