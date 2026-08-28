/**
 * Run Vitest from the repository's canonical path.
 *
 * On Windows `cd c:\repo` and `cd C:\repo` are the same directory but different strings, and Vite
 * resolves modules by string. Started from the lowercase form, Vitest and its runner load twice and
 * the test context ends up undefined, so every suite fails at its first `describe` with
 * "Cannot read properties of undefined (reading 'config')" and reports zero tests.
 *
 * realpathSync.native returns the casing the filesystem actually uses, so the child always starts
 * from the same string no matter how the shell spelled it.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = fs.realpathSync.native(path.resolve(__dirname, '..'));
const vitestBin = path.join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs');

const result = spawnSync(process.execPath, [vitestBin, ...process.argv.slice(2)], {
  cwd: repoRoot,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
