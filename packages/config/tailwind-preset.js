// Preset Tailwind compartido — fuente única de verdad del design system
// "Quiet Luxury" de Alsari Capital OS.
//
// Lo consumen los tailwind.config.ts del host y de todos los módulos vía
// `presets: [alsariPreset]`. Ningún config debe redefinir estos tokens en
// local: si un valor cambia, cambia aquí y se propaga a todo el OS.

/** @type {import('tailwindcss').Config} */
const alsariPreset = {
  content: [],
  theme: {
    extend: {
      colors: {
        // Paleta "zinc" propia del OS: grises con tinte azul marino sutil
        // (más cálida que el zinc puro de Tailwind). Decisión de marca.
        zinc: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#2a2b38',
          900: '#1e1f2a',
          950: '#14141e',
        },
        // Crema marfil de marca (logo, headers premium). Nunca hardcodear el hex.
        brand: '#F5F0E1',
      },
      fontFamily: {
        // El host inyecta las variables vía geist (next/font). En los módulos
        // en dev standalone la variable no existe y cae al stack del sistema.
        sans: [
          'var(--font-geist-sans)',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
          'Apple Color Emoji',
          'Segoe UI Emoji',
        ],
        mono: [
          'var(--font-geist-mono)',
          'ui-monospace',
          'SFMono-Regular',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        // Mínimo absoluto de la escala. Sustituye a los text-[8px]/[9px]/[10px]
        // arbitrarios: nada por debajo de 10px.
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'fade-up': 'fadeUp 0.4s ease-out forwards',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default alsariPreset;
