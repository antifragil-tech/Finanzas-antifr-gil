import { useState } from 'react';
import type { DashboardData, SocietyOption, ViewOption } from '@alsari/types';
import { FinancialSidebar } from './FinancialSidebar';
import { EntidadesView } from './views/EntidadesView';
import { Overview } from './views/Overview';
import { ProjectView } from './views/ProjectView';
import { CorporateMap } from './CorporateMap';
import { MaestroView } from './views/MaestroView';
import { PatrimonioView } from './views/PatrimonioView';
import { CashflowView } from './views/CashflowView';
import { VencimientosView } from './views/VencimientosView';
import { PersonaView, ActivosSociedadSection } from './views/PersonaView';
import { ChevronRight, PanelLeftOpen } from 'lucide-react';

const PERSONA_IDS: Record<string, string> = {
  javier_alarcon: 'Javier',
  ivan_alarcon: 'Iván',
};

// Global modules: header shows module name, not entity name
const GLOBAL_VIEWS = new Set([
  'entidades',
  'map',
  'cashflow',
  'patrimonio',
  'vencimientos',
  'maestro',
]);

const VIEW_NAMES: Record<string, string> = {
  entidades: 'Entidades',
  map: 'Mapa Corporativo',
  cashflow: 'Cashflow',
  patrimonio: 'Activos Patrimoniales',
  vencimientos: 'Vencimientos',
  maestro: 'Datos Maestros',
  overview: 'Vista Global',
};

type DashboardLayoutProps = {
  data: DashboardData;
  selectedSociety: SocietyOption;
  selectedView: string;
  availableSocieties: SocietyOption[];
  availableViews: ViewOption[];
  isPrivateMode: boolean;
  onSocietyChange: (society: SocietyOption) => void;
  onViewChange: (viewId: string) => void;
  onTogglePrivacy: () => void;
  onRefreshData?: () => void;
};

export function DashboardLayout({
  data,
  selectedSociety,
  selectedView,
  availableSocieties,
  availableViews,
  isPrivateMode,
  onSocietyChange,
  onViewChange,
  onTogglePrivacy,
  onRefreshData,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isGlobalView = GLOBAL_VIEWS.has(selectedView);
  const viewLabel =
    VIEW_NAMES[selectedView] ??
    availableViews.find((v) => v.id === selectedView)?.nombre ??
    selectedView;
  const headerTitle = isGlobalView ? viewLabel : selectedSociety.nombre;

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 font-sans text-zinc-100">
      <FinancialSidebar
        selectedSociety={selectedSociety}
        selectedView={selectedView}
        availableViews={availableViews}
        isPrivateMode={isPrivateMode}
        isOpen={sidebarOpen}
        onViewChange={onViewChange}
        onTogglePrivacy={onTogglePrivacy}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />
      <main
        className={`relative h-full flex-1 overflow-y-auto bg-zinc-950 transition-[margin] duration-200 ${sidebarOpen ? 'ml-72' : 'ml-0'}`}
      >
        <header className="sticky top-0 z-40 border-b border-white/5 bg-zinc-950/80 px-10 py-6 backdrop-blur-xl">
          <div className="text-2xs mb-1.5 flex items-center gap-2 font-medium uppercase tracking-widest text-zinc-500">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                title="Mostrar panel"
                className="mr-1 rounded-lg p-1.5 text-zinc-600 transition-all hover:bg-white/[0.04] hover:text-zinc-300"
              >
                <PanelLeftOpen size={14} />
              </button>
            )}
            <span>ANTIFRÁGIL</span>
            {!isGlobalView && (
              <>
                <ChevronRight size={10} className="text-zinc-700" />
                <button
                  onClick={() => onViewChange('entidades')}
                  className="text-zinc-400 transition-colors hover:text-zinc-200"
                >
                  Entidades
                </button>
                <ChevronRight size={10} className="text-zinc-700" />
                <span className="text-zinc-400">{selectedSociety.nombre}</span>
              </>
            )}
            <ChevronRight size={10} className="text-zinc-700" />
            <span className="uppercase text-blue-400">{viewLabel}</span>
          </div>
          <h1 className="text-4xl font-light tracking-tighter text-white">{headerTitle}</h1>
          {!isGlobalView && selectedSociety.cif && (
            <p className="mt-1 text-sm font-medium tracking-wider text-zinc-500">
              CIF: {selectedSociety.cif}
            </p>
          )}
        </header>

        <div className="px-10 py-8">
          {selectedView === 'entidades' ? (
            <EntidadesView
              data={data}
              availableSocieties={availableSocieties}
              isPrivateMode={isPrivateMode}
              onSelectSociety={(s) => {
                onSocietyChange(s);
                onViewChange('overview');
              }}
              {...(onRefreshData ? { onRefresh: onRefreshData } : {})}
              onNavigateToPatrimonio={() => onViewChange('patrimonio')}
            />
          ) : selectedView === 'map' ? (
            <CorporateMap
              data={data}
              onSelectSociety={(id) => {
                let society = availableSocieties.find((s) => s.id === id || s.idRef === id);
                if (!society) {
                  const searchName = id.replace(/^S-/, '').replace(/_/g, ' ').toLowerCase();
                  society = availableSocieties.find(
                    (s) =>
                      s.nombre.toLowerCase().includes(searchName) ||
                      searchName.includes(s.nombre.toLowerCase()),
                  );
                }
                if (society) {
                  onSocietyChange(society);
                  onViewChange('overview');
                }
              }}
              onClose={() => onViewChange('entidades')}
            />
          ) : selectedView === 'overview' && selectedSociety.id in PERSONA_IDS ? (
            <PersonaView
              personaNombre={PERSONA_IDS[selectedSociety.id] ?? selectedSociety.nombre}
              holdingNombre={selectedSociety.nombre}
              isPrivateMode={isPrivateMode}
              onViewHolding={() => {
                const holding = availableSocieties.find(
                  (s) => s.idRef === selectedSociety.idRef && s.id !== selectedSociety.id,
                );
                if (holding) {
                  onSocietyChange(holding);
                }
              }}
            />
          ) : selectedView === 'overview' ? (
            <div className="space-y-12">
              <Overview
                data={data}
                selectedSociety={selectedSociety}
                isPrivateMode={isPrivateMode}
              />
              {selectedSociety.idRef && (
                <ActivosSociedadSection
                  sociedadIdRef={selectedSociety.idRef}
                  isPrivateMode={isPrivateMode}
                  onNavigateToPatrimonio={() => onViewChange('patrimonio')}
                />
              )}
            </div>
          ) : selectedView === 'cashflow' ? (
            <CashflowView
              data={data}
              selectedSociety={selectedSociety}
              isPrivateMode={isPrivateMode}
            />
          ) : selectedView === 'vencimientos' ? (
            <VencimientosView
              isPrivateMode={isPrivateMode}
              sociedadOptions={data.sociedades.map((s) => ({
                id: s['ID-Ref'],
                nombre: s['Nombre de la Sociedad'],
              }))}
            />
          ) : selectedView === 'maestro' ? (
            <MaestroView
              {...(onRefreshData ? { onRefresh: onRefreshData } : {})}
              onNavigateToPatrimonio={() => onViewChange('patrimonio')}
            />
          ) : selectedView === 'patrimonio' ? (
            <PatrimonioView
              isPrivateMode={isPrivateMode}
              sociedadOptions={data.sociedades.map((s) => ({
                id: s['ID-Ref'],
                nombre: s['Nombre de la Sociedad'],
              }))}
            />
          ) : (
            <ProjectView data={data} projectId={selectedView} isPrivateMode={isPrivateMode} />
          )}
        </div>
      </main>
    </div>
  );
}
