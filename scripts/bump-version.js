/**
 * Bumps the requested semantic version component in package.json.
 * Defaults to patch when called by the pre-commit git hook.
 */
const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(__dirname, '..', 'package.json');
const lockPath = path.resolve(__dirname, '..', 'package-lock.json');
const mcpServerPath = path.resolve(__dirname, '..', 'src', 'mcp', 'server.ts');
const mcpBundlePath = path.resolve(
  __dirname,
  '..',
  'plugins',
  'taskplanner',
  'dist',
  'mcp-server.js',
);
const projectConfigPath = path.resolve(__dirname, '..', '.tasks', 'config.json');
const versionTextPaths = [
  path.resolve(__dirname, '..', 'plugins', 'taskplanner', '.codex-plugin', 'submission.json'),
  path.resolve(__dirname, '..', 'docs', 'CODEX_PLUGIN_SUBMISSION.md'),
  path.resolve(__dirname, '..', 'CONTRIBUTING.md'),
];
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
const previousVersion = pkg.version;

const parts = pkg.version.split('.').map(Number);
const bump = process.argv[2] ?? 'patch';
const bumpIndex = { major: 0, minor: 1, patch: 2 }[bump];
if (bumpIndex === undefined) {
  throw new Error(`Unsupported version bump "${bump}"; use major, minor, or patch`);
}
parts[bumpIndex] += 1;
for (let index = bumpIndex + 1; index < parts.length; index += 1) {
  parts[index] = 0;
}
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
  const source = fs.readFileSync(manifestPath, 'utf8');
  const updated = source.replace(/("version"\s*:\s*")[^"]+("\s*,)/, `$1${pkg.version}$2`);
  fs.writeFileSync(manifestPath, updated);
}

if (fs.existsSync(mcpServerPath)) {
  const source = fs.readFileSync(mcpServerPath, 'utf8');
  const updated = source.replace(/version: '[^']+',/, `version: '${pkg.version}',`);
  fs.writeFileSync(mcpServerPath, updated);
}

if (fs.existsSync(mcpBundlePath)) {
  const source = fs.readFileSync(mcpBundlePath, 'utf8');
  fs.writeFileSync(mcpBundlePath, source.replaceAll(previousVersion, pkg.version));
}

for (const skillPath of skillVersionPaths) {
  if (!fs.existsSync(skillPath)) continue;
  const source = fs.readFileSync(skillPath, 'utf8');
  const updated = source.replaceAll(previousVersion, pkg.version);
  fs.writeFileSync(skillPath, updated);
}

for (const textPath of versionTextPaths) {
  if (!fs.existsSync(textPath)) continue;
  const source = fs.readFileSync(textPath, 'utf8');
  fs.writeFileSync(textPath, source.replaceAll(previousVersion, pkg.version));
}

if (fs.existsSync(projectConfigPath)) {
  const config = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));
  config.taskplannerVersion = pkg.version;
  fs.writeFileSync(projectConfigPath, JSON.stringify(config, null, 2) + '\n');
}

console.log(
  `Version bumped to ${pkg.version} across package, lockfile, MCP, plugins, skills, and release metadata`,
);
