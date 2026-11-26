import { isDue } from '../util/cron.js';

export interface TaskState {
  name: string;
  fileName: string;
  order: number;
}

export const STATE_NAMES = {
  backlog: 'Backlog',
  next: 'Next',
  inProgress: 'In Progress',
  done: 'Done',
  rejected: 'Rejected',
  recurring: 'Recurring',
} as const;

export const DEFAULT_STATES: TaskState[] = [
  { name: STATE_NAMES.backlog, fileName: 'BACKLOG.md', order: 0 },
  { name: STATE_NAMES.next, fileName: 'NEXT.md', order: 1 },
  { name: STATE_NAMES.inProgress, fileName: 'IN_PROGRESS.md', order: 2 },
  { name: STATE_NAMES.done, fileName: 'DONE.md', order: 3 },
  { name: STATE_NAMES.rejected, fileName: 'REJECTED.md', order: 4 },
  { name: STATE_NAMES.recurring, fileName: 'RECURRING.md', order: 5 },
];

export const RECURRING_STATE_NAME = STATE_NAMES.recurring;

export const COMPLETED_STATE_NAMES: readonly string[] = [STATE_NAMES.done, STATE_NAMES.rejected];

export function isCompletedStateName(name: string): boolean {
  return COMPLETED_STATE_NAMES.includes(name);
}

export function isDueWork(
  task: { repeats?: string; lastRun?: string },
  stateName: string,
  now = new Date(),
): boolean {
  return !isCompletedStateName(stateName) && isDue(task.repeats, task.lastRun, now);
}

export const NEW_TASK_STATE_NAME = STATE_NAMES.backlog;

export type NewTaskState = { state: TaskState } | { error: string };

export function stateForNewTask(
  states: readonly TaskState[],
  requested: string | undefined,
  repeats: string | undefined,
): NewTaskState {
  const byName = (name: string) =>
    states.find((state) => state.name.toLowerCase() === name.toLowerCase());
  const fallback = repeats
    ? (byName(RECURRING_STATE_NAME) ?? byName(NEW_TASK_STATE_NAME))
    : byName(NEW_TASK_STATE_NAME);
  const state = requested ? byName(requested) : fallback;
  if (!state) return { error: `Unknown state "${requested ?? NEW_TASK_STATE_NAME}".` };
  if (state.name === RECURRING_STATE_NAME && !repeats) {
    return {
      error: `A task in ${RECURRING_STATE_NAME} needs a schedule: pass repeats, a cron expression in UTC such as "0 7 * * *".`,
    };
  }
  return { state };
}
