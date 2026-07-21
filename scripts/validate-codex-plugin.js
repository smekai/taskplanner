const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error(`[codex-plugin] ERROR: ${message}`);
  process.exitCode = 1;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`Failed to read JSON at ${filePath}: ${error.message}`);
    return null;
  }
}

function assertExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`${label} not found: ${filePath}`);
    return false;
  }
  return true;
}

function main() {
  const rootDir = path.resolve(__dirname, '..');
  const pluginRoot = path.join(rootDir, 'plugins', 'taskplanner');
  const manifestPath = path.join(pluginRoot, '.codex-plugin', 'plugin.json');
  const mcpPath = path.join(pluginRoot, '.mcp.json');
  const marketplacePath = path.join(rootDir, '.agents', 'plugins', 'marketplace.json');
  const vsixIconPath = path.join(rootDir, 'resources', 'icons', 'taskplanner-color.png');
  const pluginIconPath = path.join(pluginRoot, 'assets', 'taskplanner-color.png');
  const packageJson = readJson(path.join(rootDir, 'package.json'));

  for (const [relative, label] of [
    ['.codex-plugin/plugin.json', 'Codex plugin manifest'],
    ['.mcp.json', 'Codex MCP configuration'],
    ['dist/mcp-server.js', 'MCP server bundle'],
    ['ui/board/index.html', 'MCP board HTML'],
    ['assets/logo.svg', 'Cursor plugin logo'],
    ['assets/taskplanner-color.png', 'Codex plugin logo'],
    ['skills/taskplanner/SKILL.md', 'TaskPlanner skill'],
    ['skills/list-tasks/SKILL.md', 'List-tasks skill'],
    ['skills/next-task/SKILL.md', 'Next-task skill'],
    ['skills/continue-task/SKILL.md', 'Continue-task skill'],
    ['skills/initialize-taskplanner/SKILL.md', 'Initialize-taskplanner skill'],
    ['skills/initialize-taskplanner/agents/openai.yaml', 'Initialize skill UI metadata'],
    ['skills/update-taskplanner/SKILL.md', 'Update-taskplanner skill'],
    ['skills/update-taskplanner/agents/openai.yaml', 'Update skill UI metadata'],
  ]) {
    assertExists(path.join(pluginRoot, relative), label);
  }
  assertExists(marketplacePath, 'Repository Codex marketplace');

  const manifest = readJson(manifestPath);
  if (manifest) {
    if (manifest.name !== 'taskplanner') fail('plugin.json name must be "taskplanner".');
    if (manifest.version?.split('+')[0] !== packageJson?.version) {
      fail(`plugin.json base version must match package.json (${packageJson?.version}).`);
    }
    if (manifest.description !== packageJson?.description) {
      fail('plugin.json description must match package.json.');
    }
    if (manifest.license !== 'MIT') fail('plugin.json license must be MIT.');
    if (manifest.interface?.displayName !== 'Task Plan AI') {
      fail('plugin.json interface.displayName must be "Task Plan AI".');
    }
    if (manifest.skills !== './skills/') fail('plugin.json skills must point to ./skills/.');
    if (manifest.mcpServers !== './.mcp.json') {
      fail('plugin.json mcpServers must point to ./.mcp.json.');
    }
    if (manifest.apps || manifest.hooks) {
      fail('v1 must not declare apps or hooks.');
    }
    if (
      manifest.interface?.composerIcon !== './assets/taskplanner-color.png' ||
      manifest.interface?.logo !== './assets/taskplanner-color.png'
    ) {
      fail('Codex composerIcon and logo must use the shared VSIX color icon.');
    }
    for (const field of [
      'displayName',
      'shortDescription',
      'longDescription',
      'developerName',
      'category',
      'capabilities',
      'defaultPrompt',
    ]) {
      if (!manifest.interface?.[field]) fail(`plugin.json interface.${field} is required.`);
    }
  }

  if (
    fs.existsSync(vsixIconPath) &&
    fs.existsSync(pluginIconPath) &&
    !fs.readFileSync(vsixIconPath).equals(fs.readFileSync(pluginIconPath))
  ) {
    fail('Codex plugin logo must be byte-for-byte identical to the VSIX icon.');
  }

  const mcp = readJson(mcpPath);
  const server = mcp?.mcpServers?.taskplanner;
  if (server?.command !== 'node') fail('.mcp.json must launch the server with node.');
  if (!server?.args?.includes('dist/mcp-server.js')) {
    fail('.mcp.json must launch dist/mcp-server.js.');
  }
  if (server?.cwd !== '.') fail('.mcp.json cwd must be the plugin root (.).');

  const marketplace = readJson(marketplacePath);
  if (marketplace?.name !== 'refined-taskplanner') {
    fail('Marketplace name must be "refined-taskplanner".');
  }
  const entry = marketplace?.plugins?.find((plugin) => plugin.name === 'taskplanner');
  if (entry?.source?.path !== './plugins/taskplanner') {
    fail('Marketplace source must be ./plugins/taskplanner.');
  }
  if (entry?.policy?.installation !== 'AVAILABLE') {
    fail('Marketplace installation policy must be AVAILABLE.');
  }
  if (entry?.policy?.authentication !== 'ON_INSTALL') {
    fail('Marketplace authentication policy must be ON_INSTALL.');
  }
  if (!entry?.category) fail('Marketplace entry category is required.');

  if (process.exitCode && process.exitCode !== 0) return;
  console.log('[codex-plugin] Validation passed.');
}

main();
