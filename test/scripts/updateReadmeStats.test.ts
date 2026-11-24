import { createRequire } from 'module';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

const require = createRequire(import.meta.url);
const scriptPath = path.resolve(__dirname, '../../scripts/update-readme-stats.js');
const { renderStatsBlock, replaceStatsBlock, START, END } = require(scriptPath);

const stats = {
  date: '2026-11-24',
  expected: '3.0.22',
  tag: 'v3.0.12',
  npm: { latest: '3.0.12', month: 432 },
  vsmarketplace: { version: '3.0.12', install: 126 },
  openvsx: { version: '3.0.12', downloads: 4812 },
  cursor: 'not found (browser search: No results found)',
  claude: 'not listed',
  codex: { version: '3.0.18', url: 'https://chatgpt.com/plugins/x' },
  github: { stars: 25, forks: 4 },
};

const readme = `# Title\n\nIntro.\n\n${START}\nold numbers\n${END}\n\n## Next\n`;

describe('update-readme-stats', () => {
  it('renders one row per channel with complete numbers', () => {
    const block = renderStatsBlock(stats);
    expect(block.startsWith(START)).toBe(true);
    expect(block.endsWith(END)).toBe(true);
    expect(block).toContain('| 3.0.12 | 126 installs |');
    expect(block).toContain('| 3.0.12 | 4,812 downloads |');
    expect(block).toContain('| 3.0.12 | 432 downloads last month |');
    expect(block).toContain('| 3.0.22 | installs from `main` |');
    expect(block).toContain('| 3.0.18 | listed |');
    expect(block).toContain('| v3.0.12 | 25 stars · 4 forks |');
    expect(block).toContain('as of 2026-11-24');
  });

  it('leaves out channels whose check failed or that are not listed', () => {
    const block = renderStatsBlock({ ...stats, npm: { error: 'timeout' }, openvsx: undefined });
    expect(block).not.toContain('npm');
    expect(block).not.toContain('Open VSX');
    expect(block).not.toContain('Cursor Marketplace');
    expect(block).not.toContain('undefined');
  });

  it('replaces only the marked block and is idempotent', () => {
    const once = replaceStatsBlock(readme, renderStatsBlock(stats));
    expect(once.startsWith('# Title\n\nIntro.\n\n')).toBe(true);
    expect(once.endsWith('\n\n## Next\n')).toBe(true);
    expect(once).not.toContain('old numbers');
    expect(replaceStatsBlock(once, renderStatsBlock(stats))).toBe(once);
  });

  it('refuses a README without markers', () => {
    expect(() => replaceStatsBlock('# No block\n', renderStatsBlock(stats))).toThrow(/README-STATS/);
  });

  it('reads the last line of a history file from the command line', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'readme-stats-'));
    const readmePath = path.join(dir, 'README.md');
    const historyPath = path.join(dir, 'history.jsonl');
    fs.writeFileSync(readmePath, readme);
    fs.writeFileSync(historyPath, `${JSON.stringify({ ...stats, date: '2026-11-01' })}\n${JSON.stringify(stats)}\n`);

    execFileSync(process.execPath, [scriptPath, historyPath, readmePath]);

    const written = fs.readFileSync(readmePath, 'utf8');
    expect(written).toContain('as of 2026-11-24');
    expect(written).not.toContain('2026-11-01');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
