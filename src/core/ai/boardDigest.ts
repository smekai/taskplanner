import { Task } from '../model/task.js';
import { isWaiting } from '../util/time.js';

export interface BoardDigestState {
  name: string;
  tasks: Task[];
}

export interface BoardDigestOptions {
  includeTasks?: boolean;
  descriptionLimit?: number;
  now?: Date;
}

export function renderBoardDigest(
  states: BoardDigestState[],
  options: BoardDigestOptions = {},
): string {
  const lines = ['# Task Board'];
  for (const state of states) {
    lines.push('', `## ${state.name} (${state.tasks.length})`);
    if (!options.includeTasks) continue;
    for (const task of state.tasks) {
      lines.push(`- ${digestLine(task, options)}`);
    }
  }
  return lines.join('\n');
}

function digestLine(task: Task, options: BoardDigestOptions): string {
  const parts = [`**${task.id}**: ${oneLine(task.title)}`, `[${task.priority}]`];
  if (task.epic) parts.push(`epic ${oneLine(task.epic)}`);
  if (task.assignee) parts.push(`@${oneLine(task.assignee)}`);
  if (isWaiting(task.waitingUntil, options.now)) {
    parts.push(`⏳ waiting until ${task.waitingUntil}`);
  }
  const description = excerpt(task.description, options.descriptionLimit ?? 0);
  return description ? `${parts.join(' ')} — ${description}` : parts.join(' ');
}

function excerpt(description: string, limit: number): string {
  return limit > 0 ? oneLine(description).slice(0, limit) : '';
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
