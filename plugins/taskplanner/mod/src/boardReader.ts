import { normalizeStates } from '../../../../src/core/config/configStates.js';
import { filterAndPaginate } from '../../../../src/core/filter/taskFilter.js';
import { DEFAULT_STATES, TaskState } from '../../../../src/core/model/state.js';
import type { Task } from '../../../../src/core/model/task.js';
import { countTaskHeadings, parseTasks } from '../../../../src/core/parser/taskParser.js';
import {
  BoardSnapshot,
  TaskDetail,
  isCompletedState,
  taskBody,
  taskMarkdown,
} from './boardModel.js';

export const BOARD_TASK_LIMIT = 50;

export interface IndexedTask {
  task: Task;
  state: string;
}

export interface BoardRead {
  snapshot: BoardSnapshot;
  tasks: Map<string, IndexedTask[]>;
  issueCount: number;
}

function withoutBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function readConfigStates(configText: string): TaskState[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(withoutBom(configText));
  } catch {
    throw new Error('.tasks/config.json is not valid JSON.');
  }
  const states = (parsed as { states?: unknown } | null)?.states;
  return states === undefined ? [...DEFAULT_STATES] : normalizeStates(states, () => undefined);
}

export interface BuildOptions {
  loadCompleted: boolean;
  expandedStates: ReadonlySet<string>;
}

function indexTask(index: Map<string, IndexedTask[]>, entry: IndexedTask): void {
  const copies = index.get(entry.task.id);
  if (copies) copies.push(entry);
  else index.set(entry.task.id, [entry]);
}

export function buildBoard(
  states: readonly TaskState[],
  fileTexts: ReadonlyMap<string, string>,
  options: BuildOptions,
  workspaceRoot: string | null,
): BoardRead {
  const tasksByState = new Map<string, Task[]>();
  const displayCounts = new Map<string, number>();
  const tasks = new Map<string, IndexedTask[]>();
  const deferredStates: string[] = [];
  let issueCount = 0;
  for (const state of states) {
    const text = fileTexts.get(state.fileName) ?? '';
    if (isCompletedState(state.name) && !options.loadCompleted) {
      tasksByState.set(state.name, []);
      displayCounts.set(state.name, countTaskHeadings(text));
      deferredStates.push(state.name);
      continue;
    }
    const parsed = parseTasks(text);
    issueCount += parsed.errors.length;
    tasksByState.set(state.name, parsed.tasks);
    displayCounts.set(state.name, parsed.tasks.length);
    for (const task of parsed.tasks) indexTask(tasks, { task, state: state.name });
  }
  const viewStates = states.map(
    (state) =>
      filterAndPaginate(
        tasksByState,
        [state],
        undefined,
        options.expandedStates.has(state.name) ? null : BOARD_TASK_LIMIT,
        isCompletedState(state.name) ? 'file' : 'priority',
        displayCounts,
      ).states[0],
  );
  return {
    snapshot: { states: viewStates, workspaceRoot, deferredStates },
    tasks,
    issueCount,
  };
}

export function findTask(
  index: ReadonlyMap<string, readonly IndexedTask[]>,
  id: string,
  state?: string,
): IndexedTask | null {
  const copies = index.get(id) ?? [];
  if (state === undefined) return copies[0] ?? null;
  return copies.find((copy) => copy.state === state) ?? null;
}

export function taskDetailOf({ task, state }: IndexedTask): TaskDetail {
  const record = { ...task, state };
  return {
    id: task.id,
    title: task.title,
    state,
    priority: task.priority,
    tags: [...task.tags],
    text: taskMarkdown(record),
    body: taskBody(record),
  };
}
