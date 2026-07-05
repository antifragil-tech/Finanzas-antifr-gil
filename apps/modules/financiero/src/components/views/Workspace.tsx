import { useState, useEffect } from 'react';
import {
  LayoutGrid,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import type { WorkspaceWeekIndex, WorkspaceWeekData } from '@alsari/types';

const API_BASE_URL = 'http://localhost:8787/api/workspace';

export function Workspace() {
  const [weeks, setWeeks] = useState<WorkspaceWeekIndex[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [weekData, setWeekData] = useState<WorkspaceWeekData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchIndex = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(API_BASE_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { success: boolean; data: WorkspaceWeekIndex[] };
        if (json.success && Array.isArray(json.data)) {
          setWeeks(json.data);
          if (json.data.length > 0 && json.data[0]) setSelectedWeekId(json.data[0].id);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    void fetchIndex();
  }, []);

  useEffect(() => {
    if (!selectedWeekId) return;
    const fetchWeek = async () => {
      setLoadingWeek(true);
      try {
        const res = await fetch(`${API_BASE_URL}/${selectedWeekId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { success: boolean; data: WorkspaceWeekData };
        if (json.success) setWeekData(json.data);
      } catch {
        setWeekData(null);
      } finally {
        setLoadingWeek(false);
      }
    };
    void fetchWeek();
  }, [selectedWeekId]);

  const statusConfig = {
    critical: {
      color: 'border-rose-500/40 bg-rose-500/5',
      badge: 'bg-rose-500/20 text-rose-400',
      icon: AlertCircle,
      iconColor: 'text-rose-400',
    },
    warning: {
      color: 'border-amber-500/40 bg-amber-500/5',
      badge: 'bg-amber-500/20 text-amber-400',
      icon: AlertCircle,
      iconColor: 'text-amber-400',
    },
    good: {
      color: 'border-emerald-500/40 bg-emerald-500/5',
      badge: 'bg-emerald-500/20 text-emerald-400',
      icon: CheckCircle2,
      iconColor: 'text-emerald-400',
    },
    neutral: {
      color: 'border-white/10 bg-white/[0.02]',
      badge: 'bg-zinc-800 text-zinc-400',
      icon: HelpCircle,
      iconColor: 'text-zinc-500',
    },
  } as const;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-zinc-600">
        <RefreshCw size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32 text-zinc-600">
        <AlertCircle size={48} className="text-rose-500" />
        <p className="text-lg font-semibold uppercase tracking-widest">Error de conexión</p>
        <p className="text-sm text-zinc-500">No se pudo cargar el workspace desde el servidor.</p>
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32 text-zinc-600">
        <LayoutGrid size={48} className="text-zinc-700" />
        <p className="text-lg font-semibold uppercase tracking-widest">Sin semanas disponibles</p>
      </div>
    );
  }

  const selectedWeek = weeks.find((w) => w.id === selectedWeekId);

  return (
    <div className="space-y-8">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {weeks.map((week) => (
          <button
            key={week.id}
            onClick={() => setSelectedWeekId(week.id)}
            className={`flex-shrink-0 rounded-xl border px-5 py-3 text-sm font-medium transition-all ${
              selectedWeekId === week.id
                ? 'border-blue-500/40 bg-blue-600/20 text-blue-300'
                : 'border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-200'
            }`}
          >
            <div className="mb-0.5 font-mono text-xs opacity-60">{week.dateRange}</div>
            <div>{week.title}</div>
            {week.alertsCount > 0 && (
              <div className="text-2xs mt-1 font-semibold uppercase tracking-widest text-rose-400">
                {week.alertsCount} alerta{week.alertsCount > 1 ? 's' : ''}
              </div>
            )}
          </button>
        ))}
      </div>

      {selectedWeek && (
        <div className="text-2xs flex items-center gap-2 font-medium uppercase tracking-widest text-zinc-500">
          <span>Workspace</span>
          <ChevronRight size={10} className="text-zinc-700" />
          <span className="text-zinc-300">{selectedWeek.title}</span>
          <span className="text-zinc-700">•</span>
          <span>{selectedWeek.dateRange}</span>
        </div>
      )}

      {loadingWeek && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-blue-500" />
        </div>
      )}

      {!loadingWeek && weekData && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {weekData.projects.map((project) => {
            const cfg = statusConfig[project.statusType];
            const StatusIcon = cfg.icon;

            return (
              <div
                key={project.id}
                className={`space-y-4 rounded-2xl border p-6 transition-all ${cfg.color}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <StatusIcon size={20} className={cfg.iconColor} />
                    <div>
                      <h3 className="text-sm font-semibold text-white">{project.title}</h3>
                      <p className="mt-0.5 text-xs text-zinc-500">{project.subtitle}</p>
                    </div>
                  </div>
                  <div
                    className={`text-2xs rounded-lg px-2 py-1 font-semibold uppercase tracking-widest ${cfg.badge}`}
                  >
                    {project.statusType}
                  </div>
                </div>

                {project.items.length > 0 && (
                  <ul className="space-y-1.5">
                    {project.items.map((item) => (
                      <li key={item.id} className="flex items-start gap-2 text-xs text-zinc-400">
                        <span className="mt-0.5 text-zinc-600">•</span>
                        {item.text}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="space-y-2 border-t border-white/5 pt-4">
                  {project.nextStep && (
                    <div>
                      <span className="text-2xs font-semibold uppercase tracking-widest text-zinc-600">
                        Próximo paso
                      </span>
                      <p className="mt-0.5 text-xs text-zinc-300">{project.nextStep}</p>
                    </div>
                  )}
                  {project.directorNote && (
                    <div>
                      <span className="text-2xs font-semibold uppercase tracking-widest text-amber-500/60">
                        Nota Director
                      </span>
                      <p className="mt-0.5 text-xs italic text-amber-200/70">
                        {project.directorNote}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loadingWeek && weekData && weekData.projects.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-zinc-600">
          <LayoutGrid size={40} className="text-zinc-700" />
          <p className="text-sm font-semibold uppercase tracking-widest">
            Sin proyectos esta semana
          </p>
        </div>
      )}
    </div>
  );
}
