import type { Config } from 'tailwindcss';
import alsariPreset from '@alsari/config/tailwind-preset';

const config: Config = {
  presets: [alsariPreset],
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../../packages/ui/src/**/*.{ts,tsx}'],
};

export default config;
