export interface TaskState {
  name: string;
  fileName: string;
  order: number;
}

export const DEFAULT_STATES: TaskState[] = [
  { name: 'Backlog', fileName: 'BACKLOG.md', order: 0 },
  { name: 'Next', fileName: 'NEXT.md', order: 1 },
  { name: 'In Progress', fileName: 'IN_PROGRESS.md', order: 2 },
  { name: 'Done', fileName: 'DONE.md', order: 3 },
  { name: 'Rejected', fileName: 'REJECTED.md', order: 4 },
  { name: 'Recurring', fileName: 'RECURRING.md', order: 5 },
];

export const RECURRING_STATE_NAME = 'Recurring';
