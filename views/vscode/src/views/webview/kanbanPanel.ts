import * as vscode from 'vscode';
import * as path from 'path';
import { TaskStore } from '../../../../../src/core/store/taskStore.js';
import { ConfigManager } from '../../../../../src/core/config/configManager.js';
import { TaskListSortBy } from '../../../../../src/core/filter/taskFilter.js';
import { buildBoardViewModel } from '../../../../../src/core/view/boardViewModel.js';
import { watchDueFlags } from './dueClock.js';
import { parseWarningBanner } from './parseWarningBanner.js';
import { kanbanHtml } from './kanbanHtml.js';
import { COMPLETED_STATE_NAMES } from '../../../../../src/core/model/state.js';
import { getSortBy, setSortBy } from '../../config/extensionConfig.js';

export class KanbanPanel {
  private static instance: KanbanPanel | undefined;
  private panel: vscode.WebviewPanel;
  private showAllForState: Set<string> = new Set();
  private sortBy: TaskListSortBy = 'priority';
  private searchQuery: string = '';
  private storeDisposable: { dispose: () => void };
  private dueDisposable: { dispose: () => void };
  private parseWarningsDismissed = false;
  private parseWarningsKey = '';

  private constructor(
    private taskStore: TaskStore,
    private configManager: ConfigManager,
  ) {
    this.panel = vscode.window.createWebviewPanel(
      'taskplanner.kanban',
      'Tasks: Kanban Board',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: false },
    );

    this.panel.iconPath = new vscode.ThemeIcon('project');

    this.panel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    this.panel.onDidDispose(() => this.dispose());
    this.panel.onDidChangeViewState((e) => {
      if (e.webviewPanel.visible) {
        this.update();
      }
    });

    this.storeDisposable = this.taskStore.onDidChange(() => {
      if (this.panel.visible) {
        this.update();
      }
    });
    this.dueDisposable = watchDueFlags(
      () => [...this.taskStore.getAllTasks().values()].flat(),
      () => {
        if (this.panel.visible) this.update();
      },
    );

    this.syncSortFromSettings();
    this.update();
  }

  static createOrShow(taskStore: TaskStore, configManager: ConfigManager): void {
    if (KanbanPanel.instance) {
      KanbanPanel.instance.panel.reveal(vscode.ViewColumn.One);
      return;
    }
    KanbanPanel.instance = new KanbanPanel(taskStore, configManager);
  }

  public static refreshIfOpen(): void {
    if (!KanbanPanel.instance) return;
    KanbanPanel.instance.syncSortFromSettings();
    if (KanbanPanel.instance.panel.visible) {
      KanbanPanel.instance.update();
    }
  }

  private syncSortFromSettings(): void {
    this.sortBy = getSortBy();
  }

  private syncParseWarningDismissState(): void {
    const key = JSON.stringify(this.taskStore.getWarnings());
    if (key !== this.parseWarningsKey) {
      this.parseWarningsKey = key;
      this.parseWarningsDismissed = false;
    }
  }

  private handleMessage(msg: { type: string; [key: string]: unknown }): void {
    switch (msg.type) {
      case 'showAll':
        if (msg.stateName) {
          this.showAllForState.add(msg.stateName as string);
        }
        this.update();
        break;
      case 'showCompleted':
        for (const name of COMPLETED_STATE_NAMES) {
          this.taskStore.ensureStateLoaded(name);
          this.showAllForState.add(name);
        }
        this.update();
        break;
      case 'moveTask':
        this.taskStore.moveTask(msg.taskId as string, msg.targetState as string);
        break;
      case 'openTask':
        vscode.commands.executeCommand('taskplanner.viewTask', msg.taskId as string);
        break;
      case 'addTask':
        vscode.commands.executeCommand('taskplanner.createTaskInState', msg.stateName as string);
        break;
      case 'sortBy':
        {
          const nextSortBy = msg.sortBy as TaskListSortBy;
          if (nextSortBy !== this.sortBy) {
            this.sortBy = nextSortBy;
            void setSortBy(nextSortBy);
          }
          this.update();
        }
        break;
      case 'search':
        this.searchQuery = (msg.query as string) ?? '';
        this.update();
        break;
      case 'implementWithAi':
        vscode.commands.executeCommand('taskplanner.implementWithAi', msg.taskId as string);
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

  private update(): void {
    this.syncParseWarningDismissState();
    const data = buildBoardViewModel(this.taskStore, this.configManager, {
      searchQuery: this.searchQuery,
      sortBy: this.sortBy,
    });

    if (this.showAllForState.size > 0) {
      const unlimitedData = buildBoardViewModel(this.taskStore, this.configManager, {
        searchQuery: this.searchQuery,
        sortBy: this.sortBy,
        limit: null,
      });
      for (const state of data.states) {
        if (this.showAllForState.has(state.name)) {
          const full = unlimitedData.states.find((s) => s.name === state.name);
          if (full) {
            state.tasks = full.tasks;
            state.hasMore = false;
          }
        }
      }
    }

    this.panel.webview.html = kanbanHtml({
      webview: this.panel.webview,
      data,
      searchQuery: this.searchQuery,
      sortBy: this.sortBy,
      showAllForState: this.showAllForState,
      parseWarningBanner: this.parseWarningBanner(),
    });
  }

  private parseWarningBanner(): string {
    return this.parseWarningsDismissed ? '' : parseWarningBanner(this.taskStore.getWarnings());
  }

  private dispose(): void {
    this.storeDisposable.dispose();
    this.dueDisposable.dispose();
    KanbanPanel.instance = undefined;
  }
}
