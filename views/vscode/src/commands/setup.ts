import * as vscode from 'vscode';
import * as fs from 'fs';
import { ConfigManager } from '../../../../src/core/config/configManager.js';
import { TaskListSortBy } from '../../../../src/core/filter/taskFilter.js';
import { getSortBy, setSortBy } from '../config/extensionConfig.js';
import { synchronizeTaskPlannerProject } from '../project/projectSync.js';
import { MCP_CONFIG_FILE } from '../ai/aiInstructions.js';
import { writeMcpConfigNow } from './mcpConfigPrompt.js';
import { TaskStore } from '../../../../src/core/store/taskStore.js';

export interface SetupContext {
  tasksDir: string;
  configManager: ConfigManager;
  workspaceRoot: string;
  installedVersion: string;
  taskStore: TaskStore;
}

type SetupAction =
  | 'init'
  | 'initAi'
  | 'archiveDone'
  | 'writeMcpConfig'
  | 'togglePlan'
  | 'toggleAttribution'
  | 'configureAi'
  | 'sortBy'
  | 'settings';

interface SetupItem extends vscode.QuickPickItem {
  action: SetupAction;
}

const SORT_LABELS: Record<TaskListSortBy, string> = {
  priority: 'Priority',
  name: 'Name',
  id: 'ID',
  file: 'File order',
};

const SORT_OPTIONS: { label: string; description: string; value: TaskListSortBy }[] = [
  {
    label: 'Priority',
    description: 'Sort by priority (P1 first), then by name',
    value: 'priority',
  },
  { label: 'Name', description: 'Sort alphabetically by task title', value: 'name' },
  { label: 'ID', description: 'Sort by task ID', value: 'id' },
  {
    label: 'File order',
    description: 'Order as in markdown (for drag-reorder in the task list)',
    value: 'file',
  },
];

export function registerSetupCommand(context: vscode.ExtensionContext, setup: SetupContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('taskplanner.setup', async () => {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }
      const picked = await vscode.window.showQuickPick(setupItems(setup), {
        placeHolder: 'TaskPlanner Setup',
      });
      if (picked) await runSetupAction(picked.action, setup);
    }),
  );
}

function setupItems({ tasksDir, configManager }: SetupContext): SetupItem[] {
  const isInitialized = fs.existsSync(tasksDir);
  const config = configManager.get();
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

  if (isInitialized) {
    items.push(
      {
        label: '$(archive) Archive completed tasks',
        description: config.archiveDoneAfterDays
          ? `Move Done tasks older than ${config.archiveDoneAfterDays} days into .tasks/archive/`
          : 'Set archiveDoneAfterDays in .tasks/config.json first',
        action: 'archiveDone',
      },
      {
        label: `$(plug) Write ${MCP_CONFIG_FILE}`,
        description: 'Let hosts that read this file reach the TaskPlanner MCP tools',
        action: 'writeMcpConfig',
      },
    );
  }

  items.push(
    {
      label: config.aiPlanRequired
        ? '$(check) AI Planning: Enabled'
        : '$(circle-outline) AI Planning: Disabled',
      description: config.aiPlanRequired
        ? 'AI agents must write a plan before coding (click to disable)'
        : 'AI agents skip the planning step (click to enable)',
      action: 'togglePlan',
    },
    {
      label: config.readmeAttribution
        ? '$(check) README Attribution: Enabled'
        : '$(circle-outline) README Attribution: Disabled',
      description: config.readmeAttribution
        ? 'Add voluntary TaskPlanner attribution during managed updates (click to disable)'
        : 'Do not add TaskPlanner attribution during managed updates (click to enable)',
      action: 'toggleAttribution',
    },
    {
      label: '$(hubot) Configure AI Provider',
      description:
        "Choose Codex, Cursor, Claude Code, VS Code Chat, CLI, or clipboard for 'Implement with AI'",
      action: 'configureAi',
    },
    {
      label: `$(list-ordered) Sort By: ${SORT_LABELS[getSortBy()]}`,
      description: 'Change task sort order',
      action: 'sortBy',
    },
    {
      label: '$(gear) Open Settings',
      description: 'Configure TaskPlanner extension settings',
      action: 'settings',
    },
  );
  return items;
}

async function runSetupAction(action: SetupAction, setup: SetupContext): Promise<void> {
  switch (action) {
    case 'init':
      await vscode.commands.executeCommand('taskplanner.init');
      return;
    case 'initAi':
      await vscode.commands.executeCommand('taskplanner.initAi');
      return;
    case 'togglePlan':
      togglePlanning(setup.configManager);
      return;
    case 'toggleAttribution':
      toggleAttribution(setup);
      return;
    case 'archiveDone':
      archiveDone(setup);
      return;
    case 'writeMcpConfig':
      writeMcpConfigNow(setup.workspaceRoot, setup.configManager);
      return;
    case 'configureAi':
      await vscode.commands.executeCommand('taskplanner.configureAiProvider');
      return;
    case 'sortBy':
      await pickSortOrder();
      return;
    case 'settings':
      await vscode.commands.executeCommand('workbench.action.openSettings', 'taskplanner');
      return;
    default: {
      const unhandled: never = action;
      return unhandled;
    }
  }
}

function togglePlanning(configManager: ConfigManager): void {
  const enabled = !configManager.get().aiPlanRequired;
  configManager.update({ aiPlanRequired: enabled });
  configManager.save();
  vscode.window.showInformationMessage(
    `AI Planning ${enabled ? 'enabled' : 'disabled'}. Run "Initialize AI Instructions" to update AI files.`,
  );
}

function toggleAttribution({ configManager, workspaceRoot, installedVersion }: SetupContext): void {
  const enabled = !configManager.get().readmeAttribution;
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
}

function archiveDone({ taskStore, configManager }: SetupContext): void {
  const result = taskStore.archiveCompleted();
  if (result.archived > 0) {
    vscode.window.showInformationMessage(
      `Archived ${result.archived} task(s) into ${result.files.join(', ')}.`,
    );
    return;
  }
  vscode.window.showInformationMessage(
    configManager.get().archiveDoneAfterDays
      ? 'Nothing old enough to archive yet.'
      : 'Archiving is off. Set "archiveDoneAfterDays" in .tasks/config.json to enable it.',
  );
}

async function pickSortOrder(): Promise<void> {
  const picked = await vscode.window.showQuickPick(SORT_OPTIONS, {
    placeHolder: 'Select sort order',
  });
  if (!picked) return;
  await setSortBy(picked.value);
  vscode.window.showInformationMessage(`Sort order set to: ${picked.label}`);
}
