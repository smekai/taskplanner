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

  for (const skillName of ['taskplanner', 'initialize-taskplanner', 'update-taskplanner']) {
    const skillPath = path.join(root, 'plugins', 'taskplanner', 'skills', skillName, 'SKILL.md');
    const marker = /<!-- TASKPLANNER:VERSION:([^ >]+) -->/.exec(
      fs.readFileSync(skillPath, 'utf8'),
    )?.[1];
    if (marker !== expected) fail(`${skillName} skill is ${marker}; expected ${expected}.`);
  }

  const submission = readJson(path.join(root, 'codex-submission', 'submission.json'));
  if (submission.version !== expected) {
    fail(`Codex submission is ${submission.version}; expected ${expected}.`);
  }

  if (!process.exitCode) console.log(`[versions] All version markers match ${expected}.`);
}

main();
