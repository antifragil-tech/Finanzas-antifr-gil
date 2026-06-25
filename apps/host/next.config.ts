import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@alsari/ui', '@alsari/utils', '@alsari/types', '@alsari/financiero', '@alsari/proyectos', '@alsari/contabilidad', '@alsari/presupuestos'],
};

export default nextConfig;
