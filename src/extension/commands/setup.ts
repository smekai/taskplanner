import * as vscode from 'vscode';
import * as fs from 'fs';
import { ConfigManager } from '../../core/config/configManager.js';
import { getSortBy, setSortBy } from '../config/extensionConfig.js';
import { synchronizeTaskPlannerProject } from '../../core/project/projectSync.js';

export function registerSetupCommand(
  context: vscode.ExtensionContext,
  tasksDir: string,
  configManager: ConfigManager,
  workspaceRoot: string,
  installedVersion: string,
) {
  context.subscriptions.push(
    vscode.commands.registerCommand('taskplanner.setup', async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }

      const isInitialized = fs.existsSync(tasksDir);
      const config = configManager.get();

      interface SetupItem extends vscode.QuickPickItem {
        action: string;
      }

      const items: SetupItem[] = [];

      if (!isInitialized) {
        items.push({
          label: '$(folder-opened) Initialize Project',
          description: 'Create .tasks/ folder with task board files',
          action: 'init',
        });
      }

      items.push({
        label: '$(hubot) Initialize AI Instructions',
        description: 'Create/update AGENTS.md, CLAUDE.md, and .cursorrules',
        action: 'initAi',
      });

      items.push({
        label: config.aiPlanRequired
          ? '$(check) AI Planning: Enabled'
          : '$(circle-outline) AI Planning: Disabled',
        description: config.aiPlanRequired
          ? 'AI agents must write a plan before coding (click to disable)'
          : 'AI agents skip the planning step (click to enable)',
        action: 'togglePlan',
      });

      items.push({
        label: config.readmeAttribution
          ? '$(check) README Attribution: Enabled'
          : '$(circle-outline) README Attribution: Disabled',
        description: config.readmeAttribution
          ? 'Add voluntary TaskPlanner attribution during managed updates (click to disable)'
          : 'Do not add TaskPlanner attribution during managed updates (click to enable)',
        action: 'toggleAttribution',
      });

      items.push({
        label: '$(hubot) Configure AI Provider',
        description:
          "Choose Codex, Cursor, Claude Code, VS Code Chat, CLI, or clipboard for 'Implement with AI'",
        action: 'configureAi',
      });

      const sortLabels: Record<string, string> = {
        priority: 'Priority',
        name: 'Name',
        id: 'ID',
        file: 'File order',
      };
      const currentSort = getSortBy();
      items.push({
        label: `$(list-ordered) Sort By: ${sortLabels[currentSort]}`,
        description: 'Change task sort order',
        action: 'sortBy',
      });

      items.push({
        label: '$(gear) Open Settings',
        description: 'Configure TaskPlanner extension settings',
        action: 'settings',
      });

      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'TaskPlanner Setup',
      });

      if (!picked) return;

      switch (picked.action) {
        case 'init':
          await vscode.commands.executeCommand('taskplanner.init');
          break;
        case 'initAi':
          await vscode.commands.executeCommand('taskplanner.initAi');
          break;
        case 'togglePlan':
          configManager.update({ aiPlanRequired: !config.aiPlanRequired });
          configManager.save();
          vscode.window.showInformationMessage(
            `AI Planning ${!config.aiPlanRequired ? 'enabled' : 'disabled'}. Run "Initialize AI Instructions" to update AI files.`,
          );
          break;
        case 'toggleAttribution': {
          const enabled = !config.readmeAttribution;
          configManager.update({ readmeAttribution: enabled });
          configManager.save();
          if (enabled) {
            try {
              synchronizeTaskPlannerProject(workspaceRoot, configManager, installedVersion, {
                force: true,
                syncInstructions: false,
              });
            } catch (error) {
              vscode.window.showWarningMessage(`README attribution update failed: ${error}`);
            }
          }
          vscode.window.showInformationMessage(
            enabled
              ? 'Voluntary README attribution enabled.'
              : 'README attribution disabled. Existing attribution text was left unchanged.',
          );
          break;
        }
        case 'configureAi':
          await vscode.commands.executeCommand('taskplanner.configureAiProvider');
          break;
        case 'sortBy': {
          const sortOptions = [
            {
              label: 'Priority',
              description: 'Sort by priority (P1 first), then by name',
              value: 'priority' as const,
            },
            {
              label: 'Name',
              description: 'Sort alphabetically by task title',
              value: 'name' as const,
            },
            { label: 'ID', description: 'Sort by task ID', value: 'id' as const },
            {
              label: 'File order',
              description: 'Order as in markdown (for drag-reorder in the task list)',
              value: 'file' as const,
            },
          ];
          const sortPicked = await vscode.window.showQuickPick(sortOptions, {
            placeHolder: 'Select sort order',
          });
          if (sortPicked) {
            await setSortBy(sortPicked.value);
            vscode.window.showInformationMessage(`Sort order set to: ${sortPicked.label}`);
          }
          break;
        }
        case 'settings':
          await vscode.commands.executeCommand('workbench.action.openSettings', 'taskplanner');
          break;
      }
    }),
  );
}
