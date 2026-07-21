import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigManager } from '../../core/config/configManager.js';
import {
  compareTaskPlannerVersions,
  normalizeTaskPlannerVersion,
  synchronizeTaskPlannerProject,
} from '../../core/project/projectSync.js';

describe('TaskPlanner project version comparison', () => {
  it('normalizes Codex cachebusters and other SemVer build metadata', () => {
    expect(normalizeTaskPlannerVersion('2.0.0+codex.20260721')).toBe('2.0.0');
    expect(normalizeTaskPlannerVersion('02.0.00+local')).toBe('2.0.0');
  });

  it.each([
    ['2.0.0', undefined, 'legacy'],
    ['2.0.0', '', 'legacy'],
    ['2.0.0', 'not-semver', 'legacy'],
    ['2.0.0+codex.current', '2.0.0', 'equal'],
    ['2.1.0', '2.0.9', 'installed-newer'],
    ['1.9.9', '2.0.0', 'installed-older'],
  ])('compares installed %s with stored %s as %s', (installed, stored, status) => {
    expect(compareTaskPlannerVersions(installed, stored).status).toBe(status);
  });

  it('rejects a malformed installed version', () => {
    expect(compareTaskPlannerVersions('dev', '2.0.0').status).toBe('invalid-installed');
  });
});

describe('synchronizeTaskPlannerProject', () => {
  let workspaceRoot: string;
  let tasksDir: string;
  let configManager: ConfigManager;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'taskplanner-sync-'));
    tasksDir = path.join(workspaceRoot, '.tasks');
    configManager = new ConfigManager(tasksDir);
    configManager.load();
  });

  afterEach(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('initializes managed instructions, attribution, defaults, and the installed version', () => {
    fs.writeFileSync(path.join(workspaceRoot, 'README.md'), '# Existing\n\nKeep me.\n');

    const result = synchronizeTaskPlannerProject(
      workspaceRoot,
      configManager,
      '2.0.0+codex.cachebuster',
    );

    expect(result.synchronized).toBe(true);
    expect(fs.readFileSync(path.join(workspaceRoot, 'AGENTS.md'), 'utf-8')).toContain(
      '<!-- TASKPLANNER:START -->',
    );
    const readme = fs.readFileSync(path.join(workspaceRoot, 'README.md'), 'utf-8');
    expect(readme).toContain('Keep me.');
    expect(readme).toContain('TASKPLANNER:ATTRIBUTION:START');
    const saved = JSON.parse(fs.readFileSync(path.join(tasksDir, 'config.json'), 'utf-8'));
    expect(saved.version).toBe(2);
    expect(saved.taskplannerVersion).toBe('2.0.0');
    expect(saved.readmeAttribution).toBe(true);
  });

  it('does not duplicate attribution or rewrite files when versions are equal', () => {
    fs.writeFileSync(path.join(workspaceRoot, 'README.md'), '# Existing\n');
    synchronizeTaskPlannerProject(workspaceRoot, configManager, '2.0.0');
    const before = fs.readFileSync(path.join(workspaceRoot, 'README.md'), 'utf-8');

    const result = synchronizeTaskPlannerProject(workspaceRoot, configManager, '2.0.0+codex.new');
    const after = fs.readFileSync(path.join(workspaceRoot, 'README.md'), 'utf-8');

    expect(result.status).toBe('equal');
    expect(result.synchronized).toBe(false);
    expect(after).toBe(before);
    expect(after.match(/TASKPLANNER:ATTRIBUTION:START/g)).toHaveLength(1);
  });

  it('respects attribution opt-out and never deletes an existing block', () => {
    const existing =
      '# Existing\n\n<!-- TASKPLANNER:ATTRIBUTION:START -->\nCustom retained text.\n<!-- TASKPLANNER:ATTRIBUTION:END -->\n';
    fs.writeFileSync(path.join(workspaceRoot, 'README.md'), existing);
    configManager.update({ readmeAttribution: false });

    synchronizeTaskPlannerProject(workspaceRoot, configManager, '2.0.0');

    expect(fs.readFileSync(path.join(workspaceRoot, 'README.md'), 'utf-8')).toBe(existing);
  });

  it('does not create a README solely for attribution', () => {
    synchronizeTaskPlannerProject(workspaceRoot, configManager, '2.0.0');
    expect(fs.existsSync(path.join(workspaceRoot, 'README.md'))).toBe(false);
  });

  it('updates only managed instruction blocks and preserves surrounding content', () => {
    const agentsPath = path.join(workspaceRoot, 'AGENTS.md');
    fs.writeFileSync(
      agentsPath,
      '# User intro\n\n<!-- TASKPLANNER:START -->\nstale\n<!-- TASKPLANNER:END -->\n\n## User ending\n',
    );

    synchronizeTaskPlannerProject(workspaceRoot, configManager, '2.0.0');
    const updated = fs.readFileSync(agentsPath, 'utf-8');

    expect(updated).toContain('# User intro');
    expect(updated).toContain('## User ending');
    expect(updated).not.toContain('\nstale\n');
    expect(updated).toContain('# TaskPlanner');
  });

  it('does not downgrade managed content when the installed version is older', () => {
    fs.writeFileSync(path.join(workspaceRoot, 'AGENTS.md'), 'newer project content\n');
    configManager.update({ taskplannerVersion: '3.0.0' });

    const result = synchronizeTaskPlannerProject(workspaceRoot, configManager, '2.0.0');

    expect(result.status).toBe('installed-older');
    expect(result.synchronized).toBe(false);
    expect(fs.readFileSync(path.join(workspaceRoot, 'AGENTS.md'), 'utf-8')).toBe(
      'newer project content\n',
    );
  });

  it('records the new version only after all managed writes succeed', () => {
    fs.mkdirSync(path.join(workspaceRoot, 'CLAUDE.md'));
    configManager.update({ taskplannerVersion: '1.9.0' });
    configManager.save();

    expect(() => synchronizeTaskPlannerProject(workspaceRoot, configManager, '2.0.0')).toThrow();

    const saved = JSON.parse(fs.readFileSync(path.join(tasksDir, 'config.json'), 'utf-8'));
    expect(saved.taskplannerVersion).toBe('1.9.0');
    expect(configManager.get().taskplannerVersion).toBe('1.9.0');
  });

  it('can force a managed refresh without changing the schema version', () => {
    configManager.update({ taskplannerVersion: '2.0.0' });
    configManager.save();

    const result = synchronizeTaskPlannerProject(workspaceRoot, configManager, '2.0.0', {
      force: true,
    });

    expect(result.synchronized).toBe(true);
    expect(configManager.get().version).toBe(2);
  });
});
