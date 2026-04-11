import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/extension.ts', 'src/auth.ts', 'src/commands/**', 'src/views/**'],
    },
  },
});
