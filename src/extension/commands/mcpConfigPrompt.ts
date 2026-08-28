import * as vscode from 'vscode';
import { ConfigManager } from '../../core/config/configManager.js';
import { writeMcpServerConfig } from '../../core/project/projectSync.js';
import { MCP_CONFIG_FILE } from '../../core/ai/aiInstructions.js';

const PROMPT =
  'Add TaskPlanner to this repository’s MCP config? Agents in hosts that read ' +
  `${MCP_CONFIG_FILE} (Claude Code and others) can then use the TaskPlanner tools instead of ` +
  'editing the task markdown by hand.';

function report(result: ReturnType<typeof writeMcpServerConfig>): boolean {
  if (result === 'unparseable') {
    vscode.window.showWarningMessage(
      `${MCP_CONFIG_FILE} could not be parsed, so it was left untouched. Fix or remove it and try again.`,
    );
    return false;
  }
  const message =
    result === 'written'
      ? `Added the taskplanner server to ${MCP_CONFIG_FILE}.`
      : `${MCP_CONFIG_FILE} already had the taskplanner server.`;
  vscode.window.showInformationMessage(message);
  return true;
}

export function writeMcpConfigNow(workspaceRoot: string, configManager: ConfigManager): boolean {
  const ok = report(writeMcpServerConfig(workspaceRoot));
  if (ok) {
    configManager.update({ mcpConfig: 'written' });
    configManager.save();
  }
  return ok;
}

export async function promptForMcpConfig(
  workspaceRoot: string,
  configManager: ConfigManager,
): Promise<void> {
  if (configManager.get().mcpConfig !== undefined) return;

  const choice = await vscode.window.showInformationMessage(PROMPT, 'Add it', 'Not now');
  if (choice !== 'Add it') {
    configManager.update({ mcpConfig: 'declined' });
    configManager.save();
    return;
  }

  writeMcpConfigNow(workspaceRoot, configManager);
}
