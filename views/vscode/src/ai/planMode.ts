export function shouldAutomateCursorPlanMode(
  aiPlanRequired: boolean,
  automationEnabled: boolean,
): boolean {
  return aiPlanRequired && automationEnabled;
}
