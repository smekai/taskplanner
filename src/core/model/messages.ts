import { Priority } from './task.js';

export interface TaskViewItem {
  id: string;
  title: string;
  priority: Priority;
  tags: string[];
  epic?: string;
  assignee?: string;
  updatedAt?: string;
  description: string;
}

export interface StateViewData {
  name: string;
  tasks: TaskViewItem[];
  totalCount: number;
  hasMore: boolean;
}

export interface TaskViewData {
  states: StateViewData[];
  filter?: TaskFilter;
}

export const GROUP_BY_VALUES = ['status', 'assignee', 'epic', 'date', 'none'] as const;

export type GroupBy = (typeof GROUP_BY_VALUES)[number];

export interface TaskFilter {
  status?: string;
  query?: string;
  tag?: string;
  groupBy?: GroupBy;
}

export interface GroupViewData {
  label: string;
  tasks: TaskViewItem[];
  totalCount: number;
  hasMore: boolean;
  collapsed?: boolean;
}
