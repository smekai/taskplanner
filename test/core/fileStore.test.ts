import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileStore } from '../../src/core/store/fileStore.js';
import { TaskState } from '../../src/core/model/state.js';

const BACKLOG: TaskState = { name: 'Backlog', fileName: 'BACKLOG.md', order: 0 };
const BOARD = `# Backlog

## TASK-001: First
**Priority:** P2

Body.

---
`;
const LONG_AGO = new Date('2020-01-01T00:00:00Z');

describe('FileStore.commitWrites', () => {
  let tasksDir: string;
  let filePath: string;

  beforeEach(() => {
    tasksDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskplanner-file-store-'));
    filePath = path.join(tasksDir, BACKLOG.fileName);
    fs.writeFileSync(filePath, BOARD);
    fs.utimesSync(filePath, LONG_AGO, LONG_AGO);
  });

  afterEach(() => {
    fs.rmSync(tasksDir, { recursive: true, force: true });
  });

  const mtime = () => fs.statSync(filePath).mtimeMs;

  it('leaves a state file alone when the write would not change it', () => {
    const store = new FileStore(tasksDir);
    const { tasks } = store.readState(BACKLOG);

    const prepared = store.prepareState(BACKLOG, tasks);
    store.commitWrites([prepared]);

    expect(prepared.isUnchanged).toBe(true);
    expect(mtime()).toBe(LONG_AGO.getTime());
    expect(fs.readFileSync(filePath, 'utf8')).toBe(BOARD);
  });

  it('still writes a changed task', () => {
    const store = new FileStore(tasksDir);
    const [task] = store.readState(BACKLOG).tasks;

    store.writeState(BACKLOG, [{ ...task, title: 'Renamed' }]);

    expect(mtime()).not.toBe(LONG_AGO.getTime());
    expect(fs.readFileSync(filePath, 'utf8')).toContain('## TASK-001: Renamed');
  });

  it('creates a missing state file even when it would be empty', () => {
    fs.rmSync(filePath);
    const store = new FileStore(tasksDir);

    const prepared = store.prepareState(BACKLOG, []);
    store.commitWrites([prepared]);

    expect(prepared.isUnchanged).toBe(false);
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
