import * as vscode from 'vscode';
import { TaskListSortBy } from '../../core/filter/taskFilter.js';
import { AiTool } from '../commands/implementWithAi.js';

export type GroupBy = 'status' | 'assignee' | 'date' | 'none';

const SECTION = 'taskplanner';

function cfg(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(SECTION);
}

export function getTaskDirectory(): string {
  return cfg().get<string>('taskDirectory', '.tasks');
}

export function getAutoInitAiFiles(): boolean {
  return cfg().get<boolean>('autoInitAiFiles', true);
}

export function getAiTool(): AiTool {
  return cfg().get<AiTool>('aiTool', 'auto');
}

export async function setAiTool(value: AiTool): Promise<void> {
  await cfg().update('aiTool', value, vscode.ConfigurationTarget.Global);
}

export function getClaudeCliCommand(): string {
  return cfg().get<string>('claudeCliCommand', 'claude {{file}}');
}

export function getCursorPlanAndSubmitAfterOpen(): boolean {
  return cfg().get<boolean>('cursorPlanAndSubmitAfterOpen', true);
}

const SORT_BY_VALUES: readonly TaskListSortBy[] = ['priority', 'name', 'id', 'file'];

export function getSortBy(): TaskListSortBy {
  const value = cfg().get<string>('sortBy', 'priority');
  return (SORT_BY_VALUES as readonly string[]).includes(value)
    ? (value as TaskListSortBy)
    : 'priority';
}

export async function setSortBy(
  value: TaskListSortBy,
  target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace,
): Promise<void> {
  await cfg().update('sortBy', value, target);
}

const GROUP_BY_VALUES: readonly GroupBy[] = ['status', 'assignee', 'date', 'none'];

export function getGroupBy(): GroupBy {
  const value = cfg().get<string>('groupBy', 'status');
  return (GROUP_BY_VALUES as readonly string[]).includes(value) ? (value as GroupBy) : 'status';
}

export async function setGroupBy(
  value: GroupBy,
  target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace,
): Promise<void> {
  await cfg().update('groupBy', value, target);
}
