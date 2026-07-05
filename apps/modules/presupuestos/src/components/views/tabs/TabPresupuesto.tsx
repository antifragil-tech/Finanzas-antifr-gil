import { useEffect, useState } from 'react';
import { Plus, Wallet, TrendingDown } from 'lucide-react';
import type { Presupuesto, PresupuestoCategoria } from '@alsari/types';
import { getPresupuestosByProyecto, createPresupuesto } from '../../../lib/presupuestosApi';
import { DetallePresupuesto } from '../DetallePresupuesto';

type Props = {
  proyectoId: string;
  proyectoNombre: string;
  isPrivateMode: boolean;
  categoria: PresupuestoCategoria;
};

export function TabPresupuesto({ proyectoId, proyectoNombre, isPrivateMode, categoria }: Props) {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setLoading(true);
    setSelectedId(null);
    getPresupuestosByProyecto(proyectoId)
      .then((rows) => {
        const filtrados = rows.filter((r) => (r.categoria ?? 'gasto') === categoria);
        setPresupuestos(filtrados);
        if (filtrados.length === 1) setSelectedId(filtrados[0]!.id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [proyectoId, categoria]);

  async function handleCreate() {
    setCreating(true);
    try {
      const p = await createPresupuesto({
        nombre:
          categoria === 'ingreso'
            ? `Presupuesto Ingresos ${proyectoNombre}`
            : `Presupuesto ${proyectoNombre}`,
        tipo: categoria === 'ingreso' ? 'explotacion' : 'capex',
        categoria,
        proyecto_id_ref: proyectoId,
        proyecto_nombre: proyectoNombre,
      });
      setPresupuestos((prev) => [...prev, p]);
      setSelectedId(p.id);
    } catch {
      /* ignore */
    }
    setCreating(false);
  }

  if (loading)
    return (
      <div className="flex h-40 items-center justify-center text-sm text-zinc-600">Cargando...</div>
    );

  // Si hay presupuesto seleccionado → mostrar detalle
  if (selectedId) {
    return (
      <DetallePresupuesto
        presupuestoId={selectedId}
        isPrivateMode={isPrivateMode}
        {...(presupuestos.length > 1 && { onBack: () => setSelectedId(null) })}
      />
    );
  }

  const esIngreso = categoria === 'ingreso';
  const IconCat = esIngreso ? TrendingDown : Wallet;
  const colorCat = esIngreso ? 'text-emerald-300' : 'text-blue-300';
  const bgCat = esIngreso
    ? 'bg-emerald-600/15 border-emerald-500/25 hover:bg-emerald-600/25'
    : 'bg-blue-600/15 border-blue-500/25 hover:bg-blue-600/25';

  // Sin presupuesto
  if (presupuestos.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center">
        <IconCat size={36} className="mb-3 text-zinc-700" />
        <p className="mb-1 text-sm font-semibold text-zinc-400">
          Sin presupuesto de {esIngreso ? 'ingresos' : 'gastos'}
        </p>
        <p className="mb-4 text-xs text-zinc-600">
          {esIngreso
            ? 'Crea el presupuesto de ingresos para planificar cobros, rentas y recurrencias'
            : 'Crea el presupuesto de gastos para gestionar capítulos, partidas y pagos'}
        </p>
        <button
          onClick={() => void handleCreate()}
          disabled={creating}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all disabled:opacity-50 ${bgCat} ${colorCat}`}
        >
          <Plus size={14} />{' '}
          {creating ? 'Creando...' : `Crear presupuesto ${esIngreso ? 'ingresos' : 'gastos'}`}
        </button>
      </div>
    );
  }

  // Varios presupuestos → lista
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{presupuestos.length} presupuestos</h3>
        <button
          onClick={() => void handleCreate()}
          className="flex items-center gap-1.5 rounded-lg border border-blue-500/25 bg-blue-600/15 px-3 py-1.5 text-xs font-medium text-blue-300 transition-all hover:bg-blue-600/25"
        >
          <Plus size={12} /> Nuevo
        </button>
      </div>
      {presupuestos.map((p) => (
        <button
          key={p.id}
          onClick={() => setSelectedId(p.id)}
          className="group w-full rounded-xl border border-white/[0.06] bg-zinc-900/50 p-4 text-left transition-all hover:border-white/[0.12]"
        >
          <p className="text-sm font-medium text-white transition-colors group-hover:text-blue-200">
            {p.nombre}
          </p>
          <p className="mt-0.5 text-xs capitalize text-zinc-500">
            {p.tipo} · {p.estado}
          </p>
        </button>
      ))}
    </div>
  );
}
