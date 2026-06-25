import { useEffect, useState } from 'react';
import { FolderKanban, Target, ListTodo, Wallet, TrendingUp, MapPin, ArrowRight, Building2 } from 'lucide-react';
import type { ProyectoRow, TotalesProyecto } from '../../lib/proyectosApi';
import { getTotalesByProyecto, getAllTareas, getSociedades, type SociedadRow } from '../../lib/proyectosApi';
import type { ProyectoTarea } from '@alsari/types';

function fmt(n: number, priv: boolean) {
  if (priv) return '•••• €';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function estadoBadge(estado: string | null) {
  const map: Record<string, string> = {
    activo:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    cerrado:  'bg-zinc-700/30 text-zinc-500 border-zinc-600/20',
    pausado:  'bg-amber-500/15 text-amber-400 border-amber-500/20',
  };
  return map[estado ?? ''] ?? 'bg-zinc-700/30 text-zinc-500 border-zinc-600/20';
}

function groupBySociedad(proyectos: ProyectoRow[]): Map<string, ProyectoRow[]> {
  const map = new Map<string, ProyectoRow[]>();
  for (const p of proyectos) {
    const key = p.sociedad_tenedora ?? 'Sin sociedad';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return map;
}

type Props = {
  proyectos: ProyectoRow[];
  isPrivateMode: boolean;
  onSelectProyecto: (id: string) => void;
};

export function VistaGlobal({ proyectos, isPrivateMode, onSelectProyecto }: Props) {
  const [totales, setTotales]             = useState<Map<string, TotalesProyecto>>(new Map());
  const [tareasMap, setTareasMap]         = useState<Map<string, number>>(new Map());
  const [sociedades, setSociedades]       = useState<Map<string, string>>(new Map());

  useEffect(() => {
    getTotalesByProyecto()
      .then(rows => {
        const map = new Map<string, TotalesProyecto>();
        for (const r of rows) map.set(r.proyecto_id_ref, r);
        setTotales(map);
      })
      .catch(() => {});

    getAllTareas()
      .then((tareas: ProyectoTarea[]) => {
        const map = new Map<string, number>();
        for (const t of tareas) {
          if (t.columna !== 'done' && t.columna !== 'backlog') {
            map.set(t.proyecto_id, (map.get(t.proyecto_id) ?? 0) + 1);
          }
        }
        setTareasMap(map);
      })
      .catch(() => {});

    getSociedades()
      .then((rows: SociedadRow[]) => {
        const map = new Map<string, string>();
        for (const s of rows) map.set(s.id_ref, s.nombre);
        setSociedades(map);
      })
      .catch(() => {});
  }, []);

  const grupos = groupBySociedad(proyectos);
  const totalPresupuestado = Array.from(totales.values()).reduce((s, t) => s + Number(t.total_presupuestado), 0);
  const totalPagado        = Array.from(totales.values()).reduce((s, t) => s + Number(t.total_pagado), 0);

  if (proyectos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-600">
        <FolderKanban size={40} className="mb-3" />
        <p className="text-sm font-semibold">No hay proyectos registrados</p>
        <p className="text-xs mt-1">Los proyectos se gestionan desde el módulo Financiero</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">

      {/* KPI header */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-900/60 border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <FolderKanban size={14} className="text-blue-400" />
            <span className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Proyectos</span>
          </div>
          <p className="text-2xl font-semibold text-white">{proyectos.length}</p>
          <p className="text-xs text-zinc-600 mt-0.5">
            {proyectos.filter(p => p.estado === 'activo').length} activos
          </p>
        </div>
        <div className="bg-zinc-900/60 border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={14} className="text-violet-400" />
            <span className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Total presupuestado</span>
          </div>
          <p className="text-2xl font-semibold text-white">{fmt(totalPresupuestado, isPrivateMode)}</p>
        </div>
        <div className="bg-zinc-900/60 border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-emerald-400" />
            <span className="text-2xs font-semibold text-zinc-500 uppercase tracking-widest">Ejecutado</span>
          </div>
          <p className="text-2xl font-semibold text-emerald-300">{fmt(totalPagado, isPrivateMode)}</p>
          {totalPresupuestado > 0 && (
            <p className="text-xs text-zinc-500 mt-0.5">
              {Math.round((totalPagado / totalPresupuestado) * 100)}% del total
            </p>
          )}
        </div>
      </div>

      {/* Proyectos por sociedad */}
      {Array.from(grupos.entries()).map(([sociedad, prs]) => (
        <div key={sociedad}>
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={13} className="text-zinc-500" />
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
              {sociedades.get(sociedad) ?? sociedad}
            </h2>
            <span className="text-xs text-zinc-600">{prs.length} {prs.length === 1 ? 'proyecto' : 'proyectos'}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {prs.map(p => {
              const t = totales.get(p.id_ref);
              const presupuestado = t ? Number(t.total_presupuestado) : 0;
              const pagado        = t ? Number(t.total_pagado) : 0;
              const pct           = presupuestado > 0 ? Math.round((pagado / presupuestado) * 100) : 0;

              return (
                <button
                  key={p.id_ref}
                  onClick={() => onSelectProyecto(p.id_ref)}
                  className="group text-left bg-zinc-900/50 border border-white/[0.06] hover:border-blue-500/30 hover:bg-zinc-900/80 rounded-2xl p-5 transition-all"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="text-sm font-semibold text-white leading-tight group-hover:text-blue-200 transition-colors">
                        {p.nombre}
                      </p>
                      {p.ubicacion && (
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin size={10} className="text-zinc-600" />
                          <span className="text-2xs text-zinc-600">{p.ubicacion}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-2xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${estadoBadge(p.estado)}`}>
                        {p.estado ?? '—'}
                      </span>
                      <ArrowRight size={12} className="text-zinc-700 group-hover:text-blue-400 transition-colors" />
                    </div>
                  </div>

                  {/* Quickstats */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { icon: Target,   label: 'OKRs',    val: '—' },
                      { icon: ListTodo, label: 'Tareas',  val: String(tareasMap.get(p.id_ref) ?? '—') },
                      { icon: Wallet,   label: 'Budget',  val: t ? fmt(presupuestado, isPrivateMode) : '—' },
                    ].map(item => (
                      <div key={item.label} className="bg-zinc-800/40 rounded-lg px-2 py-1.5 text-center">
                        <item.icon size={10} className="text-zinc-500 mx-auto mb-0.5" />
                        <p className="text-2xs text-zinc-600 uppercase tracking-wider">{item.label}</p>
                        <p className="text-2xs font-medium text-zinc-300 truncate">{item.val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Budget progress */}
                  {presupuestado > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-2xs text-zinc-600 uppercase tracking-wider">Ejecutado</span>
                        <span className="text-2xs font-medium text-zinc-400">{pct}%</span>
                      </div>
                      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {p.fecha_prevista_salida && (
                    <p className="mt-2 text-2xs text-zinc-600">
                      Salida prevista: {new Date(p.fecha_prevista_salida).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
