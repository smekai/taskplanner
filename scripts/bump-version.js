/**
 * Bumps the requested semantic version component in package.json.
 * Defaults to patch when called by the pre-commit git hook.
 */
const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(__dirname, '..', 'package.json');
const lockPath = path.resolve(__dirname, '..', 'package-lock.json');
const repo = path.resolve(__dirname, '..');
const pluginHosts = ['claude', 'cursor', 'codex'];
const pluginRoot = (host) => path.join(repo, 'views', host);
const mcpServerPath = path.join(repo, 'mcp', 'src', 'server.ts');
const projectConfigPath = path.join(repo, '.tasks', 'config.json');
const mcpPackagePath = path.join(repo, 'mcp', 'package.json');
const bundlePaths = [
  path.join(repo, 'mcp', 'dist', 'mcp-server.js'),
  ...pluginHosts.map((host) => path.join(pluginRoot(host), 'dist', 'mcp-server.js')),
];
const versionTextPaths = [path.join(pluginRoot('codex'), '.codex-plugin', 'submission.json')];
const pluginManifestPaths = pluginHosts.map((host) =>
  path.join(pluginRoot(host), `.${host}-plugin`, 'plugin.json'),
);
const versionedSkills = ['taskplanner', 'initialize-taskplanner', 'update-taskplanner'];
const skillVersionPaths = pluginHosts.flatMap((host) =>
  versionedSkills.map((skill) => path.join(pluginRoot(host), 'skills', skill, 'SKILL.md')),
);
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

if (fs.existsSync(mcpPackagePath)) {
  const mcpPackage = JSON.parse(fs.readFileSync(mcpPackagePath, 'utf8'));
  mcpPackage.version = pkg.version;
  fs.writeFileSync(mcpPackagePath, JSON.stringify(mcpPackage, null, 2) + '\n');
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

for (const bundlePath of bundlePaths) {
  if (!fs.existsSync(bundlePath)) continue;
  const source = fs.readFileSync(bundlePath, 'utf8');
  fs.writeFileSync(bundlePath, source.replaceAll(previousVersion, pkg.version));
}

for (const skillPath of skillVersionPaths) {
  if (!fs.existsSync(skillPath)) continue;
  const source = fs.readFileSync(skillPath, 'utf8');
  const updated = source.replace(
    /<!-- TASKPLANNER:VERSION:[^ >]+ -->/,
    `<!-- TASKPLANNER:VERSION:${pkg.version} -->`,
  );
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
  `Version bumped to ${pkg.version} across package, lockfile, MCP, npm package, plugins, skills, and release metadata`,
);
