import * as vscode from 'vscode';
import { TaskStore } from '../../../../src/core/store/taskStore.js';
import { FileStore } from '../../../../src/core/store/fileStore.js';
import { ConfigManager } from '../../../../src/core/config/configManager.js';
import { findTaskLineNumber } from '../../../../src/core/parser/taskParser.js';

export function registerOpenTaskCommand(
  context: vscode.ExtensionContext,
  taskStore: TaskStore,
  fileStore: FileStore,
  configManager: ConfigManager,
) {
  context.subscriptions.push(
    vscode.commands.registerCommand('taskplanner.openTask', async (item?: string) => {
      if (typeof item !== 'string') {
        return;
      }
      const taskId = item;

      const found = taskStore.findTask(taskId);
      if (!found) {
        vscode.window.showErrorMessage(`Task ${taskId} not found.`);
        return;
      }

      const state = configManager.get().states.find((s) => s.name === found.stateName);
      if (!state) {
        return;
      }

      const filePath = fileStore.getStateFilePath(state);
      const content = fileStore.readRawContent(state);
      const lineNumber = findTaskLineNumber(content, taskId);

      const doc = await vscode.workspace.openTextDocument(filePath);
      const editor = await vscode.window.showTextDocument(doc);

      const position = new vscode.Position(lineNumber - 1, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter,
      );
    }),
  );
}
