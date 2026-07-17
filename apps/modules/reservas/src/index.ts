// Punto de entrada del módulo (igual patrón que los demás módulos del OS).
// El host montará este componente cuando el módulo se registre.
export { ClinicaDashboard } from './App';
export type { CitaPanelMode } from './clinica/CitaPanel';
export type { AccionesRealesAgenda, AgendaInicial, Catalogo } from './App';
export type {
  CitaMock,
  EstadoCita,
  EstadoPago,
  OrigenCita,
  Profesional,
  Servicio,
} from './spike/mockData';
