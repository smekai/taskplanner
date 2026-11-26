import { Priority } from '../model/task.js';

// WHY: `.` excludes a carriage return and `$` does not forgive a trailing one, so an unsplit CRLF board matched no heading and read back as empty rather than as broken.
export const LINE_BREAK = /\r?\n/;

const TASK_HEADING_RE = /^## ([A-Z]+-\d+):\s*(\S.*)$/;
const SEPARATOR_RE = /^---\s*$/;
const PLAN_HEADING_RE = /^### Plan\s*$/;
const RUNS_HEADING_RE = /^### Runs\s*$/;
const RUN_ITEM_RE = /^\s*[-*]\s+/;
const ATTRIBUTE_RE = /^\*\*(.+?):\*\*\s*(.*)$/;

const SEPARATOR_BEFORE_NEXT_FIELD = /\s\|\s(?=\*\*)/;

interface FieldMatch {
  key: string;
  value: string;
}

const BUILT_IN_FIELD_RES = {
  priority: /^\*\*Priority:\*\*\s*(\S*)/,
  tags: /^\*\*Tags?:\*\*\s*(.+)/,
  epic: /^\*\*Epic:\*\*\s*(.+)/,
  assignee: /^\*\*Assignee:\*\*\s*(.+)/,
  updatedAt: /^\*\*Updated:\*\*\s*(.+)/,
  waitingUntil: /^\*\*Waiting until:\*\*\s*(.+)/,
  repeats: /^\*\*Repeats:\*\*\s*(.+)/,
  lastRun: /^\*\*Last run:\*\*\s*(.+)/,
} as const;

export type BuiltInField = keyof typeof BUILT_IN_FIELD_RES;

export function taskHeadingOf(line: string): { id: string; title: string } | undefined {
  const [, id, title] = line.match(TASK_HEADING_RE) ?? [];
  return id !== undefined && title !== undefined ? { id, title: title.trim() } : undefined;
}

export function taskHeadingIdOf(line: string): string | undefined {
  return taskHeadingOf(line)?.id;
}

export function looksLikeTaskHeading(line: string): boolean {
  return /^##\s/.test(line) && !/^###/.test(line);
}

export function isSectionSeparatorLine(line: string): boolean {
  return SEPARATOR_RE.test(line);
}

export function isPlanHeadingLine(line: string): boolean {
  return PLAN_HEADING_RE.test(line);
}

export function isRunsHeadingLine(line: string): boolean {
  return RUNS_HEADING_RE.test(line);
}

export function runEntryOf(line: string): string | undefined {
  const entry = line.replace(RUN_ITEM_RE, '').trim();
  return entry.length > 0 ? entry : undefined;
}

export function containsRunsHeading(text: string): boolean {
  return text.split(LINE_BREAK).some(isRunsHeadingLine);
}

export function endsTaskSection(text: string): boolean {
  return text
    .trim()
    .split(LINE_BREAK)
    .some((line) => isSectionSeparatorLine(line) || taskHeadingIdOf(line) !== undefined);
}

export function builtInFieldOf(
  segment: string,
): { field: BuiltInField; value: string } | undefined {
  for (const [field, pattern] of Object.entries(BUILT_IN_FIELD_RES)) {
    const [, value] = segment.match(pattern) ?? [];
    if (value !== undefined) return { field: field as BuiltInField, value: value.trim() };
  }
  return undefined;
}

export function attributeOf(segment: string): FieldMatch | undefined {
  const [, key, value] = segment.match(ATTRIBUTE_RE) ?? [];
  return key !== undefined && value !== undefined
    ? { key: key.trim(), value: value.trim() }
    : undefined;
}

export function isReservedAttributeKey(key: string): boolean {
  return builtInFieldOf(`**${key}:** probe`) !== undefined;
}

export function splitFieldGroup(line: string): string[] {
  return line.split(SEPARATOR_BEFORE_NEXT_FIELD).map((segment) => segment.trim());
}

export const PRIORITY_VALUES: readonly Priority[] = Object.values(Priority);

export function parsePriority(value: string): Priority | undefined {
  const normalized = value.trim().toUpperCase();
  return PRIORITY_VALUES.find((priority) => priority === normalized);
}
