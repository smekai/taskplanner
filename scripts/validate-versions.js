const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fail(message) {
  console.error(`[versions] ERROR: ${message}`);
  process.exitCode = 1;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const pkg = readJson(path.join(root, 'package.json'));
  const lock = readJson(path.join(root, 'package-lock.json'));
  const cursor = readJson(
    path.join(root, 'plugins', 'taskplanner', '.cursor-plugin', 'plugin.json'),
  );
  const codex = readJson(path.join(root, 'plugins', 'taskplanner', '.codex-plugin', 'plugin.json'));
  const expected = pkg.version;

  const versions = [
    ['package-lock.json', lock.version],
    ['package-lock.json root package', lock.packages?.['']?.version],
    ['Cursor plugin manifest', cursor.version],
    ['Codex plugin manifest', codex.version?.split('+')[0]],
  ];
  for (const [label, actual] of versions) {
    if (actual !== expected) fail(`${label} is ${actual}; expected ${expected}.`);
  }

  const mcpSource = fs.readFileSync(path.join(root, 'src', 'mcp', 'server.ts'), 'utf8');
  const mcpVersion = /version: '([^']+)',/.exec(mcpSource)?.[1];
  if (mcpVersion !== expected) fail(`MCP server is ${mcpVersion}; expected ${expected}.`);

  const mcpBundle = fs.readFileSync(
    path.join(root, 'plugins', 'taskplanner', 'dist', 'mcp-server.js'),
    'utf8',
  );
  const mcpBundleVersion = /name:"taskplanner",version:"([^"]+)"/.exec(mcpBundle)?.[1];
  if (mcpBundleVersion !== expected) {
    fail(`Bundled MCP server is ${mcpBundleVersion}; expected ${expected}.`);
  }

  for (const skillName of ['taskplanner', 'initialize-taskplanner', 'update-taskplanner']) {
    const skillPath = path.join(root, 'plugins', 'taskplanner', 'skills', skillName, 'SKILL.md');
    const skill = fs.readFileSync(skillPath, 'utf8');
    const marker = /<!-- TASKPLANNER:VERSION:([^ >]+) -->/.exec(skill)?.[1];
    if (marker !== expected) fail(`${skillName} skill is ${marker}; expected ${expected}.`);
    for (const embedded of skill.match(/\b\d+\.\d+\.\d+\b/g) ?? []) {
      if (embedded !== expected) {
        fail(`${skillName} skill embeds ${embedded}; expected only ${expected}.`);
      }
    }
  }

  const submission = readJson(path.join(root, 'codex-submission', 'submission.json'));
  if (submission.version !== expected) {
    fail(`Codex submission is ${submission.version}; expected ${expected}.`);
  }

  const projectConfig = readJson(path.join(root, '.tasks', 'config.json'));
  if (projectConfig.taskplannerVersion !== expected) {
    fail(
      `Repository taskplannerVersion is ${projectConfig.taskplannerVersion}; expected ${expected}.`,
    );
  }

  for (const relativePath of ['CONTRIBUTING.md', 'docs/CODEX_PLUGIN_SUBMISSION.md']) {
    const content = fs.readFileSync(path.join(root, relativePath), 'utf8');
    if (!content.includes(expected)) fail(`${relativePath} does not reference ${expected}.`);
  }

  if (!process.exitCode) console.log(`[versions] All version markers match ${expected}.`);
}

main();
