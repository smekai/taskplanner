import { Task } from '../model/task.js';
import { serializeTask } from './taskSerializer.js';

export type InsertPosition = 'top' | 'bottom';

export interface RemovedTask {
  content: string;
  section?: string;
}

interface SectionBounds {
  start: number;
  end: number;
}

const SECTION_END_RE = /^---[ \t]*(?:\r?\n|$)/gm;

function escaped(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lineEndingOf(content: string): '\r\n' | '\n' {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

function withLineEnding(content: string, lineEnding: '\r\n' | '\n'): string {
  return content.replace(/\r\n|\n/g, lineEnding);
}

function sectionBounds(content: string, taskId: string): SectionBounds | undefined {
  const heading = new RegExp(`^##\\s+${escaped(taskId)}:.*$`, 'm').exec(content);
  if (!heading) return undefined;

  SECTION_END_RE.lastIndex = heading.index + heading[0].length;
  const end = SECTION_END_RE.exec(content);
  if (!end) return undefined;

  return { start: heading.index, end: end.index + end[0].length };
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

  return bounds
    ? `${rawContent.slice(0, bounds.start)}${section}${rawContent.slice(bounds.end)}`
    : insertSection(rawContent, section, position, lineEnding);
}

export function removeTask(rawContent: string, taskId: string): RemovedTask {
  const bounds = sectionBounds(rawContent, taskId);
  if (!bounds) return { content: rawContent };

  return {
    content: `${rawContent.slice(0, bounds.start)}${rawContent.slice(bounds.end)}`,
    section: rawContent.slice(bounds.start, bounds.end),
  };
}
