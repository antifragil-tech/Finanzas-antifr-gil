/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { ContabilidadLayout } from './components/ContabilidadLayout';
import type { ContabilidadView } from './components/ContabilidadSidebar';
import { DashboardContabilidad } from './components/views/DashboardContabilidad';
import { MovimientosBancarios } from './components/views/MovimientosBancarios';
import { Facturas } from './components/views/Facturas';
import { FacturasEmitidas } from './components/views/FacturasEmitidas';
import { Contactos } from './components/views/Contactos';
import { DiarioBorrador } from './components/views/DiarioBorrador';
import { Reconciliacion } from './components/views/Reconciliacion';
import { MisEmpresas } from './components/views/MisEmpresas';
import { getReglas, getCurrentUserEmail, getSociedadesContabilidad } from './lib/contabilidadApi';
import type { ReglaCategorizacion, SociedadContabilidad } from '@alsari/types';

export function ContabilidadDashboard() {
  const [view, setView] = useState<ContabilidadView>('dashboard');
  const [isPrivateMode, setPrivate] = useState(false);
  const [sociedades, setSociedades] = useState<SociedadContabilidad[]>([]);
  const [reglas, setReglas] = useState<ReglaCategorizacion[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    void getSociedadesContabilidad()
      .then(setSociedades)
      .catch(() => {});
    void getReglas()
      .then(setReglas)
      .catch(() => {});
    void getCurrentUserEmail()
      .then(setUserEmail)
      .catch(() => {});
  }, []);

  const shared = { isPrivateMode, sociedades, reglas, userEmail };

  return (
    <ContabilidadLayout
      selectedView={view}
      isPrivateMode={isPrivateMode}
      onViewChange={setView}
      onTogglePrivacy={() => setPrivate((v) => !v)}
    >
      {view === 'dashboard' && <DashboardContabilidad {...shared} onNavigate={setView} />}
      {view === 'movimientos' && <MovimientosBancarios {...shared} />}
      {view === 'facturas' && <Facturas {...shared} />}
      {view === 'facturas_emitidas' && <FacturasEmitidas {...shared} />}
      {view === 'contactos' && <Contactos {...shared} />}
      {view === 'diario' && <DiarioBorrador {...shared} />}
      {view === 'reconciliacion' && <Reconciliacion {...shared} />}
      {view === 'mis_empresas' && (
        <MisEmpresas sociedades={sociedades} onSociedadesChange={setSociedades} />
      )}
    </ContabilidadLayout>
  );
}
