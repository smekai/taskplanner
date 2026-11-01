import * as vscode from 'vscode';
import { ConfigManager } from '../../../../src/core/config/configManager.js';
import { TaskStore } from '../../../../src/core/store/taskStore.js';
import { checkAndPromptDuplicateConflicts } from '../commands/resolveConflicts.js';

export function createFileWatcher(
  workspacePath: string,
  taskDirName: string,
  configManager: ConfigManager,
  taskStore: TaskStore,
  logChannel?: vscode.OutputChannel,
): vscode.Disposable {
  const pattern = new vscode.RelativePattern(workspacePath, `${taskDirName}/*.md`);
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleReload() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(async () => {
      try {
        configManager.get();
        await taskStore.reloadAsync();
        await checkAndPromptDuplicateConflicts(taskStore, configManager);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logChannel?.appendLine(`[TaskPlanner] Reload failed after .tasks change: ${message}`);
      }
    }, 300);
  }

  const changeDisposable = watcher.onDidChange(scheduleReload);
  const createDisposable = watcher.onDidCreate(scheduleReload);
  const deleteDisposable = watcher.onDidDelete(scheduleReload);

  return {
    dispose() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      changeDisposable.dispose();
      createDisposable.dispose();
      deleteDisposable.dispose();
      watcher.dispose();
    },
  };
}
