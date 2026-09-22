import { Task } from '../model/task.js';
import { BoardSegment } from '../model/parseResult.js';
import { endsTaskSection, isReservedAttributeKey } from './grammar.js';

const GROUP_JOIN = ' | ';
const UNUSABLE_KEY_CHARACTERS = /[|:*]/;

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function bodyOrThrow(field: 'description' | 'plan', value: string): string {
  const body = value.trim();
  if (endsTaskSection(body)) {
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

  return `**${key}:** ${value}`;
}

export function serializeTask(task: Task): string {
  const lines: string[] = [`## ${oneLine(task.id)}: ${oneLine(task.title)}`];

  const group: string[] = [`**Priority:** ${task.priority}`];
  if (task.tags.length > 0) group.push(`**Tags:** ${task.tags.map(oneLine).join(', ')}`);
  if (task.epic) group.push(`**Epic:** ${oneLine(task.epic)}`);
  if (task.assignee) group.push(`**Assignee:** ${oneLine(task.assignee)}`);
  lines.push(group.join(GROUP_JOIN));

  if (task.updatedAt) lines.push(`**Updated:** ${oneLine(task.updatedAt)}`);
  if (task.waitingUntil) lines.push(`**Waiting until:** ${oneLine(task.waitingUntil)}`);
  for (const [key, value] of Object.entries(task.attributes ?? {})) {
    lines.push(attributeLineOrThrow(key, value));
  }

  if (task.description.trim()) {
    lines.push('', bodyOrThrow('description', task.description));
  }
  if (task.plan?.trim()) {
    lines.push('', '### Plan', '', bodyOrThrow('plan', task.plan));
  }

  return lines.join('\n');
}

export function serializeStateFile(stateName: string, tasks: Task[]): string {
  const lines: string[] = [`# ${stateName}`, ''];
  if (tasks.length === 0) return lines.join('\n');

  for (const task of tasks) {
    lines.push(serializeTask(task), '', '---', '');
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

function afterBlankLine(content: string, lineEnding: string): string {
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
): Map<string, OriginalSection> {
  const originals = new Map<string, OriginalSection>();
  for (let i = firstTaskAt; i < segments.length; i++) {
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

export function serializeBoard(segments: BoardSegment[], tasks: Task[]): string {
  const whole = segments.map((segment) => segment.raw).join('');
  const lineEnding = lineEndingOf(whole);
  const taskIndexes = segments.flatMap((segment, i) => (segment.kind === 'task' ? [i] : []));

  if (taskIndexes.length === 0) {
    return tasks.reduce(
      (acc, task) => afterBlankLine(acc, lineEnding) + freshSection(task, lineEnding),
      whole,
    );
  }

  const firstTaskAt = taskIndexes[0];
  const lastTaskAt = taskIndexes[taskIndexes.length - 1];
  const join = (from: number, to: number) =>
    segments
      .slice(from, to)
      .map((segment) => segment.raw)
      .join('');
  const originals = originalSections(segments, firstTaskAt);

  let out = join(0, firstTaskAt);
  for (const task of tasks) {
    const original = originals.get(task.id);
    if (!original) {
      out = afterBlankLine(out, lineEnding) + freshSection(task, lineEnding);
      continue;
    }
    out += original.leading;
    out += sameTask(original.task, task) ? original.raw : freshSection(task, lineEnding);
  }
  return out + join(lastTaskAt + 1, segments.length);
}
