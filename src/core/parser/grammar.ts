import { Priority } from '../model/task.js';

// WHY: `.` excludes a carriage return and `$` does not forgive a trailing one, so an unsplit CRLF board matched no heading and read back as empty rather than as broken.
export const LINE_BREAK = /\r?\n/;

const TASK_HEADING_RE = /^## ([A-Z]+-\d+):\s*(.+)$/;
const SEPARATOR_RE = /^---\s*$/;
const PLAN_HEADING_RE = /^### Plan\s*$/;
const ATTRIBUTE_RE = /^\*\*(.+?):\*\*\s*(.*)$/;

// WHY: a group separator is only a separator when another field follows it, so a value may contain a bare pipe.
const GROUP_SEPARATOR = /\s\|\s(?=\*\*)/;

export interface FieldMatch {
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
} as const;

export type BuiltInField = keyof typeof BUILT_IN_FIELD_RES;

export function taskHeadingIdOf(line: string): string | undefined {
  return line.match(TASK_HEADING_RE)?.[1];
}

export function taskHeadingOf(line: string): { id: string; title: string } | undefined {
  const match = line.match(TASK_HEADING_RE);
  return match ? { id: match[1], title: match[2].trim() } : undefined;
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

export function isFileHeadingLine(line: string): boolean {
  return /^#\s/.test(line);
}

export function builtInFieldOf(
  segment: string,
): { field: BuiltInField; value: string } | undefined {
  for (const [field, pattern] of Object.entries(BUILT_IN_FIELD_RES)) {
    const match = segment.match(pattern);
    if (match) return { field: field as BuiltInField, value: match[1].trim() };
  }
  return undefined;
}

export function attributeOf(segment: string): FieldMatch | undefined {
  const match = segment.match(ATTRIBUTE_RE);
  return match ? { key: match[1].trim(), value: match[2].trim() } : undefined;
}

// WHY: asking the built-in patterns whether they would claim the line keeps this from drifting when a field is added.
export function isReservedAttributeKey(key: string): boolean {
  return builtInFieldOf(`**${key}:** probe`) !== undefined;
}

export function splitFieldGroup(line: string): string[] {
  return line.split(GROUP_SEPARATOR).map((segment) => segment.trim());
}

export const PRIORITY_VALUES: readonly Priority[] = Object.values(Priority);

export function parsePriority(value: string): Priority | undefined {
  const normalized = value.trim().toUpperCase();
  return PRIORITY_VALUES.find((priority) => priority === normalized);
}
