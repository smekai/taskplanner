export enum Priority {
  P0 = 'P0',
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3',
  P4 = 'P4',
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  tags: string[];
  epic?: string;
  assignee?: string;
  updatedAt?: string;
  waitingUntil?: string;
  plan?: string;
}

export function isPriority(value: string): value is Priority {
  return Object.values(Priority).includes(value as Priority);
}
