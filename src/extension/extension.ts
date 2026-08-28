import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from '../core/config/configManager.js';
import { FileStore } from '../core/store/fileStore.js';
import { TaskStore } from '../core/store/taskStore.js';
import { registerInitCommand } from './commands/initProject.js';
import { registerInitAiCommand } from './commands/initAi.js';
import { registerSetupCommand } from './commands/setup.js';
import { registerCreateTaskCommand } from './commands/createTask.js';
import { registerMoveTaskCommand } from './commands/moveTask.js';
import { registerOpenTaskCommand } from './commands/openTask.js';
import {
  checkAndPromptDuplicateConflicts,
  registerResolveConflictsCommand,
} from './commands/resolveConflicts.js';
import {
  registerAiProviderOnboarding,
  registerImplementWithAiCommand,
} from './commands/implementWithAi.js';
import { createFileWatcher } from './watchers/fileWatcher.js';
import { TaskListViewProvider } from './views/webview/taskListPanel.js';
import { KanbanPanel } from './views/webview/kanbanPanel.js';
import { scheduleAiInstructionSyncPrompt } from './aiInstructionSyncPrompt.js';
import { getTaskDirectory } from './config/extensionConfig.js';
import { synchronizeTaskPlannerProject } from '../core/project/projectSync.js';

export async function activate(context: vscode.ExtensionContext) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return;
  }

  const taskDirName = getTaskDirectory();
  const tasksDir = path.join(workspaceFolder.uri.fsPath, taskDirName);

  const configManager = new ConfigManager(tasksDir);
  const fileStore = new FileStore(tasksDir);
  const taskStore = new TaskStore(configManager, fileStore);
  const installedVersion = String(context.extension.packageJSON.version ?? '');
  const taskPlannerLog = vscode.window.createOutputChannel('TaskPlanner');
  context.subscriptions.push(taskPlannerLog);

  const isInitialized = fs.existsSync(tasksDir);
  vscode.commands.executeCommand('setContext', 'taskplanner:initialized', isInitialized);

  if (isInitialized) {
    configManager.load();
    reportConfigDiagnostics(configManager, taskPlannerLog);
    try {
      const sync = synchronizeTaskPlannerProject(
        workspaceFolder.uri.fsPath,
        configManager,
        installedVersion,
      );
      if (sync.synchronized) {
        taskPlannerLog.appendLine(
          `Synchronized managed project files for TaskPlanner ${sync.installedVersion}.`,
        );
      } else if (sync.status === 'installed-older') {
        const message = `TaskPlanner ${installedVersion} is older than this project's ${sync.storedVersion}; managed files were not downgraded.`;
        taskPlannerLog.appendLine(message);
        vscode.window.showWarningMessage(message);
      }
    } catch (error) {
      const message = `TaskPlanner managed-file synchronization failed: ${error}`;
      taskPlannerLog.appendLine(message);
      vscode.window.showWarningMessage(message);
    }
    await taskStore.reloadAsync();
    configManager.reconcileNextId(taskStore.getMaxTaskIdNumber() + 1);
    void checkAndPromptDuplicateConflicts(taskStore, configManager);
    scheduleAiInstructionSyncPrompt(context, workspaceFolder.uri.fsPath, tasksDir);
  }

  const taskListProvider = new TaskListViewProvider(taskStore, configManager, () =>
    fs.existsSync(tasksDir),
  );
  const viewProviderDisposable = vscode.window.registerWebviewViewProvider(
    TaskListViewProvider.viewType,
    taskListProvider,
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration('taskplanner.sortBy') ||
        e.affectsConfiguration('taskplanner.groupBy')
      ) {
        taskListProvider.refresh();
        KanbanPanel.refreshIfOpen();
      }
    }),
  );

  registerInitCommand(context, configManager, fileStore, taskStore, installedVersion);
  registerInitAiCommand(context, configManager, installedVersion);
  registerSetupCommand(
    context,
    tasksDir,
    configManager,
    workspaceFolder.uri.fsPath,
    installedVersion,
    taskStore,
  );
  registerCreateTaskCommand(context, taskStore, configManager);
  registerMoveTaskCommand(context, taskStore, configManager);
  registerOpenTaskCommand(context, taskStore, fileStore, configManager);
  registerResolveConflictsCommand(context, taskStore, configManager);
  registerImplementWithAiCommand(context, taskStore, configManager);
  registerAiProviderOnboarding(context, isInitialized);

  context.subscriptions.push(
    vscode.commands.registerCommand('taskplanner.refresh', async () => {
      configManager.load();
      await taskStore.reloadAsync();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('taskplanner.openTaskList', () => {
      vscode.commands.executeCommand('taskplanner.taskView.focus');
    }),
    vscode.commands.registerCommand('taskplanner.openKanban', () => {
      KanbanPanel.createOrShow(taskStore, configManager);
    }),
    vscode.commands.registerCommand('taskplanner.viewTask', (taskId: string) => {
      taskListProvider.showTask(taskId);
      vscode.commands.executeCommand('taskplanner.taskView.focus');
    }),
  );

  const watcher = createFileWatcher(
    workspaceFolder.uri.fsPath,
    taskDirName,
    configManager,
    taskStore,
    taskPlannerLog,
  );

  context.subscriptions.push(viewProviderDisposable, watcher);

  try {
    const pluginDir = path.join(context.extensionPath, 'plugins', 'taskplanner');
    if (fs.existsSync(pluginDir)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vscode as any).cursor?.plugins?.registerPath?.(pluginDir);
    }
  } catch {
    // Not running in Cursor or API unavailable
  }
}

export function deactivate() {
  // Cleanup handled by disposables
}

function reportConfigDiagnostics(configManager: ConfigManager, log: vscode.OutputChannel): void {
  const diagnostics = configManager.getDiagnostics();
  if (diagnostics.length === 0) return;

  for (const diagnostic of diagnostics) {
    log.appendLine(`[config] ${diagnostic.message}`);
  }
  const summary =
    diagnostics.length === 1
      ? diagnostics[0].message
      : `${diagnostics.length} problems in .tasks/config.json; defaults were used where needed.`;
  void vscode.window
    .showWarningMessage(`TaskPlanner: ${summary}`, 'Show details')
    .then((choice) => {
      if (choice === 'Show details') log.show(true);
    });
}
