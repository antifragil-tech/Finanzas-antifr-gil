import { defineConfig } from 'vitest/config';

// Tests de lógica pura de dominio (Node, sin DOM).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
