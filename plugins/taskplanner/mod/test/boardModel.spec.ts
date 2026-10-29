import { describe, expect, it } from 'vitest';
import {
  BoardSnapshot,
  boardDigestText,
  boardSignature,
  describeError,
  ancestorDirs,
  isOwnPlugin,
  paneCheckDecision,
  createdTaskId,
  editPrompt,
  isPaneWriteByOwnPlugin,
  newTaskStates,
  startDraft,
  joinPath,
  moveKey,
  moveTargetForKey,
  moveTargets,
  pickTab,
  shouldRefreshAfterTool,
  slug,
  supportsTextScale,
  taskBody,
  taskMarkdown,
  startPrompt,
  truncate,
} from '../src/boardModel.js';
import { Priority } from '../../../../src/core/model/task.js';

function task(id: string, title = 'A task') {
  return { id, title, priority: Priority.P2, tags: [], description: '' };
}

function board(counts: Record<string, number>): BoardSnapshot {
  return {
    workspaceRoot: '/work',
    states: Object.entries(counts).map(([name, count]) => ({
      name,
      tasks: Array.from({ length: count }, (_, index) => task(`${name}-${index}`)),
      totalCount: count,
      hasMore: false,
    })),
  };
}

const STANDARD = { Backlog: 2, Next: 0, 'In Progress': 0, Done: 4, Rejected: 0 };

describe('boardDigestText', () => {
  it('counts every state and lists In Progress then Next', () => {
    const snapshot = board({ Backlog: 1, Next: 1, 'In Progress': 1 });
    expect(boardDigestText(snapshot)).toBe(
      'Backlog 1 · Next 1 · In Progress 1\n- In Progress: In Progress-0 P2 A task\n- Next: Next-0 P2 A task',
    );
  });
});

describe('taskMarkdown and taskBody', () => {
  const record = {
    id: 'TASK-001',
    title: 'Title',
    state: 'Next',
    priority: 'P1',
    tags: ['ui', 'feature'],
    assignee: 'Ann',
    description: 'Body text.',
    plan: '- Step one',
  };

  it('renders the heading, meta line, description and plan', () => {
    expect(taskMarkdown(record)).toBe(
      [
        '## TASK-001: Title',
        '**Priority:** P1 · **State:** Next · **Tags:** ui, feature · **Assignee:** Ann',
        'Body text.',
        '### Plan\n\n- Step one',
      ].join('\n\n'),
    );
  });

  it('keeps only the description and plan for the body', () => {
    expect(taskBody(record)).toBe('Body text.\n\n### Plan\n\n- Step one');
    expect(taskBody({ id: 'TASK-2' })).toBe('');
  });
});

describe('own-plugin checks', () => {
  it('recognises only this plugin, by name or by its marketplace id', () => {
    expect(isOwnPlugin('taskplanner')).toBe(true);
    expect(isOwnPlugin('taskplanner@refined-taskplanner')).toBe(true);
    expect(isOwnPlugin('taskplanner@some-other-market')).toBe(false);
    expect(isOwnPlugin('taskplanner-extra')).toBe(false);
    expect(isOwnPlugin('engine')).toBe(false);
  });

  it('turns only an ask on its own write into an allow, and keeps every other verdict', () => {
    const move = 'mcp__plugin_taskplanner_taskplanner__taskplanner_move';
    const create = 'mcp__plugin_taskplanner_taskplanner__taskplanner_create';
    const ask = { decision: 'ask' as const, reason: 'rules say ask' };
    const deny = { decision: 'deny' as const, reason: 'deny rule' };
    const allow = { decision: 'allow' as const, reason: 'allow rule' };
    expect(paneCheckDecision('taskplanner', move, ask).decision).toBe('allow');
    expect(paneCheckDecision('taskplanner@refined-taskplanner', create, ask).decision).toBe(
      'allow',
    );
    expect(paneCheckDecision('taskplanner', move, deny)).toBe(deny);
    expect(paneCheckDecision('taskplanner', move, allow)).toBe(allow);
    expect(paneCheckDecision('engine', move, ask)).toBe(ask);
    expect(paneCheckDecision('taskplanner@some-other-market', move, ask)).toBe(ask);
    expect(
      paneCheckDecision(
        'taskplanner',
        'mcp__plugin_taskplanner_taskplanner__taskplanner_update',
        ask,
      ),
    ).toBe(ask);
  });

  it('approves only a move this plugin makes', () => {
    const move = 'mcp__plugin_taskplanner_taskplanner__taskplanner_move';
    expect(isPaneWriteByOwnPlugin('taskplanner', move)).toBe(true);
    expect(
      isPaneWriteByOwnPlugin(
        'taskplanner@refined-taskplanner',
        'mcp__taskplanner__taskplanner_move',
      ),
    ).toBe(true);
    expect(isPaneWriteByOwnPlugin('engine', move)).toBe(false);
    expect(isPaneWriteByOwnPlugin('other-mod', move)).toBe(false);
    expect(
      isPaneWriteByOwnPlugin('taskplanner', 'mcp__plugin_taskplanner_taskplanner__taskplanner_get'),
    ).toBe(false);
    expect(isPaneWriteByOwnPlugin('taskplanner', 'Bash')).toBe(false);
    expect(
      isPaneWriteByOwnPlugin(
        'taskplanner',
        'mcp__plugin_taskplanner_taskplanner__taskplanner_create',
      ),
    ).toBe(true);
    expect(
      isPaneWriteByOwnPlugin(
        'taskplanner',
        'mcp__plugin_taskplanner_taskplanner__taskplanner_update',
      ),
    ).toBe(false);
  });
});

describe('new tasks', () => {
  it('offers only open states and starts the draft in Backlog', () => {
    expect(newTaskStates(board(STANDARD))).toEqual(['Backlog', 'Next', 'In Progress']);
    expect(newTaskStates(null)).toEqual([]);
    expect(startDraft(board(STANDARD))).toEqual({ title: '', priority: 'P2', state: 'Backlog' });
    expect(startDraft(board({ Todo: 0, Doing: 0 })).state).toBe('Todo');
  });

  it('reads the new task ID from structured content, JSON text or plain text', () => {
    expect(
      createdTaskId({
        content: [],
        isError: false,
        structuredContent: { task: { id: 'TASK-071' } },
      }),
    ).toBe('TASK-071');
    expect(
      createdTaskId({
        content: [{ type: 'text', text: '{"task":{"id":"TASK-072"}}' }],
        isError: false,
      }),
    ).toBe('TASK-072');
    expect(
      createdTaskId({
        content: [{ type: 'text', text: 'Created TASK-073: Title [P2] in Backlog' }],
        isError: false,
      }),
    ).toBe('TASK-073');
    expect(createdTaskId({ content: [], isError: false })).toBeNull();
  });

  it('drafts an edit request for Claude', () => {
    const detail = {
      id: 'TASK-9',
      title: 'Pane',
      state: 'Next',
      priority: 'P2',
      tags: [],
      text: '',
      body: '',
    };
    expect(editPrompt(detail)).toBe('Update TASK-9 (Pane): ');
  });
});

describe('describeError', () => {
  it('explains a permission refusal', () => {
    const summary = describeError(
      '$.mcp.call(...) refused: the auto mode classifier gave no verdict',
    );
    expect(summary.title).toBe('Claude Code did not allow the change.');
    expect(summary.detail).toMatch(/^Allow the TaskPlanner move and create tools/);
    expect(summary.detail).toMatch(/classifier gave no verdict$/);
  });

  it('keeps any other message as the detail', () => {
    expect(describeError('.tasks/config.json is not valid JSON.')).toEqual({
      title: 'Something went wrong with the board.',
      detail: '.tasks/config.json is not valid JSON.',
    });
  });
});

describe('pickTab', () => {
  it('keeps a tab that still exists', () => {
    expect(pickTab(board(STANDARD), 'Done')).toBe('Done');
  });

  it('prefers In Progress, then Next, then Backlog, by which has tasks', () => {
    expect(pickTab(board({ ...STANDARD, 'In Progress': 1 }), null)).toBe('In Progress');
    expect(pickTab(board({ ...STANDARD, Next: 1 }), null)).toBe('Next');
    expect(pickTab(board(STANDARD), 'Gone')).toBe('Backlog');
  });

  it('falls back to the first preferred state, then the first state', () => {
    expect(pickTab(board({ Backlog: 0, Next: 0, 'In Progress': 0 }), null)).toBe('In Progress');
    expect(pickTab(board({ Todo: 0, Shipped: 0 }), null)).toBe('Todo');
    expect(pickTab({ states: [], workspaceRoot: null }, null)).toBeNull();
  });
});

describe('moveTargets', () => {
  it('offers every other state in board order', () => {
    expect(moveTargets(board(STANDARD), 'Next')).toEqual([
      'Backlog',
      'In Progress',
      'Done',
      'Rejected',
    ]);
  });

  it('maps a move button key back to its state', () => {
    expect(moveKey('In Progress')).toBe('move-in-progress');
    expect(moveTargetForKey(board(STANDARD), 'Next', 'move-in-progress')).toBe('In Progress');
    expect(moveTargetForKey(board(STANDARD), 'Next', 'move-next')).toBeNull();
    expect(moveTargetForKey(board(STANDARD), 'Next', 'tab-backlog')).toBeNull();
  });
});

describe('shouldRefreshAfterTool', () => {
  it('refreshes after TaskPlanner writes from a project or a plugin server', () => {
    expect(shouldRefreshAfterTool('mcp__taskplanner__taskplanner_move', {})).toBe(true);
    expect(
      shouldRefreshAfterTool('mcp__plugin_taskplanner_taskplanner__taskplanner_create', {}),
    ).toBe(true);
    expect(shouldRefreshAfterTool('mcp__taskplanner__taskplanner_update', {})).toBe(true);
  });

  it('ignores TaskPlanner reads', () => {
    expect(shouldRefreshAfterTool('mcp__taskplanner__taskplanner_list', {})).toBe(false);
    expect(shouldRefreshAfterTool('mcp__taskplanner__taskplanner_board_data', {})).toBe(false);
  });

  it('refreshes after a file edit under .tasks/ on either path style', () => {
    expect(shouldRefreshAfterTool('Edit', { file_path: '/repo/.tasks/BACKLOG.md' })).toBe(true);
    expect(shouldRefreshAfterTool('Write', { file_path: 'C:\\repo\\.tasks\\NEXT.md' })).toBe(true);
    expect(shouldRefreshAfterTool('Edit', { file_path: '/repo/src/tasks.ts' })).toBe(false);
    expect(shouldRefreshAfterTool('Read', { file_path: '/repo/.tasks/BACKLOG.md' })).toBe(false);
  });
});

describe('boardSignature', () => {
  it('ignores listing order and changes with size or time', () => {
    const a = { name: 'A.md', size: 1, mtimeMs: 10 };
    const b = { name: 'B.md', size: 2, mtimeMs: 20 };
    expect(boardSignature([b, a])).toBe(boardSignature([a, b]));
    expect(boardSignature([a, { ...b, mtimeMs: 21 }])).not.toBe(boardSignature([a, b]));
    expect(boardSignature([a, { ...b, size: 3 }])).not.toBe(boardSignature([a, b]));
  });
});

describe('small helpers', () => {
  it('joins paths without doubling separators', () => {
    expect(joinPath('C:\\repo\\', '.tasks', 'config.json')).toBe('C:\\repo/.tasks/config.json');
    expect(joinPath('/repo', '.tasks')).toBe('/repo/.tasks');
  });

  it('truncates with an ellipsis only when needed', () => {
    expect(truncate('short', 10)).toBe('short');
    expect(truncate('a longer title', 8)).toBe('a longe…');
  });

  it('words the start prompt by state', () => {
    const detail = { id: 'TASK-9', title: 'Pane', priority: 'P2', tags: [], text: '', body: '' };
    expect(startPrompt({ ...detail, state: 'In Progress' })).toBe(
      'Continue TASK-9 (Pane) following the TaskPlanner workflow.',
    );
    expect(startPrompt({ ...detail, state: 'Backlog' })).toBe(
      'Work on TASK-9 (Pane) following the TaskPlanner workflow.',
    );
  });
});

describe('slug', () => {
  it('makes state names key-safe', () => {
    expect(slug('In Progress')).toBe('in-progress');
    expect(slug('  QA / Review ')).toBe('qa-review');
  });
});

describe('supportsTextScale', () => {
  it('turns on from the first engine verified to draw text sizes', () => {
    expect(supportsTextScale('2.1.299 (Claude Code)')).toBe(true);
    expect(supportsTextScale('2.1.300')).toBe(true);
    expect(supportsTextScale('2.2.0')).toBe(true);
    expect(supportsTextScale('2.1.299-dev.20261015.t101500.sha1a2b3c4')).toBe(true);
    expect(supportsTextScale('2.1.295')).toBe(false);
    expect(supportsTextScale('1.9.999')).toBe(false);
    expect(supportsTextScale('unknown')).toBe(false);
  });
});

describe('ancestorDirs', () => {
  it('walks a POSIX path up to the root', () => {
    expect(ancestorDirs('/repo/packages/app/')).toEqual([
      '/repo/packages/app',
      '/repo/packages',
      '/repo',
      '/',
    ]);
  });

  it('walks a Windows path up to the drive', () => {
    expect(ancestorDirs('C:\\Development\\repo\\sub')).toEqual([
      'C:\\Development\\repo\\sub',
      'C:\\Development\\repo',
      'C:\\Development',
      'C:',
    ]);
  });
});
