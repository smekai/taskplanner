import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '../../src/core/config/configManager.js';
import { FileStore } from '../../src/core/store/fileStore.js';
import { TaskStore } from '../../src/core/store/taskStore.js';

describe('TaskStore deferred Done/Rejected', () => {
  let tmpDir: string;
  let configManager: ConfigManager;
  let fileStore: FileStore;
  let taskStore: TaskStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskplanner-deferred-'));
    configManager = new ConfigManager(tmpDir);
    configManager.load();
    configManager.save();
    fileStore = new FileStore(tmpDir);
    fileStore.initializeStateFiles(configManager.get());

    const donePath = path.join(tmpDir, 'DONE.md');
    fs.writeFileSync(
      donePath,
      `# Done

## TASK-099: Archived one
**Priority:** P3

Old.

---

## TASK-100: Archived two
**Priority:** P4

Also old.

---
`,
      'utf-8',
    );

    taskStore = new TaskStore(configManager, fileStore);
    taskStore.reload();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('defers parsing Done but stores heading count', () => {
    expect(taskStore.isStateDeferredUnloaded('Done')).toBe(true);
    expect(taskStore.getTasksByState('Done')).toHaveLength(0);
    expect(taskStore.getStateDisplayCounts().get('Done')).toBe(2);
  });

  it('loads Done on ensureStateLoaded', () => {
    taskStore.ensureStateLoaded('Done');
    expect(taskStore.isStateDeferredUnloaded('Done')).toBe(false);
    expect(taskStore.getTasksByState('Done')).toHaveLength(2);
    expect(taskStore.getStateDisplayCounts().get('Done')).toBe(2);
  });

  it('findTask loads deferred Done when the id is there', () => {
    const found = taskStore.findTask('TASK-099');
    expect(found?.task.title).toBe('Archived one');
    expect(found?.stateName).toBe('Done');
    expect(taskStore.isStateDeferredUnloaded('Done')).toBe(false);
  });

  it('reloadAsync matches deferred counts', async () => {
    const ts = new TaskStore(configManager, fileStore);
    await ts.reloadAsync();
    expect(ts.getStateDisplayCounts().get('Done')).toBe(2);
    expect(ts.getTasksByState('Done')).toHaveLength(0);
  });
});
