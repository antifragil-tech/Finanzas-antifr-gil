import { defineConfig } from 'vitest/config';

// Tests de lógica pura (Node, sin DOM).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
