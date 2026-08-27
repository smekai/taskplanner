import { describe, it, expect } from 'vitest';
import { filterAndPaginate, groupTasks, sortTasks } from '../../core/filter/taskFilter.js';
import { Task, Priority } from '../../core/model/task.js';
import { TaskState } from '../../core/model/state.js';
import { GROUP_BY_VALUES } from '../../core/model/messages.js';
import * as fs from 'fs';

const states: TaskState[] = [
  { name: 'Backlog', fileName: 'BACKLOG.md', order: 0 },
  { name: 'In Progress', fileName: 'IN_PROGRESS.md', order: 1 },
  { name: 'Done', fileName: 'DONE.md', order: 2 },
];

function makeTask(
  id: string,
  title: string,
  priority: Priority = Priority.P3,
  tags: string[] = [],
): Task {
  return { id, title, description: '', priority, tags };
}

function makeTasks(count: number, prefix: string): Task[] {
  return Array.from({ length: count }, (_, i) =>
    makeTask(`TASK-${prefix}${String(i + 1).padStart(3, '0')}`, `Task ${prefix} ${i + 1}`),
  );
}

describe('filterAndPaginate', () => {
  it('returns all states with no filter', () => {
    const tasksByState = new Map<string, Task[]>([
      ['Backlog', [makeTask('TASK-001', 'First')]],
      ['In Progress', [makeTask('TASK-002', 'Second')]],
      ['Done', []],
    ]);

    const result = filterAndPaginate(tasksByState, states);
    expect(result.states).toHaveLength(3);
    expect(result.states[0].tasks).toHaveLength(1);
    expect(result.states[1].tasks).toHaveLength(1);
    expect(result.states[2].tasks).toHaveLength(0);
  });

  it('filters by status', () => {
    const tasksByState = new Map<string, Task[]>([
      ['Backlog', [makeTask('TASK-001', 'First')]],
      ['In Progress', [makeTask('TASK-002', 'Second')]],
      ['Done', []],
    ]);

    const result = filterAndPaginate(tasksByState, states, { status: 'Backlog' });
    expect(result.states).toHaveLength(1);
    expect(result.states[0].name).toBe('Backlog');
  });

  it('filters by query matching ID', () => {
    const tasksByState = new Map<string, Task[]>([
      ['Backlog', [makeTask('TASK-001', 'Alpha'), makeTask('TASK-002', 'Beta')]],
      ['In Progress', []],
      ['Done', []],
    ]);

    const result = filterAndPaginate(tasksByState, states, { query: '001' });
    expect(result.states[0].tasks).toHaveLength(1);
    expect(result.states[0].tasks[0].id).toBe('TASK-001');
  });

  it('filters by query matching title (case-insensitive)', () => {
    const tasksByState = new Map<string, Task[]>([
      ['Backlog', [makeTask('TASK-001', 'Fix login bug'), makeTask('TASK-002', 'Add feature')]],
      ['In Progress', []],
      ['Done', []],
    ]);

    const result = filterAndPaginate(tasksByState, states, { query: 'LOGIN' });
    expect(result.states[0].tasks).toHaveLength(1);
    expect(result.states[0].tasks[0].title).toBe('Fix login bug');
  });

  it('applies 50-task limit and sets hasMore', () => {
    const tasksByState = new Map<string, Task[]>([
      ['Backlog', makeTasks(60, 'B')],
      ['In Progress', []],
      ['Done', []],
    ]);

    const result = filterAndPaginate(tasksByState, states);
    expect(result.states[0].tasks).toHaveLength(50);
    expect(result.states[0].totalCount).toBe(60);
    expect(result.states[0].hasMore).toBe(true);
  });

  it('returns all tasks when limit is null (show all)', () => {
    const tasksByState = new Map<string, Task[]>([
      ['Backlog', makeTasks(60, 'B')],
      ['In Progress', []],
      ['Done', []],
    ]);

    const result = filterAndPaginate(tasksByState, states, undefined, null);
    expect(result.states[0].tasks).toHaveLength(60);
    expect(result.states[0].hasMore).toBe(false);
  });

  it('combines status and query filters', () => {
    const tasksByState = new Map<string, Task[]>([
      ['Backlog', [makeTask('TASK-001', 'Fix bug'), makeTask('TASK-002', 'Add feature')]],
      ['In Progress', [makeTask('TASK-003', 'Fix crash')]],
      ['Done', []],
    ]);

    const result = filterAndPaginate(tasksByState, states, { status: 'Backlog', query: 'fix' });
    expect(result.states).toHaveLength(1);
    expect(result.states[0].tasks).toHaveLength(1);
    expect(result.states[0].tasks[0].id).toBe('TASK-001');
  });

  it('filters by tag', () => {
    const tasksByState = new Map<string, Task[]>([
      [
        'Backlog',
        [
          makeTask('TASK-001', 'Alpha', Priority.P2, ['ui']),
          makeTask('TASK-002', 'Beta', Priority.P2, ['core']),
        ],
      ],
      ['In Progress', [makeTask('TASK-003', 'Gamma', Priority.P2, ['ui'])]],
      ['Done', []],
    ]);

    const result = filterAndPaginate(tasksByState, states, { tag: 'ui' });
    expect(result.states[0].tasks).toHaveLength(1);
    expect(result.states[0].tasks[0].id).toBe('TASK-001');
    expect(result.states[1].tasks).toHaveLength(1);
    expect(result.states[1].tasks[0].id).toBe('TASK-003');
  });

  it('filters by query matching tags', () => {
    const tasksByState = new Map<string, Task[]>([
      ['Backlog', [makeTask('TASK-001', 'Alpha', Priority.P2, ['feature']), makeTask('TASK-002', 'Beta')]],
      ['In Progress', []],
      ['Done', []],
    ]);

    const result = filterAndPaginate(tasksByState, states, { query: 'feature' });
    expect(result.states[0].tasks).toHaveLength(1);
    expect(result.states[0].tasks[0].id).toBe('TASK-001');
  });

  it('combines status, tag, and query filters', () => {
    const tasksByState = new Map<string, Task[]>([
      [
        'Backlog',
        [
          makeTask('TASK-001', 'Fix ui bug', Priority.P2, ['ui']),
          makeTask('TASK-002', 'Fix core bug', Priority.P2, ['core']),
        ],
      ],
      ['In Progress', [makeTask('TASK-003', 'Fix ui crash', Priority.P2, ['ui'])]],
      ['Done', []],
    ]);

    const result = filterAndPaginate(tasksByState, states, {
      status: 'Backlog',
      tag: 'ui',
      query: 'fix',
    });
    expect(result.states).toHaveLength(1);
    expect(result.states[0].tasks).toHaveLength(1);
    expect(result.states[0].tasks[0].id).toBe('TASK-001');
  });
});

describe('sortTasks', () => {
  it('sorts by priority then ID when priorities tie', () => {
    const tasks = [
      makeTask('TASK-003', 'Third', Priority.P1),
      makeTask('TASK-001', 'First', Priority.P1),
      makeTask('TASK-002', 'Second', Priority.P1),
      makeTask('TASK-004', 'Fourth', Priority.P2),
    ];

    const sorted = sortTasks(tasks, 'priority');
    expect(sorted.map((t) => t.id)).toEqual([
      'TASK-001',
      'TASK-002',
      'TASK-003',
      'TASK-004',
    ]);
  });

  it('sorts by name then ID when titles tie', () => {
    const tasks = [
      makeTask('TASK-003', 'Same title'),
      makeTask('TASK-001', 'Same title'),
      makeTask('TASK-002', 'Same title'),
      makeTask('TASK-004', 'Other title'),
    ];

    const sorted = sortTasks(tasks, 'name');
    expect(sorted.map((t) => t.id)).toEqual([
      'TASK-004',
      'TASK-001',
      'TASK-002',
      'TASK-003',
    ]);
  });
});

describe('groupTasks by epic', () => {
  const byState = () =>
    new Map<string, Task[]>([
      [
        'Backlog',
        [
          { ...makeTask('TASK-001', 'Milestone work'), epic: '2.2.x' },
          { ...makeTask('TASK-002', 'Other milestone'), epic: '2.3.x' },
          makeTask('TASK-003', 'Unassigned to any epic'),
        ],
      ],
    ]);

  it('buckets tasks by their epic', () => {
    const groups = groupTasks(byState(), states, 'epic');
    const names = groups.map((g) => g.label).sort();
    expect(names).toContain('2.2.x');
    expect(names).toContain('2.3.x');
    expect(groups.find((g) => g.label === '2.2.x')?.tasks).toHaveLength(1);
  });

  it('collects tasks without an epic under a visible bucket', () => {
    const groups = groupTasks(byState(), states, 'epic');
    const none = groups.find((g) => g.label === 'No epic');
    expect(none).toBeDefined();
    expect(none?.tasks.map((t) => t.id)).toEqual(['TASK-003']);
  });
});

describe('groupBy vocabulary', () => {
  // The bug this guards: 'epic' was added to the filter, the message type, the setting enum and the
  // menu, but not to the extension's accepted-value list, so the selection was silently rejected on
  // the next read. These declarations live in different files and must not drift apart.
  it('matches the taskplanner.groupBy enum in package.json', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const enumValues = pkg.contributes.configuration.properties['taskplanner.groupBy'].enum;
    expect([...enumValues].sort()).toEqual([...GROUP_BY_VALUES].sort());
  });

  it('matches the grouping menu offered in the task list panel', () => {
    const panel = fs.readFileSync('src/extension/views/webview/taskListPanel.ts', 'utf8');
    const block = /const groupByItems = \[([\s\S]*?)\]/.exec(panel);
    expect(block).not.toBeNull();
    const offered = [...block![1].matchAll(/value: '([^']+)'/g)].map((m) => m[1]);
    expect(offered.sort()).toEqual([...GROUP_BY_VALUES].sort());
  });

  it('groups every declared value without falling through', () => {
    const tasks = new Map<string, Task[]>([['Backlog', [makeTask('TASK-001', 'One')]]]);
    for (const value of GROUP_BY_VALUES) {
      const groups = groupTasks(tasks, states, value);
      expect(groups.some((g) => g.tasks.length > 0)).toBe(true);
    }
  });
});
