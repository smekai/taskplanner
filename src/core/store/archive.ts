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
export function isArchivable(task: Task, afterDays: number, now = new Date()): boolean {
  if (!Number.isFinite(afterDays) || afterDays <= 0) return false;

  const date = task.updatedAt?.trim().slice(0, 10) ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return true;

  const completed = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(completed)) return true;

  const ageDays = (now.getTime() - completed) / 86_400_000;
  return ageDays >= afterDays;
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
