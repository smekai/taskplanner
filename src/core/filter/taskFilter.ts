import { Task } from '../model/task.js';
import { TaskState } from '../model/state.js';
import {
  TaskFilter,
  TaskViewData,
  TaskViewItem,
  StateViewData,
  GroupViewData,
} from '../model/messages.js';

const DEFAULT_LIMIT = 50;

function applyLimit<T>(
  items: T[],
  totalCount: number,
  limit: number | null,
): { sliced: T[]; hasMore: boolean } {
  if (limit === null) {
    return { sliced: items, hasMore: false };
  }
  return { sliced: items.slice(0, limit), hasMore: totalCount > limit };
}

function taskToViewItem(task: Task): TaskViewItem {
  return {
    id: task.id,
    title: task.title,
    priority: task.priority,
    tags: [...task.tags],
    epic: task.epic,
    assignee: task.assignee,
    updatedAt: task.updatedAt,
    description: task.description,
  };
}

function matchesQuery(task: Task, query: string): boolean {
  const q = query.toLowerCase();
  return (
    task.id.toLowerCase().includes(q) ||
    task.title.toLowerCase().includes(q) ||
    (task.assignee?.toLowerCase().includes(q) ?? false) ||
    (task.updatedAt?.toLowerCase().includes(q) ?? false) ||
    task.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

function matchesTag(task: Task, tag: string): boolean {
  return task.tags.includes(tag);
}

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };

function compareById(a: Task, b: Task): number {
  return a.id.localeCompare(b.id);
}

export type TaskListSortBy = 'priority' | 'name' | 'id' | 'file';

export function sortTasks(tasks: Task[], sortBy: TaskListSortBy): Task[] {
  if (sortBy === 'file') {
    return [...tasks];
  }
  const sorted = [...tasks];
  sorted.sort((a, b) => {
    switch (sortBy) {
      case 'priority': {
        const diff = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
        return diff !== 0 ? diff : compareById(a, b);
      }
      case 'name': {
        const diff = a.title.localeCompare(b.title);
        return diff !== 0 ? diff : compareById(a, b);
      }
      case 'id':
        return compareById(a, b);
      default:
        return 0;
    }
  });
  return sorted;
}

export function filterAndPaginate(
  tasksByState: Map<string, Task[]>,
  states: TaskState[],
  filter?: TaskFilter,
  limit: number | null = DEFAULT_LIMIT,
  sortBy: TaskListSortBy = 'priority',
  stateDisplayCounts?: ReadonlyMap<string, number>,
): TaskViewData {
  const result: StateViewData[] = [];

  for (const state of states) {
    // Skip states that don't match the status filter
    if (filter?.status && filter.status !== state.name) {
      continue;
    }

    let tasks = tasksByState.get(state.name) ?? [];

    // Apply query filter
    if (filter?.query) {
      tasks = tasks.filter((t) => matchesQuery(t, filter.query!));
    }

    // Apply tag filter
    if (filter?.tag) {
      tasks = tasks.filter((t) => matchesTag(t, filter.tag!));
    }

    // Apply sorting
    tasks = sortTasks(tasks, sortBy);

    const hasContentFilter = Boolean(filter?.query?.trim()) || Boolean(filter?.tag);
    const totalCount = hasContentFilter
      ? tasks.length
      : (stateDisplayCounts?.get(state.name) ?? tasks.length);
    const { sliced, hasMore } = applyLimit(tasks, totalCount, limit);

    result.push({
      name: state.name,
      tasks: sliced.map(taskToViewItem),
      totalCount,
      hasMore,
    });
  }

  return { states: result, filter };
}

/** Default collapsed states for the task list */
const COLLAPSED_STATES = new Set(['Backlog', 'Done', 'Rejected']);

export function groupTasks(
  tasksByState: Map<string, Task[]>,
  states: TaskState[],
  groupBy: 'status' | 'assignee' | 'epic' | 'date' | 'none',
  filter?: TaskFilter,
  limit: number | null = DEFAULT_LIMIT,
  sortBy: TaskListSortBy = 'priority',
  stateDisplayCounts?: ReadonlyMap<string, number>,
): GroupViewData[] {
  // Collect all tasks with their state name
  let allTasks: { task: Task; stateName: string }[] = [];
  for (const state of states) {
    if (filter?.status && filter.status !== state.name) {
      continue;
    }
    const tasks = tasksByState.get(state.name) ?? [];
    for (const task of tasks) {
      allTasks.push({ task, stateName: state.name });
    }
  }

  // Apply query filter
  if (filter?.query) {
    allTasks = allTasks.filter((t) => matchesQuery(t.task, filter.query!));
  }

  // Apply tag filter
  if (filter?.tag) {
    allTasks = allTasks.filter((t) => matchesTag(t.task, filter.tag!));
  }

  // Group
  const groups = new Map<string, { task: Task; stateName: string }[]>();

  for (const entry of allTasks) {
    let key: string;
    switch (groupBy) {
      case 'status':
        key = entry.stateName;
        break;
      case 'assignee':
        key = entry.task.assignee || 'Unassigned';
        break;
      case 'epic':
        key = entry.task.epic || 'No epic';
        break;
      case 'date':
        key = entry.task.updatedAt ? entry.task.updatedAt.split('T')[0] : 'No date';
        break;
      case 'none':
        key = 'All Tasks';
        break;
    }
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(entry);
  }

  // Build result
  const result: GroupViewData[] = [];

  // For status grouping, maintain state order
  if (groupBy === 'status') {
    for (const state of states) {
      if (filter?.status && filter.status !== state.name) {
        continue;
      }
      const entries = groups.get(state.name) ?? [];
      const sorted = sortTasks(
        entries.map((e) => e.task),
        sortBy,
      );
      const hasContentFilter = Boolean(filter?.query?.trim()) || Boolean(filter?.tag);
      const totalCount = hasContentFilter
        ? sorted.length
        : (stateDisplayCounts?.get(state.name) ?? sorted.length);
      const { sliced, hasMore } = applyLimit(sorted, totalCount, limit);
      result.push({
        label: state.name,
        tasks: sliced.map(taskToViewItem),
        totalCount,
        hasMore,
        collapsed: COLLAPSED_STATES.has(state.name),
      });
    }
  } else {
    // Sort group keys
    const keys = [...groups.keys()].sort();
    for (const key of keys) {
      const entries = groups.get(key)!;
      const sorted = sortTasks(
        entries.map((e) => e.task),
        sortBy,
      );
      const totalCount = sorted.length;
      const { sliced, hasMore } = applyLimit(sorted, totalCount, limit);
      result.push({
        label: key,
        tasks: sliced.map(taskToViewItem),
        totalCount,
        hasMore,
      });
    }
  }

  return result;
}
