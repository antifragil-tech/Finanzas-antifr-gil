import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClinicaDashboard } from './App';
import '@alsari/ui/styles'; // tailwind base + utilidades glass del design system
import './index.css'; // overrides de tema para el calendario (DayPilot)
import './standalone.css'; // altura de viewport — solo para el arranque Vite, no para el host

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <ClinicaDashboard />
  </StrictMode>,
);
