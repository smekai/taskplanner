import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '../../core/config/configManager.js';

describe('ConfigManager', () => {
  let tmpDir: string;
  let configManager: ConfigManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskplanner-test-'));
    configManager = new ConfigManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns default config when no file exists', () => {
    const config = configManager.load();
    expect(config.version).toBe(3);
    expect(config.idPrefix).toBe('TASK');
    expect(config.nextId).toBe(1);
    expect(config.states).toHaveLength(5);
    expect(config.taskplannerVersion).toBe('');
    expect(config.aiPlanRequired).toBe(true);
    expect(config.readmeAttribution).toBe(true);
  });

  it('strips the legacy sortBy field and bumps to version 3', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'config.json'),
      JSON.stringify({ version: 2, idPrefix: 'ACME', nextId: 42, sortBy: 'priority' }),
    );

    const config: Record<string, unknown> = configManager.load();
    expect(config.sortBy).toBeUndefined();
    expect(config.version).toBe(3);
    // Unrelated keys survive the migration.
    expect(config.idPrefix).toBe('ACME');
    expect(config.nextId).toBe(42);

    // The key is gone from disk, not just from the in-memory object.
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8'));
    expect('sortBy' in onDisk).toBe(false);
  });

  it('records the v3 schema even when there was nothing to change', () => {
    // A v2 file that already lacks sortBy and already has Rejected: the migration finds nothing to
    // do, but the file must still be marked as having reached v3.
    const states = [
      { name: 'Backlog', fileName: 'BACKLOG.md', order: 0 },
      { name: 'Next', fileName: 'NEXT.md', order: 1 },
      { name: 'In Progress', fileName: 'IN_PROGRESS.md', order: 2 },
      { name: 'Done', fileName: 'DONE.md', order: 3 },
      { name: 'Rejected', fileName: 'REJECTED.md', order: 4 },
    ];
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ version: 2, states }));

    expect(configManager.load().version).toBe(3);
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8'));
    expect(onDisk.version).toBe(3);
  });

  it('never downgrades a config written by a newer TaskPlanner', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'config.json'),
      JSON.stringify({ version: 99, idPrefix: 'FUTURE' }),
    );

    expect(configManager.load().version).toBe(99);
  });

  describe('malformed config.json', () => {
    // The failure mode: a bad `states` entry reaches path.join(tasksDir, state.fileName) in
    // FileStore and throws on undefined. Loading must degrade to a usable board instead.
    const write = (content: string) =>
      fs.writeFileSync(path.join(tmpDir, 'config.json'), content);

    it('repairs states given as bare strings', () => {
      write(JSON.stringify({ states: ['Backlog', 'Next', 'Done'] }));
      const config = configManager.load();

      expect(config.states.every((s) => typeof s.fileName === 'string')).toBe(true);
      expect(config.states.map((s) => s.name)).toContain('Backlog');
      expect(configManager.getDiagnostics().length).toBeGreaterThan(0);
    });

    it('repairs a known state that is missing a field', () => {
      write(JSON.stringify({ states: [{ name: 'Backlog', order: 0 }] }));
      const config = configManager.load();

      expect(config.states.find((s) => s.name === 'Backlog')?.fileName).toBe('BACKLOG.md');
      expect(configManager.getDiagnostics().length).toBeGreaterThan(0);
    });

    it('falls back to the default board for an unrecognisable entry', () => {
      write(JSON.stringify({ states: [{ nonsense: true }] }));
      const config = configManager.load();

      expect(config.states).toHaveLength(5);
      expect(configManager.getDiagnostics().length).toBeGreaterThan(0);
    });

    for (const [label, content] of [
      ['truncated JSON', '{ "idPrefix": "X", '],
      ['an empty file', ''],
      ['a JSON array', '[1,2,3]'],
      ['a non-array states', JSON.stringify({ states: 'nope' })],
    ] as Array<[string, string]>) {
      it(`does not throw on ${label}`, () => {
        write(content);
        expect(() => configManager.load()).not.toThrow();
        expect(configManager.load().states).toHaveLength(5);
      });
    }

    it('reports the real problem once, without a spurious states complaint', () => {
      write('{ broken');
      configManager.load();
      const messages = configManager.getDiagnostics().map((d) => d.message);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain('could not be parsed');
    });

    it('reports nothing for a clean config', () => {
      write(JSON.stringify({ version: 3, idPrefix: 'OK' }));
      configManager.load();
      expect(configManager.getDiagnostics()).toEqual([]);
    });
  });

  it('saves and loads config', () => {
    configManager.load();
    configManager.update({ idPrefix: 'BUG' });
    configManager.save();

    const newManager = new ConfigManager(tmpDir);
    const loaded = newManager.load();
    expect(loaded.idPrefix).toBe('BUG');
  });

  it('generates incrementing IDs', () => {
    configManager.load();
    const id1 = configManager.getNextId();
    const id2 = configManager.getNextId();
    expect(id1).toBe('TASK-001');
    expect(id2).toBe('TASK-002');
  });

  it('creates directory on save if needed', () => {
    const nestedDir = path.join(tmpDir, 'nested', '.tasks');
    const manager = new ConfigManager(nestedDir);
    manager.load();
    manager.save();
    expect(fs.existsSync(path.join(nestedDir, 'config.json'))).toBe(true);
  });

  it('reconcileNextId bumps nextId up to floor and persists', () => {
    configManager.load();
    expect(configManager.get().nextId).toBe(1);

    const changed = configManager.reconcileNextId(42);
    expect(changed).toBe(true);
    expect(configManager.get().nextId).toBe(42);

    const reloaded = new ConfigManager(tmpDir);
    expect(reloaded.load().nextId).toBe(42);
  });

  it('reconcileNextId is a no-op when floor is not higher', () => {
    configManager.load();
    configManager.update({ nextId: 100 });
    configManager.save();

    expect(configManager.reconcileNextId(50)).toBe(false);
    expect(configManager.reconcileNextId(100)).toBe(false);
    expect(configManager.get().nextId).toBe(100);
  });

  it('reloadFromDisk picks up concurrent writes from another process', () => {
    configManager.load();
    expect(configManager.get().nextId).toBe(1);

    const other = new ConfigManager(tmpDir);
    other.load();
    other.update({ nextId: 77 });
    other.save();

    configManager.reloadFromDisk();
    expect(configManager.get().nextId).toBe(77);
  });

  it('preserves unknown fields on load', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'config.json'),
      JSON.stringify({ version: 1, idPrefix: 'CUSTOM', nextId: 50 }),
    );
    const config = configManager.load();
    expect(config.idPrefix).toBe('CUSTOM');
    expect(config.nextId).toBe(50);
    // Default fields should fill in (5 states including Rejected)
    expect(config.states).toHaveLength(5);
  });
});
