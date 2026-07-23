const TASKPLANNER_PLUGIN_MENTION = '[@TaskPlanner](plugin://taskplanner@refined-taskplanner)';

export interface CodexDeepLinkOptions {
  planMode?: boolean;
}

export function buildCodexDeepLink(
  prompt: string,
  workspacePath: string,
  options: CodexDeepLinkOptions = {},
): string {
  const taskPrompt = `${TASKPLANNER_PLUGIN_MENTION} ${prompt}`;
  const params = new URLSearchParams({
    prompt: options.planMode ? `/plan ${taskPrompt}` : taskPrompt,
    path: workspacePath,
  });
  return `codex://new?${params.toString()}`;
}
