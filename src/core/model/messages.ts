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

/**
 * Groupings the task list offers. Single source of truth: the type derives from this list, and
 * the VS Code setting enum in package.json is asserted against it by a unit test.
 */
export const GROUP_BY_VALUES = ['status', 'assignee', 'epic', 'date', 'none'] as const;

export type GroupBy = (typeof GROUP_BY_VALUES)[number];

/** Filter criteria for the task list */
export interface TaskFilter {
  status?: string;
  query?: string;
  tag?: string;
  groupBy?: GroupBy;
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
