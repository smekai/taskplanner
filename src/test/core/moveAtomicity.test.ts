import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigManager } from '../../core/config/configManager.js';
import { FileStore } from '../../core/store/fileStore.js';
import { TaskStore } from '../../core/store/taskStore.js';
import { Priority } from '../../core/model/task.js';

// A move writes two files, and serializing a task can fail — a refused body, a rejected
// attribute, a full disk. Failing on the second write after the first has landed leaves the task
// in neither state, which destroys work instead of reporting a problem.
describe('commit writes every state or none', () => {
  let tmpDir: string;
  let fileStore: FileStore;
  let taskStore: TaskStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskplanner-atomic-'));
    const configManager = new ConfigManager(tmpDir);
    configManager.load();
    configManager.save();
    fileStore = new FileStore(tmpDir);
    fileStore.initializeStateFiles(configManager.get());
    taskStore = new TaskStore(configManager, fileStore);
    taskStore.reload();
    taskStore.createTask(
      { title: 'Movable', priority: Priority.P1, tags: [], description: 'Body.' },
      'Backlog',
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const read = (file: string) => fs.readFileSync(path.join(tmpDir, file), 'utf8');

  /** Serializing the destination fails; the source must not already be on disk. */
  function failOnState(stateName: string) {
    const real = fileStore.prepareState.bind(fileStore);
    vi.spyOn(fileStore, 'prepareState').mockImplementation((state, tasks) => {
      if (state.name === stateName) throw new Error('refused');
      return real(state, tasks);
    });
  }

  it('leaves both files untouched when the destination cannot be serialized', () => {
    const backlogBefore = read('BACKLOG.md');
    const nextBefore = read('NEXT.md');
    failOnState('Next');

    expect(() => taskStore.moveTask('TASK-001', 'Next')).toThrow();

    expect(read('BACKLOG.md')).toBe(backlogBefore);
    expect(read('NEXT.md')).toBe(nextBefore);
    expect(backlogBefore).toContain('TASK-001');
  });

  it('leaves the file untouched when the source cannot be serialized', () => {
    const backlogBefore = read('BACKLOG.md');
    failOnState('Backlog');

    expect(() => taskStore.moveTask('TASK-001', 'Next')).toThrow();

    expect(read('BACKLOG.md')).toBe(backlogBefore);
    expect(read('NEXT.md')).not.toContain('TASK-001');
  });

  it('still moves a task it can serialize', () => {
    const moved = taskStore.moveTask('TASK-001', 'Next');

    expect(moved?.id).toBe('TASK-001');
    expect(read('NEXT.md')).toContain('TASK-001');
    expect(read('BACKLOG.md')).not.toContain('TASK-001');
  });
});
