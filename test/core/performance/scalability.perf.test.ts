import { describe, it, expect } from 'vitest';
import { parseTasks } from '../../../src/core/parser/taskParser.js';
import { serializeStateFile } from '../../../src/core/parser/taskSerializer.js';
import { groupTasks, filterAndPaginate } from '../../../src/core/filter/taskFilter.js';
import { Task } from '../../../src/core/model/task.js';
import { TaskState } from '../../../src/core/model/state.js';
import { Priority } from '../../../src/core/model/task.js';

function buildStateMarkdown(stateName: string, taskCount: number): string {
  let s = `# ${stateName}\n\n`;
  for (let i = 1; i <= taskCount; i++) {
    const id = `TASK-${String(i).padStart(3, '0')}`;
    s += `## ${id}: Task ${i}\n**Priority:** P1\n\nBody ${i}.\n\n---\n\n`;
  }
  return s;
}

function tasksFromParse(n: number): Task[] {
  const raw = buildStateMarkdown('Test', n);
  return parseTasks(raw).tasks;
}

const sampleStates: TaskState[] = [
  { name: 'Backlog', fileName: 'BACKLOG.md', order: 0 },
  { name: 'Next', fileName: 'NEXT.md', order: 1 },
  { name: 'In Progress', fileName: 'IN_PROGRESS.md', order: 2 },
  { name: 'Done', fileName: 'DONE.md', order: 3 },
  { name: 'Rejected', fileName: 'REJECTED.md', order: 4 },
];

describe('scalability (timing smoke)', () => {
  it('parses 500 tasks within a generous bound', () => {
    const raw = buildStateMarkdown('Done', 500);
    const t0 = performance.now();
    const { tasks } = parseTasks(raw);
    const ms = performance.now() - t0;
    expect(tasks).toHaveLength(500);
    expect(ms).toBeLessThan(30_000);
  });

  it('serializes and parses a round-trip for 300 tasks', () => {
    const tasks: Task[] = [];
    for (let i = 1; i <= 300; i++) {
      tasks.push({
        id: `TASK-${String(i).padStart(3, '0')}`,
        title: `T ${i}`,
        priority: Priority.P2,
        tags: [],
        description: `D ${i}`,
      });
    }
    const md = serializeStateFile('Next', tasks);
    const t0 = performance.now();
    const back = parseTasks(md);
    const ms = performance.now() - t0;
    expect(back.tasks).toHaveLength(300);
    expect(ms).toBeLessThan(20_000);
  });

  it('groupTasks and filterAndPaginate stay bounded for large maps', () => {
    const n = 2000;
    const backlog = tasksFromParse(n);
    const tasksByState = new Map<string, Task[]>([
      ['Backlog', backlog],
      ['Next', []],
      ['In Progress', []],
      ['Done', []],
      ['Rejected', []],
    ]);
    const displayCounts = new Map([
      ['Backlog', n],
      ['Next', 0],
      ['In Progress', 0],
      ['Done', 0],
      ['Rejected', 0],
    ]);

    const t0 = performance.now();
    const groups = groupTasks(
      tasksByState,
      sampleStates,
      'status',
      undefined,
      50,
      'priority',
      displayCounts,
    );
    const gMs = performance.now() - t0;
    expect(groups.length).toBeGreaterThan(0);
    expect(gMs).toBeLessThan(15_000);

    const t1 = performance.now();
    const view = filterAndPaginate(tasksByState, sampleStates, undefined, 50, 'priority', displayCounts);
    const fMs = performance.now() - t1;
    expect(view.states.length).toBeGreaterThan(0);
    expect(fMs).toBeLessThan(15_000);
  });
});
