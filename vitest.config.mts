import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'views/vscode/test/**/*.test.ts', 'views/claude/mod/test/**/*.spec.ts', 'views/mcp-app/test/**/*.test.ts'],
    globals: true,
  },
});
