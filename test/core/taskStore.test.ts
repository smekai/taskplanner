import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '../../src/core/config/configManager.js';
import { FileStore } from '../../src/core/store/fileStore.js';
import { MAX_RUNS, TaskStore } from '../../src/core/store/taskStore.js';
import { Priority } from '../../src/core/model/task.js';

describe('TaskStore', () => {
  let tmpDir: string;
  let configManager: ConfigManager;
  let fileStore: FileStore;
  let taskStore: TaskStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskplanner-test-'));
    configManager = new ConfigManager(tmpDir);
    configManager.load();
    configManager.save();
    fileStore = new FileStore(tmpDir);
    fileStore.initializeStateFiles(configManager.get());
    taskStore = new TaskStore(configManager, fileStore);
    taskStore.reload();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('starts with empty states', () => {
    expect(taskStore.getTasksByState('Backlog')).toHaveLength(0);
    expect(taskStore.getTasksByState('Next')).toHaveLength(0);
  });

  it('creates a task', () => {
    const task = taskStore.createTask(
      {
        title: 'Test task',
        priority: Priority.P1,
        tags: ['test'],
        description: 'A test task.',
      },
      'Backlog',
    );

    expect(task.id).toBe('TASK-001');
    expect(taskStore.getTasksByState('Backlog')).toHaveLength(1);

    // Verify persisted to file
    const filePath = path.join(tmpDir, 'BACKLOG.md');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('TASK-001');
    expect(content).toContain('Test task');
  });

  it('moves a task between states', () => {
    taskStore.createTask(
      { title: 'Move me', priority: Priority.P2, tags: [], description: 'Will move.' },
      'Backlog',
    );

    const moved = taskStore.moveTask('TASK-001', 'In Progress');
    expect(moved).not.toBeNull();
    expect(taskStore.getTasksByState('Backlog')).toHaveLength(0);
    expect(taskStore.getTasksByState('In Progress')).toHaveLength(1);
  });

  it('deletes a task', () => {
    taskStore.createTask(
      { title: 'Delete me', priority: Priority.P3, tags: [], description: '' },
      'Backlog',
    );

    expect(taskStore.deleteTask('TASK-001')).toBe(true);
    expect(taskStore.getTasksByState('Backlog')).toHaveLength(0);
  });

  it('updates a task', () => {
    taskStore.createTask(
      { title: 'Original', priority: Priority.P3, tags: [], description: 'Old.' },
      'Backlog',
    );

    const updated = taskStore.updateTask('TASK-001', { title: 'Updated', priority: Priority.P1 });
    expect(updated?.title).toBe('Updated');
    expect(updated?.priority).toBe(Priority.P1);
  });

  it('finds a task by ID', () => {
    taskStore.createTask(
      { title: 'Find me', priority: Priority.P1, tags: ['search'], description: 'Findable.' },
      'Next',
    );

    const found = taskStore.findTask('TASK-001');
    expect(found?.task.title).toBe('Find me');
    expect(found?.stateName).toBe('Next');
  });

  it('reorders tasks', () => {
    taskStore.createTask(
      { title: 'First', priority: Priority.P1, tags: [], description: '' },
      'Backlog',
    );
    taskStore.createTask(
      { title: 'Second', priority: Priority.P2, tags: [], description: '' },
      'Backlog',
    );

    // With insertPosition 'top', Second (TASK-002) is at index 0, First (TASK-001) at index 1
    const tasks = taskStore.getTasksByState('Backlog');
    expect(tasks[0].id).toBe('TASK-002');
    expect(tasks[1].id).toBe('TASK-001');

    taskStore.reorderTask('TASK-001', 'up');
    const reordered = taskStore.getTasksByState('Backlog');
    expect(reordered[0].id).toBe('TASK-001');
    expect(reordered[1].id).toBe('TASK-002');
  });

  it('notifies listeners on change', () => {
    let changeCount = 0;
    taskStore.onDidChange(() => changeCount++);

    taskStore.createTask(
      { title: 'Notify', priority: Priority.P1, tags: [], description: '' },
      'Backlog',
    );
    expect(changeCount).toBe(1);

    taskStore.moveTask('TASK-001', 'Next');
    expect(changeCount).toBe(2);
  });

  it('reorders a task to a specific index', () => {
    taskStore.createTask(
      { title: 'A', priority: Priority.P1, tags: [], description: '' },
      'Backlog',
    );
    taskStore.createTask(
      { title: 'B', priority: Priority.P2, tags: [], description: '' },
      'Backlog',
    );
    taskStore.createTask(
      { title: 'C', priority: Priority.P3, tags: [], description: '' },
      'Backlog',
    );

    expect(taskStore.reorderTaskToIndex('TASK-003', 2)).toBe(true);
    let order = taskStore.getTasksByState('Backlog').map((t) => t.id);
    expect(order).toEqual(['TASK-002', 'TASK-001', 'TASK-003']);

    expect(taskStore.reorderTaskToIndex('TASK-003', 0)).toBe(true);
    order = taskStore.getTasksByState('Backlog').map((t) => t.id);
    expect(order).toEqual(['TASK-003', 'TASK-002', 'TASK-001']);
  });

  it('reorderTaskToIndex is a no-op when index unchanged', () => {
    let changeCount = 0;
    taskStore.onDidChange(() => changeCount++);
    taskStore.createTask(
      { title: 'Only', priority: Priority.P1, tags: [], description: '' },
      'Backlog',
    );
    const before = changeCount;
    expect(taskStore.reorderTaskToIndex('TASK-001', 0)).toBe(true);
    expect(changeCount).toBe(before);
  });

  it('moveTask inserts at targetIndex in target state', () => {
    taskStore.createTask(
      { title: 'In next', priority: Priority.P1, tags: [], description: '' },
      'Next',
    );
    taskStore.createTask(
      { title: 'In backlog', priority: Priority.P2, tags: [], description: '' },
      'Backlog',
    );

    const moved = taskStore.moveTask('TASK-002', 'Next', 0);
    expect(moved).not.toBeNull();
    const nextOrder = taskStore.getTasksByState('Next').map((t) => t.title);
    expect(nextOrder).toEqual(['In backlog', 'In next']);
    expect(taskStore.getTasksByState('Backlog')).toHaveLength(0);
  });

  it('moveTask with targetIndex reorders within the same state', () => {
    taskStore.createTask(
      { title: 'First', priority: Priority.P1, tags: [], description: '' },
      'Backlog',
    );
    taskStore.createTask(
      { title: 'Second', priority: Priority.P2, tags: [], description: '' },
      'Backlog',
    );

    const moved = taskStore.moveTask('TASK-001', 'Backlog', 0);
    expect(moved).not.toBeNull();
    const order = taskStore.getTasksByState('Backlog').map((t) => t.id);
    expect(order).toEqual(['TASK-001', 'TASK-002']);
  });

  it('getMaxTaskIdNumber walks loaded states and deferred raw content', () => {
    // Seed Done (deferred) with a high id; seed Backlog with a lower one.
    fs.writeFileSync(
      path.join(tmpDir, 'DONE.md'),
      `# Done\n\n## TASK-050: Archived\n**Priority:** P3\n\n---\n`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(tmpDir, 'BACKLOG.md'),
      `# Backlog\n\n## TASK-002: Loaded\n**Priority:** P1\n\n---\n`,
      'utf-8',
    );
    taskStore.reload();

    expect(taskStore.isStateDeferredUnloaded('Done')).toBe(true);
    expect(taskStore.getMaxTaskIdNumber()).toBe(50);
    // Must not force a parse of Done.
    expect(taskStore.isStateDeferredUnloaded('Done')).toBe(true);
  });

  it('createTask reconciles nextId past higher IDs already on disk', () => {
    // Simulate a post-merge state: config.nextId stale, BACKLOG.md has a higher TASK-050.
    fs.writeFileSync(
      path.join(tmpDir, 'BACKLOG.md'),
      `# Backlog\n\n## TASK-050: Merged in from another branch\n**Priority:** P2\n\n---\n`,
      'utf-8',
    );
    taskStore.reload();
    expect(configManager.get().nextId).toBe(1);

    const task = taskStore.createTask(
      { title: 'New', priority: Priority.P1, tags: [], description: '' },
      'Next',
    );

    expect(task.id).toBe('TASK-051');
    expect(configManager.get().nextId).toBe(52);
  });

  it('createTask reloads config.json to pick up another process bumping nextId', () => {
    taskStore.createTask(
      { title: 'First', priority: Priority.P1, tags: [], description: '' },
      'Backlog',
    );
    // Another process writes a higher nextId to config.json.
    const other = new ConfigManager(tmpDir);
    other.load();
    other.update({ nextId: 200 });
    other.save();

    const task = taskStore.createTask(
      { title: 'Second', priority: Priority.P1, tags: [], description: '' },
      'Backlog',
    );

    expect(task.id).toBe('TASK-200');
  });

  it('creates from the saved counter without reading unrelated states or archives', () => {
    configManager.update({ nextId: 200 });
    configManager.save();
    const targeted = new TaskStore(configManager, fileStore);
    targeted.reloadState('Backlog');
    const stateRead = vi.spyOn(fileStore, 'readState');
    const rawRead = vi.spyOn(fileStore, 'readRawContent');
    const archiveList = vi.spyOn(fileStore, 'listArchiveFiles');
    const archiveRead = vi.spyOn(fileStore, 'readArchiveRaw');

    const task = targeted.createTask(
      { title: 'New', priority: Priority.P1, tags: [], description: '' },
      'Backlog',
    );

    expect(task.id).toBe('TASK-200');
    expect(stateRead).not.toHaveBeenCalled();
    expect(rawRead).not.toHaveBeenCalled();
    expect(archiveList).not.toHaveBeenCalled();
    expect(archiveRead).not.toHaveBeenCalled();
  });

  it('preserves a task moved into the migrated Rejected state when allocating the next ID', () => {
    const legacy = {
      ...configManager.get(),
      version: 1,
      sortBy: 'priority',
      states: configManager.get().states.filter((state) => state.name !== 'Rejected'),
    };
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify(legacy));
    fs.writeFileSync(
      path.join(tmpDir, 'BACKLOG.md'),
      '# Backlog\n\n## TASK-001: Manually added\n**Priority:** P1\n\n---\n',
    );
    configManager.load({ persistMigration: false });
    taskStore.reload();
    taskStore.moveTask('TASK-001', 'Rejected');
    const nextConfig = new ConfigManager(tmpDir);
    nextConfig.load({ persistMigration: false });
    const nextStore = new TaskStore(nextConfig, fileStore);
    nextStore.reloadState('Backlog');

    const created = nextStore.createTask(
      { title: 'New', priority: Priority.P1, tags: [], description: '' },
      'Backlog',
    );

    expect(created.id).toBe('TASK-002');
    expect(fs.readFileSync(path.join(tmpDir, 'REJECTED.md'), 'utf8')).toContain('TASK-001');
    const persisted = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf8'));
    expect(persisted.version).toBe(4);
    expect(persisted.sortBy).toBeUndefined();
    expect(persisted.states.some((state: { name: string }) => state.name === 'Rejected')).toBe(
      true,
    );
  });

  it('does not lower a counter already seen when another writer restores an older config', () => {
    configManager.update({ nextId: 200 });
    configManager.save();
    const other = new ConfigManager(tmpDir);
    other.load();
    other.update({ nextId: 1 });
    other.save();

    const task = taskStore.createTask(
      { title: 'New', priority: Priority.P1, tags: [], description: '' },
      'Backlog',
    );

    expect(task.id).toBe('TASK-200');
  });

  it('does not rewrite config on a move when the counter and schema already agree', () => {
    taskStore.createTask(
      { title: 'Existing', priority: Priority.P1, tags: [], description: '' },
      'Backlog',
    );
    const save = vi.spyOn(configManager, 'save');

    taskStore.moveTask('TASK-001', 'Next');

    expect(save).not.toHaveBeenCalled();
  });

  it('uses the new prefix counter without inheriting the previous prefix high water mark', () => {
    configManager.update({ nextId: 200 });
    configManager.save();
    const other = new ConfigManager(tmpDir);
    other.load();
    other.update({ idPrefix: 'NEW', nextId: 1 });
    other.save();

    const task = taskStore.createTask(
      { title: 'New prefix', priority: Priority.P1, tags: [], description: '' },
      'Backlog',
    );

    expect(task.id).toBe('NEW-001');
  });

  describe('recordRun', () => {
    const recurring = () =>
      taskStore.createTask(
        {
          title: 'Daily watch',
          priority: Priority.P1,
          tags: [],
          description: 'Check the stores.',
          repeats: '0 7 * * *',
        },
        'Recurring',
      );

    it('stamps the last run and puts the result first in the history', () => {
      const created = recurring();

      taskStore.recordRun(created.id, 'all stores  on\n3.0.28', new Date('2026-11-24T07:05:00Z'));
      const task = taskStore.recordRun(created.id, 'ok', new Date('2026-11-25T07:12:30Z'));

      expect(task?.lastRun).toBe('2026-11-25 07:12');
      expect(task?.runs).toEqual([
        '2026-11-25 07:12 — ok',
        '2026-11-24 07:05 — all stores on 3.0.28',
      ]);
      const onDisk = fs.readFileSync(path.join(tmpDir, 'RECURRING.md'), 'utf8');
      expect(onDisk).toContain('**Last run:** 2026-11-25 07:12');
      expect(onDisk).toContain('### Runs\n\n- 2026-11-25 07:12 — ok\n');
    });

    it('keeps only the latest MAX_RUNS entries', () => {
      const created = recurring();
      for (let day = 1; day <= MAX_RUNS + 3; day++) {
        taskStore.recordRun(created.id, `run ${day}`, new Date(Date.UTC(2026, 10, day, 7)));
      }

      const runs = taskStore.getTasksByState('Recurring')[0].runs ?? [];

      expect(runs).toHaveLength(MAX_RUNS);
      expect(runs[0]).toContain(`run ${MAX_RUNS + 3}`);
      expect(runs[MAX_RUNS - 1]).toContain('run 4');
    });

    it('records a run with no result as the timestamp alone', () => {
      const created = recurring();

      const task = taskStore.recordRun(created.id, '  ', new Date('2026-11-25T07:00:00Z'));

      expect(task?.runs).toEqual(['2026-11-25 07:00']);
    });

    it('refuses a task without a schedule', () => {
      const plain = taskStore.createTask(
        { title: 'One-off', priority: Priority.P2, tags: [], description: '' },
        'Backlog',
      );

      expect(() => taskStore.recordRun(plain.id, 'ok')).toThrow(/Repeats/);
    });

    it('returns null for an unknown task', () => {
      expect(taskStore.recordRun('TASK-999', 'ok')).toBeNull();
    });
  });
});
