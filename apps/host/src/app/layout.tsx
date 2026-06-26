import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
// Tema oscuro del calendario (DayPilot) del módulo reservas, montado embebido en
// esta demo. Es CSS global scopeado bajo `.dp-quiet`; el root layout es el sitio
// canónico para CSS global en App Router. (No se toca la fuente de reservas.)
import '../../../modules/reservas/src/index.css';

export const metadata: Metadata = {
  title: 'Antifrágil OS',
  description: 'Sistema operativo de Antifrágil',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
