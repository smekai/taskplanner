import { describe, it, expect } from 'vitest';
import { serializeTask, serializeStateFile } from '../../core/parser/taskSerializer.js';
import { parseTasks } from '../../core/parser/taskParser.js';
import { Task, Priority } from '../../core/model/task.js';

describe('serializeTask', () => {
  it('serializes a full task with metadata on one line', () => {
    const task: Task = {
      id: 'TASK-001',
      title: 'Implement auth',
      priority: Priority.P1,
      tags: ['auth', 'backend'],
      description: 'Build OAuth2 authentication.',
    };
    const result = serializeTask(task);
    expect(result).toBe(
      `## TASK-001: Implement auth\n**Priority:** P1 | **Tags:** auth, backend\n\nBuild OAuth2 authentication.`,
    );
  });

  it('uses Tags for one tag', () => {
    const task: Task = {
      id: 'TASK-002',
      title: 'Fix bug',
      priority: Priority.P2,
      tags: ['bugfix'],
      description: 'Fix the login bug.',
    };
    const result = serializeTask(task);
    expect(result).toContain('**Tags:** bugfix');
  });

  it('includes epic on the same line', () => {
    const task: Task = {
      id: 'TASK-003',
      title: 'Setup CI',
      priority: Priority.P2,
      tags: ['devops'],
      epic: 'infrastructure',
      description: 'Configure CI.',
    };
    const result = serializeTask(task);
    expect(result).toContain('**Priority:** P2 | **Tags:** devops | **Epic:** infrastructure');
  });

  it('handles empty tags', () => {
    const task: Task = {
      id: 'TASK-004',
      title: 'Simple',
      priority: Priority.P4,
      tags: [],
      description: 'No tags.',
    };
    const result = serializeTask(task);
    expect(result).not.toContain('**Tag');
    expect(result).toContain('**Priority:** P4');
  });

  it('serializes task with plan', () => {
    const task: Task = {
      id: 'TASK-010',
      title: 'With plan',
      priority: Priority.P1,
      tags: [],
      description: 'Some description.',
      plan: '- Step 1\n- Step 2',
    };
    const result = serializeTask(task);
    expect(result).toBe(
      `## TASK-010: With plan\n**Priority:** P1\n\nSome description.\n\n### Plan\n\n- Step 1\n- Step 2`,
    );
  });

  it('omits plan section when plan is empty', () => {
    const task: Task = {
      id: 'TASK-011',
      title: 'No plan',
      priority: Priority.P2,
      tags: [],
      description: 'Desc.',
    };
    const result = serializeTask(task);
    expect(result).not.toContain('### Plan');
  });

  it('handles empty description', () => {
    const task: Task = {
      id: 'TASK-005',
      title: 'No desc',
      priority: Priority.P3,
      tags: [],
      description: '',
    };
    const result = serializeTask(task);
    expect(result).toBe('## TASK-005: No desc\n**Priority:** P3');
  });
});

describe('serializeStateFile', () => {
  it('serializes empty state', () => {
    const result = serializeStateFile('Backlog', []);
    expect(result).toBe('# Backlog\n');
  });

  it('serializes state with tasks', () => {
    const tasks: Task[] = [
      {
        id: 'TASK-001',
        title: 'First',
        priority: Priority.P1,
        tags: [],
        description: 'Desc one.',
      },
      {
        id: 'TASK-002',
        title: 'Second',
        priority: Priority.P2,
        tags: ['ui'],
        description: 'Desc two.',
      },
    ];
    const result = serializeStateFile('Backlog', tasks);
    expect(result).toContain('# Backlog');
    expect(result).toContain('## TASK-001: First');
    expect(result).toContain('## TASK-002: Second');
    expect(result).toContain('---');
  });
});

// These values are routinely model output. Serializing one must not be able to put a
// second task on someone's board, and the only check that proves it is the round-trip.
describe('serializeTask round-trips', () => {
  const HEADING = '\n## TASK-999: Injected';

  const roundTripped = (overrides: Partial<Task>) =>
    parseTasks(serializeTask(task(overrides))).tasks;

  it.each([
    ['title', { title: `Safe title${HEADING}` }],
    ['tags', { tags: [`ui${HEADING}`] }],
    ['epic', { epic: `Milestone${HEADING}` }],
    ['assignee', { assignee: `owner${HEADING}` }],
    ['updatedAt', { updatedAt: `2026-09-18 10:00${HEADING}` }],
    ['waitingUntil', { waitingUntil: `2026-12-01${HEADING}` }],
  ])('a task heading smuggled through %s does not become a second task', (_field, overrides) => {
    expect(roundTripped(overrides).map((parsed) => parsed.id)).toEqual(['TASK-001']);
  });

  it('keeps the value, collapsed onto its one line', () => {
    expect(roundTripped({ title: `Safe title${HEADING}` })[0].title).toBe(
      'Safe title ## TASK-999: Injected',
    );
  });

  it('refuses a description holding a separator, because escaping it would rewrite the author', () => {
    expect(() => serializeTask(task({ description: 'Body\n\n---\n\nMore' }))).toThrow(
      /description/,
    );
  });

  it('refuses a plan holding a task heading', () => {
    expect(() => serializeTask(task({ plan: `Step one${HEADING}` }))).toThrow(/plan/);
  });

  it('leaves an ordinary body alone, including a line that merely starts with a dash', () => {
    expect(roundTripped({ description: 'Body\n- a list item\n--- not a separator' })).toHaveLength(1);
  });
});

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'TASK-001',
    title: 'Implement auth',
    priority: Priority.P1,
    tags: [],
    description: 'Body.',
    ...overrides,
  };
}
