import * as vscode from 'vscode';
import { ConfigManager } from '../../core/config/configManager.js';
import { TaskStore } from '../../core/store/taskStore.js';
import {
  detectDuplicates,
  DuplicateConflict,
  DuplicateResolution,
  resolveConflict,
} from '../../core/validation/duplicateDetector.js';

let lastConflictSignature = '';
let promptInProgress = false;

function buildConflictSignature(conflicts: DuplicateConflict[]): string {
  return conflicts
    .map((conflict) => {
      const occurrences = conflict.occurrences
        .map((occurrence) => {
          return `${occurrence.stateName}:${occurrence.index}:${occurrence.task.updatedAt ?? ''}`;
        })
        .join('|');
      return `${conflict.taskId}=>${occurrences}`;
    })
    .join('||');
}

function summarizeConflict(conflict: DuplicateConflict): string {
  const title = conflict.occurrences[0]?.task.title ?? '';
  const states = conflict.occurrences.map((occurrence) => occurrence.stateName).join(', ');
  return `${conflict.taskId}: ${title} (in ${states})`;
}

function resolveAll(
  conflicts: DuplicateConflict[],
  configManager: ConfigManager,
): DuplicateResolution[] {
  const states = configManager.get().states;
  return conflicts.map((conflict) => resolveConflict(conflict, states));
}

function applyResolutions(taskStore: TaskStore, resolutions: DuplicateResolution[]): number {
  return taskStore.fixDuplicates(resolutions);
}

async function reviewConflicts(
  taskStore: TaskStore,
  configManager: ConfigManager,
  conflicts: DuplicateConflict[],
): Promise<void> {
  const autoFixAllItem: vscode.QuickPickItem = {
    label: 'Auto-fix all duplicates',
    description: `Resolve ${conflicts.length} conflicts`,
  };
  const picks: vscode.QuickPickItem[] = [
    autoFixAllItem,
    ...conflicts.map((conflict) => ({
      label: summarizeConflict(conflict),
      description: `${conflict.occurrences.length} occurrences`,
    })),
  ];

  const picked = await vscode.window.showQuickPick(picks, {
    placeHolder: 'Select a conflict to resolve or auto-fix all',
  });
  if (!picked) {
    return;
  }

  if (picked.label === autoFixAllItem.label) {
    const removed = applyResolutions(taskStore, resolveAll(conflicts, configManager));
    vscode.window.showInformationMessage(
      `Resolved duplicate conflicts. Removed ${removed} duplicates.`,
    );
    return;
  }

  const conflict = conflicts.find((item) => summarizeConflict(item) === picked.label);
  if (!conflict) {
    return;
  }

  const action = await vscode.window.showQuickPick(
    [{ label: 'Auto-fix this conflict' }, { label: 'Auto-fix all conflicts' }],
    { placeHolder: `Resolve ${conflict.taskId}` },
  );
  if (!action) {
    return;
  }

  const resolutions =
    action.label === 'Auto-fix all conflicts'
      ? resolveAll(conflicts, configManager)
      : [resolveConflict(conflict, configManager.get().states)];
  const removed = applyResolutions(taskStore, resolutions);
  vscode.window.showInformationMessage(
    `Resolved duplicate conflicts. Removed ${removed} duplicates.`,
  );
}

export async function checkAndPromptDuplicateConflicts(
  taskStore: TaskStore,
  configManager: ConfigManager,
): Promise<void> {
  taskStore.ensureAllDeferredStatesLoaded();
  const conflicts = detectDuplicates(taskStore.getAllTasks());
  if (conflicts.length === 0) {
    lastConflictSignature = '';
    return;
  }

  const signature = buildConflictSignature(conflicts);
  if (promptInProgress || signature === lastConflictSignature) {
    return;
  }
  lastConflictSignature = signature;
  promptInProgress = true;

  try {
    const action = await vscode.window.showWarningMessage(
      `Found duplicate task IDs (${conflicts.length}).`,
      'Review',
      'Auto-fix All',
      'Ignore',
    );

    if (action === 'Auto-fix All') {
      const removed = applyResolutions(taskStore, resolveAll(conflicts, configManager));
      vscode.window.showInformationMessage(
        `Resolved duplicate conflicts. Removed ${removed} duplicates.`,
      );
      return;
    }
    if (action === 'Review') {
      await reviewConflicts(taskStore, configManager, conflicts);
    }
  } finally {
    promptInProgress = false;
  }
}

export function registerResolveConflictsCommand(
  context: vscode.ExtensionContext,
  taskStore: TaskStore,
  configManager: ConfigManager,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('taskplanner.resolveConflicts', async () => {
      taskStore.ensureAllDeferredStatesLoaded();
      const conflicts = detectDuplicates(taskStore.getAllTasks());
      if (conflicts.length === 0) {
        vscode.window.showInformationMessage('No duplicate task IDs detected.');
        return;
      }
      await reviewConflicts(taskStore, configManager, conflicts);
    }),
  );
}
