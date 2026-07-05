import { Building2, Settings, ShieldCheck, Users } from 'lucide-react';
import {
  OSActionBar,
  OSActionButton,
  OSDataList,
  OSEmptyState,
  OSKpiCard,
  OSPageHeader,
  OSSection,
  OSStatusBadge,
} from '@/components/os/ui';

// Página de ejemplo del panel kit (split 5D). Todo el contenido es ficticio
// de interfaz: no representa configuración real de Antifrágil.

export default function ConfiguracionPage() {
  return (
    <div className="pb-12">
      <OSPageHeader
        titulo="Configuración"
        descripcion="Ajustes del sistema: usuarios, roles, centros y catálogos. Esta página es el escaparate del panel kit del OS; los datos son ficticios de interfaz."
        acciones={
          <OSActionBar>
            <OSActionButton variante="primaria">Nuevo usuario</OSActionButton>
            <OSActionButton>Exportar</OSActionButton>
          </OSActionBar>
        }
      />

      <OSSection titulo="Resumen" nota="datos ficticios de interfaz">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <OSKpiCard label="Usuarios" valor="6" hint="mock" icon={Users} />
          <OSKpiCard
            label="Roles definidos"
            valor="4"
            hint="CEO · coordinación · recepción · profesional"
            icon={ShieldCheck}
            tone="info"
          />
          <OSKpiCard
            label="Centros activos"
            valor="2"
            hint="de 6 en catálogo"
            icon={Building2}
            tone="ok"
          />
          <OSKpiCard
            label="Catálogos pendientes"
            valor="3"
            hint="mock"
            icon={Settings}
            tone="warn"
          />
        </div>
      </OSSection>

      <OSSection titulo="Centros y proyectos" nota="catálogo del contexto global (5C)">
        <OSDataList
          items={[
            {
              id: 'playamar',
              principal: 'Clínica Playamar',
              secundario: 'Centro propio',
              badge: <OSStatusBadge tone="ok">Activo</OSStatusBadge>,
            },
            {
              id: 'lidomare',
              principal: 'Lidomare',
              secundario: 'Centro asociado — frontera económica pendiente (B2-P2)',
              badge: <OSStatusBadge tone="warn">Pendiente</OSStatusBadge>,
            },
            {
              id: 'vivofacil',
              principal: 'Vivofácil',
              secundario: 'Canal B2B — derivaciones',
              badge: <OSStatusBadge tone="info">Canal</OSStatusBadge>,
            },
            {
              id: 'oasis',
              principal: 'Oasis · 9AM Club',
              secundario: 'Naturaleza pendiente de definir (B2-P1)',
              badge: <OSStatusBadge>Por definir</OSStatusBadge>,
            },
          ]}
        />
      </OSSection>

      <OSSection titulo="Integraciones">
        <OSEmptyState
          titulo="Sin integraciones configuradas"
          descripcion="Las conexiones (Supabase real, banco, gestoría) se configurarán cuando los módulos operativos estén integrados. Nada conectado en este shell."
          icon={Settings}
          accion={<OSActionButton>Ver plan de integración</OSActionButton>}
        />
      </OSSection>
    </div>
  );
}
