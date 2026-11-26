import * as vscode from 'vscode';
import { TaskStore } from '../../../../../src/core/store/taskStore.js';
import { ConfigManager } from '../../../../../src/core/config/configManager.js';
import { groupTasks, TaskListSortBy } from '../../../../../src/core/filter/taskFilter.js';
import { isDeferredStateName } from '../../../../../src/core/store/taskStore.js';
import { Task, Priority } from '../../../../../src/core/model/task.js';
import { isValidCron } from '../../../../../src/core/util/cron.js';
import { TaskFilter } from '../../../../../src/core/model/messages.js';
import { watchDueFlags } from './dueClock.js';
import { openTaskFileAtLine } from './openTaskFile.js';
import { parseWarningBanner } from './parseWarningBanner.js';
import { taskDetailHtml } from './taskDetailHtml.js';
import { taskListHtml, welcomeHtml } from './taskListHtml.js';
import {
  getSortBy,
  getGroupBy,
  setSortBy,
  setGroupBy,
  GroupBy,
} from '../../config/extensionConfig.js';

export class TaskListViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'taskplanner.taskView';

  private view?: vscode.WebviewView;
  private filter: TaskFilter = { groupBy: 'status' };
  private sortBy: TaskListSortBy = 'priority';
  private showAllForGroup: Set<string> = new Set();
  private toggledGroups: Set<string> = new Set();
  private activeTaskId: string | null = null;
  private storeDisposable?: { dispose: () => void };
  private dueDisposable?: { dispose: () => void };
  private parseWarningsDismissed = false;
  private parseWarningsKey = '';

  constructor(
    private taskStore: TaskStore,
    private configManager: ConfigManager,
    private isInitialized: () => boolean,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.update();
      }
    });
    webviewView.onDidDispose(() => {
      this.storeDisposable?.dispose();
      this.storeDisposable = undefined;
      this.dueDisposable?.dispose();
      this.dueDisposable = undefined;
      this.view = undefined;
    });

    this.storeDisposable = this.taskStore.onDidChange(() => {
      if (this.view?.visible && !this.activeTaskId) {
        this.update();
      }
    });
    this.dueDisposable = watchDueFlags(
      () => [...this.taskStore.getAllTasks().values()].flat(),
      () => {
        if (this.view?.visible && !this.activeTaskId) this.update();
      },
    );

    this.syncSettingsFromWorkspace();
    this.update();
  }

  public refresh(): void {
    this.syncSettingsFromWorkspace();
    this.update();
  }

  private syncSettingsFromWorkspace(): void {
    this.sortBy = getSortBy();
    this.filter.groupBy = getGroupBy();
  }

  public showTask(taskId: string): void {
    this.activeTaskId = taskId;
    this.update();
  }

  private handleMessage(msg: { type: string; [key: string]: unknown }): void {
    switch (msg.type) {
      case 'applyFilter':
        this.applyFilter(msg.filter as TaskFilter | undefined, msg.sortBy as TaskListSortBy);
        this.showAllForGroup.clear();
        this.update();
        break;
      case 'showAll':
        if (msg.groupLabel) this.showAllOf(msg.groupLabel as string);
        this.update();
        break;
      case 'toggleGroup':
      case 'expandGroup':
        if (msg.groupLabel) this.toggleGroup(msg.groupLabel as string);
        this.update();
        break;
      case 'viewTask':
        this.activeTaskId = msg.taskId as string;
        this.update();
        break;
      case 'backToList':
        this.activeTaskId = null;
        this.update();
        break;
      case 'changeStatus':
        this.taskStore.moveTask(msg.taskId as string, msg.targetState as string);
        break;
      case 'reorderTask':
        this.taskStore.reorderTaskToIndex(msg.taskId as string, msg.newIndex as number);
        break;
      case 'moveTask':
        this.taskStore.moveTask(
          msg.taskId as string,
          msg.targetState as string,
          typeof msg.targetIndex === 'number' ? msg.targetIndex : undefined,
        );
        break;
      case 'saveTask':
        this.taskStore.updateTask(msg.taskId as string, taskUpdatesFrom(msg));
        break;
      case 'openInEditor':
        vscode.commands.executeCommand('taskplanner.openTask', msg.taskId as string);
        break;
      case 'implementWithAi':
        vscode.commands.executeCommand('taskplanner.implementWithAi', msg.taskId as string);
        break;
      case 'command':
        vscode.commands.executeCommand(msg.command as string);
        break;
      case 'openParseWarningFile':
        openTaskFileAtLine(this.configManager.getTasksDir(), msg.fileName as string, msg.line);
        break;
      case 'dismissParseWarnings':
        this.parseWarningsDismissed = true;
        this.update();
        break;
    }
  }

  private applyFilter(filter: TaskFilter | undefined, sortBy: TaskListSortBy | undefined): void {
    const prevGroupBy = this.filter.groupBy ?? 'status';
    const prevSortBy = this.sortBy;
    this.filter = filter ?? { groupBy: 'status' };
    if (sortBy) this.sortBy = sortBy;

    const nextGroupBy = this.filter.groupBy ?? 'status';
    if (nextGroupBy !== prevGroupBy) void setGroupBy(nextGroupBy as GroupBy);
    if (this.sortBy !== prevSortBy) void setSortBy(this.sortBy);
  }

  private showAllOf(groupLabel: string): void {
    if (isDeferredStateName(groupLabel)) this.taskStore.ensureStateLoaded(groupLabel);
    this.showAllForGroup.add(groupLabel);
  }

  private toggleGroup(label: string): void {
    if (this.toggledGroups.delete(label)) return;
    this.toggledGroups.add(label);
    if (isDeferredStateName(label)) this.taskStore.ensureStateLoaded(label);
  }

  private syncParseWarningDismissState(): void {
    const key = JSON.stringify(this.taskStore.getWarnings());
    if (key !== this.parseWarningsKey) {
      this.parseWarningsKey = key;
      this.parseWarningsDismissed = false;
    }
  }

  private update(): void {
    if (!this.view) return;

    this.syncParseWarningDismissState();

    if (!this.isInitialized()) {
      this.view.webview.html = welcomeHtml(this.view.webview);
      return;
    }

    if (this.activeTaskId) {
      const found = this.taskStore.findTask(this.activeTaskId);
      if (found) {
        this.view.webview.html = taskDetailHtml({
          webview: this.view.webview,
          task: found.task,
          stateName: found.stateName,
          states: this.configManager.get().states,
          parseWarningBanner: this.parseWarningBanner(),
        });
        return;
      }
      this.activeTaskId = null;
    }

    const config = this.configManager.get();
    const states = config.states;
    const groupBy = this.filter.groupBy ?? 'status';
    const needAllTasks =
      groupBy !== 'status' ||
      this.sortBy === 'file' ||
      Boolean(this.filter.query?.trim()) ||
      Boolean(this.filter.tag);
    if (needAllTasks) {
      this.taskStore.ensureAllDeferredStatesLoaded();
    }
    const allTasks = this.taskStore.getAllTasks();
    const displayCounts = this.taskStore.getStateDisplayCounts();

    const groups = groupTasks(allTasks, states, groupBy, {
      filter: this.filter,
      sortBy: this.sortBy,
      stateDisplayCounts: displayCounts,
    });

    if (this.showAllForGroup.size > 0) {
      const unlimitedGroups = groupTasks(allTasks, states, groupBy, {
        filter: this.filter,
        limit: null,
        sortBy: this.sortBy,
        stateDisplayCounts: displayCounts,
      });
      for (const group of groups) {
        if (this.showAllForGroup.has(group.label)) {
          const full = unlimitedGroups.find((g) => g.label === group.label);
          if (full) {
            group.tasks = full.tasks;
            group.hasMore = false;
          }
        }
      }
    }

    this.view.webview.html = taskListHtml({
      webview: this.view.webview,
      groups,
      groupBy,
      states,
      configTags: config.tags,
      tasksByState: allTasks,
      filter: this.filter,
      sortBy: this.sortBy,
      toggledGroups: this.toggledGroups,
      parseWarningBanner: this.parseWarningBanner(),
    });
  }

  private parseWarningBanner(): string {
    return this.parseWarningsDismissed ? '' : parseWarningBanner(this.taskStore.getWarnings());
  }
}

function taskUpdatesFrom(msg: Record<string, unknown>): Partial<Omit<Task, 'id'>> {
  const updates: Partial<Omit<Task, 'id'>> = {};
  if (msg.title !== undefined) updates.title = msg.title as string;
  if (msg.description !== undefined) updates.description = msg.description as string;
  if (msg.priority !== undefined) updates.priority = msg.priority as Priority;
  if (msg.tags !== undefined) updates.tags = msg.tags as string[];
  if (msg.assignee !== undefined) updates.assignee = (msg.assignee as string) || undefined;
  if (msg.epic !== undefined) updates.epic = (msg.epic as string) || undefined;
  if (msg.repeats === undefined) return updates;

  const schedule = (msg.repeats as string).trim();
  if (schedule && !isValidCron(schedule)) {
    void vscode.window.showWarningMessage(
      `"${schedule}" is not a cron schedule. Use 5 fields in UTC, such as "0 7 * * *", or @daily. The schedule was not saved.`,
    );
    return updates;
  }
  return { ...updates, repeats: schedule || undefined };
}
