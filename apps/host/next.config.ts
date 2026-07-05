import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@alsari/ui', '@alsari/utils', '@alsari/types', '@alsari/reservas'],
};

export default nextConfig;
