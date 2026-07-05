import { ReservasClient } from './ReservasClient';

// Módulo canónico Reservas (PR #5, apps/modules/reservas) montado en el shell.
// Sin copia de código: el host importa del workspace vía ReservasClient.
export default function ReservasPage() {
  return <ReservasClient />;
}
