import { Task } from '../model/task.js';
import { BoardSegment } from '../model/parseResult.js';
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

function lineEndingOf(content: string): '\r\n' | '\n' {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

function freshSection(task: Task, lineEnding: string): string {
  const body = serializeTask(task).replace(/\n/g, lineEnding);
  return `${body}${lineEnding}${lineEnding}---${lineEnding}`;
}

function endsWithBlankLine(content: string, lineEnding: string): string {
  if (content.length === 0 || content.endsWith(lineEnding + lineEnding)) return content;
  return content.endsWith(lineEnding) ? content + lineEnding : content + lineEnding + lineEnding;
}

function sameTags(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((tag, index) => tag === b[index]);
}

function sameAttributes(a: Record<string, string> = {}, b: Record<string, string> = {}): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

function sameTask(a: Task, b: Task): boolean {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.description === b.description &&
    a.priority === b.priority &&
    a.epic === b.epic &&
    a.assignee === b.assignee &&
    a.updatedAt === b.updatedAt &&
    a.waitingUntil === b.waitingUntil &&
    (a.plan ?? '') === (b.plan ?? '') &&
    sameTags(a.tags, b.tags) &&
    sameAttributes(a.attributes, b.attributes)
  );
}

interface OriginalSection {
  raw: string;
  task: Task;
  leading: string;
}

function originalSections(
  segments: BoardSegment[],
  firstTaskAt: number,
  lastTaskAt: number,
): Map<string, OriginalSection> {
  const originals = new Map<string, OriginalSection>();
  for (let i = firstTaskAt; i <= lastTaskAt; i++) {
    const segment = segments[i];
    if (segment.kind !== 'task') continue;
    const before = segments[i - 1];
    const leading = i > firstTaskAt && before?.kind === 'text' ? before.raw : '';
    if (!originals.has(segment.task.id)) {
      originals.set(segment.task.id, { raw: segment.raw, task: segment.task, leading });
    }
  }
  return originals;
}

// WHY: only the tasks in a state file are parsed, so writing through the segments is what keeps prose, comments and refused sections on disk.
export function serializeBoard(segments: BoardSegment[], tasks: Task[]): string {
  const whole = segments.map((segment) => segment.raw).join('');
  const lineEnding = lineEndingOf(whole);
  const firstTaskAt = segments.findIndex((segment) => segment.kind === 'task');

  if (firstTaskAt === -1) {
    return tasks.reduce(
      (acc, task) => endsWithBlankLine(acc, lineEnding) + freshSection(task, lineEnding),
      whole,
    );
  }

  let lastTaskAt = firstTaskAt;
  for (let i = segments.length - 1; i > firstTaskAt; i--) {
    if (segments[i].kind === 'task') {
      lastTaskAt = i;
      break;
    }
  }

  const join = (from: number, to: number) =>
    segments
      .slice(from, to)
      .map((segment) => segment.raw)
      .join('');
  const originals = originalSections(segments, firstTaskAt, lastTaskAt);

  let out = join(0, firstTaskAt);
  for (const task of tasks) {
    const original = originals.get(task.id);
    if (!original) {
      out = endsWithBlankLine(out, lineEnding) + freshSection(task, lineEnding);
      continue;
    }
    out += original.leading;
    out += sameTask(original.task, task) ? original.raw : freshSection(task, lineEnding);
  }
  return out + join(lastTaskAt + 1, segments.length);
}
