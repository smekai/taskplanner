import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/test/{core,claude-mod}/**/*.test.ts'],
    globals: true,
  },
});
