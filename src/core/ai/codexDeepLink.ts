const TASKPLANNER_PLUGIN_MENTION = '[@TaskPlanner](plugin://taskplanner@refined-taskplanner)';

export function buildCodexDeepLink(prompt: string, workspacePath: string): string {
  const params = new URLSearchParams({
    prompt: `${TASKPLANNER_PLUGIN_MENTION} ${prompt}`,
    path: workspacePath,
  });
  return `codex://new?${params.toString()}`;
}
