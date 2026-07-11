import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    passWithNoTests: true, // unit specs land with the first pure chat logic; integration lives in test/
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/application/**'],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
});
