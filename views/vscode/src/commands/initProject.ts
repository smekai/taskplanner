import * as vscode from 'vscode';
import { ConfigManager } from '../../../../src/core/config/configManager.js';
import { FileStore } from '../../../../src/core/store/fileStore.js';
import { TaskStore } from '../../../../src/core/store/taskStore.js';
import { getAutoInitAiFiles } from '../config/extensionConfig.js';
import { synchronizeTaskPlannerProject } from '../project/projectSync.js';
import { promptForMcpConfig } from './mcpConfigPrompt.js';

export function registerInitCommand(
  context: vscode.ExtensionContext,
  configManager: ConfigManager,
  fileStore: FileStore,
  taskStore: TaskStore,
  installedVersion: string,
) {
  context.subscriptions.push(
    vscode.commands.registerCommand('taskplanner.init', async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }

      try {
        configManager.load();
        configManager.save();

        fileStore.initializeStateFiles(configManager.get());

        await taskStore.reloadAsync();

        if (getAutoInitAiFiles()) {
          const synchronized = await vscode.commands.executeCommand<boolean>('taskplanner.initAi');
          if (!synchronized)
            throw new Error('Managed project-file synchronization did not finish.');
        } else {
          synchronizeTaskPlannerProject(
            workspaceFolder.uri.fsPath,
            configManager,
            installedVersion,
            { syncInstructions: false },
          );
        }

        await promptForMcpConfig(workspaceFolder.uri.fsPath, configManager);

        vscode.commands.executeCommand('setContext', 'taskplanner:initialized', true);
        vscode.window.showInformationMessage('TaskPlanner initialized! Check .tasks/ directory.');
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to initialize TaskPlanner: ${err}`);
      }
    }),
  );
}
