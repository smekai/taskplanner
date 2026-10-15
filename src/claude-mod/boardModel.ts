import type { StateViewData, TaskViewItem } from '../core/model/messages.js';
import type { McpToolResult } from './modApi.js';

export const IN_PROGRESS_STATE = 'In Progress';
export const COMPLETED_STATES: readonly string[] = ['Done', 'Rejected'];
export const BOARD_FILE_PATTERN = /^(.+\.md|config\.json)$/;

const DEFAULT_TAB_ORDER = [IN_PROGRESS_STATE, 'Next', 'Backlog'];
const TASKPLANNER_WRITE_TOOL = /__taskplanner_(create|move|update)$/;
const PANE_WRITE_TOOL = /^mcp__.+__taskplanner_(move|create)$/;
const TASK_ID_IN_TEXT = /\b([A-Z][A-Z0-9]*-\d+)\b/;
export const PRIORITIES: readonly string[] = ['P0', 'P1', 'P2', 'P3', 'P4'];
export const DEFAULT_NEW_PRIORITY = 'P2';
const OWN_PLUGIN = 'taskplanner';
const FILE_EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const TASKS_DIR_SEGMENT = /(^|[\\/])\.tasks[\\/]/;
const PERMISSION_REFUSAL = /refused|permission|classifier|haven't granted/i;

export interface BoardSnapshot {
  states: StateViewData[];
  workspaceRoot: string | null;
}

export interface TaskDetail {
  id: string;
  title: string;
  state: string;
  priority: string;
  tags: string[];
  text: string;
  body: string;
}

export interface ErrorSummary {
  title: string;
  detail: string;
}

export interface TaskDraft {
  title: string;
  priority: string;
  state: string;
}

export interface BoardFileStat {
  name: string;
  size: number;
  mtimeMs: number;
}

export function resultText(result: McpToolResult): string {
  return result.content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value.trim() : '';
}

function tagsOf(task: Record<string, unknown>): string[] {
  return Array.isArray(task.tags)
    ? task.tags.filter((tag): tag is string => typeof tag === 'string')
    : [];
}

export function taskBody(task: Record<string, unknown>): string {
  const sections: string[] = [];
  const description = stringField(task, 'description');
  if (description) sections.push(description);
  const plan = stringField(task, 'plan');
  if (plan) sections.push(`### Plan\n\n${plan}`);
  return sections.join('\n\n');
}

export function taskMarkdown(task: Record<string, unknown>): string {
  const meta = [
    `**Priority:** ${stringField(task, 'priority')}`,
    `**State:** ${stringField(task, 'state')}`,
  ];
  const tags = tagsOf(task);
  if (tags.length > 0) meta.push(`**Tags:** ${tags.join(', ')}`);
  for (const [key, label] of [
    ['epic', 'Epic'],
    ['assignee', 'Assignee'],
    ['waitingUntil', 'Waiting until'],
    ['updatedAt', 'Updated'],
  ] as const) {
    const value = stringField(task, key);
    if (value) meta.push(`**${label}:** ${value}`);
  }
  const sections = [
    `## ${stringField(task, 'id')}: ${stringField(task, 'title')}`,
    meta.join(' · '),
  ];
  const body = taskBody(task);
  if (body) sections.push(body);
  return sections.join('\n\n');
}

export function boardDigestText(board: BoardSnapshot): string {
  const counts = board.states.map((state) => `${state.name} ${state.totalCount}`).join(' · ');
  const lines = [counts];
  for (const name of [IN_PROGRESS_STATE, 'Next']) {
    for (const task of stateNamed(board, name)?.tasks ?? []) {
      lines.push(`- ${name}: ${task.id} ${task.priority} ${task.title}`);
    }
  }
  return lines.join('\n');
}

export function stateNamed(board: BoardSnapshot, name: string | null): StateViewData | undefined {
  return board.states.find((state) => state.name === name);
}

export function pickTab(board: BoardSnapshot, current: string | null): string | null {
  if (current && stateNamed(board, current)) return current;
  const withTasks = DEFAULT_TAB_ORDER.find(
    (name) => (stateNamed(board, name)?.totalCount ?? 0) > 0,
  );
  if (withTasks) return withTasks;
  const present = DEFAULT_TAB_ORDER.find((name) => stateNamed(board, name));
  return present ?? board.states[0]?.name ?? null;
}

export function isCompletedState(name: string | null): boolean {
  return name !== null && COMPLETED_STATES.includes(name);
}

export function moveTargets(board: BoardSnapshot, currentState: string): string[] {
  return board.states.map((state) => state.name).filter((name) => name !== currentState);
}

export function moveKey(target: string): string {
  return `move-${slug(target)}`;
}

export function moveTargetForKey(
  board: BoardSnapshot,
  currentState: string,
  key: string,
): string | null {
  return moveTargets(board, currentState).find((target) => moveKey(target) === key) ?? null;
}

export function inProgressTask(board: BoardSnapshot | null): TaskViewItem | null {
  return (board && stateNamed(board, IN_PROGRESS_STATE)?.tasks[0]) || null;
}

export function shouldRefreshAfterTool(tool: string, input: Record<string, unknown>): boolean {
  if (TASKPLANNER_WRITE_TOOL.test(tool)) return true;
  if (!FILE_EDIT_TOOLS.has(tool)) return false;
  const target = input.file_path ?? input.notebook_path;
  return typeof target === 'string' && TASKS_DIR_SEGMENT.test(target);
}

export const TEXT_SCALE_VERSION: readonly number[] = [2, 1, 299];

export function supportsTextScale(version: string): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  for (let index = 0; index < TEXT_SCALE_VERSION.length; index += 1) {
    if (parts[index] !== TEXT_SCALE_VERSION[index]) return parts[index] > TEXT_SCALE_VERSION[index];
  }
  return true;
}

export function isOwnPlugin(name: string): boolean {
  return name === OWN_PLUGIN || name.startsWith(`${OWN_PLUGIN}@`);
}

export function isPaneWriteByOwnPlugin(origin: string, tool: string): boolean {
  return isOwnPlugin(origin) && PANE_WRITE_TOOL.test(tool);
}

export function describeError(message: string): ErrorSummary {
  if (PERMISSION_REFUSAL.test(message)) {
    return {
      title: 'Claude Code did not allow the change.',
      detail: `Allow the TaskPlanner move and create tools for this project, then try again. ${message}`,
    };
  }
  return { title: 'Something went wrong with the board.', detail: message };
}

export function newTaskStates(board: BoardSnapshot | null): string[] {
  const names = board?.states.map((state) => state.name) ?? [];
  return names.filter((name) => !isCompletedState(name));
}

export function startDraft(board: BoardSnapshot | null, activeTab: string | null): TaskDraft {
  const states = newTaskStates(board);
  const state =
    activeTab && states.includes(activeTab)
      ? activeTab
      : states.includes('Backlog')
        ? 'Backlog'
        : (states[0] ?? 'Backlog');
  return { title: '', priority: DEFAULT_NEW_PRIORITY, state };
}

export function createdTaskId(result: McpToolResult): string | null {
  const structured = result.structuredContent as { task?: { id?: unknown } } | undefined;
  if (typeof structured?.task?.id === 'string') return structured.task.id;
  const text = resultText(result);
  try {
    const parsed = JSON.parse(text) as { task?: { id?: unknown } };
    if (typeof parsed.task?.id === 'string') return parsed.task.id;
  } catch {
    return TASK_ID_IN_TEXT.exec(text)?.[1] ?? null;
  }
  return TASK_ID_IN_TEXT.exec(text)?.[1] ?? null;
}

export function editPrompt(task: TaskDetail): string {
  return `Update ${task.id} (${task.title}): `;
}

export function boardSignature(files: readonly BoardFileStat[]): string {
  return [...files]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((file) => `${file.name}:${file.size}:${file.mtimeMs}`)
    .join('|');
}

export function joinPath(root: string, ...parts: string[]): string {
  return [root.replace(/[\\/]+$/, ''), ...parts].join('/');
}

export function startPrompt(task: TaskDetail): string {
  const verb = task.state === IN_PROGRESS_STATE ? 'Continue' : 'Work on';
  return `${verb} ${task.id} (${task.title}) following the TaskPlanner workflow.`;
}

export function truncate(text: string, width: number): string {
  if (width <= 1) return text.slice(0, Math.max(0, width));
  return text.length <= width ? text : `${text.slice(0, width - 1)}…`;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
