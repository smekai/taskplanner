import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from '../../core/store/taskStore.js';
import { ConfigManager } from '../../core/config/configManager.js';
import { composeImplementationPrompt } from '../../core/ai/promptComposer.js';
import { buildCodexDeepLink } from '../../core/ai/codexDeepLink.js';
import { shouldAutomateCursorPlanMode } from '../../core/ai/planMode.js';
import {
  getAiTool,
  setAiTool,
  getClaudeCliCommand,
  getCursorPlanAndSubmitAfterOpen,
} from '../config/extensionConfig.js';

export type AiTool =
  | 'auto'
  | 'cursor'
  | 'codex-app'
  | 'claude-code'
  | 'vscode-chat'
  | 'claude-cli'
  | 'clipboard';

const GLOBAL_ONBOARDING_KEY = 'taskplanner.aiProviderOnboarding';
const CHAT_OPEN_COMMAND = 'workbench.action.chat.open';

/** Best-effort Cursor-internal commands after Tier 1 (may not exist in all builds). */
const CURSOR_PLAN_COMMANDS = ['composerMode.plan', 'cursor.composer.plan'];
const CURSOR_SUBMIT_COMMANDS = ['workbench.action.chat.acceptInput', 'chat.action.acceptInput'];

let aiLogChannel: vscode.OutputChannel | undefined;

function getAiLogChannel(context: vscode.ExtensionContext): vscode.OutputChannel {
  if (!aiLogChannel) {
    aiLogChannel = vscode.window.createOutputChannel('TaskPlanner AI');
    context.subscriptions.push(aiLogChannel);
  }
  return aiLogChannel;
}

function logTier1Failure(context: vscode.ExtensionContext, reason: string): void {
  const ch = getAiLogChannel(context);
  const line = `[${new Date().toISOString()}] Cursor Tier 1 (${CHAT_OPEN_COMMAND}) failed: ${reason}`;
  ch.appendLine(line);
}

export async function openVsCodeChat(prompt: string): Promise<void> {
  await vscode.commands.executeCommand(CHAT_OPEN_COMMAND, {
    query: prompt,
    isPartialQuery: false,
  });
}

async function tryCursorPlanAndSubmit(): Promise<void> {
  for (const id of CURSOR_PLAN_COMMANDS) {
    try {
      await vscode.commands.executeCommand(id);
      break;
    } catch {
      /* try next */
    }
  }
  await delay(100);
  for (const id of CURSOR_SUBMIT_COMMANDS) {
    try {
      await vscode.commands.executeCommand(id);
      break;
    } catch {
      /* try next */
    }
  }
}

export function registerImplementWithAiCommand(
  context: vscode.ExtensionContext,
  taskStore: TaskStore,
  configManager: ConfigManager,
) {
  context.subscriptions.push(
    vscode.commands.registerCommand('taskplanner.implementWithAi', async (taskId?: string) => {
      if (typeof taskId !== 'string') {
        return;
      }

      const found = taskStore.findTask(taskId);
      if (!found) {
        vscode.window.showErrorMessage(`Task ${taskId} not found.`);
        return;
      }

      const config = configManager.get();
      const prompt = composeImplementationPrompt(found.task, found.stateName, config);

      const setting = getAiTool();
      const tool = setting === 'auto' ? detectAiTool() : setting;
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

      await dispatch(context, tool, prompt, config.aiPlanRequired, workspacePath);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('taskplanner.configureAiProvider', async () => {
      await showAiProviderQuickPick(context);
    }),
  );
}

/** One-time prompt to pick default AI tool; safe to call when `.tasks` exists. */
export function registerAiProviderOnboarding(
  context: vscode.ExtensionContext,
  isInitialized: boolean,
): void {
  if (!isInitialized) {
    return;
  }
  const state = context.globalState.get<string>(GLOBAL_ONBOARDING_KEY);
  if (state === 'done' || state === 'later') {
    return;
  }
  setTimeout(() => {
    void vscode.window
      .showInformationMessage(
        'TaskPlanner: Choose your default AI tool for “Implement with AI” (optional).',
        'Choose AI provider',
        'Later',
      )
      .then((sel) => {
        if (sel === 'Choose AI provider') {
          void showAiProviderQuickPick(context);
        } else if (sel === 'Later') {
          void context.globalState.update(GLOBAL_ONBOARDING_KEY, 'later');
        }
      });
  }, 2500);
}

async function showAiProviderQuickPick(context: vscode.ExtensionContext): Promise<void> {
  const items: { label: string; description: string; value: AiTool }[] = [
    {
      label: '$(hubot) Auto',
      description: 'Cursor in Cursor IDE; otherwise Claude Code',
      value: 'auto',
    },
    {
      label: '$(sparkle) Cursor',
      description: 'Composer / Agent Chat (tiered delivery)',
      value: 'cursor',
    },
    {
      label: '$(code) Codex app',
      description: 'Open a new Codex task with the workspace and prompt prefilled',
      value: 'codex-app',
    },
    {
      label: '$(terminal) Claude Code (extension)',
      description: 'Anthropic Claude Code sidebar via URI',
      value: 'claude-code',
    },
    {
      label: '$(comment-discussion) VS Code Chat',
      description: 'workbench Chat (e.g. Copilot Chat)',
      value: 'vscode-chat',
    },
    {
      label: '$(console) Claude Code CLI',
      description: 'Integrated terminal (see claudeCliCommand)',
      value: 'claude-cli',
    },
    {
      label: '$(clippy) Clipboard only',
      description: 'Copy prompt for any tool',
      value: 'clipboard',
    },
  ];

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'AI tool for Implement with AI',
  });
  if (!picked) {
    return;
  }

  await setAiTool(picked.value);
  await context.globalState.update(GLOBAL_ONBOARDING_KEY, 'done');
  vscode.window.showInformationMessage(`TaskPlanner: AI tool set to "${picked.value}".`);
}

function detectAiTool(): Exclude<AiTool, 'auto'> {
  const appName = vscode.env.appName.toLowerCase();
  if (appName.includes('cursor')) {
    return 'cursor';
  }
  return 'claude-code';
}

async function dispatch(
  context: vscode.ExtensionContext,
  tool: Exclude<AiTool, 'auto'>,
  prompt: string,
  aiPlanRequired: boolean,
  workspacePath?: string,
): Promise<void> {
  switch (tool) {
    case 'cursor':
      await dispatchCursor(context, prompt, aiPlanRequired);
      break;
    case 'codex-app':
      await dispatchCodexApp(prompt, aiPlanRequired, workspacePath);
      break;
    case 'claude-code':
      await dispatchClaudeCode(prompt);
      break;
    case 'vscode-chat':
      await dispatchVsCodeChat(prompt);
      break;
    case 'claude-cli':
      await dispatchClaudeCli(prompt);
      break;
    case 'clipboard':
      await copyToClipboard(prompt);
      break;
  }
}

async function dispatchCodexApp(
  prompt: string,
  aiPlanRequired: boolean,
  workspacePath?: string,
): Promise<void> {
  if (!workspacePath) {
    await copyToClipboard(prompt, 'No workspace folder is open for Codex.');
    return;
  }

  try {
    const opened = await vscode.env.openExternal(
      vscode.Uri.parse(buildCodexDeepLink(prompt, workspacePath, { planMode: aiPlanRequired })),
    );
    if (!opened) {
      await copyToClipboard(prompt, 'Codex could not be opened.');
      return;
    }
    vscode.window.showInformationMessage(
      'Task opened in Codex with the prompt prefilled — review and submit it there.',
    );
  } catch {
    await copyToClipboard(prompt, 'Codex could not be opened.');
  }
}

async function dispatchVsCodeChat(prompt: string): Promise<void> {
  try {
    await openVsCodeChat(prompt);
    vscode.window.showInformationMessage('Prompt opened in VS Code Chat — review and submit.');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    vscode.window.showWarningMessage(
      `VS Code Chat could not be opened (${msg}). Prompt copied to clipboard.`,
    );
    await copyToClipboard(prompt);
  }
}

async function dispatchClaudeCli(prompt: string): Promise<void> {
  const template = getClaudeCliCommand();
  const tmpDir = os.tmpdir();
  const filePath = path.join(tmpDir, `taskplanner-ai-prompt-${Date.now()}.txt`);
  try {
    await fs.promises.writeFile(filePath, prompt, 'utf8');
  } catch {
    await copyToClipboard(prompt, 'Could not write temp file for Claude CLI.');
    return;
  }

  try {
    const line = template.includes('{{file}}')
      ? template.replace(/\{\{file\}\}/g, filePath)
      : `${template} ${JSON.stringify(filePath)}`;
    const term = vscode.window.createTerminal({ name: 'TaskPlanner Claude' });
    term.show();
    term.sendText(line, true);
    vscode.window.showInformationMessage('Started Claude CLI in terminal — check the panel.');
  } catch {
    await copyToClipboard(prompt, 'Claude CLI terminal could not be started.');
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dispatchCursor(
  context: vscode.ExtensionContext,
  prompt: string,
  aiPlanRequired: boolean,
): Promise<void> {
  const automatePlanMode = shouldAutomateCursorPlanMode(
    aiPlanRequired,
    getCursorPlanAndSubmitAfterOpen(),
  );
  let tier1Ok = false;
  try {
    await openVsCodeChat(prompt);
    tier1Ok = true;
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    logTier1Failure(context, reason);
    vscode.window.showWarningMessage(
      'Cursor quick-open failed; using Agent Chat paste fallback. See output “TaskPlanner AI” for details.',
    );
  }

  if (tier1Ok) {
    if (automatePlanMode) {
      await delay(200);
      await tryCursorPlanAndSubmit();
    }
    vscode.window.showInformationMessage('Prompt sent to Cursor chat — review if needed.');
    return;
  }

  const saved = await vscode.env.clipboard.readText();
  try {
    await vscode.env.clipboard.writeText(prompt);
    await vscode.commands.executeCommand('composer.newAgentChat');
    await delay(150);
    await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
    if (automatePlanMode) {
      await delay(100);
      await tryCursorPlanAndSubmit();
      vscode.window.showInformationMessage(
        'Plan request sent to Cursor chat — review the plan before implementation.',
      );
    } else {
      vscode.window.showInformationMessage(
        'Prompt pasted into Cursor Agent Chat — review and submit.',
      );
    }
    return;
  } catch {
    /* Tier 3 */
  } finally {
    await delay(100);
    await vscode.env.clipboard.writeText(saved);
  }

  await copyToClipboard(prompt, 'Cursor chat commands not available.');
}

// TODO: Open prompt directly in Claude Code sidebar once supported.
// https://github.com/anthropics/claude-code/issues/42000
async function dispatchClaudeCode(prompt: string): Promise<void> {
  const uri = vscode.Uri.parse(
    `vscode://anthropic.claude-code/open?prompt=${encodeURIComponent(prompt)}`,
  );
  await vscode.env.openExternal(uri);
  vscode.window.showInformationMessage('Prompt pre-filled in Claude Code — press Enter to submit.');
}

async function copyToClipboard(prompt: string, prefix?: string): Promise<void> {
  await vscode.env.clipboard.writeText(prompt);
  const msg = prefix
    ? `${prefix} Task prompt copied to clipboard — paste into your AI assistant.`
    : 'Task prompt copied to clipboard — paste into your AI assistant.';
  vscode.window.showInformationMessage(msg);
}
