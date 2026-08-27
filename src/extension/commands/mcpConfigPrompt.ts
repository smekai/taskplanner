import * as vscode from 'vscode';
import { ConfigManager } from '../../core/config/configManager.js';
import { writeMcpServerConfig } from '../../core/project/projectSync.js';
import { MCP_CONFIG_FILE } from '../../core/ai/aiInstructions.js';

const PROMPT =
  'Add TaskPlanner to this repository’s MCP config? Agents in hosts that read ' +
  `${MCP_CONFIG_FILE} (Claude Code and others) can then use the TaskPlanner tools instead of ` +
  'editing the task markdown by hand.';

/** Report the outcome of a write attempt without duplicating the wording at each call site. */
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

/** Write the MCP config, recording the outcome so the prompt is not repeated. */
export function writeMcpConfigNow(workspaceRoot: string, configManager: ConfigManager): boolean {
  const ok = report(writeMcpServerConfig(workspaceRoot));
  if (ok) {
    configManager.update({ mcpConfig: 'written' });
    configManager.save();
  }
  return ok;
}

/**
 * Ask once whether to write the repository MCP config, and remember the answer. This writes a file
 * that tells an agent what to execute, so it never happens without the user saying so.
 */
export async function promptForMcpConfig(
  workspaceRoot: string,
  configManager: ConfigManager,
): Promise<void> {
  if (configManager.get().mcpConfig !== undefined) return;

  const choice = await vscode.window.showInformationMessage(PROMPT, 'Add it', 'Not now');
  if (choice !== 'Add it') {
    // "Not now" and dismissal both record a decline; Setup can still write it later.
    configManager.update({ mcpConfig: 'declined' });
    configManager.save();
    return;
  }

  writeMcpConfigNow(workspaceRoot, configManager);
}
