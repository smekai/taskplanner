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
    lines.push(
      'Plan this task before implementation. During planning, work read-only: inspect the repository, ask any required questions, and present a proposed plan. Do not modify files or start implementation until the user approves the plan.',
      '',
    );
  }

  lines.push(`Implement task ${task.id}: ${task.title}`, '', meta.join(' | '), '');

  if (task.description.trim()) {
    lines.push('Description:', task.description.trim(), '');
  }

  if (task.plan?.trim()) {
    lines.push('Existing plan:', task.plan.trim(), '');
  }

  if (config.aiPlanRequired) {
    lines.push(
      'Planning phase (read-only):',
      '1. Inspect the repository and task context without changing files',
      task.plan?.trim()
        ? '2. Review and refine the existing plan; do not silently replace it'
        : '2. Propose a concise implementation plan',
      '3. Stop and wait for explicit user approval',
      '',
      'After approval:',
      `4. Move the task from ${stateName} to In Progress (cut from source .tasks/ file, paste into IN_PROGRESS.md)`,
      '5. Save the approved plan as a ### Plan subsection under the task heading before coding',
      '6. Implement the task',
      '7. Verify the implementation',
      '8. Move the task to DONE.md when complete',
    );
  } else {
    lines.push(
      'Workflow:',
      `1. Move the task from ${stateName} to In Progress (cut from source .tasks/ file, paste into IN_PROGRESS.md)`,
      '2. Implement the task',
      '3. Verify the implementation',
      '4. Move the task to DONE.md when complete',
    );
  }

  lines.push(
    '',
    'Refer to .tasks/config.json and the repository AGENTS.md or CLAUDE.md for project conventions.',
  );

  return lines.join('\n');
}
