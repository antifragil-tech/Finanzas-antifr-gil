/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { ProyectosLayout } from './components/ProyectosLayout';
import type { ProyectosView, ProyectoTab } from './components/ProyectosSidebar';
import { VistaGlobal }    from './components/views/VistaGlobal';
import { DetalleProyecto } from './components/views/DetalleProyecto';
import { PanelTareas }    from './components/views/PanelTareas';
import { Tesoreria }      from './components/views/Tesoreria';
import { getProyectos, getSociedades } from './lib/proyectosApi';
import type { ProyectoRow, SociedadRow } from './lib/proyectosApi';
import { NuevoProyecto } from './components/views/NuevoProyecto';

export function ProyectosDashboard() {
  const [view, setView]                     = useState<ProyectosView>('global');
  const [selectedId, setSelectedId]         = useState<string | null>(null);
  const [selectedTab, setSelectedTab]       = useState<ProyectoTab>('objetivos');
  const [isPrivateMode, setPrivate]         = useState(false);
  const [proyectos, setProyectos]           = useState<ProyectoRow[]>([]);
  const [sociedades, setSociedades]         = useState<SociedadRow[]>([]);
  const [loadingProyectos, setLoadingProyectos] = useState(true);

  useEffect(() => {
    getProyectos()
      .then(setProyectos)
      .catch(() => {})
      .finally(() => setLoadingProyectos(false));
    getSociedades().then(setSociedades).catch(() => {});
  }, []);

  function handleSelectProyecto(id: string) {
    setSelectedId(id);
    setSelectedTab('presupuesto-gasto');
    setView('detalle');
  }

  function handleViewChange(v: ProyectosView) {
    setView(v);
    if (v === 'global') setSelectedId(null);
  }

  const proyectoActivo = proyectos.find(p => p.id_ref === selectedId) ?? null;

  return (
    <ProyectosLayout
      selectedView={view}
      selectedProyectoId={selectedId}
      selectedTab={selectedTab}
      proyectos={proyectos}
      isPrivateMode={isPrivateMode}
      onViewChange={handleViewChange}
      onSelectProyecto={handleSelectProyecto}
      onTabChange={setSelectedTab}
      onTogglePrivacy={() => setPrivate(v => !v)}
    >
      {loadingProyectos ? (
        <div className="flex items-center justify-center h-40 text-zinc-600 text-sm">
          Cargando proyectos...
        </div>
      ) : view === 'global' ? (
        <VistaGlobal
          proyectos={proyectos}
          isPrivateMode={isPrivateMode}
          onSelectProyecto={handleSelectProyecto}
        />
      ) : view === 'nuevo-proyecto' ? (
        <NuevoProyecto
          sociedades={sociedades}
          onCreated={id => {
            getProyectos().then(setProyectos).catch(() => {});
            handleSelectProyecto(id);
          }}
          onCancel={() => handleViewChange('global')}
        />
      ) : view === 'tareas-global' ? (
        <PanelTareas
          proyectos={proyectos}
          isPrivateMode={isPrivateMode}
          onGoToProject={handleSelectProyecto}
        />
      ) : view === 'tesoreria' ? (
        <Tesoreria isPrivateMode={isPrivateMode} />
      ) : proyectoActivo ? (
        <DetalleProyecto
          proyecto={proyectoActivo}
          selectedTab={selectedTab}
          isPrivateMode={isPrivateMode}
          sociedades={sociedades}
          onTabChange={setSelectedTab}
          onBack={() => handleViewChange('global')}
          onUpdated={p => setProyectos(prev => prev.map(x => x.id_ref === p.id_ref ? p : x))}
          onDeleted={idRef => {
            setProyectos(prev => prev.filter(x => x.id_ref !== idRef));
            handleViewChange('global');
          }}
        />
      ) : (
        <div className="flex items-center justify-center h-40 text-zinc-600 text-sm">
          Proyecto no encontrado
        </div>
      )}
    </ProyectosLayout>
  );
}
