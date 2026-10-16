import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'plugins/taskplanner/mod/test/**/*.spec.ts'],
    globals: true,
  },
});
