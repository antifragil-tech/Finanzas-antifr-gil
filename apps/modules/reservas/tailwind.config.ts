import type { Config } from 'tailwindcss';
import alsariPreset from '@alsari/config/tailwind-preset';

// Hereda el preset "Quiet Luxury" (zinc navy + crema #F5F0E1) como el resto de
// módulos. No se redefinen tokens en local.
const config: Config = {
  presets: [alsariPreset],
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../../packages/ui/src/**/*.{ts,tsx}'],
};

export default config;
