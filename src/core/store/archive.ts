import { Task } from '../model/task.js';

/** Bucket for completed tasks that carry no date at all. */
export const UNDATED_ARCHIVE_FILE = 'DONE-undated.md';

export interface ArchiveResult {
  /** How many sections left DONE.md. */
  archived: number;
  /** Archive file names that were written, for reporting. */
  files: string[];
}

/**
 * Archive file a task belongs in, bucketed by half-year so files stay findable and bounded.
 *
 * A task with no usable date goes to its own bucket rather than being given an invented one: it is
 * still archived, but the file name says the date is unknown instead of implying otherwise.
 */
export function archiveFileFor(task: Task): string {
  const date = task.updatedAt?.trim().slice(0, 10) ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return UNDATED_ARCHIVE_FILE;
  const [year, month] = date.split('-');
  return `DONE-${year}-H${Number(month) <= 6 ? 1 : 2}.md`;
}

/** Human-facing heading inside an archive file, derived from its name. */
export function archiveHeadingFor(fileName: string): string {
  if (fileName === UNDATED_ARCHIVE_FILE) return 'Done — undated';
  const match = /^DONE-(\d{4})-H([12])\.md$/.exec(fileName);
  return match ? `Done — ${match[1]} H${match[2]}` : 'Done — archived';
}

/**
 * Whether a completed task is old enough to archive.
 *
 * A task with no date counts as eligible: the board owner's call is that unknown-age history is
 * still history. `afterDays` of 0 or less disables archiving entirely, which is what an unset
 * config means — upgrading TaskPlanner must not reshuffle a board nobody asked it to touch.
 */
export function isDateArchivable(
  value: string | undefined,
  afterDays: number,
  now = new Date(),
): boolean {
  if (!Number.isFinite(afterDays) || afterDays <= 0) return false;

  const date = value?.trim().slice(0, 10) ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return true;

  const completed = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(completed)) return true;

  const ageDays = (now.getTime() - completed) / 86_400_000;
  return ageDays >= afterDays;
}

export function isArchivable(task: Task, afterDays: number, now = new Date()): boolean {
  return isDateArchivable(task.updatedAt, afterDays, now);
}

/** Split completed tasks into those staying in DONE.md and those moving out, grouped by file. */
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

/**
 * One `## <ID> — <date>` entry in WORK_LOG.md, kept as raw text. The log is prose, not tasks, so it
 * is split rather than parsed — nothing here should reformat what a human wrote.
 */
export interface WorkLogEntry {
  id: string;
  date: string;
  text: string;
}

/**
 * Split WORK_LOG.md into its header and its entries.
 *
 * The heading pattern demands a real ID and a real date, which is what keeps the `## TASK-### —
 * YYYY-MM-DD` line inside the file's own template block from being mistaken for an entry.
 */
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

/** Archive file a work-log entry belongs in, bucketed the same way completed tasks are. */
export function workLogArchiveFileFor(entry: WorkLogEntry): string {
  const [year, month] = entry.date.split('-');
  return `WORK_LOG-${year}-H${Number(month) <= 6 ? 1 : 2}.md`;
}

/** Reassemble a work-log file from its header and entries, preserving each entry verbatim. */
export function joinWorkLog(header: string, entries: WorkLogEntry[]): string {
  const body = entries.map((entry) => entry.text).join('\n\n');
  return `${header}\n\n${body}\n`.replace(/\n{4,}/g, '\n\n\n');
}
