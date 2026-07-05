/// <reference types="vite/client" />
import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from './components/DashboardLayout';
import type {
  DashboardData,
  FinancialProject,
  FinancialSociety,
  Project,
  Society,
  SocietyOption,
  ViewOption,
} from '@alsari/types';
import { AlertTriangle, RefreshCw, Layers } from 'lucide-react';
import { sbHeaders, sbUrl } from '@alsari/supabase-client';
import { BalanceView } from './components/views/BalanceView';

const CACHE_KEY = 'antifragil_dashboard_cache_v1';

function loadCache(): DashboardData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as DashboardData) : null;
  } catch {
    return null;
  }
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function sbGet<T>(table: string, params = ''): Promise<T[]> {
  const res = await fetch(sbUrl(`${table}?select=*${params ? '&' + params : ''}`), {
    headers: sbHeaders(),
  });
  if (!res.ok) throw new Error(`Supabase ${table}: HTTP ${res.status}`);
  return res.json() as Promise<T[]>;
}

// ── Row → DashboardData mappers ───────────────────────────────────────────────

type SocRow = {
  id_ref: string;
  nombre: string;
  cif?: string;
  holding_principal?: string;
  pct_pavier?: number;
  pct_armia?: number;
  estado?: string;
  parent_sociedad_id?: string | null;
  pct_en_sociedad_padre?: number | null;
};
type ProjRow = { id_ref: string; nombre: string; sociedad_tenedora?: string; estado?: string };
type KpisSocRow = {
  id_ref: string;
  nombre?: string;
  tipo?: string;
  caja_disponible?: number;
  deuda_bancaria_cp?: number;
  deuda_bancaria_lp?: number;
  deuda_bancaria?: number;
  deuda_socios?: number;
  deuda_financiera_neta?: number;
  activo_corriente?: number;
  activo_no_corriente?: number;
  activo_total?: number;
  pasivo_corriente?: number;
  pasivo_no_corriente?: number;
  pasivo_total?: number;
  fondo_maniobra?: number;
  patrimonio_neto?: number;
  fecha_actualizacion?: string;
};
type KpisProjRow = {
  id_ref: string;
  nombre?: string;
  tipo?: string;
  sociedad_tenedora?: string;
  presupuesto?: number;
  inversion_inicial?: number;
  recapex_acumulado?: number;
  capital_expuesto?: number;
  deuda?: number;
  beneficio_acumulado_bruto?: number;
  opex_acumulado?: number;
  valoracion?: number;
  margen_latente_salida?: number;
  margen_latente_salida_pct?: number;
  fecha_actualizacion?: string;
};

function mapSociedad(r: SocRow): Society {
  return {
    'ID-Ref': r.id_ref,
    'Nombre de la Sociedad': r.nombre,
    ...(r.cif ? { CIF: r.cif } : {}),
    '% Pavier': r.pct_pavier ?? 0,
    '% Armia': r.pct_armia ?? 0,
    Estado: r.estado,
    parent_sociedad_id: r.parent_sociedad_id ?? null,
    pct_en_sociedad_padre: r.pct_en_sociedad_padre ?? null,
  };
}

function mapProyecto(
  r: ProjRow,
): Project & { clean_id: string; clean_nombre: string; clean_tenedora: string } {
  return {
    'ID-Ref': r.id_ref,
    Nombre: r.nombre,
    'Nombre del proyecto': r.nombre,
    'Sociedad-Ref': r.sociedad_tenedora ?? '',
    'Sociedad tenedora': r.sociedad_tenedora ?? '',
    Estado: r.estado,
    clean_id: r.id_ref,
    clean_nombre: r.nombre,
    clean_tenedora: r.sociedad_tenedora ?? '',
  };
}

function mapKpisSoc(r: KpisSocRow): FinancialSociety {
  return {
    'ID-Ref': r.id_ref,
    Nombre: r.nombre ?? '',
    Tipo: r.tipo,
    'Caja Disponible': r.caja_disponible ?? 0,
    'Deuda Bancaria C/P': r.deuda_bancaria_cp ?? 0,
    'Deuda Bancaria L/P': r.deuda_bancaria_lp ?? 0,
    'Deuda Bancaria': r.deuda_bancaria ?? 0,
    'Deuda de socios': r.deuda_socios ?? 0,
    'Deuda Financiera Neta': r.deuda_financiera_neta ?? 0,
    'Activo Corriente': r.activo_corriente ?? 0,
    'Activo No Corriente': r.activo_no_corriente ?? 0,
    'Activo Total': r.activo_total ?? 0,
    'Pasivo Corriente': r.pasivo_corriente ?? 0,
    'Pasivo No Corriente': r.pasivo_no_corriente ?? 0,
    'Pasivo Total': r.pasivo_total ?? 0,
    'Fondo de maniobra': r.fondo_maniobra ?? 0,
    'Patrimonio neto': r.patrimonio_neto ?? 0,
    'Fecha Actualización': r.fecha_actualizacion,
  };
}

function mapKpisProj(r: KpisProjRow): FinancialProject {
  return {
    'ID-Ref': r.id_ref,
    Nombre: r.nombre ?? '',
    Tipo: r.tipo,
    'Sociedad-Ref': r.sociedad_tenedora ?? '',
    'Sociedad tenedora': r.sociedad_tenedora ?? '',
    Presupuesto: r.presupuesto ?? 0,
    'Inversión inicial': r.inversion_inicial ?? 0,
    'ReCapex Acumulado': r.recapex_acumulado ?? 0,
    'Capital Expuesto': r.capital_expuesto ?? 0,
    Deuda: r.deuda ?? 0,
    'Beneficio Acumulado': r.beneficio_acumulado_bruto ?? 0,
    'OPEX Acumulado': r.opex_acumulado ?? 0,
    Valoración: r.valoracion ?? 0,
    'Margen latente de salida': r.margen_latente_salida ?? 0,
    'Margen Latente %': r.margen_latente_salida_pct ?? 0,
    'Fecha Actualización': r.fecha_actualizacion,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FinancieroDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [usingCache, setUsingCache] = useState(false);

  const [selectedSociety, setSelectedSociety] = useState<SocietyOption>({
    id: 'alsari_capital',
    nombre: 'Antifrágil',
    idRef: null,
    variant: 'secondary',
    badge: 'Holding principal',
  });

  const [selectedView, setSelectedView] = useState('entidades');
  const [isPrivateMode, setIsPrivateMode] = useState(false);

  const fetchFromSupabase = async (): Promise<DashboardData> => {
    const [socRows, projRows, kpisSocRows, kpisProjRows] = await Promise.all([
      sbGet<SocRow>('sociedades', 'order=id_ref'),
      sbGet<ProjRow>('proyectos', 'order=id_ref'),
      sbGet<KpisSocRow>('kpis_sociedades', 'order=id_ref'),
      sbGet<KpisProjRow>('kpis_proyectos', 'order=id_ref'),
    ]);
    if (!socRows.length) throw new Error('Supabase vacío');
    return {
      sociedades: socRows.map(mapSociedad),
      proyectos: projRows.map(mapProyecto) as unknown as DashboardData['proyectos'],
      finanzas_sociedades: kpisSocRows.map(mapKpisSoc),
      finanzas_proyectos: kpisProjRows.map(mapKpisProj),
      fichas: {},
    };
  };

  const fetchFromCFWorker = async (): Promise<DashboardData> => {
    const apiUrl =
      (import.meta.env?.['VITE_API_URL'] as string | undefined) ?? 'http://127.0.0.1:8787';
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`CF Worker HTTP ${response.status}`);
    const result = (await response.json()) as { success: boolean; data: DashboardData };
    if (!result.success || !result.data?.sociedades || !result.data?.finanzas_sociedades) {
      throw new Error('CF Worker: respuesta inválida');
    }
    const cleanProjects = (result.data.proyectos || []).map((row: Record<string, unknown>) => {
      const keys = Object.keys(row);
      const keyTenedora = keys.find(
        (k) => k.toLowerCase().includes('tenedora') || k.toLowerCase().includes('holding'),
      );
      const keyNombre =
        keys.find(
          (k) => k.toLowerCase().includes('nombre') && k.toLowerCase().includes('proyecto'),
        ) || keys.find((k) => k.toLowerCase() === 'nombre');
      const keyId =
        keys.find((k) => k.toLowerCase().includes('id') && k.toLowerCase().includes('ref')) ||
        keys.find((k) => k.toLowerCase() === 'id-ref');
      return {
        ...row,
        clean_id: String(row[keyId ?? ''] ?? '').trim(),
        clean_nombre: String(row[keyNombre ?? ''] ?? '').trim(),
        clean_tenedora: String(row[keyTenedora ?? ''] ?? '').trim(),
      };
    });
    return { ...result.data, proyectos: cleanProjects as unknown as DashboardData['proyectos'] };
  };

  const fetchData = async () => {
    setLoading(true);
    setError(false);
    try {
      let processed: DashboardData | null = null;

      try {
        processed = await fetchFromSupabase();
      } catch {
        /* sigue */
      }
      if (!processed) {
        try {
          processed = await fetchFromCFWorker();
        } catch {
          /* sigue */
        }
      }

      if (processed) {
        setData(processed);
        setUsingCache(false);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(processed));
        } catch {
          /* cuota llena */
        }
      } else {
        const cached = loadCache();
        if (cached) {
          setData(cached);
          setUsingCache(true);
        } else {
          setError(true);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableSocieties = useMemo<SocietyOption[]>(() => {
    if (!data?.sociedades || data.sociedades.length === 0) return [];
    const societies: SocietyOption[] = [];
    const pavier_raw = data.sociedades.find((s) =>
      s?.['Nombre de la Sociedad']?.toLowerCase().includes('pavier'),
    );
    const armia_raw = data.sociedades.find((s) =>
      s?.['Nombre de la Sociedad']?.toLowerCase().includes('armia'),
    );
    // Filas de personas físicas en la tabla de sociedades (con DNI, no CIF de holding)
    const javier_persona = data.sociedades.find(
      (s) =>
        s !== pavier_raw &&
        (s?.['Nombre de la Sociedad']?.toLowerCase().includes('javier') ||
          s?.['ID-Ref']?.toLowerCase().includes('javier')),
    );
    const ivan_persona = data.sociedades.find(
      (s) =>
        s !== armia_raw &&
        (s?.['Nombre de la Sociedad']?.toLowerCase().includes('iván') ||
          s?.['Nombre de la Sociedad']?.toLowerCase().includes('ivan') ||
          s?.['ID-Ref']?.toLowerCase().includes('ivan')),
    );
    const cif = (raw: typeof pavier_raw) => (raw?.['CIF'] ? { cif: raw['CIF'] } : {});
    // Personas físicas: sin CIF (tienen DNI, no CIF de sociedad)
    if (pavier_raw)
      societies.push({
        id: 'javier_alarcon',
        nombre: 'Javier Alarcón',
        idRef: pavier_raw['ID-Ref'],
        variant: 'primary',
        showCrown: true,
      });
    if (armia_raw)
      societies.push({
        id: 'ivan_alarcon',
        nombre: 'Iván Alarcón',
        idRef: armia_raw['ID-Ref'],
        variant: 'primary',
        showCrown: true,
      });
    societies.push({
      id: 'alsari_capital',
      nombre: 'Antifrágil',
      idRef: null,
      variant: 'secondary',
      badge: 'Consolidado Total',
    });
    if (pavier_raw)
      societies.push({
        id: pavier_raw['ID-Ref'],
        nombre: pavier_raw['Nombre de la Sociedad'],
        idRef: pavier_raw['ID-Ref'],
        ...cif(pavier_raw),
        variant: 'secondary',
        badge: 'Holding Principal',
      });
    if (armia_raw)
      societies.push({
        id: armia_raw['ID-Ref'],
        nombre: armia_raw['Nombre de la Sociedad'],
        idRef: armia_raw['ID-Ref'],
        ...cif(armia_raw),
        variant: 'secondary',
        badge: 'Holding Principal',
      });
    const filiales = data.sociedades
      .filter(
        (s) => s !== pavier_raw && s !== armia_raw && s !== javier_persona && s !== ivan_persona,
      )
      .sort((a, b) =>
        (a?.['Nombre de la Sociedad'] || '').localeCompare(b?.['Nombre de la Sociedad'] || ''),
      )
      .map((s) => ({
        id: s['ID-Ref'],
        nombre: s['Nombre de la Sociedad'],
        idRef: s['ID-Ref'],
        ...(s['CIF'] ? { cif: s['CIF'] } : {}),
        variant: 'neutral' as const,
        badge: 'Filial',
      }));
    societies.push(...filiales);
    return societies;
  }, [data?.sociedades]);

  const availableViews = useMemo<ViewOption[]>(() => {
    const views: ViewOption[] = [{ id: 'overview', nombre: 'Visión General' }];
    if (selectedSociety?.idRef && data?.proyectos && Array.isArray(data.proyectos)) {
      const id = String(selectedSociety.idRef).trim();
      data.proyectos
        .filter((p) => p.clean_tenedora === id)
        .forEach((p) => {
          const projectId = p?.clean_id || p?.['ID-Ref']?.toString().trim();
          const projectName = p?.clean_nombre || p?.Nombre || p?.['Nombre del proyecto'];
          if (projectId && projectName) views.push({ id: projectId, nombre: projectName });
        });
    }
    return views;
  }, [selectedSociety, data?.proyectos]);

  const handleSocietyChange = (society: SocietyOption) => {
    setSelectedSociety(society);
    setSelectedView('overview');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950">
        <img
          src="/logo.png"
          alt="Cargando..."
          className="mb-4 h-24 w-auto animate-pulse object-contain"
        />
        <p className="text-sm font-medium tracking-wider text-zinc-500">ANTIFRÁGIL OS</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-rose-500/20 bg-rose-950/40 px-6 py-2.5 text-xs text-rose-400">
          <AlertTriangle size={13} className="shrink-0" />
          <span>Supabase no disponible — sin caché local. Solo Balance PGC operativo.</span>
          <button
            onClick={() => {
              void fetchData();
            }}
            className="ml-auto flex items-center gap-1.5 transition-colors hover:text-rose-200"
          >
            <RefreshCw size={12} />
            Reintentar
          </button>
        </div>
        <div className="max-w-5xl px-10 py-8">
          <BalanceView />
        </div>
      </div>
    );
  }

  if (availableSocieties.length === 0 || availableViews.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-6 text-zinc-500">
          <Layers size={64} className="animate-pulse text-purple-500" />
          <div className="flex flex-col items-center gap-2">
            <p className="text-lg font-semibold uppercase tracking-widest">
              Initializing Neural Core
            </p>
            <p className="font-mono text-xs opacity-60">Building society structure...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 selection:bg-blue-500/30">
      {usingCache && (
        <div className="sticky top-0 z-50 flex items-center gap-3 border-b border-amber-500/20 bg-amber-950/40 px-6 py-2 text-xs text-amber-400">
          <AlertTriangle size={12} className="shrink-0" />
          <span>
            Supabase offline — mostrando datos de la última sincronización. Balance PGC operativo.
          </span>
          <button
            onClick={() => {
              void fetchData();
            }}
            className="ml-auto flex items-center gap-1.5 transition-colors hover:text-amber-200"
          >
            <RefreshCw size={12} />
            Reintentar
          </button>
        </div>
      )}
      <DashboardLayout
        data={data}
        selectedSociety={selectedSociety}
        selectedView={selectedView}
        availableSocieties={availableSocieties}
        availableViews={availableViews}
        isPrivateMode={isPrivateMode}
        onSocietyChange={handleSocietyChange}
        onViewChange={setSelectedView}
        onTogglePrivacy={() => setIsPrivateMode(!isPrivateMode)}
        onRefreshData={() => {
          void fetchData();
        }}
      />
      <div className="fixed bottom-8 right-8 z-50">
        <div className="flex h-12 w-12 cursor-crosshair items-center justify-center rounded-full border border-blue-500/40 bg-blue-500/20 text-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.3)] backdrop-blur-xl transition-all hover:scale-110 active:scale-90">
          <Layers size={20} />
        </div>
      </div>
    </div>
  );
}
