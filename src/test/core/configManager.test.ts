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
    expect(config.version).toBe(2);
    expect(config.idPrefix).toBe('TASK');
    expect(config.nextId).toBe(1);
    expect(config.states).toHaveLength(5);
    expect(config.taskplannerVersion).toBe('');
    expect(config.aiPlanRequired).toBe(true);
    expect(config.readmeAttribution).toBe(true);
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
