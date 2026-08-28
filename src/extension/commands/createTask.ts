import * as vscode from 'vscode';
import { TaskStore } from '../../core/store/taskStore.js';
import { ConfigManager } from '../../core/config/configManager.js';
import { Priority, isPriority } from '../../core/model/task.js';

export function registerCreateTaskCommand(
  context: vscode.ExtensionContext,
  taskStore: TaskStore,
  configManager: ConfigManager,
) {
  async function createTask(targetState: string) {
    const config = configManager.get();

    const title = await vscode.window.showInputBox({
      prompt: 'Task title',
      placeHolder: 'e.g., Implement user authentication',
      validateInput: (value) => (value.trim() ? null : 'Title is required'),
    });
    if (!title) {
      return;
    }

    const description = await vscode.window.showInputBox({
      prompt: 'Description (optional)',
      placeHolder: 'Brief description of the task',
    });

    const priorityPick = await vscode.window.showQuickPick(
      config.priorities.map((p) => ({
        label: p,
        description: getPriorityDescription(p),
      })),
      { placeHolder: 'Select priority' },
    );
    if (!priorityPick) {
      return;
    }
    const priority = isPriority(priorityPick.label) ? priorityPick.label : Priority.P4;

    const tagsInput = await vscode.window.showInputBox({
      prompt: 'Tags (comma-separated, optional)',
      placeHolder: 'e.g., auth, backend',
    });
    const tags = tagsInput
      ? tagsInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const assignee = await vscode.window.showInputBox({
      prompt: 'Assignee (optional)',
      placeHolder: 'e.g., John',
    });

    try {
      const task = taskStore.createTask(
        {
          title: title.trim(),
          priority,
          tags,
          description: description?.trim() ?? '',
          assignee: assignee?.trim() || undefined,
        },
        targetState,
      );

      vscode.window.showInformationMessage(`Created ${task.id}: ${task.title}`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to create task: ${err}`);
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('taskplanner.createTask', () => createTask('Backlog')),
    vscode.commands.registerCommand('taskplanner.createTaskInState', (stateName: string) =>
      createTask(stateName),
    ),
  );
}

function getPriorityDescription(priority: string): string {
  switch (priority) {
    case 'P0':
      return 'Blocker';
    case 'P1':
      return 'Critical';
    case 'P2':
      return 'High';
    case 'P3':
      return 'Medium';
    case 'P4':
      return 'Low';
    default:
      return '';
  }
}
