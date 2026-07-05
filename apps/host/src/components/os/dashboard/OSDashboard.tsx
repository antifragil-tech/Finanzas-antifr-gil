'use client';

import { AlertTriangle, Boxes } from 'lucide-react';
import { centroLabel, periodoLabel, rolLabel } from '../context/osGlobalOptions';
import { useOSGlobalContext } from '../context/useOSGlobalContext';
import { OSDataList, OSEmptyState, OSKpiCard, OSPageHeader, OSSection, OSStatusBadge } from '../ui';
import {
  ALERTAS,
  FINANZAS_OPERATIVAS,
  getActividadPropia,
  getResumenOperativo,
  MODULOS_CONECTADOS,
} from './mockDashboardData';

// Dashboard operativo mock del OS (split 5E). Todo es ficticio de interfaz y
// está rotulado como tal. La visibilidad por rol es comportamiento VISUAL
// (qué cards se muestran), no seguridad: los permisos reales llegarán con
// auth/RLS al conectar módulos.

const ESTADO_BADGE = {
  diseño: <OSStatusBadge tone="info">Diseño</OSStatusBadge>,
  draft: <OSStatusBadge tone="warn">Draft</OSStatusBadge>,
  no_apply: <OSStatusBadge>NO APPLY</OSStatusBadge>,
} as const;

export function OSDashboard() {
  const { centro, periodo, rol } = useOSGlobalContext();

  const resumen = getResumenOperativo(centro, periodo).filter((k) => k.roles.includes(rol));
  const finanzas = FINANZAS_OPERATIVAS.filter((k) => k.roles.includes(rol));
  const alertas = ALERTAS.filter((a) => a.roles.includes(rol));
  const actividad = getActividadPropia(periodo).filter((k) => k.roles.includes(rol));
  const veModulos = rol === 'ceo' || rol === 'coordinacion';

  return (
    <div className="pb-12">
      <OSPageHeader
        titulo={`Panel — ${centroLabel(centro)}`}
        descripcion={`Periodo: ${periodoLabel(periodo)} · Vista: ${rolLabel(rol)}. Datos ficticios de interfaz: no representan actividad real de Antifrágil.`}
        acciones={<OSStatusBadge tone="warn">Mock</OSStatusBadge>}
      />

      {resumen.length > 0 && (
        <OSSection titulo="Resumen operativo" nota="datos ficticios">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {resumen.map((k) => (
              <OSKpiCard key={k.id} label={k.label} valor={k.valor} hint={k.hint} tone={k.tone} />
            ))}
          </div>
        </OSSection>
      )}

      {actividad.length > 0 && (
        <OSSection titulo="Mi actividad" nota="solo actividad propia · mock">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {actividad.map((k) => (
              <OSKpiCard key={k.id} label={k.label} valor={k.valor} hint={k.hint} tone={k.tone} />
            ))}
          </div>
        </OSSection>
      )}

      {finanzas.length > 0 && (
        <OSSection titulo="Finanzas operativas" nota="módulos sin conectar">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {finanzas.map((k) => (
              <OSKpiCard key={k.id} label={k.label} valor={k.valor} hint={k.hint} tone={k.tone} />
            ))}
          </div>
        </OSSection>
      )}

      {veModulos && (
        <OSSection titulo="Módulos conectados" nota="estado real de cada línea">
          <OSDataList
            items={MODULOS_CONECTADOS.map((m) => ({
              id: m.id,
              principal: m.nombre,
              secundario: m.detalle,
              meta: m.fuente,
              badge: ESTADO_BADGE[m.estado],
            }))}
          />
        </OSSection>
      )}

      <OSSection titulo="Alertas" nota="mock">
        {alertas.length > 0 ? (
          <OSDataList
            items={alertas.map((a) => ({
              id: a.id,
              principal: a.texto,
              badge: <OSStatusBadge tone={a.tone}>Aviso</OSStatusBadge>,
            }))}
          />
        ) : (
          <OSEmptyState
            titulo="Sin alertas para esta vista"
            descripcion="El rol activo no tiene alertas mock asignadas."
            icon={AlertTriangle}
          />
        )}
      </OSSection>

      {!veModulos && rol !== 'profesional' && (
        <OSSection titulo="Módulos">
          <OSEmptyState
            titulo="Vista limitada"
            descripcion="La vista de recepción muestra solo operación diaria: citas, cobros e incidencias."
            icon={Boxes}
          />
        </OSSection>
      )}
    </div>
  );
}
