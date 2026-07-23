import { describe, it, expect } from 'vitest';
import { composeImplementationPrompt } from '../../core/ai/promptComposer.js';
import { Task, Priority } from '../../core/model/task.js';
import { TaskPlannerConfig, createDefaultConfig } from '../../core/model/config.js';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'TASK-026',
    title: 'Implement with AI button',
    priority: Priority.P1,
    tags: ['feature', 'ui'],
    description: 'Add an Implement with AI action button.',
    ...overrides,
  };
}

describe('composeImplementationPrompt', () => {
  const config = createDefaultConfig();

  it('includes task ID and title', () => {
    const result = composeImplementationPrompt(makeTask(), 'Next', config);
    expect(result).toContain('TASK-026');
    expect(result).toContain('Implement with AI button');
  });

  it('includes priority and tags', () => {
    const result = composeImplementationPrompt(makeTask(), 'Next', config);
    expect(result).toContain('Priority: P1');
    expect(result).toContain('Tags: feature, ui');
  });

  it('includes description', () => {
    const result = composeImplementationPrompt(makeTask(), 'Next', config);
    expect(result).toContain('Add an Implement with AI action button.');
  });

  it('requires read-only planning and approval when aiPlanRequired is true', () => {
    const withPlan: TaskPlannerConfig = { ...config, aiPlanRequired: true };
    const result = composeImplementationPrompt(makeTask(), 'Next', withPlan);
    expect(result).toContain('During planning, work read-only');
    expect(result).toContain('Stop and wait for explicit user approval');
    expect(result).toContain('After approval:');
    expect(result.indexOf('Stop and wait')).toBeLessThan(
      result.indexOf('Move the task from Next to In Progress'),
    );
  });

  it('omits plan-mode instruction when aiPlanRequired is false', () => {
    const noPlanConfig: TaskPlannerConfig = { ...config, aiPlanRequired: false };
    const result = composeImplementationPrompt(makeTask(), 'Backlog', noPlanConfig);
    expect(result).not.toContain('During planning, work read-only');
    expect(result).not.toContain('Stop and wait for explicit user approval');
    expect(result).not.toContain('### Plan subsection');
    expect(result).not.toContain('After approval:');
    expect(result).toContain('Move the task to DONE.md');
  });

  it('includes workflow steps with plan requirement', () => {
    const result = composeImplementationPrompt(makeTask(), 'Next', config);
    expect(result).not.toContain('git branch');
    expect(result).toContain('Move the task from Next to In Progress');
    expect(result).toContain('Save the approved plan as a ### Plan subsection');
    expect(result).toContain('Verify the implementation');
    expect(result).toContain('Move the task to DONE.md');
  });

  it('requires an existing plan to be reviewed instead of silently replaced', () => {
    const task = makeTask({ plan: '- Step 1\n- Step 2' });
    const result = composeImplementationPrompt(task, 'Next', config);
    expect(result).toContain('Existing plan:');
    expect(result).toContain('- Step 1');
    expect(result).toContain('Review and refine the existing plan; do not silently replace it');
  });

  it('includes assignee when present', () => {
    const task = makeTask({ assignee: 'Fedor' });
    const result = composeImplementationPrompt(task, 'Next', config);
    expect(result).toContain('Assignee: Fedor');
  });

  it('includes status in metadata', () => {
    const result = composeImplementationPrompt(makeTask(), 'Backlog', config);
    expect(result).toContain('Status: Backlog');
  });
});
