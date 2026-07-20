/**
 * Verify local Cursor plugin install files and registration metadata.
 * Usage: node scripts/verify-cursor-plugin-local.js
 */
const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error(`[verify-local] ERROR: ${message}`);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const pluginDest = path.join(process.env.USERPROFILE, '.cursor', 'plugins', 'taskplanner');
const requiredFiles = [
  '.cursor-plugin/plugin.json',
  'mcp.json',
  'dist/mcp-server.js',
  'ui/board/index.html',
  'skills/taskplanner/SKILL.md',
  'skills/list-tasks/SKILL.md',
  'skills/next-task/SKILL.md',
  'skills/continue-task/SKILL.md',
  'rules/taskplanner-workflow.mdc',
  'commands/list-tasks.md',
  'commands/next-task.md',
  'commands/continue-task.md',
  'assets/logo.svg',
];

for (const relative of requiredFiles) {
  const full = path.join(pluginDest, relative);
  if (!fs.existsSync(full)) {
    fail(`Missing installed file: ${full}`);
  }
}

const mcp = readJson(path.join(pluginDest, 'mcp.json'));
const args = mcp?.mcpServers?.taskplanner?.args || [];
if (!args.includes('${CURSOR_PLUGIN_ROOT}/dist/mcp-server.js')) {
  fail('Installed mcp.json does not point to ${CURSOR_PLUGIN_ROOT}/dist/mcp-server.js');
}

const installedPluginsPath = path.join(
  process.env.USERPROFILE,
  '.claude',
  'plugins',
  'installed_plugins.json',
);
const settingsPath = path.join(process.env.USERPROFILE, '.claude', 'settings.json');

if (!fs.existsSync(installedPluginsPath)) {
  fail(`Missing ${installedPluginsPath}. Run scripts/register-cursor-plugin-local.cmd`);
}
if (!fs.existsSync(settingsPath)) {
  fail(`Missing ${settingsPath}. Run scripts/register-cursor-plugin-local.cmd`);
}

const installed = readJson(installedPluginsPath);
const installEntry = installed?.plugins?.['taskplanner@local']?.[0];
if (!installEntry || path.resolve(installEntry.installPath) !== path.resolve(pluginDest)) {
  fail('installed_plugins.json does not register taskplanner@local at the expected install path.');
}

const settings = readJson(settingsPath);
if (settings?.enabledPlugins?.['taskplanner@local'] !== true) {
  fail('settings.json does not enable taskplanner@local.');
}

console.log('[verify-local] Installed plugin files OK.');
console.log('[verify-local] MCP config OK.');
console.log('[verify-local] Claude plugin registration OK.');
console.log('[verify-local] Expected Customize entries (User scope):');
console.log('  - Plugins: taskplanner');
console.log('  - MCP: taskplanner');
console.log('  - Skills: taskplanner');
console.log('  - Rules: taskplanner-workflow');
console.log('  - Commands: /list-tasks, /next-task, /continue-task');
console.log('[verify-local] Verification passed.');
