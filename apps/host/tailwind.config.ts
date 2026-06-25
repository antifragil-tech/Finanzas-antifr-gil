import type { Config } from 'tailwindcss';
import alsariPreset from '@alsari/config/tailwind-preset';

const config: Config = {
  presets: [alsariPreset],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
    // Modules are workspace symlinks — Tailwind won't auto-discover them.
    // Restrict to */src/** to avoid scanning node_modules/ inside each module.
    '../modules/*/src/**/*.{ts,tsx}',
  ],
};

export default config;
