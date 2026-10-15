/**
 * Validates the Claude Code plugin with Claude Code itself: the manifest, the marketplace, the
 * mod's hooks module, and the mod's kit tests. Needs a `claude` CLI new enough to load mods
 * (set CLAUDE_BIN to use one that is not on PATH). CI has no Claude CLI, so this runs in
 * `release:check` only.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const MIN_VERSION = [2, 1, 287];
const root = path.resolve(__dirname, '..');
const pluginDir = path.join('plugins', 'taskplanner');
const claude = process.env.CLAUDE_BIN || 'claude';

function run(args, { quiet = false } = {}) {
  const result = spawnSync(claude, args, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32' && !process.env.CLAUDE_BIN,
    stdio: quiet ? 'pipe' : 'inherit',
  });
  if (result.error) {
    console.error(`[claude-plugin] ERROR: could not run "${claude}": ${result.error.message}`);
    process.exit(1);
  }
  return result;
}

function isAtLeast(version, minimum) {
  for (let index = 0; index < minimum.length; index += 1) {
    if (version[index] !== minimum[index]) return version[index] > minimum[index];
  }
  return true;
}

function main() {
  const probe = run(['--version'], { quiet: true });
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(probe.stdout || '');
  if (probe.status !== 0 || !match) {
    console.error(
      `[claude-plugin] ERROR: "${claude} --version" failed; install Claude Code or set CLAUDE_BIN.`,
    );
    process.exit(1);
  }
  const version = match.slice(1).map(Number);
  if (!isAtLeast(version, MIN_VERSION)) {
    console.error(
      `[claude-plugin] ERROR: Claude Code ${version.join('.')} cannot load mods; ` +
        `need ${MIN_VERSION.join('.')} or later (claude update).`,
    );
    process.exit(1);
  }

  const steps = [
    ['plugin', 'validate', '--strict', pluginDir],
    ['plugin', 'validate', '.'],
    ['plugin', 'test', pluginDir],
  ];
  for (const args of steps) {
    console.log(`[claude-plugin] claude ${args.join(' ')}`);
    const result = run(args);
    if (result.status !== 0) {
      console.error(`[claude-plugin] ERROR: "claude ${args.join(' ')}" failed.`);
      process.exit(result.status || 1);
    }
  }
  console.log(
    `[claude-plugin] Plugin, marketplace and mod tests pass on Claude Code ${version.join('.')}.`,
  );
}

main();
