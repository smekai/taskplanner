/**
 * Bumps the patch version in package.json.
 * Called by the pre-commit git hook.
 */
const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(__dirname, '..', 'package.json');
const lockPath = path.resolve(__dirname, '..', 'package-lock.json');
const mcpServerPath = path.resolve(__dirname, '..', 'src', 'mcp', 'server.ts');
const pluginManifestPaths = [
  path.resolve(__dirname, '..', 'plugins', 'taskplanner', '.cursor-plugin', 'plugin.json'),
  path.resolve(__dirname, '..', 'plugins', 'taskplanner', '.codex-plugin', 'plugin.json'),
];
const skillVersionPaths = [
  path.resolve(__dirname, '..', 'plugins', 'taskplanner', 'skills', 'taskplanner', 'SKILL.md'),
  path.resolve(
    __dirname,
    '..',
    'plugins',
    'taskplanner',
    'skills',
    'initialize-taskplanner',
    'SKILL.md',
  ),
  path.resolve(
    __dirname,
    '..',
    'plugins',
    'taskplanner',
    'skills',
    'update-taskplanner',
    'SKILL.md',
  ),
];
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const parts = pkg.version.split('.').map(Number);
parts[2] += 1;
pkg.version = parts.join('.');

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

if (fs.existsSync(lockPath)) {
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  lock.version = pkg.version;
  if (lock.packages?.['']) lock.packages[''].version = pkg.version;
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
}

for (const manifestPath of pluginManifestPaths) {
  if (!fs.existsSync(manifestPath)) continue;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = pkg.version;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

if (fs.existsSync(mcpServerPath)) {
  const source = fs.readFileSync(mcpServerPath, 'utf8');
  const updated = source.replace(/version: '[^']+',/, `version: '${pkg.version}',`);
  fs.writeFileSync(mcpServerPath, updated);
}

for (const skillPath of skillVersionPaths) {
  if (!fs.existsSync(skillPath)) continue;
  const source = fs.readFileSync(skillPath, 'utf8');
  const updated = source.replace(
    /<!-- TASKPLANNER:VERSION:[^>]+ -->/,
    `<!-- TASKPLANNER:VERSION:${pkg.version} -->`,
  );
  fs.writeFileSync(skillPath, updated);
}

console.log(
  `Version bumped to ${pkg.version} across package, lockfile, MCP, plugin manifests, and skills`,
);
