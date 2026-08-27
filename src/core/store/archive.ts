import { Task } from '../model/task.js';
import { daysSince, parseTimestamp } from '../util/time.js';

export const UNDATED_ARCHIVE_FILE = 'DONE-undated.md';
export const UNDATED_WORK_LOG_ARCHIVE_FILE = 'WORK_LOG-undated.md';

export interface ArchiveResult {
  archived: number;
  files: string[];
}

function halfYearSuffix(date: Date): string {
  return `${date.getUTCFullYear()}-H${date.getUTCMonth() < 6 ? 1 : 2}`;
}

export function archiveFileFor(task: Task): string {
  const date = parseTimestamp(task.updatedAt);
  return date === null ? UNDATED_ARCHIVE_FILE : `DONE-${halfYearSuffix(date)}.md`;
}

export function archiveHeadingFor(fileName: string): string {
  if (fileName === UNDATED_ARCHIVE_FILE) return 'Done — undated';
  const match = /^DONE-(\d{4})-H([12])\.md$/.exec(fileName);
  return match ? `Done — ${match[1]} H${match[2]}` : 'Done — archived';
}

/**
 * An unset or non-positive threshold disables archiving entirely: upgrading TaskPlanner must never
 * reshuffle a board nobody asked it to touch. An undatable task counts as old enough — unknown-age
 * history is still history.
 */
export function isDateArchivable(
  value: string | undefined,
  afterDays: number,
  now = new Date(),
): boolean {
  if (!(afterDays > 0)) return false;
  const age = daysSince(value, now);
  return age === null || age >= afterDays;
}

export function isArchivable(task: Task, afterDays: number, now = new Date()): boolean {
  return isDateArchivable(task.updatedAt, afterDays, now);
}

export function planArchive(
  tasks: Task[],
  afterDays: number,
  now = new Date(),
): { keep: Task[]; byFile: Map<string, Task[]> } {
  const keep: Task[] = [];
  const byFile = new Map<string, Task[]>();

  for (const task of tasks) {
    if (!isArchivable(task, afterDays, now)) {
      keep.push(task);
      continue;
    }
    const fileName = archiveFileFor(task);
    const bucket = byFile.get(fileName) ?? [];
    bucket.push(task);
    byFile.set(fileName, bucket);
  }

  return { keep, byFile };
}

export interface WorkLogEntry {
  id: string;
  date: string;
  text: string;
}

/** Splits WORK_LOG.md into its header and its entries, keeping each entry's text verbatim. */
export function splitWorkLog(content: string): { header: string; entries: WorkLogEntry[] } {
  const lines = content.split('\n');
  // Demanding a real ID and date is what keeps the template block in the file header from
  // being read as an entry.
  const heading = /^## ([A-Z]+-\d+) — (\d{4}-\d{2}-\d{2})\s*$/;

  const starts: number[] = [];
  lines.forEach((line, index) => {
    if (heading.test(line)) starts.push(index);
  });

  if (starts.length === 0) return { header: content, entries: [] };

  const entries: WorkLogEntry[] = [];
  for (let i = 0; i < starts.length; i += 1) {
    const from = starts[i];
    const to = i + 1 < starts.length ? starts[i + 1] : lines.length;
    const match = heading.exec(lines[from]);
    entries.push({
      id: match![1],
      date: match![2],
      text: lines.slice(from, to).join('\n').replace(/\s+$/, ''),
    });
  }

  return { header: lines.slice(0, starts[0]).join('\n').replace(/\s+$/, ''), entries };
}

export function workLogArchiveFileFor(entry: WorkLogEntry): string {
  const date = parseTimestamp(entry.date);
  return date === null ? UNDATED_WORK_LOG_ARCHIVE_FILE : `WORK_LOG-${halfYearSuffix(date)}.md`;
}

export function joinWorkLog(header: string, entries: WorkLogEntry[]): string {
  const body = entries.map((entry) => entry.text).join('\n\n');
  return `${header}\n\n${body}\n`.replace(/\n{4,}/g, '\n\n\n');
}
