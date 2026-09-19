import { Task } from '../model/task.js';
import { isReservedAttributeKey, isSectionSeparatorLine, taskHeadingIdOf } from './taskParser.js';

const LINE_BREAK = /\r?\n/;
const ATTRIBUTE_DELIMITER = '|';
const UNUSABLE_KEY_CHARACTERS = /[|:*]/;

// WHY: these values are often model output, and a newline in one closes the section and opens a second task on the line after it.
function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function endsTheSection(line: string): boolean {
  return isSectionSeparatorLine(line) || taskHeadingIdOf(line) !== undefined;
}

function bodyOrThrow(field: 'description' | 'plan', value: string): string {
  const body = value.trim();
  if (body.split(LINE_BREAK).some(endsTheSection)) {
    throw new Error(
      `Task ${field} contains a line that would end the task section; remove the separator or heading before serializing.`,
    );
  }
  return body;
}

function attributeLineOrThrow(rawKey: string, rawValue: string): string {
  const key = oneLine(rawKey);
  const value = oneLine(rawValue);

  if (key.length === 0) {
    throw new Error('Task attribute name is empty; every attribute needs a name.');
  }
  if (UNUSABLE_KEY_CHARACTERS.test(key)) {
    throw new Error(
      `Task attribute name "${key}" contains one of | : *, which the metadata line cannot represent; rename the attribute before serializing.`,
    );
  }
  if (isReservedAttributeKey(key)) {
    throw new Error(
      `Task attribute "${key}" is the name of a built-in field and would overwrite it when read back; rename the attribute before serializing.`,
    );
  }
  if (value.includes(ATTRIBUTE_DELIMITER)) {
    throw new Error(
      `Task attribute "${key}" has a value containing "${ATTRIBUTE_DELIMITER}", which separates metadata fields and would truncate it when read back; remove it before serializing.`,
    );
  }

  return `**${key}:** ${value}`;
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
    lines.push(attributeLineOrThrow(key, value));
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
