import { describe, expect, it } from 'vitest';
import {
  BOARD_TASK_LIMIT,
  buildBoard,
  findTask,
  focusTask,
  readConfigStates,
  taskDetailOf,
} from '../src/boardReader.js';
import { DEFAULT_STATES } from '../../../../src/core/model/state.js';

const COLLAPSED = { loadCompleted: false, expandedStates: new Set<string>() };
const WITH_COMPLETED = { loadCompleted: true, expandedStates: new Set<string>() };

function section(id: string, title: string, priority: string, extra = ''): string {
  return `## ${id}: ${title}\n**Priority:** ${priority}${extra}\n\nAbout ${title}.\n\n---\n`;
}

const FILES = new Map([
  [
    'BACKLOG.md',
    `# Backlog\n\n${section('TASK-003', 'Low', 'P3')}${section('TASK-002', 'High', 'P0')}`,
  ],
  ['NEXT.md', '# Next\n'],
  ['IN_PROGRESS.md', `# In Progress\n\n${section('TASK-004', 'Doing', 'P1', ' | **Tags:** ui')}`],
  ['DONE.md', `# Done\n\n${section('TASK-001', 'Old', 'P2')}${section('TASK-000', 'Older', 'P2')}`],
  ['REJECTED.md', ''],
]);

describe('readConfigStates', () => {
  it('reads the configured states, BOM and all', () => {
    const states = [
      { name: 'Todo', fileName: 'TODO.md', order: 0 },
      { name: 'Shipped', fileName: 'SHIPPED.md', order: 1 },
    ];
    expect(readConfigStates(`${String.fromCharCode(0xfeff)}${JSON.stringify({ states })}`)).toEqual(
      states,
    );
  });

  it('falls back to the default board when states are missing', () => {
    expect(readConfigStates('{"idPrefix":"TASK"}')).toEqual(DEFAULT_STATES);
  });

  it('restores a malformed known state the way the server does', () => {
    const states = readConfigStates(JSON.stringify({ states: ['Backlog', { name: 'Next' }] }));
    expect(states.map((state) => state.fileName)).toEqual(['BACKLOG.md', 'NEXT.md']);
  });

  it('rejects config.json that is not JSON', () => {
    expect(() => readConfigStates('{ nope')).toThrow('.tasks/config.json is not valid JSON.');
  });
});

describe('buildBoard', () => {
  it('sorts open states by priority and counts deferred states without parsing them', () => {
    const { snapshot, tasks } = buildBoard(DEFAULT_STATES, FILES, COLLAPSED, '/work');
    const backlog = snapshot.states.find((state) => state.name === 'Backlog');
    expect(backlog?.tasks.map((task) => task.id)).toEqual(['TASK-002', 'TASK-003']);
    const done = snapshot.states.find((state) => state.name === 'Done');
    expect(done).toMatchObject({ tasks: [], totalCount: 2 });
    expect(snapshot.deferredStates).toEqual(['Done', 'Rejected']);
    expect(tasks.has('TASK-001')).toBe(false);
    expect(findTask(tasks, 'TASK-004')?.state).toBe('In Progress');
    expect(snapshot.workspaceRoot).toBe('/work');
  });

  it('parses deferred states when asked', () => {
    const { snapshot, tasks } = buildBoard(DEFAULT_STATES, FILES, WITH_COMPLETED, null);
    const done = snapshot.states.find((state) => state.name === 'Done');
    expect(done?.tasks.map((task) => task.id)).toEqual(['TASK-001', 'TASK-000']);
    expect(snapshot.deferredStates).toEqual([]);
    expect(findTask(tasks, 'TASK-001')?.state).toBe('Done');
  });

  it('treats a missing state file as empty and counts parse errors', () => {
    const files = new Map([['BACKLOG.md', '# Backlog\n\n## not a task heading\n\ntext\n']]);
    const { snapshot, issueCount } = buildBoard(DEFAULT_STATES, files, COLLAPSED, null);
    expect(snapshot.states.every((state) => state.totalCount === 0)).toBe(true);
    expect(issueCount).toBe(1);
  });

  it('caps each state at the pane limit and says more exist', () => {
    const many = Array.from({ length: BOARD_TASK_LIMIT + 2 }, (_, index) =>
      section(`TASK-${100 + index}`, `Task ${index}`, 'P2'),
    ).join('');
    const { snapshot } = buildBoard(
      DEFAULT_STATES,
      new Map([['BACKLOG.md', many]]),
      COLLAPSED,
      null,
    );
    expect(snapshot.states[0]).toMatchObject({
      totalCount: BOARD_TASK_LIMIT + 2,
      hasMore: true,
    });
    expect(snapshot.states[0].tasks).toHaveLength(BOARD_TASK_LIMIT);
  });

  it('shows every task of a state the person expanded', () => {
    const many = Array.from({ length: BOARD_TASK_LIMIT + 2 }, (_, index) =>
      section(`TASK-${100 + index}`, `Task ${index}`, 'P2'),
    ).join('');
    const expanded = { loadCompleted: false, expandedStates: new Set(['Backlog']) };
    const { snapshot } = buildBoard(
      DEFAULT_STATES,
      new Map([['BACKLOG.md', many]]),
      expanded,
      null,
    );
    expect(snapshot.states[0]).toMatchObject({ totalCount: BOARD_TASK_LIMIT + 2, hasMore: false });
    expect(snapshot.states[0].tasks).toHaveLength(BOARD_TASK_LIMIT + 2);
  });

  it('keeps Done in file order, newest first, rather than by priority', () => {
    const done = `# Done

${section('TASK-009', 'Just finished', 'P3')}${section('TASK-001', 'Long ago', 'P0')}`;
    const { snapshot } = buildBoard(
      DEFAULT_STATES,
      new Map([['DONE.md', done]]),
      WITH_COMPLETED,
      null,
    );
    const ids = snapshot.states.find((state) => state.name === 'Done')?.tasks.map((t) => t.id);
    expect(ids).toEqual(['TASK-009', 'TASK-001']);
  });
});

describe('findTask', () => {
  it('keeps both copies of a duplicated id and finds only the one in the asked state', () => {
    const files = new Map([
      [
        'BACKLOG.md',
        `# Backlog

${section('TASK-007', 'Backlog copy', 'P2')}`,
      ],
      [
        'NEXT.md',
        `# Next

${section('TASK-007', 'Next copy', 'P2')}`,
      ],
    ]);
    const { tasks } = buildBoard(DEFAULT_STATES, files, COLLAPSED, null);
    expect(findTask(tasks, 'TASK-007', 'Backlog')?.task.title).toBe('Backlog copy');
    expect(findTask(tasks, 'TASK-007', 'Next')?.task.title).toBe('Next copy');
    expect(findTask(tasks, 'TASK-007', 'Done')).toBeNull();
    expect(findTask(tasks, 'TASK-007')?.task.title).toBe('Backlog copy');
    expect(findTask(tasks, 'TASK-404')).toBeNull();
  });
});

describe('focusTask', () => {
  const NOW = new Date('2026-10-29T12:00:00Z');

  function focusOf(files: Record<string, string>): string | null {
    const { focusCandidates } = buildBoard(
      DEFAULT_STATES,
      new Map(Object.entries(files)),
      COLLAPSED,
      null,
    );
    const found = focusTask(focusCandidates, NOW);
    return found ? `${found.state} ${found.task.id}` : null;
  }

  const backlog = `# Backlog\n\n${section('TASK-010', 'Later', 'P3')}${section('TASK-011', 'Soon', 'P1')}`;
  const next = `# Next\n\n${section('TASK-020', 'Minor', 'P3')}${section('TASK-021', 'Major', 'P0')}`;

  it('prefers the task in progress over everything planned', () => {
    expect(focusOf(Object.fromEntries(FILES))).toBe('In Progress TASK-004');
  });

  it('falls back to the highest-priority Next task', () => {
    expect(focusOf({ 'BACKLOG.md': backlog, 'NEXT.md': next })).toBe('Next TASK-021');
  });

  it('falls back to the highest-priority Backlog task when Next is empty', () => {
    expect(focusOf({ 'BACKLOG.md': backlog })).toBe('Backlog TASK-011');
  });

  it('skips planned tasks that are still waiting, but not once the date arrives', () => {
    const blocked = section('TASK-030', 'Blocked', 'P0', '\n**Waiting until:** 2026-11-05');
    const waiting = `# Next\n\n${blocked}${section('TASK-031', 'Free', 'P2')}`;
    expect(focusOf({ 'NEXT.md': waiting })).toBe('Next TASK-031');
    const arrived = waiting.replace('2026-11-05', '2026-10-29');
    expect(focusOf({ 'NEXT.md': arrived })).toBe('Next TASK-030');
  });

  it('shows nothing when no open state has a task to pick', () => {
    expect(focusOf({ 'DONE.md': `# Done\n\n${section('TASK-001', 'Old', 'P2')}` })).toBeNull();
    expect(focusTask([], NOW)).toBeNull();
  });

  it('looks past the pane cap when every displayed candidate is waiting', () => {
    const waitingCount = BOARD_TASK_LIMIT + 1;
    const waiting = Array.from({ length: waitingCount }, (_, index) =>
      section(`TASK-${100 + index}`, `Blocked ${index}`, 'P0', '\n**Waiting until:** 2026-11-05'),
    ).join('');
    const runnable = section('TASK-999', 'Runnable', 'P4');
    expect(focusOf({ 'NEXT.md': `# Next\n\n${waiting}${runnable}` })).toBe('Next TASK-999');
  });
});

describe('taskDetailOf', () => {
  it('carries the fields the pane shows', () => {
    const { tasks } = buildBoard(DEFAULT_STATES, FILES, COLLAPSED, null);
    const detail = taskDetailOf(findTask(tasks, 'TASK-004')!);
    expect(detail).toMatchObject({
      id: 'TASK-004',
      title: 'Doing',
      state: 'In Progress',
      priority: 'P1',
      tags: ['ui'],
      body: 'About Doing.',
    });
    expect(
      detail.text.startsWith('## TASK-004: Doing\n\n**Priority:** P1 · **State:** In Progress'),
    ).toBe(true);
  });
});
