import * as vscode from 'vscode';
import * as path from 'path';
import { TaskStore } from '../../../../../src/core/store/taskStore.js';
import { ConfigManager } from '../../../../../src/core/config/configManager.js';
import { groupTasks, TaskListSortBy } from '../../../../../src/core/filter/taskFilter.js';
import { isDeferredStateName } from '../../../../../src/core/store/taskStore.js';
import { Task, Priority } from '../../../../../src/core/model/task.js';
import { isValidCron } from '../../../../../src/core/util/cron.js';
import { TaskFilter } from '../../../../../src/core/model/messages.js';
import { watchDueFlags } from './dueClock.js';
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
        {
          const prevGroupBy = this.filter.groupBy ?? 'status';
          const prevSortBy = this.sortBy;

          this.filter = (msg.filter as TaskFilter) ?? { groupBy: 'status' };
          if (msg.sortBy) {
            this.sortBy = msg.sortBy as TaskListSortBy;
          }

          const nextGroupBy = this.filter.groupBy ?? 'status';
          const nextSortBy = this.sortBy;

          if (nextGroupBy !== prevGroupBy) {
            void setGroupBy(nextGroupBy as GroupBy);
          }

          if (nextSortBy !== prevSortBy) {
            void setSortBy(nextSortBy);
          }
        }
        this.showAllForGroup.clear();
        this.update();
        break;
      case 'showAll':
        if (msg.groupLabel) {
          const gl = msg.groupLabel as string;
          if (isDeferredStateName(gl)) {
            this.taskStore.ensureStateLoaded(gl);
          }
          this.showAllForGroup.add(gl);
        }
        this.update();
        break;
      case 'toggleGroup':
        {
          const label = msg.groupLabel as string;
          const before = this.toggledGroups.has(label);
          if (before) {
            this.toggledGroups.delete(label);
          } else {
            this.toggledGroups.add(label);
          }
          const after = this.toggledGroups.has(label);
          if (!before && after && isDeferredStateName(label)) {
            this.taskStore.ensureStateLoaded(label);
          }
        }
        this.update();
        break;
      case 'expandGroup':
        if (msg.groupLabel) {
          const label = msg.groupLabel as string;
          const before = this.toggledGroups.has(label);
          if (before) {
            this.toggledGroups.delete(label);
          } else {
            this.toggledGroups.add(label);
          }
          const after = this.toggledGroups.has(label);
          if (!before && after && isDeferredStateName(label)) {
            this.taskStore.ensureStateLoaded(label);
          }
        }
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
      case 'moveTask': {
        const ti = msg.targetIndex;
        this.taskStore.moveTask(
          msg.taskId as string,
          msg.targetState as string,
          typeof ti === 'number' ? ti : undefined,
        );
        break;
      }
      case 'saveTask':
        {
          const taskId = msg.taskId as string;
          const updates: Partial<Omit<Task, 'id'>> = {};
          if (msg.title !== undefined) updates.title = msg.title as string;
          if (msg.description !== undefined) updates.description = msg.description as string;
          if (msg.priority !== undefined) updates.priority = msg.priority as Priority;
          if (msg.tags !== undefined) updates.tags = msg.tags as string[];
          if (msg.assignee !== undefined) updates.assignee = (msg.assignee as string) || undefined;
          if (msg.epic !== undefined) updates.epic = (msg.epic as string) || undefined;
          if (msg.repeats !== undefined) {
            const schedule = (msg.repeats as string).trim();
            if (schedule && !isValidCron(schedule)) {
              void vscode.window.showWarningMessage(
                `"${schedule}" is not a cron schedule. Use 5 fields in UTC, such as "0 7 * * *", or @daily. The schedule was not saved.`,
              );
            } else {
              updates.repeats = schedule || undefined;
            }
          }
          this.taskStore.updateTask(taskId, updates);
        }
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
      case 'openParseWarningFile': {
        const fileName = msg.fileName as string;
        const line = typeof msg.line === 'number' ? msg.line : 1;
        const dir = this.configManager.getTasksDir();
        const uri = vscode.Uri.file(path.join(dir, fileName));
        void vscode.workspace.openTextDocument(uri).then((doc) => {
          void vscode.window.showTextDocument(doc, {
            selection: new vscode.Range(line - 1, 0, line - 1, 0),
          });
        });
        break;
      }
      case 'dismissParseWarnings':
        this.parseWarningsDismissed = true;
        this.update();
        break;
    }
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
