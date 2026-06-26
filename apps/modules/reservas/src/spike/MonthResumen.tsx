import { getProfesional, PROF_COLOR, type CitaMock } from './mockData';

interface Props {
  citas: CitaMock[];
  startDate: string; // "YYYY-MM-DD" (cualquier día del mes)
  onDayClick: (dia: string) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Vista MES = resumen operativo (no eventos): por día, qué profesionales trabajan y
// cuántos clientes tienen. No es la vista principal del módulo.
export function MonthResumen({ citas, startDate, onDayClick }: Props) {
  const base = new Date(`${startDate.slice(0, 7)}-01T00:00:00`);
  const year = base.getFullYear();
  const month = base.getMonth();
  const offset = (base.getDay() + 6) % 7; // lunes primero
  const diasMes = new Date(year, month + 1, 0).getDate();
  const hoy = new Date();
  const hoyStr = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;

  const celdas: (string | null)[] = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= diasMes; d++) celdas.push(`${year}-${pad(month + 1)}-${pad(d)}`);
  while (celdas.length % 7 !== 0) celdas.push(null);

  const resumenDia = (dia: string) => {
    const delDia = citas.filter((c) => c.inicio.slice(0, 10) === dia && c.estado_cita !== 'cancelada');
    const porProf = new Map<string, number>();
    for (const c of delDia) porProf.set(c.profesional_id, (porProf.get(c.profesional_id) ?? 0) + 1);
    return { total: delDia.length, porProf };
  };

  return (
    <div className="p-1">
      <div className="grid grid-cols-7 gap-px">
        {DIAS.map((d) => (
          <div key={d} className="px-2 py-1.5 text-2xs uppercase tracking-widest text-zinc-500">
            {d}
          </div>
        ))}
        {celdas.map((dia, i) => {
          if (!dia) return <div key={i} className="min-h-[92px] rounded-md bg-zinc-950/40" />;
          const { total, porProf } = resumenDia(dia);
          const num = Number(dia.slice(8, 10));
          const esHoy = dia === hoyStr;
          return (
            <button
              key={i}
              onClick={() => onDayClick(dia)}
              className={`min-h-[92px] rounded-md border p-1.5 text-left transition-colors hover:border-white/15 ${
                esHoy ? 'border-brand/30 bg-brand/5' : 'border-white/5 bg-zinc-900/30'
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={`text-xs ${esHoy ? 'font-semibold text-brand' : 'text-zinc-400'}`}>{num}</span>
                {total > 0 && (
                  <span className="rounded-full bg-zinc-800 px-1.5 text-2xs text-zinc-300">{total}</span>
                )}
              </div>
              <div className="space-y-0.5">
                {[...porProf.entries()].map(([pid, n]) => (
                  <div key={pid} className="flex items-center gap-1.5 truncate text-2xs text-zinc-300">
                    <i
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: PROF_COLOR[pid] ?? '#71717a' }}
                    />
                    {getProfesional(pid)?.nombre.split(' ')[0]}
                    <span className="text-zinc-600">·{n}</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
