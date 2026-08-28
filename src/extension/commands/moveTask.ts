import * as vscode from 'vscode';
import { TaskStore } from '../../core/store/taskStore.js';
import { ConfigManager } from '../../core/config/configManager.js';

export function registerMoveTaskCommand(
  context: vscode.ExtensionContext,
  taskStore: TaskStore,
  configManager: ConfigManager,
) {
  context.subscriptions.push(
    vscode.commands.registerCommand('taskplanner.moveTask', async (item?: string) => {
      let taskId: string;

      if (typeof item === 'string') {
        taskId = item;
      } else {
        taskStore.ensureAllDeferredStatesLoaded();
        const allTasks = taskStore.getAllTasks();
        const picks: vscode.QuickPickItem[] = [];
        for (const [stateName, tasks] of allTasks) {
          for (const task of tasks) {
            picks.push({
              label: `${task.id}: ${task.title}`,
              description: `[${task.priority}] in ${stateName}`,
            });
          }
        }
        if (picks.length === 0) {
          vscode.window.showInformationMessage('No tasks to move.');
          return;
        }
        const picked = await vscode.window.showQuickPick(picks, {
          placeHolder: 'Select task to move',
        });
        if (!picked) {
          return;
        }
        taskId = picked.label.split(':')[0].trim();
      }

      const found = taskStore.findTask(taskId);
      if (!found) {
        vscode.window.showErrorMessage(`Task ${taskId} not found.`);
        return;
      }

      const config = configManager.get();
      const targetStates = config.states
        .filter((s) => s.name !== found.stateName)
        .map((s) => ({ label: s.name }));

      const target = await vscode.window.showQuickPick(targetStates, {
        placeHolder: `Move ${taskId} from ${found.stateName} to...`,
      });
      if (!target) {
        return;
      }

      const moved = taskStore.moveTask(taskId, target.label);
      if (moved) {
        vscode.window.showInformationMessage(
          `Moved ${taskId} from ${found.stateName} to ${target.label}`,
        );
      } else {
        vscode.window.showErrorMessage(`Failed to move ${taskId}.`);
      }
    }),
  );
}
