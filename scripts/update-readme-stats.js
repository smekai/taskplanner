const fs = require('fs');
const path = require('path');

const START = '<!-- README-STATS:START -->';
const END = '<!-- README-STATS:END -->';

const formatCount = (value) => Number(value).toLocaleString('en-US');
const isCount = (value) => typeof value === 'number' && Number.isFinite(value);
const isVersion = (value) => typeof value === 'string' && /^\d+\.\d+\.\d+/.test(value);

function statsRows(stats) {
  const rows = [];
  const { vsmarketplace: vsm, openvsx, npm, codex, claude, cursor, github } = stats;

  if (vsm && isVersion(vsm.version) && isCount(vsm.install)) {
    rows.push(['[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=refined.taskplanner)', vsm.version, `${formatCount(vsm.install)} installs`]);
  }
  if (openvsx && isVersion(openvsx.version) && isCount(openvsx.downloads)) {
    rows.push(['[Open VSX](https://open-vsx.org/extension/refined/taskplanner) (Cursor and other editors)', openvsx.version, `${formatCount(openvsx.downloads)} downloads`]);
  }
  if (cursor && typeof cursor === 'object' && isVersion(cursor.version)) {
    rows.push(['[Cursor Marketplace](https://cursor.com/marketplace) plugin', cursor.version, 'listed']);
  }
  if (npm && isVersion(npm.latest) && isCount(npm.month)) {
    rows.push(['[npm `@smekai/taskplanner`](https://www.npmjs.com/package/@smekai/taskplanner)', npm.latest, `${formatCount(npm.month)} downloads last month`]);
  }
  if (claude && typeof claude === 'object' && isVersion(claude.version)) {
    rows.push(['Claude plugin directory', claude.version, 'listed']);
  } else if (isVersion(stats.expected)) {
    rows.push(['Claude Code plugin ([repository marketplace](#claude-code-and-claude-desktop))', stats.expected, 'installs from `main`']);
  }
  if (codex && typeof codex === 'object' && isVersion(codex.version)) {
    const label = codex.url ? `[Codex plugin directory](${codex.url})` : 'Codex plugin directory';
    rows.push([label, codex.version, 'listed']);
  }
  if (github && isCount(github.stars)) {
    const forks = isCount(github.forks) ? ` · ${formatCount(github.forks)} forks` : '';
    rows.push(['[GitHub](https://github.com/smekai/taskplanner)', stats.tag || '', `${formatCount(github.stars)} stars${forks}`]);
  }
  return rows;
}

function renderStatsBlock(stats) {
  if (!stats || typeof stats.date !== 'string') {
    throw new Error('stats must have a "date" (YYYY-MM-DD)');
  }
  const rows = statsRows(stats);
  if (rows.length === 0) {
    throw new Error('stats have no channel with complete numbers');
  }
  return [
    START,
    '| Channel | Version | Usage |',
    '| --- | --- | --- |',
    ...rows.map((cells) => `| ${cells.join(' | ')} |`),
    '',
    `<sub>Numbers as of ${stats.date}, refreshed by a daily check.</sub>`,
    END,
  ].join('\n');
}

function replaceStatsBlock(readme, block) {
  const start = readme.indexOf(START);
  const end = readme.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`README has no ${START} … ${END} block`);
  }
  return readme.slice(0, start) + block + readme.slice(end + END.length);
}

function readStats(statsPath) {
  const text = fs.readFileSync(statsPath, 'utf8');
  if (statsPath.endsWith('.jsonl')) {
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
    if (lines.length === 0) throw new Error(`${statsPath} is empty`);
    return JSON.parse(lines[lines.length - 1]);
  }
  return JSON.parse(text);
}

function main(argv) {
  const [statsPath, readmeArg] = argv;
  if (!statsPath) {
    console.error('Usage: node scripts/update-readme-stats.js <stats.json | history.jsonl> [README.md]');
    process.exitCode = 2;
    return;
  }
  const readmePath = path.resolve(readmeArg || path.join(__dirname, '..', 'README.md'));
  const readme = fs.readFileSync(readmePath, 'utf8');
  const updated = replaceStatsBlock(readme, renderStatsBlock(readStats(statsPath)));
  if (updated === readme) {
    console.log('[readme-stats] unchanged');
    return;
  }
  fs.writeFileSync(readmePath, updated, 'utf8');
  console.log('[readme-stats] updated');
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`[readme-stats] ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { renderStatsBlock, replaceStatsBlock, readStats, START, END };
