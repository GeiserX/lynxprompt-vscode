import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [],
    },
  },
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, 'tests', '__mocks__', 'vscode.ts'),
    },
  },
});
