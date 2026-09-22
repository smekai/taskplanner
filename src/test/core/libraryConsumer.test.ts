import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { boardExists, initializeBoard, openBoard } from '../../core/store/openBoard.js';
import { renderWorkLogEntry } from '../../core/store/archive.js';
import { renderBoardDigest } from '../../core/ai/boardDigest.js';
import { Priority, Task } from '../../core/model/task.js';

// The surface a program consumes this package through, rather than the editor. Each of
// these existed inside TaskPlanner already and was being re-derived by a consumer.
describe('library consumer surface', () => {
  let tmpDir: string;
  let tasksDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskplanner-consumer-'));
    tasksDir = path.join(tmpDir, '.tasks');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('openBoard', () => {
    it('reports whether a board is there before opening one', () => {
      expect(boardExists(tasksDir)).toBe(false);
      initializeBoard(tasksDir);
      expect(boardExists(tasksDir)).toBe(true);
    });

    it('creates the board on request and leaves it usable', () => {
      const { taskStore } = openBoard(tasksDir, { initialize: true });

      taskStore.createTask(
        { title: 'First', description: '', priority: Priority.P1, tags: [] },
        'Backlog',
      );

      expect(openBoard(tasksDir).taskStore.getTasksByState('Backlog')).toHaveLength(1);
    });

    // A consumer's read must not rewrite the owner's file, which is why the default is
    // the opposite of the extension's.
    it('does not persist a migration on open', () => {
      fs.mkdirSync(tasksDir, { recursive: true });
      const unmigrated = JSON.stringify({ idPrefix: 'TASK', nextId: 1 }, null, 2) + '\n';
      fs.writeFileSync(path.join(tasksDir, 'config.json'), unmigrated);

      openBoard(tasksDir);

      expect(fs.readFileSync(path.join(tasksDir, 'config.json'), 'utf-8')).toBe(unmigrated);
    });
  });

  describe('finding work a consumer put there', () => {
    it('finds a task by an attribute it wrote, and reports nothing for one it did not', () => {
      const { taskStore } = openBoard(tasksDir, { initialize: true });
      taskStore.createTask(
        {
          title: 'Owned',
          description: '',
          priority: Priority.P1,
          tags: [],
          attributes: { 'Isotopy origin': 'abc123' },
        },
        'Backlog',
      );

      expect(taskStore.findTaskByAttribute('Isotopy origin', 'abc123')?.task.title).toBe('Owned');
      expect(taskStore.findTaskByAttribute('Isotopy origin', 'nope')).toBeNull();
    });

    // An id that was archived out of Done is still spent, so a consumer asking "does this
    // exist" has to be told yes.
    it('counts archived ids as known, not only the ones still on the board', () => {
      const { taskStore } = openBoard(tasksDir, { initialize: true });
      const live = taskStore.createTask(
        { title: 'Live', description: '', priority: Priority.P1, tags: [] },
        'Backlog',
      );
      fs.mkdirSync(path.join(tasksDir, 'archive'), { recursive: true });
      fs.writeFileSync(
        path.join(tasksDir, 'archive', 'DONE-2026.md'),
        '# Done\n\n## TASK-900: Archived\n**Priority:** P1\n\n---\n',
      );

      const known = taskStore.knownTaskIds();

      expect(known.has(live.id)).toBe(true);
      expect(known.has('TASK-900')).toBe(true);
    });
  });

  describe('work log', () => {
    it('puts a new entry above the ones already there, under the header', () => {
      const { fileStore } = openBoard(tasksDir, { initialize: true });
      fileStore.prependWorkLogEntry({ id: 'TASK-001', date: '2026-01-01', what: 'Older.' });

      const wrote = fileStore.prependWorkLogEntry({
        id: 'TASK-002',
        date: '2026-02-02',
        what: 'Newer.',
        outcome: 'Done.',
      });

      const content = fileStore.readWorkLog();
      expect(wrote).toBe(true);
      expect(content.indexOf('TASK-002')).toBeLessThan(content.indexOf('TASK-001'));
      expect(content.indexOf('# Work Log')).toBeLessThan(content.indexOf('TASK-002'));
      expect(content).toContain('**Outcome:** Done.');
    });

    it('does nothing when the project keeps no work log', () => {
      const { fileStore } = openBoard(tasksDir, { initialize: true });
      fs.rmSync(path.join(tasksDir, 'WORK_LOG.md'));

      expect(fileStore.prependWorkLogEntry({ id: 'TASK-001', date: '2026-01-01', what: 'x' })).toBe(
        false,
      );
    });

    it('skips a field it was not given rather than writing an empty one', () => {
      expect(renderWorkLogEntry({ id: 'TASK-004', date: '2026-07-29', what: 'Shipped.' })).toBe(
        '## TASK-004 — 2026-07-29\n**What:** Shipped.\n\n---',
      );
    });
  });

  describe('board digest', () => {
    const task = (overrides: Partial<Task> = {}): Task => ({
      id: 'TASK-004',
      title: 'Existing',
      description: '',
      priority: Priority.P1,
      tags: [],
      ...overrides,
    });

    it('counts every state and lists nothing unless asked', () => {
      const digest = renderBoardDigest([{ name: 'Backlog', tasks: [task()] }]);

      expect(digest).toContain('## Backlog (1)');
      expect(digest).not.toContain('TASK-004');
    });

    it('marks who holds a task and what it waits on', () => {
      const digest = renderBoardDigest(
        [{ name: 'Next', tasks: [task({ assignee: 'owner', waitingUntil: '2026-12-01' })] }],
        { includeTasks: true, now: new Date('2026-09-10T12:00:00.000Z') },
      );

      expect(digest).toContain('@owner');
      expect(digest).toContain('waiting until 2026-12-01');
    });

    it('does not mark a waiting date that has already arrived', () => {
      const digest = renderBoardDigest(
        [{ name: 'Next', tasks: [task({ waitingUntil: '2026-01-01' })] }],
        { includeTasks: true, now: new Date('2026-09-10T12:00:00.000Z') },
      );

      expect(digest).not.toContain('waiting until');
    });

    it('includes a one-line description excerpt only when a limit is given', () => {
      const states = [{ name: 'Backlog', tasks: [task({ description: 'Long\nbody text.' })] }];

      expect(renderBoardDigest(states, { includeTasks: true })).not.toContain('Long');
      expect(renderBoardDigest(states, { includeTasks: true, descriptionLimit: 6 })).toContain(
        '— Long b',
      );
    });
  });
});
