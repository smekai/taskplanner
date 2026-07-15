/**
 * Register the local TaskPlanner Cursor plugin in ~/.claude config files.
 * Usage: node scripts/register-cursor-plugin-local.js
 */
const fs = require('fs');
const path = require('path');

const pluginDest = path.join(process.env.USERPROFILE, '.cursor', 'plugins', 'taskplanner');
const installedPluginsPath = path.join(
  process.env.USERPROFILE,
  '.claude',
  'plugins',
  'installed_plugins.json',
);
const claudeSettingsPath = path.join(process.env.USERPROFILE, '.claude', 'settings.json');

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return fallback;
  return JSON.parse(raw);
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function main() {
  const manifestPath = path.join(pluginDest, '.cursor-plugin', 'plugin.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(
      `[taskplanner] ERROR: Plugin not installed at ${pluginDest}. Run scripts/install-cursor-plugin-local.cmd first.`,
    );
    process.exit(1);
  }

  const installPath = path.resolve(pluginDest);

  const installed = readJson(installedPluginsPath, { plugins: {} });
  installed.plugins = installed.plugins || {};
  installed.plugins['taskplanner@local'] = [{ scope: 'user', installPath }];
  writeJson(installedPluginsPath, installed);

  const settings = readJson(claudeSettingsPath, {});
  settings.enabledPlugins = settings.enabledPlugins || {};
  settings.enabledPlugins['taskplanner@local'] = true;
  writeJson(claudeSettingsPath, settings);

  console.log(`[taskplanner] Updated ${installedPluginsPath}`);
  console.log(`[taskplanner] Updated ${claudeSettingsPath}`);
  console.log('[taskplanner] Restart Cursor fully, then check Customize (User scope).');
}

main();
