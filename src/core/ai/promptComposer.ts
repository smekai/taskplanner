import { Task } from '../model/task.js';
import { TaskPlannerConfig } from '../model/config.js';

export function composeImplementationPrompt(
  task: Task,
  stateName: string,
  config: TaskPlannerConfig,
): string {
  const meta: string[] = [];
  meta.push(`Priority: ${task.priority}`);
  if (task.tags.length > 0) meta.push(`Tags: ${task.tags.join(', ')}`);
  if (task.assignee) meta.push(`Assignee: ${task.assignee}`);
  meta.push(`Status: ${stateName}`);

  const lines: string[] = [];

  if (config.aiPlanRequired) {
    lines.push('Use plan mode. Read and analyze before making changes.', '');
  }

  lines.push(`Implement task ${task.id}: ${task.title}`, '', meta.join(' | '), '');

  if (task.description.trim()) {
    lines.push('Description:', task.description.trim(), '');
  }

  if (task.plan?.trim()) {
    lines.push('Existing plan:', task.plan.trim(), '');
  }

  lines.push(
    'Workflow:',
    `1. Move the task from ${stateName} to In Progress (cut from source .tasks/ file, paste into IN_PROGRESS.md)`,
  );

  if (config.aiPlanRequired) {
    lines.push('2. Write a ### Plan subsection under the task heading before coding');
    lines.push('3. Implement the task');
    lines.push('4. Move the task to DONE.md when complete');
  } else {
    lines.push('2. Implement the task');
    lines.push('3. Move the task to DONE.md when complete');
  }

  lines.push(
    '',
    'Refer to .tasks/config.json and the repository AGENTS.md or CLAUDE.md for project conventions.',
  );

  return lines.join('\n');
}
