import { Task } from '../model/task.js';

export function serializeTask(task: Task): string {
  const lines: string[] = [];

  lines.push(`## ${task.id}: ${task.title}`);

  const metaParts: string[] = [`**Priority:** ${task.priority}`];
  if (task.tags.length > 0) {
    metaParts.push(`**Tags:** ${task.tags.join(', ')}`);
  }
  if (task.epic) {
    metaParts.push(`**Epic:** ${task.epic}`);
  }
  if (task.assignee) {
    metaParts.push(`**Assignee:** ${task.assignee}`);
  }
  lines.push(metaParts.join(' | '));

  if (task.updatedAt) {
    lines.push(`**Updated:** ${task.updatedAt}`);
  }

  if (task.waitingUntil) {
    lines.push(`**Waiting until:** ${task.waitingUntil}`);
  }

  if (task.description.trim()) {
    lines.push('');
    lines.push(task.description.trim());
  }

  if (task.plan?.trim()) {
    lines.push('');
    lines.push('### Plan');
    lines.push('');
    lines.push(task.plan.trim());
  }

  return lines.join('\n');
}

export function serializeStateFile(stateName: string, tasks: Task[]): string {
  const lines: string[] = [`# ${stateName}`, ''];

  if (tasks.length === 0) {
    return lines.join('\n');
  }

  for (let i = 0; i < tasks.length; i++) {
    lines.push(serializeTask(tasks[i]));
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}
