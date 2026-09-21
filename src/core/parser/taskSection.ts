import { Task, Priority } from '../model/task.js';
import { ParseIssue } from '../model/parseResult.js';
import {
  BuiltInField,
  LINE_BREAK,
  PRIORITY_VALUES,
  attributeOf,
  builtInFieldOf,
  isPlanHeadingLine,
  isSectionSeparatorLine,
  parsePriority,
  splitFieldGroup,
  taskHeadingOf,
} from './grammar.js';

export const MISSING_PRIORITY = Priority.P4;

export interface SectionParse {
  task?: Task;
  errors: ParseIssue[];
  warnings: ParseIssue[];
}

interface Collected {
  fields: Partial<Record<BuiltInField, string>>;
  attributes: Record<string, string>;
  description: string[];
  plan: string[];
}

function assign(collected: Collected, segment: string): boolean {
  const builtIn = builtInFieldOf(segment);
  if (builtIn) {
    collected.fields[builtIn.field] = builtIn.value;
    return true;
  }
  const attribute = attributeOf(segment);
  if (attribute) {
    collected.attributes[attribute.key] = attribute.value;
    return true;
  }
  return false;
}

function readFieldOrFieldGroup(collected: Collected, line: string): boolean {
  const segments = splitFieldGroup(line);
  let matched = false;
  for (const segment of segments) {
    if (assign(collected, segment)) matched = true;
  }
  return matched;
}

function tagsOf(raw: string | undefined): string[] {
  if (raw === undefined) return [];
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function priorityOf(
  raw: string | undefined,
  line: number,
  errors: ParseIssue[],
  warnings: ParseIssue[],
): Priority {
  if (raw === undefined) {
    warnings.push({ line, message: `No **Priority:** line; read as ${MISSING_PRIORITY}.` });
    return MISSING_PRIORITY;
  }
  const parsed = parsePriority(raw);
  if (parsed) return parsed;

  const valid = PRIORITY_VALUES.join(', ');
  const message =
    raw.length === 0
      ? `**Priority:** has no value; expected one of ${valid}.`
      : `**Priority:** "${raw}" is not a priority; expected one of ${valid}.`;
  errors.push({ line, message });
  return MISSING_PRIORITY;
}

export function parseTaskSection(raw: string, startLine: number): SectionParse {
  const lines = raw.split(LINE_BREAK);
  const errors: ParseIssue[] = [];
  const warnings: ParseIssue[] = [];

  const heading = taskHeadingOf(lines[0]);
  if (!heading) {
    return { errors, warnings };
  }

  const collected: Collected = { fields: {}, attributes: {}, description: [], plan: [] };
  let inMetadata = true;
  let inPlan = false;
  let priorityLine = startLine;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (isSectionSeparatorLine(line)) break;

    if (inMetadata) {
      if (readFieldOrFieldGroup(collected, line)) {
        if (collected.fields.priority !== undefined && priorityLine === startLine) {
          priorityLine = startLine + i;
        }
        continue;
      }
      inMetadata = false;
      if (line.trim() === '') continue;
    }

    if (isPlanHeadingLine(line)) {
      inPlan = true;
      continue;
    }
    (inPlan ? collected.plan : collected.description).push(line);
  }

  const plan = collected.plan.join('\n').trim();
  const task: Task = {
    id: heading.id,
    title: heading.title,
    description: collected.description.join('\n').trim(),
    priority: priorityOf(collected.fields.priority, priorityLine, errors, warnings),
    tags: tagsOf(collected.fields.tags),
    epic: collected.fields.epic,
    assignee: collected.fields.assignee,
    updatedAt: collected.fields.updatedAt,
    waitingUntil: collected.fields.waitingUntil,
    ...(plan ? { plan } : {}),
    ...(Object.keys(collected.attributes).length > 0 ? { attributes: collected.attributes } : {}),
  };

  return { task, errors, warnings };
}
