import { describe, it, expect } from 'vitest';
import { upsertTask, removeTask } from '../../core/parser/boardEditor.js';
import { parseTasks } from '../../core/parser/taskParser.js';
import { Task, Priority } from '../../core/model/task.js';

// serializeStateFile rebuilds a file from the tasks it parsed, so everything it did not
// parse is lost. These operations edit one section and leave every other byte alone.
const BOARD = [
  '# Backlog',
  '',
  'Notes a human wrote at the top of the file.',
  '',
  '<!-- keep this -->',
  '## TASK-001: Existing',
  '**Priority:** P1',
  '',
  'Body.',
  '',
  '---',
  '',
  '## task-002: Prefix the parser refuses',
  '',
  '---',
  '',
].join('\n');

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'TASK-003',
    title: 'New task',
    priority: Priority.P2,
    tags: [],
    description: 'New body.',
    ...overrides,
  };
}

describe('upsertTask', () => {
  it('adds a task without disturbing anything else in the file', () => {
    const result = upsertTask(BOARD, task());

    expect(result).toContain('Notes a human wrote at the top of the file.');
    expect(result).toContain('<!-- keep this -->');
    expect(result).toContain('## task-002: Prefix the parser refuses');
    expect(result).toContain('## TASK-003: New task');
  });

  it('replaces a task in place rather than moving it', () => {
    const result = upsertTask(BOARD, task({ id: 'TASK-001', title: 'Rewritten' }));

    expect(result).toContain('## TASK-001: Rewritten');
    expect(result).not.toContain('## TASK-001: Existing');
    expect(result.indexOf('<!-- keep this -->')).toBeLessThan(result.indexOf('## TASK-001:'));
  });

  it('adds one task, not two', () => {
    expect(parseTasks(upsertTask(BOARD, task())).tasks).toHaveLength(2);
  });

  it('appends at the bottom when asked', () => {
    const result = upsertTask(BOARD, task(), 'bottom');

    expect(result.indexOf('## TASK-003:')).toBeGreaterThan(result.indexOf('## task-002:'));
  });

  it('keeps a CRLF file on CRLF', () => {
    const result = upsertTask(BOARD.replace(/\n/g, '\r\n'), task());

    expect(result).not.toMatch(/(?<!\r)\n/);
  });

  it('keeps an LF file on LF', () => {
    expect(upsertTask(BOARD, task())).not.toContain('\r\n');
  });
});

describe('removeTask', () => {
  it('returns the file without the task, and the section it took', () => {
    const { content, section } = removeTask(BOARD, 'TASK-001');

    expect(content).not.toContain('## TASK-001:');
    expect(section).toContain('## TASK-001: Existing');
  });

  it('leaves the rest of the file exactly as it was', () => {
    const { content } = removeTask(BOARD, 'TASK-001');

    expect(content).toContain('Notes a human wrote at the top of the file.');
    expect(content).toContain('<!-- keep this -->');
    expect(content).toContain('## task-002: Prefix the parser refuses');
  });

  it('reports nothing taken when the task is not there', () => {
    expect(removeTask(BOARD, 'TASK-404')).toEqual({ content: BOARD });
  });
});
