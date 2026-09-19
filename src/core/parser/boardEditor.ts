import { Task } from '../model/task.js';
import { isSectionSeparatorLine, taskHeadingIdOf } from './taskParser.js';
import { serializeTask } from './taskSerializer.js';

export type InsertPosition = 'top' | 'bottom';

export interface RemovedTask {
  content: string;
  section?: string;
}

interface SectionBounds {
  start: number;
  end: number;
  separated: boolean;
}

interface LineSpan {
  text: string;
  start: number;
  end: number;
}

function lineSpans(content: string): LineSpan[] {
  const spans: LineSpan[] = [];
  let start = 0;
  while (start <= content.length) {
    const brk = content.indexOf('\n', start);
    const stop = brk === -1 ? content.length : brk;
    spans.push({
      text: content.slice(start, stop).replace(/\r$/, ''),
      start,
      end: brk === -1 ? stop : brk + 1,
    });
    if (brk === -1) break;
    start = brk + 1;
  }
  return spans;
}

function lineEndingOf(content: string): '\r\n' | '\n' {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

function withLineEnding(content: string, lineEnding: '\r\n' | '\n'): string {
  return content.replace(/\r\n|\n/g, lineEnding);
}

// WHY: a section runs to its separator, but an unterminated one ends where the next task begins — the boundary parseTasks uses, so an edit never reaches into a neighbour.
function sectionBounds(content: string, taskId: string): SectionBounds | undefined {
  const spans = lineSpans(content);
  const headingAt = spans.findIndex((span) => taskHeadingIdOf(span.text) === taskId);
  if (headingAt === -1) return undefined;

  const start = spans[headingAt].start;
  for (const span of spans.slice(headingAt + 1)) {
    if (isSectionSeparatorLine(span.text)) return { start, end: span.end, separated: true };
    if (taskHeadingIdOf(span.text) !== undefined) {
      return { start, end: span.start, separated: false };
    }
  }
  return { start, end: content.length, separated: false };
}

function insertSection(
  content: string,
  section: string,
  position: InsertPosition,
  lineEnding: '\r\n' | '\n',
): string {
  if (position === 'bottom') {
    const separator = content.endsWith(lineEnding)
      ? content.endsWith(`${lineEnding}${lineEnding}`)
        ? ''
        : lineEnding
      : `${lineEnding}${lineEnding}`;
    return `${content}${separator}${section}`;
  }

  // WHY: the first line is the state heading, so a new task goes after it rather than above it.
  const headingEnd = content.indexOf(lineEnding);
  if (headingEnd === -1) {
    return `${content}${lineEnding}${lineEnding}${section}`;
  }
  const afterHeading = headingEnd + lineEnding.length;
  return `${content.slice(0, afterHeading)}${lineEnding}${section}${content.slice(afterHeading)}`;
}

export function upsertTask(
  rawContent: string,
  task: Task,
  position: InsertPosition = 'top',
): string {
  const lineEnding = lineEndingOf(rawContent);
  const section = withLineEnding(`${serializeTask(task)}\n\n---\n`, lineEnding);
  const bounds = sectionBounds(rawContent, task.id);
  if (!bounds) return insertSection(rawContent, section, position, lineEnding);

  const spacer = bounds.separated ? '' : lineEnding;
  return `${rawContent.slice(0, bounds.start)}${section}${spacer}${rawContent.slice(bounds.end)}`;
}

export function removeTask(rawContent: string, taskId: string): RemovedTask {
  const bounds = sectionBounds(rawContent, taskId);
  if (!bounds) return { content: rawContent };

  return {
    content: `${rawContent.slice(0, bounds.start)}${rawContent.slice(bounds.end)}`,
    section: rawContent.slice(bounds.start, bounds.end),
  };
}
