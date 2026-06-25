import { defineConfig } from 'vitest/config';

// Tests de la capa de cálculo/insights (Node puro, sin DOM).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
