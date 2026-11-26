import { Task, Priority } from '../model/task.js';
import { ParseIssue } from '../model/parseResult.js';
import { isValidCron } from '../util/cron.js';
import {
  BuiltInField,
  LINE_BREAK,
  PRIORITY_VALUES,
  attributeOf,
  builtInFieldOf,
  isPlanHeadingLine,
  isRunsHeadingLine,
  isSectionSeparatorLine,
  runEntryOf,
  parsePriority,
  splitFieldGroup,
  taskHeadingOf,
} from './grammar.js';

const MISSING_PRIORITY = Priority.P4;

interface SectionParse {
  task?: Task;
  errors: ParseIssue[];
  warnings: ParseIssue[];
}

interface Collected {
  fields: Partial<Record<BuiltInField, string>>;
  attributes: Record<string, string>;
  description: string[];
  plan: string[];
  runs: string[];
}

type Body = 'description' | 'plan' | 'runs';

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

interface FieldLines {
  priority: number;
  repeats: number;
}

function readMetadata(
  lines: string[],
  collected: Collected,
  startLine: number,
): { bodyFrom: number; fieldLines: FieldLines } {
  const fieldLines = { priority: startLine, repeats: startLine };
  for (const [index, line] of lines.entries()) {
    if (isSectionSeparatorLine(line) || !readFieldOrFieldGroup(collected, line)) {
      return { bodyFrom: index, fieldLines };
    }
    const lineNumber = startLine + index + 1;
    if (collected.fields.priority !== undefined && fieldLines.priority === startLine) {
      fieldLines.priority = lineNumber;
    }
    if (collected.fields.repeats !== undefined && fieldLines.repeats === startLine) {
      fieldLines.repeats = lineNumber;
    }
  }
  return { bodyFrom: lines.length, fieldLines };
}

function keepsRunHistory(collected: Collected): boolean {
  return collected.fields.repeats !== undefined || collected.fields.lastRun !== undefined;
}

function readBody(lines: string[], collected: Collected): void {
  const [first, ...rest] = lines;
  let body: Body = 'description';
  for (const line of first?.trim() === '' ? rest : lines) {
    if (isSectionSeparatorLine(line)) return;
    if (isPlanHeadingLine(line)) {
      body = 'plan';
    } else if (isRunsHeadingLine(line) && keepsRunHistory(collected)) {
      body = 'runs';
    } else if (body === 'runs') {
      const entry = runEntryOf(line);
      if (entry !== undefined) collected.runs.push(entry);
    } else {
      collected[body].push(line);
    }
  }
}

function scheduleWarning(repeats: string | undefined, line: number): ParseIssue[] {
  if (repeats === undefined || isValidCron(repeats)) return [];
  return [
    {
      line,
      message: `**Repeats:** "${repeats}" is not a cron schedule, so the task is never due; expected 5 fields in UTC such as "0 7 * * *", or @daily.`,
    },
  ];
}

export function parseTaskSection(raw: string, startLine: number): SectionParse {
  const errors: ParseIssue[] = [];
  const [headingLine = '', ...bodyLines] = raw.split(LINE_BREAK);
  const heading = taskHeadingOf(headingLine);
  if (!heading) {
    return { errors, warnings: [] };
  }

  const collected: Collected = {
    fields: {},
    attributes: {},
    description: [],
    plan: [],
    runs: [],
  };
  const { bodyFrom, fieldLines } = readMetadata(bodyLines, collected, startLine);
  readBody(bodyLines.slice(bodyFrom), collected);
  const { fields } = collected;
  const warnings = scheduleWarning(fields.repeats, fieldLines.repeats);

  const plan = collected.plan.join('\n').trim();
  const task: Task = {
    id: heading.id,
    title: heading.title,
    description: collected.description.join('\n').trim(),
    priority: priorityOf(fields.priority, fieldLines.priority, errors, warnings),
    tags: tagsOf(fields.tags),
    epic: fields.epic,
    assignee: fields.assignee,
    updatedAt: fields.updatedAt,
    waitingUntil: fields.waitingUntil,
    ...(fields.repeats !== undefined ? { repeats: fields.repeats } : {}),
    ...(fields.lastRun !== undefined ? { lastRun: fields.lastRun } : {}),
    ...(plan ? { plan } : {}),
    ...(collected.runs.length > 0 ? { runs: collected.runs } : {}),
    ...(Object.keys(collected.attributes).length > 0 ? { attributes: collected.attributes } : {}),
  };

  return { task, errors, warnings };
}
