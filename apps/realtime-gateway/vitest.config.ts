import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    passWithNoTests: true, // unit specs land with the first pure gateway logic; integration lives in test/
  },
});
