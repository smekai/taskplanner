import { Task } from '../model/task.js';
import { TaskState } from '../model/state.js';

export interface DuplicateOccurrence {
  stateName: string;
  task: Task;
  index: number;
}

export interface DuplicateConflict {
  taskId: string;
  occurrences: DuplicateOccurrence[];
}

export interface DuplicateResolution {
  taskId: string;
  keep: DuplicateOccurrence;
  remove: DuplicateOccurrence[];
}

function parseTimestamp(value?: string): number | null {
  if (!value) {
    return null;
  }
  const normalized = value.replace(' ', 'T');
  const ts = Date.parse(normalized);
  return Number.isNaN(ts) ? null : ts;
}

function compareByUpdatedAt(a: DuplicateOccurrence, b: DuplicateOccurrence): number {
  const aTs = parseTimestamp(a.task.updatedAt);
  const bTs = parseTimestamp(b.task.updatedAt);
  if (aTs !== null && bTs !== null) {
    return aTs - bTs;
  }
  if (aTs !== null) {
    return 1;
  }
  if (bTs !== null) {
    return -1;
  }
  return 0;
}

function compareByStateOrder(
  a: DuplicateOccurrence,
  b: DuplicateOccurrence,
  stateOrder: Map<string, number>,
): number {
  const aOrder = stateOrder.get(a.stateName) ?? -1;
  const bOrder = stateOrder.get(b.stateName) ?? -1;
  return aOrder - bOrder;
}

export function detectDuplicates(tasksByState: Map<string, Task[]>): DuplicateConflict[] {
  const byTaskId = new Map<string, DuplicateOccurrence[]>();

  for (const [stateName, tasks] of tasksByState) {
    tasks.forEach((task, index) => {
      const occurrences = byTaskId.get(task.id) ?? [];
      occurrences.push({ stateName, task, index });
      byTaskId.set(task.id, occurrences);
    });
  }

  const conflicts: DuplicateConflict[] = [];
  for (const [taskId, occurrences] of byTaskId) {
    if (occurrences.length > 1) {
      conflicts.push({ taskId, occurrences });
    }
  }

  conflicts.sort((a, b) => a.taskId.localeCompare(b.taskId));
  return conflicts;
}

export function resolveConflict(
  conflict: DuplicateConflict,
  states: TaskState[],
): DuplicateResolution {
  if (conflict.occurrences.length < 2) {
    return {
      taskId: conflict.taskId,
      keep: conflict.occurrences[0],
      remove: [],
    };
  }

  const stateOrder = new Map(states.map((state) => [state.name, state.order]));
  const ranked = [...conflict.occurrences].sort((a, b) => {
    const updatedDiff = compareByUpdatedAt(a, b);
    if (updatedDiff !== 0) {
      return updatedDiff;
    }

    const stateDiff = compareByStateOrder(a, b, stateOrder);
    if (stateDiff !== 0) {
      return stateDiff;
    }

    return a.index - b.index;
  });

  const keep = ranked[ranked.length - 1];
  const remove = ranked.filter((occurrence) => occurrence !== keep);
  return {
    taskId: conflict.taskId,
    keep,
    remove,
  };
}
