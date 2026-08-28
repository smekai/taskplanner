import type { TaskStore } from '../store/taskStore.js';
import type { ConfigManager } from '../config/configManager.js';
import type { TaskFilter, TaskViewData } from '../model/messages.js';
import { filterAndPaginate, TaskListSortBy } from '../filter/taskFilter.js';

export interface BuildBoardViewModelOptions {
  searchQuery?: string;
  sortBy?: TaskListSortBy;
  limit?: number | null;
}

export function buildBoardViewModel(
  taskStore: TaskStore,
  configManager: ConfigManager,
  opts: BuildBoardViewModelOptions = {},
): TaskViewData {
  const states = configManager.get().states;
  const query = opts.searchQuery?.trim();
  if (query) {
    taskStore.ensureAllDeferredStatesLoaded();
  }
  const allTasks = taskStore.getAllTasks();
  const filter: TaskFilter | undefined = query ? { query } : undefined;
  const displayCounts = taskStore.getStateDisplayCounts();
  return filterAndPaginate(
    allTasks,
    states,
    filter,
    opts.limit,
    opts.sortBy ?? 'priority',
    displayCounts,
  );
}
