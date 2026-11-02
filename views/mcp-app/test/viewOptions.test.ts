import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VIEW,
  latestResponseGate,
  refreshArgs,
  showMore,
  showsEveryTask,
  viewFromToolInput,
} from '../board/viewOptions.js';

describe('board refresh keeps the options the board was opened with', () => {
  const opened = viewFromToolInput({
    workspace_root: '/repo',
    query: 'login',
    limit: 1,
    include_completed: true,
  });

  it('a refresh after a move sends the opening filter, limit and completed states', () => {
    expect(refreshArgs(opened, '/repo')).toEqual({
      workspace_root: '/repo',
      query: 'login',
      limit: 1,
      include_completed: true,
    });
  });

  it('show more lifts only the limit and keeps the filter', () => {
    const expanded = showMore(opened, 'Backlog');
    expect(refreshArgs(expanded, '/repo')).toEqual({
      workspace_root: '/repo',
      query: 'login',
      limit: null,
      include_completed: true,
    });
    expect(showsEveryTask(expanded)).toBe(true);
  });

  it('show more on a completed state loads completed states', () => {
    expect(showMore(DEFAULT_VIEW, 'Done').includeCompleted).toBe(true);
    expect(showMore(DEFAULT_VIEW, 'Rejected').includeCompleted).toBe(true);
    expect(showMore(DEFAULT_VIEW, 'Next').includeCompleted).toBe(false);
  });

  it('a board opened without options refreshes with the server defaults', () => {
    expect(refreshArgs(viewFromToolInput({ workspace_root: '/repo' }), '/repo')).toEqual({
      workspace_root: '/repo',
    });
    expect(refreshArgs(DEFAULT_VIEW)).toEqual({});
    expect(showsEveryTask(DEFAULT_VIEW)).toBe(false);
  });

  it('ignores option values the server would reject', () => {
    expect(viewFromToolInput({ query: '  ', limit: 0, include_completed: 'yes' })).toEqual(
      DEFAULT_VIEW,
    );
    expect(viewFromToolInput(undefined)).toEqual(DEFAULT_VIEW);
  });
});

describe('latestResponseGate', () => {
  it('drops a refresh that a newer board superseded', () => {
    const gate = latestResponseGate();
    const startupRefresh = gate.begin();
    const toolResult = gate.begin();
    expect(gate.isCurrent(startupRefresh)).toBe(false);
    expect(gate.isCurrent(toolResult)).toBe(true);
  });
});
