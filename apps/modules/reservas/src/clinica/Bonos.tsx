import { BONOS, restantes, type BonoMock } from './mock/bonos';
import { Subvista } from './Subvista';

const fecha = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' });

const ESTADO_TONE: Record<BonoMock['estado'], string> = {
  activo: 'text-emerald-300',
  por_renovar: 'text-amber-300',
  agotado: 'text-rose-300',
};
const ESTADO_LABEL: Record<BonoMock['estado'], string> = {
  activo: 'Activo',
  por_renovar: 'Por renovar',
  agotado: 'Agotado',
};

// Vista "Bonos / Programas": paquetes de sesiones por cliente (mock). Los que
// están por renovar o agotados generan un cobro pendiente al renovar.
export function Bonos() {
  const activos = BONOS.filter((b) => b.estado === 'activo').length;
  const porRenovar = BONOS.filter((b) => b.estado !== 'activo').length;

  return (
    <Subvista
      titulo="Bonos / Programas"
      subtitulo="Sesiones contratadas vs usadas por cliente. Renovaciones → cobro pendiente."
      acciones={
        <div className="flex gap-2">
          <Kpi label="Activos" value={String(activos)} tone="text-emerald-300" />
          <Kpi label="Por renovar / agotados" value={String(porRenovar)} tone="text-amber-300" />
        </div>
      }
    >
      <div className="glass-panel overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead className="border-b border-white/5 text-2xs uppercase tracking-widest text-zinc-600">
            <tr>
              {['Cliente', 'Tipo', 'Nombre', 'Usadas', 'Restantes', 'Caducidad', 'Estado', 'Cobro'].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BONOS.map((b) => {
              const rest = restantes(b);
              const pct = Math.round((b.sesiones_usadas / b.sesiones_contratadas) * 100);
              return (
                <tr key={b.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5 text-zinc-200">{b.cliente}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-2xs uppercase tracking-wide text-violet-300">
                      {b.tipo === 'bono' ? 'Bono' : 'Programa'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-400">{b.nombre}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-300">{b.sesiones_usadas}/{b.sesiones_contratadas}</span>
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/5">
                        <span className="block h-full rounded-full bg-zinc-400" style={{ width: `${pct}%` }} />
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-zinc-200">{rest}</td>
                  <td className="px-4 py-2.5 text-zinc-400">{fecha(b.caducidad)}</td>
                  <td className={`px-4 py-2.5 ${ESTADO_TONE[b.estado]}`}>{ESTADO_LABEL[b.estado]}</td>
                  <td className="px-4 py-2.5 text-2xs">
                    {b.estado === 'activo' ? (
                      <span className="text-zinc-600">—</span>
                    ) : (
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 uppercase tracking-wide text-amber-300">
                        Renovación pendiente
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Subvista>
  );
}

function Kpi({ label, value, tone = 'text-zinc-100' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="glass-panel flex items-baseline gap-2 rounded-lg px-3 py-1.5">
      <span className={`text-sm font-semibold ${tone}`}>{value}</span>
      <span className="text-2xs uppercase tracking-widest text-zinc-500">{label}</span>
    </div>
  );
}
