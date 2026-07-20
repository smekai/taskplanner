import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from '../../core/config/configManager.js';
import { generateAiInstructions, upsertMarkedSection } from '../../core/ai/aiInstructions.js';

export function registerInitAiCommand(
  context: vscode.ExtensionContext,
  configManager: ConfigManager,
) {
  context.subscriptions.push(
    vscode.commands.registerCommand('taskplanner.initAi', async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }

      const rootPath = workspaceFolder.uri.fsPath;
      const config = configManager.get();
      const instructions = generateAiInstructions(config);

      const updatedFiles: string[] = [];

      // Update AGENTS.md (Codex and other agents.md-compatible tools)
      const agentsPath = path.join(rootPath, 'AGENTS.md');
      updateFileWithMarkers(agentsPath, instructions.agentsMd);
      updatedFiles.push('AGENTS.md');

      // Update CLAUDE.md
      const claudePath = path.join(rootPath, 'CLAUDE.md');
      updateFileWithMarkers(claudePath, instructions.claudeMd);
      updatedFiles.push('CLAUDE.md');

      // Update .cursorrules
      const cursorPath = path.join(rootPath, '.cursorrules');
      updateFileWithMarkers(cursorPath, instructions.cursorRules);
      updatedFiles.push('.cursorrules');

      vscode.window.showInformationMessage(`AI instructions updated: ${updatedFiles.join(', ')}`);
    }),
  );
}

function updateFileWithMarkers(filePath: string, content: string): void {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
  const updated = upsertMarkedSection(existing, content);
  fs.writeFileSync(filePath, updated, 'utf-8');
}
