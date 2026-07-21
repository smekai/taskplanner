import * as vscode from 'vscode';
import * as fs from 'fs';
import { ConfigManager } from '../../core/config/configManager.js';
import { synchronizeTaskPlannerProject } from '../../core/project/projectSync.js';

export function registerInitAiCommand(
  context: vscode.ExtensionContext,
  configManager: ConfigManager,
  installedVersion: string,
) {
  context.subscriptions.push(
    vscode.commands.registerCommand('taskplanner.initAi', async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return false;
      }
      if (!fs.existsSync(configManager.getTasksDir())) {
        vscode.window.showErrorMessage('Initialize TaskPlanner before updating project files.');
        return false;
      }

      try {
        const result = synchronizeTaskPlannerProject(
          workspaceFolder.uri.fsPath,
          configManager,
          installedVersion,
          { force: true },
        );
        if (result.status === 'installed-older') {
          vscode.window.showWarningMessage(
            `TaskPlanner ${installedVersion} is older than this project's ${result.storedVersion}; managed files were not downgraded.`,
          );
          return false;
        }
        vscode.window.showInformationMessage(
          `TaskPlanner project files updated: ${result.updatedFiles.join(', ')}`,
        );
        return true;
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update TaskPlanner project files: ${error}`);
        return false;
      }
    }),
  );
}
