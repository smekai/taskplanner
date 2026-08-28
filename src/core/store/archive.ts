import { Task } from '../model/task.js';
import { daysSince, parseTimestamp } from '../util/time.js';

export interface ArchiveKind {
  filePrefix: string;
  label: string;
}

export const TASK_ARCHIVE: ArchiveKind = { filePrefix: 'DONE', label: 'Done' };
export const WORK_LOG_ARCHIVE: ArchiveKind = { filePrefix: 'WORK_LOG', label: 'Work log' };

const UNDATED_BUCKET = 'undated';
const ARCHIVE_FILE_RE = /^(DONE|WORK_LOG)-(undated|\d{4})\.md$/;

export interface ArchiveResult {
  archived: number;
  files: string[];
}

export function archiveFileName(kind: ArchiveKind, date: string | undefined): string {
  const parsed = parseTimestamp(date);
  const bucket = parsed === null ? UNDATED_BUCKET : String(parsed.getUTCFullYear());
  return `${kind.filePrefix}-${bucket}.md`;
}

export function archiveHeading(fileName: string): string {
  const match = ARCHIVE_FILE_RE.exec(fileName);
  if (!match) return 'Archived';

  const [, filePrefix, bucket] = match;
  const kind = filePrefix === WORK_LOG_ARCHIVE.filePrefix ? WORK_LOG_ARCHIVE : TASK_ARCHIVE;
  return `${kind.label} — ${bucket}`;
}

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
    const fileName = archiveFileName(TASK_ARCHIVE, task.updatedAt);
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

export function splitWorkLog(content: string): { header: string; entries: WorkLogEntry[] } {
  const lines = content.split('\n');
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

export function joinWorkLog(header: string, entries: WorkLogEntry[]): string {
  const body = entries.map((entry) => entry.text).join('\n\n');
  return `${header}\n\n${body}\n`.replace(/\n{4,}/g, '\n\n\n');
}
