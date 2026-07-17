import { cargarAgendaReal } from '@/lib/datos/reservas';
import { ReservasClient } from './ReservasClient';

// Módulo canónico Reservas (apps/modules/reservas) montado en el shell.
// Server component: con entorno Supabase carga la agenda REAL (citas +
// catálogos de clinica_*) y la inyecta al módulo; sin entorno el módulo
// arranca en su escenario demo (contrato del build: CI sin secrets en verde).
export default async function ReservasPage() {
  const agenda = await cargarAgendaReal();

  if (!agenda) return <ReservasClient />;

  // "Hoy" real en la zona de la clínica (el servidor puede correr en UTC).
  const hoy = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  return (
    <ReservasClient
      catalogo={{
        profesionales: agenda.profesionales,
        servicios: agenda.servicios,
        salas: [],
        real: true,
      }}
      agenda={{ hoy, citas: agenda.citas }}
    />
  );
}
