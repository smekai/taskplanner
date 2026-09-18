import { Task } from '../model/task.js';

const SECTION_BREAK_RE = /^(?:---\s*|## [A-Z]+-\d+:.*)$/m;

// WHY: these values are often model output, and a newline in one closes the section and opens a second task on the line after it.
function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function bodyOrThrow(field: 'description' | 'plan', value: string): string {
  const body = value.trim();
  if (SECTION_BREAK_RE.test(body)) {
    throw new Error(
      `Task ${field} contains a line that would end the task section; remove the separator or heading before serializing.`,
    );
  }
  return body;
}

export function serializeTask(task: Task): string {
  const lines: string[] = [];

  lines.push(`## ${oneLine(task.id)}: ${oneLine(task.title)}`);

  const metaParts: string[] = [`**Priority:** ${task.priority}`];
  if (task.tags.length > 0) {
    metaParts.push(`**Tags:** ${task.tags.map(oneLine).join(', ')}`);
  }
  if (task.epic) {
    metaParts.push(`**Epic:** ${oneLine(task.epic)}`);
  }
  if (task.assignee) {
    metaParts.push(`**Assignee:** ${oneLine(task.assignee)}`);
  }
  lines.push(metaParts.join(' | '));

  if (task.updatedAt) {
    lines.push(`**Updated:** ${oneLine(task.updatedAt)}`);
  }

  if (task.waitingUntil) {
    lines.push(`**Waiting until:** ${oneLine(task.waitingUntil)}`);
  }

  for (const [key, value] of Object.entries(task.attributes ?? {})) {
    lines.push(`**${oneLine(key)}:** ${oneLine(value)}`);
  }

  if (task.description.trim()) {
    lines.push('');
    lines.push(bodyOrThrow('description', task.description));
  }

  if (task.plan?.trim()) {
    lines.push('');
    lines.push('### Plan');
    lines.push('');
    lines.push(bodyOrThrow('plan', task.plan));
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
