export interface BoardVisualArgs {
  [key: string]: unknown;
  workspace_root?: string;
  query?: string;
  include_completed?: boolean;
  limit?: number | null;
}

export interface BoardView {
  query?: string;
  includeCompleted: boolean;
  limit?: number | null;
}

export const DEFAULT_VIEW: BoardView = { includeCompleted: false };

const COMPLETED_STATES = new Set(['Done', 'Rejected']);

export function viewFromToolInput(args: Record<string, unknown> | undefined): BoardView {
  const view: BoardView = { includeCompleted: args?.include_completed === true };
  if (typeof args?.query === 'string' && args.query.trim()) view.query = args.query;
  if (args?.limit === null || (typeof args?.limit === 'number' && args.limit > 0)) {
    view.limit = args.limit;
  }
  return view;
}

export function showMore(view: BoardView, stateName: string): BoardView {
  return {
    ...view,
    limit: null,
    includeCompleted: view.includeCompleted || COMPLETED_STATES.has(stateName),
  };
}

export function showsEveryTask(view: BoardView): boolean {
  return view.limit === null;
}

export function refreshArgs(view: BoardView, workspaceRoot?: string): BoardVisualArgs {
  const args: BoardVisualArgs = {};
  if (workspaceRoot) args.workspace_root = workspaceRoot;
  if (view.query) args.query = view.query;
  if (view.includeCompleted) args.include_completed = true;
  if (view.limit !== undefined) args.limit = view.limit;
  return args;
}

export function latestResponseGate(): { begin(): number; isCurrent(ticket: number): boolean } {
  let latest = 0;
  return {
    begin: () => ++latest,
    isCurrent: (ticket) => ticket === latest,
  };
}
