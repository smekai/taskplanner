import { describe, expect, it, vi } from 'vitest';
import type { ElementNode, Elements } from '../../src/claude-mod/modApi.js';
import type { BoardSnapshot } from '../../src/claude-mod/boardModel.js';
import { PaneActions, PaneModel, renderBand, renderPane, slug } from '../../src/claude-mod/paneView.js';
import { Priority } from '../../src/core/model/task.js';

function element(type: string) {
  return (props: Record<string, unknown>): ElementNode => {
    const { children, ...rest } = props;
    return { type, props: rest, children: (children as unknown[] | undefined) ?? [] };
  };
}

const el = {
  Box: element('Box'),
  Text: element('Text'),
  Button: element('Button'),
  Markdown: element('Markdown'),
  Input: element('Input'),
  Select: element('Select'),
} as unknown as Elements;

function walk(node: unknown): ElementNode[] {
  if (!node || typeof node !== 'object') return [];
  const current = node as ElementNode;
  return [current, ...(current.children ?? []).flatMap(walk)];
}

function byKey(tree: ElementNode, key: string): ElementNode | undefined {
  return walk(tree).find((node) => node.props.key === key);
}

function texts(tree: ElementNode): string[] {
  return walk(tree)
    .filter((node) => node.type === 'Text')
    .flatMap((node) => (node.children ?? []) as string[]);
}

const BOARD: BoardSnapshot = {
  workspaceRoot: '/work',
  states: [
    {
      name: 'Backlog',
      tasks: [
        {
          id: 'TASK-002',
          title: 'A very long backlog task title that cannot fit',
          priority: Priority.P2,
          tags: [],
          description: '',
        },
      ],
      totalCount: 4,
      hasMore: true,
    },
    { name: 'Next', tasks: [], totalCount: 0, hasMore: false },
    {
      name: 'In Progress',
      tasks: [{ id: 'TASK-001', title: 'First', priority: Priority.P1, tags: [], description: '' }],
      totalCount: 1,
      hasMore: false,
    },
    { name: 'Done', tasks: [], totalCount: 7, hasMore: false },
  ],
};

function model(overrides: Partial<PaneModel> = {}): PaneModel {
  return {
    board: BOARD,
    tab: 'In Progress',
    detail: null,
    draft: null,
    notice: null,
    error: null,
    issueCount: 0,
    isLoading: false,
    isMissingBoard: false,
    columns: 30,
    surface: 'terminal',
    hasTextScale: false,
    ...overrides,
  };
}

function actions(): PaneActions {
  return {
    selectTab: vi.fn(),
    openTask: vi.fn(),
    back: vi.fn(),
    move: vi.fn(),
    start: vi.fn(),
    refresh: vi.fn(),
    edit: vi.fn(),
    newTask: vi.fn(),
    cancelNew: vi.fn(),
    setDraftTitle: vi.fn(),
    setDraftPriority: vi.fn(),
    setDraftState: vi.fn(),
    create: vi.fn(),
  };
}

function press(tree: ElementNode, key: string): void {
  const button = byKey(tree, key);
  if (!button) throw new Error(`no element with key ${key}`);
  (button.props.onPress as () => void)();
}

describe('renderPane list view', () => {
  it('draws one tab per state with digit hotkeys, dimming the inactive ones', () => {
    const tree = renderPane(el, model(), actions());
    const tabs = ['backlog', 'next', 'in-progress', 'done'].map((name) =>
      byKey(tree, `tab-${name}`),
    );
    expect(tabs.map((tab) => tab?.props.label)).toEqual([
      'Backlog 4',
      'Next 0',
      'In Progress 1',
      'Done 7',
    ]);
    expect(tabs.map((tab) => tab?.props.hotkey)).toEqual(['1', '2', '3', '4']);
    expect(tabs.map((tab) => tab?.props.dimColor)).toEqual([true, true, false, true]);
  });

  it('lists the active tab tasks and wires presses to actions', () => {
    const handlers = actions();
    const tree = renderPane(el, model(), handlers);
    expect(byKey(tree, 'task-TASK-001')?.props.label).toBe('TASK-001 P1 First');
    press(tree, 'task-TASK-001');
    press(tree, 'tab-backlog');
    press(tree, 'refresh');
    expect(handlers.openTask).toHaveBeenCalledWith('TASK-001');
    expect(handlers.selectTab).toHaveBeenCalledWith('Backlog');
    expect(handlers.refresh).toHaveBeenCalled();
  });

  it('truncates long rows to the pane width and counts hidden tasks', () => {
    const tree = renderPane(el, model({ tab: 'Backlog' }), actions());
    const label = byKey(tree, 'task-TASK-002')?.props.label as string;
    expect(label).toHaveLength(30);
    expect(label.endsWith('…')).toBe(true);
    expect(texts(tree)).toContain('+3 more');
  });

  it('says when a state is empty, and shows loading and errors with a retry', () => {
    const handlers = actions();
    const tree = renderPane(
      el,
      model({ tab: 'Next', isLoading: true, error: 'boom', issueCount: 2 }),
      handlers,
    );
    expect(texts(tree)).toEqual(
      expect.arrayContaining([
        'TaskPlanner · loading…',
        'Something went wrong with the board.',
        'boom',
        'No tasks in Next.',
        '2 part(s) of the board did not parse; ask Claude to check .tasks/.',
      ]),
    );
    press(tree, 'retry');
    expect(handlers.refresh).toHaveBeenCalled();
  });

  it('explains a missing board instead of listing', () => {
    const tree = renderPane(el, model({ board: null, isMissingBoard: true }), actions());
    expect(texts(tree)).toContain('No .tasks/ board in this folder.');
    expect(byKey(tree, 'tab-backlog')).toBeUndefined();
  });

  it('shows a loading line before the first board arrives', () => {
    const tree = renderPane(el, model({ board: null }), actions());
    expect(texts(tree)).toContain('Loading the board…');
  });
});

const detail = {
  id: 'TASK-001',
  title: 'First',
  state: 'In Progress',
  priority: 'P1',
  tags: ['ui'],
  text: '## TASK-001: First',
  body: 'About first.',
};

describe('renderPane detail view', () => {
  it('offers a move to every other state and renders the task markdown', () => {
    const handlers = actions();
    const tree = renderPane(el, model({ detail }), handlers);
    expect(byKey(tree, 'move-in-progress')).toBeUndefined();
    expect(byKey(tree, 'move-done')?.props.label).toBe('Done');
    expect(texts(tree)).toContain('Move to another state (now In Progress):');
    expect(byKey(tree, 'task-markdown')?.props.text).toBe('## TASK-001: First');
    press(tree, 'move-next');
    press(tree, 'start');
    press(tree, 'back');
    expect(handlers.move).toHaveBeenCalledWith('TASK-001', 'Next');
    expect(handlers.start).toHaveBeenCalledWith(detail);
    expect(handlers.back).toHaveBeenCalled();
  });

  it('does not offer to start a completed task', () => {
    const tree = renderPane(el, model({ detail: { ...detail, state: 'Done' } }), actions());
    expect(byKey(tree, 'start')).toBeUndefined();
    expect(byKey(tree, 'move-in-progress')).toBeDefined();
  });
});

describe('renderPane on the desktop surface', () => {
  const desktop = (overrides: Partial<PaneModel> = {}) =>
    model({ surface: 'desktop', columns: 60, hasTextScale: true, ...overrides });

  it('heads the pane with a title and the counts per state', () => {
    const tree = renderPane(el, desktop(), actions());
    const title = walk(tree).find((node) => node.props.size === 'title');
    expect(title?.children).toEqual(['TaskPlanner']);
    expect(texts(tree)).toContain('4 backlog · 0 next · 1 in progress · 7 done');
  });

  it('draws tasks as cards with a coloured priority and an untruncated title', () => {
    const tree = renderPane(el, desktop({ tab: 'Backlog' }), actions());
    const card = byKey(tree, 'card-TASK-002');
    expect(card?.props).toMatchObject({ borderStyle: 'round', paddingX: 1 });
    expect(byKey(tree, 'task-TASK-002')?.props.label).toBe(
      'A very long backlog task title that cannot fit',
    );
    const chip = walk(card).find((node) => node.type === 'Text' && node.children?.[0] === 'P2');
    expect(chip?.props.color).toBe('suggestion');
  });

  it('marks the active tab as the primary button', () => {
    const tree = renderPane(el, desktop(), actions());
    expect(byKey(tree, 'tab-in-progress')?.props.variant).toBe('primary');
    expect(byKey(tree, 'tab-backlog')?.props.variant).toBe('secondary');
    expect(byKey(tree, 'tab-backlog')?.props.plain).toBeUndefined();
  });

  it('shows the detail with a heading, chips, a primary start and only the body', () => {
    const tree = renderPane(el, desktop({ detail }), actions());
    const heading = walk(tree).find((node) => node.props.size === 'heading');
    expect(heading?.children).toEqual(['First']);
    expect(texts(tree)).toEqual(expect.arrayContaining(['TASK-001', 'P1', 'In Progress', 'ui']));
    expect(byKey(tree, 'start')?.props.variant).toBe('primary');
    expect(byKey(tree, 'task-markdown')?.props.text).toBe('About first.');
  });

  it('keeps cards but drops type scale on engines that do not draw it', () => {
    const tree = renderPane(el, desktop({ tab: 'Backlog', hasTextScale: false }), actions());
    expect(byKey(tree, 'card-TASK-002')).toBeDefined();
    const scaled = walk(tree).filter(
      (node) => 'size' in node.props || 'weight' in node.props || 'mono' in node.props,
    );
    expect(scaled).toEqual([]);
  });

  it('never sends type scale to the terminal', () => {
    const tree = renderPane(el, model({ hasTextScale: true }), actions());
    expect(walk(tree).filter((node) => 'size' in node.props)).toEqual([]);
  });

  it('says so when a task has no description', () => {
    const tree = renderPane(el, desktop({ detail: { ...detail, body: '' } }), actions());
    expect(byKey(tree, 'task-markdown')).toBeUndefined();
    expect(texts(tree)).toContain('No description yet.');
  });
});

describe('renderBand', () => {
  it('keeps what was drawn below and adds the task with a Board button', () => {
    const onOpen = vi.fn();
    const below = el.Text({ children: ['other band'] });
    const tree = renderBand(el, BOARD.states[2].tasks[0], 80, below, onOpen);
    expect(tree.children?.[0]).toBe(below);
    expect(texts(tree)).toContain('▶ TASK-001 · First');
    press(tree, 'taskplanner-board');
    expect(onOpen).toHaveBeenCalled();
  });
});

describe('slug', () => {
  it('makes state names key-safe', () => {
    expect(slug('In Progress')).toBe('in-progress');
    expect(slug('  QA / Review ')).toBe('qa-review');
  });
});

describe('writing from the pane', () => {
  const draft = { title: 'Draft title', priority: 'P2', state: 'Backlog' };
  const openTask = {
    id: 'TASK-001',
    title: 'First',
    state: 'In Progress',
    priority: 'P1',
    tags: [],
    text: '## TASK-001: First',
    body: '',
  };

  it('offers a new task from the header and hides it while drafting', () => {
    const handlers = actions();
    const tree = renderPane(el, model(), handlers);
    press(tree, 'new-task');
    expect(handlers.newTask).toHaveBeenCalled();
    expect(byKey(renderPane(el, model({ draft }), actions()), 'new-task')).toBeUndefined();
  });

  it('draws the draft form with title, priority and open states only', () => {
    const tree = renderPane(el, model({ draft }), actions());
    expect(byKey(tree, 'new-title')?.props).toMatchObject({
      value: 'Draft title',
      autoFocus: true,
    });
    const priority = byKey(tree, 'new-priority')?.props;
    expect(priority?.value).toBe('P2');
    const values = (options: unknown) => (options as { value: string }[]).map((o) => o.value);
    expect(values(priority?.options)).toEqual(['P0', 'P1', 'P2', 'P3', 'P4']);
    expect(values(byKey(tree, 'new-state')?.props.options)).toEqual([
      'Backlog',
      'Next',
      'In Progress',
    ]);
    expect(byKey(tree, 'task-TASK-001')).toBeUndefined();
  });

  it('wires the form controls to the draft actions', () => {
    const handlers = actions();
    const tree = renderPane(el, model({ draft }), handlers);
    (byKey(tree, 'new-title')?.props.onInput as (value: string) => void)('Typed');
    (byKey(tree, 'new-priority')?.props.onSelect as (value: string) => void)('P0');
    (byKey(tree, 'new-state')?.props.onSelect as (value: string) => void)('Next');
    (byKey(tree, 'new-title')?.props.onSubmit as (value: string) => void)('Submitted');
    press(tree, 'create-task');
    press(tree, 'cancel-new');
    expect(handlers.setDraftTitle).toHaveBeenCalledWith('Typed');
    expect(handlers.setDraftTitle).toHaveBeenLastCalledWith('Submitted');
    expect(handlers.setDraftPriority).toHaveBeenCalledWith('P0');
    expect(handlers.setDraftState).toHaveBeenCalledWith('Next');
    expect(handlers.create).toHaveBeenCalledTimes(2);
    expect(handlers.cancelNew).toHaveBeenCalled();
  });

  it('offers editing with Claude and shows the notice', () => {
    const handlers = actions();
    const tree = renderPane(
      el,
      model({ detail: openTask, notice: 'Describe the change.' }),
      handlers,
    );
    press(tree, 'edit');
    expect(handlers.edit).toHaveBeenCalledWith(openTask);
    expect(texts(tree)).toContain('Describe the change.');
  });

  it('keeps the mobile surface read-only', () => {
    const tree = renderPane(el, model({ surface: 'mobile', detail: openTask, draft }), actions());
    expect(byKey(tree, 'new-task')).toBeUndefined();
    expect(byKey(tree, 'new-title')).toBeUndefined();
    expect(byKey(tree, 'move-done')).toBeUndefined();
  });
});
