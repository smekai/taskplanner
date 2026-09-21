import { Task } from '../model/task.js';
import { BoardSegment, ParseIssue, ParseResult } from '../model/parseResult.js';
import { LINE_BREAK, looksLikeTaskHeading, taskHeadingIdOf } from './grammar.js';
import { RawSection, splitSections } from './boardSections.js';
import { parseTaskSection } from './taskSection.js';

const BOM = '﻿';

function stripBom(content: string): string {
  return content.startsWith(BOM) ? content.slice(1) : content;
}

function brokenHeadings(section: RawSection): ParseIssue[] {
  const lines = section.raw.split(LINE_BREAK);
  const starts = lines
    .map((line, index) => (looksLikeTaskHeading(line) ? index : -1))
    .filter((index) => index !== -1);

  return starts.map((start, nth) => ({
    line: section.line + start,
    message: `"${lines[start].trim()}" is not a task heading, so this section was not read as a task. Use "## PREFIX-000: Title" with an uppercase prefix, digits, and a title.`,
    raw: lines.slice(start, starts[nth + 1] ?? lines.length).join('\n'),
  }));
}

export function parseTasks(rawContent: string): ParseResult {
  const content = stripBom(rawContent);
  const tasks: Task[] = [];
  const errors: ParseIssue[] = [];
  const warnings: ParseIssue[] = [];
  const segments: BoardSegment[] = [];
  if (rawContent.startsWith(BOM)) {
    segments.push({ kind: 'text', raw: BOM });
  }

  for (const section of splitSections(content)) {
    if (section.kind === 'text') {
      errors.push(...brokenHeadings(section));
      segments.push({ kind: 'text', raw: section.raw });
      continue;
    }

    const parsed = parseTaskSection(section.raw, section.line);
    errors.push(...parsed.errors);
    warnings.push(...parsed.warnings);
    if (parsed.task) {
      tasks.push(parsed.task);
      segments.push({ kind: 'task', task: parsed.task, raw: section.raw });
      continue;
    }
    errors.push(...brokenHeadings(section));
    segments.push({ kind: 'text', raw: section.raw });
  }

  return { tasks, errors, warnings, segments };
}

export function findTaskLineNumber(content: string, taskId: string): number {
  const lines = stripBom(content).split(LINE_BREAK);
  const at = lines.findIndex((line) => taskHeadingIdOf(line) === taskId);
  return at === -1 ? 1 : at + 1;
}

function headingIds(rawContent: string): string[] {
  return stripBom(rawContent)
    .split(LINE_BREAK)
    .map(taskHeadingIdOf)
    .filter((id): id is string => id !== undefined);
}

export function countTaskHeadings(rawContent: string): number {
  return headingIds(rawContent).length;
}

export function taskIdsIn(rawContent: string): Set<string> {
  return new Set(headingIds(rawContent));
}

export function maxTaskIdNumber(rawContent: string, prefix: string): number {
  let max = 0;
  for (const id of headingIds(rawContent)) {
    const [idPrefix, digits] = [
      id.slice(0, id.lastIndexOf('-')),
      id.slice(id.lastIndexOf('-') + 1),
    ];
    if (idPrefix !== prefix) continue;
    const n = parseInt(digits, 10);
    if (n > max) max = n;
  }
  return max;
}
