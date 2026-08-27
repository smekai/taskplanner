import { Priority } from './task.js';

/** Task data sent from extension host to webview */
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

/** Filter criteria for the task list */
export interface TaskFilter {
  status?: string;
  query?: string;
  tag?: string;
  groupBy?: 'status' | 'assignee' | 'epic' | 'date' | 'none';
}

/** Grouped task view for the task list panel */
export interface GroupViewData {
  label: string;
  tasks: TaskViewItem[];
  totalCount: number;
  hasMore: boolean;
  collapsed?: boolean;
}

/** Messages from webview to extension host */
export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'moveTask'; taskId: string; targetState: string; targetIndex?: number }
  | { type: 'reorderTask'; taskId: string; newIndex: number }
  | { type: 'deleteTask'; taskId: string }
  | { type: 'openTask'; taskId: string }
  | { type: 'applyFilter'; filter: TaskFilter }
  | { type: 'showAll'; stateName?: string }
  | { type: 'expandGroup'; groupLabel: string };
