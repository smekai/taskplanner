import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { contentHasTaskPlannerMarkers } from '../core/ai/aiInstructions.js';

const WORKSPACE_STATE_KEY = 'suppressAiInstructionSyncPrompt';

/**
 * If the workspace has TaskPlanner config but a supported AI instruction file is missing the
 * TaskPlanner marker block, offer to synchronize all instruction targets.
 */
export function scheduleAiInstructionSyncPrompt(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  tasksDir: string,
): void {
  const configPath = path.join(tasksDir, 'config.json');
  if (!fs.existsSync(configPath)) {
    return;
  }

  if (context.workspaceState.get<boolean>(WORKSPACE_STATE_KEY)) {
    return;
  }

  const claudePath = path.join(workspaceRoot, 'CLAUDE.md');
  const cursorPath = path.join(workspaceRoot, '.cursorrules');
  const agentsPath = path.join(workspaceRoot, 'AGENTS.md');

  const claudeOk =
    fs.existsSync(claudePath) && contentHasTaskPlannerMarkers(fs.readFileSync(claudePath, 'utf-8'));
  const cursorOk =
    fs.existsSync(cursorPath) && contentHasTaskPlannerMarkers(fs.readFileSync(cursorPath, 'utf-8'));
  const agentsOk =
    fs.existsSync(agentsPath) && contentHasTaskPlannerMarkers(fs.readFileSync(agentsPath, 'utf-8'));

  if (claudeOk && cursorOk && agentsOk) {
    return;
  }

  void vscode.window
    .showInformationMessage(
      'TaskPlanner: One or more AI instruction files need synchronization. Update AGENTS.md, CLAUDE.md, and .cursorrules now?',
      'Sync AI Instructions',
      "Don't show again",
      'Later',
    )
    .then((choice) => {
      if (choice === 'Sync AI Instructions') {
        void vscode.commands.executeCommand('taskplanner.initAi');
      } else if (choice === "Don't show again") {
        void context.workspaceState.update(WORKSPACE_STATE_KEY, true);
      }
    });
}
