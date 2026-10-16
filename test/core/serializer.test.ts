import { describe, it, expect } from 'vitest';
import { serializeTask, serializeStateFile } from '../../src/core/parser/taskSerializer.js';
import { Task, Priority } from '../../src/core/model/task.js';

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
