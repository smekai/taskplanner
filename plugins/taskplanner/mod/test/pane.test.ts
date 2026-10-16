import { expect, mock, test } from 'claude-code/testing';

const SERVER = 'plugin:taskplanner:taskplanner';
const ROOT = '/work';

const STATES = [
  { name: 'Backlog', fileName: 'BACKLOG.md', order: 0 },
  { name: 'Next', fileName: 'NEXT.md', order: 1 },
  { name: 'In Progress', fileName: 'IN_PROGRESS.md', order: 2 },
  { name: 'Done', fileName: 'DONE.md', order: 3 },
  { name: 'Rejected', fileName: 'REJECTED.md', order: 4 },
];

function section(id: string, title: string, priority: string, body: string) {
  return `## ${id}: ${title}\n**Priority:** ${priority} | **Tags:** ui\n\n${body}\n\n---\n`;
}

// Stands in for the server's move, so a reload after a move sees the task in its new file.
function moveSection(files: Record<string, string>, id: string, target: string) {
  const fileName = STATES.find((state) => state.name === target)?.fileName;
  if (!fileName) return;
  for (const [name, text] of Object.entries(files)) {
    const start = text.indexOf(`## ${id}:`);
    if (start < 0) continue;
    const end = text.indexOf('---\n', start) + '---\n'.length;
    files[name] = text.slice(0, start) + text.slice(end);
    files[fileName] = `${files[fileName] ?? `# ${target}\n\n`}${text.slice(start, end)}`;
    return;
  }
}

function boardFiles(): Record<string, string> {
  return {
    'config.json': JSON.stringify({ version: 3, idPrefix: 'TASK', nextId: 5, states: STATES }),
    'BACKLOG.md': `# Backlog\n\n${section('TASK-002', 'Second task', 'P2', 'About the second task.')}`,
    'IN_PROGRESS.md': `# In Progress\n\n${section('TASK-001', 'First task', 'P1', 'About the first task.')}`,
    'DONE.md': `# Done\n\n${section('TASK-003', 'Old', 'P3', 'Shipped.')}${section('TASK-004', 'Older', 'P3', 'Shipped.')}`,
  };
}

const PANE = {
  plugin: 'taskplanner',
  component: 'Pane',
  requestId: 'taskplanner',
  viewport: { columns: 120, rows: 40 },
  props: {
    title: 'TaskPlanner',
    isFocused: true,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const;

const BAND = {
  plugin: 'taskplanner',
  component: 'AbovePrompt',
  viewport: { columns: 120, rows: 40 },
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 6,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 6 },
    view: {},
  },
} as const;

type McpCall = { server: string; tool: string; args: Record<string, unknown> };

function posixPath(path: string) {
  return path
    .split('\\')
    .join('/')
    .replace(/^[A-Za-z]:/, '');
}

function baseName(path: string) {
  return path.split(/[\\/]/).pop() ?? path;
}

function engine(
  on: any,
  options: {
    hasBoard?: boolean;
    surfaces?: string[];
    takenCommands?: string[];
    cwd?: string;
    boardRoots?: string[];
    backlogTasks?: number;
  } = {},
) {
  const calls: McpCall[] = [];
  const opened: string[] = [];
  const submitted: string[] = [];
  const filled: string[] = [];
  const registered: string[] = [];
  const reads: string[] = [];
  const files = boardFiles();
  if (options.backlogTasks) {
    files['BACKLOG.md'] = Array.from({ length: options.backlogTasks }, (_, index) =>
      section(`TASK-${100 + index}`, `Backlog task ${index}`, 'P2', 'Body.'),
    ).join('');
  }
  const clock = mock.clock(on);
  let mtimeMs = 1000;
  let gate: Promise<void> | null = null;
  let cwd = options.cwd ?? ROOT;
  const boardRoots = options.boardRoots ?? [ROOT];
  on('session.start', () => ({ cwd: ROOT }));
  on('command.register', ($: unknown, e: { name: string }) => {
    if (options.takenCommands?.includes(e.name)) return { deny: `/${e.name} is taken` };
    registered.push(e.name);
    return { value: undefined };
  });
  on('session.root', () => ({ value: ROOT }));
  on('session.cwd', () => ({ value: cwd }));
  on('session.version', () => ({ value: { version: '2.1.292' } }));
  on('session.surfaces', () => ({ value: options.surfaces ?? ['desktop'] }));
  on('fs.exists', ($: unknown, e: { path: string }) => ({
    value:
      (options.hasBoard ?? true) &&
      boardRoots.some((root) => posixPath(e.path) === `${root}/.tasks/config.json`),
  }));
  on('fs.read', async ($: unknown, e: { path: string }) => {
    if (gate) await gate;
    const name = baseName(e.path);
    reads.push(name);
    return name in files ? { value: files[name] } : { deny: `ENOENT: ${name}` };
  });
  on('fs.list', () => ({
    value: [
      ...Object.keys(files).map((name) => ({
        name,
        kind: 'file',
        size: files[name].length,
        isLink: false,
      })),
      { name: 'archive', kind: 'dir', size: 0, isLink: false },
    ],
  }));
  on('fs.stat', () => ({ value: { kind: 'file', size: 10, mtimeMs, isLink: false } }));
  on('mcp.connect', () => ({ value: { isConnected: true, server: SERVER } }));
  on('mcp.call', ($: unknown, e: McpCall) => {
    calls.push(e);
    if (e.tool === 'taskplanner_create') {
      const id = 'TASK-005';
      const file = e.args.state === 'Next' ? 'NEXT.md' : 'BACKLOG.md';
      files[file] =
        `${files[file] ?? '# Board\n\n'}${section(id, String(e.args.title), String(e.args.priority), '')}`;
      mtimeMs += 1000;
      return {
        value: {
          content: [{ type: 'text', text: JSON.stringify({ task: { id } }) }],
          isError: false,
        },
      };
    }
    if (e.tool === 'taskplanner_move')
      moveSection(files, String(e.args.task_id), String(e.args.target_state));
    mtimeMs += 1000;
    return { value: { content: [{ type: 'text', text: 'Moved' }], isError: false } };
  });
  on('prompt.fill', ($: unknown, e: { text: string }) => {
    filled.push(e.text);
    return { isFilled: true };
  });
  on('ui.open', ($: unknown, e: { id: string }) => {
    opened.push(e.id);
    return { value: { isPlaced: true } };
  });
  on('ui.panes', () => ({ value: [] }));
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['drawn by Claude Code'] }));
  on('prompt.submit', ($: unknown, e: { text: string }) => {
    submitted.push(e.text);
    return { text: e.text };
  });
  on('tool.call', () => ({ result: 'ok' }));
  const configReads = () => reads.filter((name) => name === 'config.json').length;
  const touch = () => {
    mtimeMs += 1000;
  };
  const changeDirectory = (path: string) => {
    cwd = path;
  };
  const holdReads = () => {
    let release = () => {};
    gate = new Promise<void>((resolve) => {
      release = () => {
        gate = null;
        resolve();
      };
    });
    return release;
  };
  return {
    calls,
    opened,
    submitted,
    filled,
    registered,
    reads,
    files,
    clock,
    configReads,
    touch,
    holdReads,
    changeDirectory,
  };
}

async function startSession($: any, clock: { settle: () => Promise<void> }) {
  await $.session.start({ surface: 'desktop', isInteractive: true, cwd: ROOT });
  await clock.settle();
}

test('/taskboard opens the pane from the .tasks files with no MCP call', async ($, on) => {
  const world = engine(on);
  await startSession($, world.clock);
  expect(world.registered).toEqual(['taskboard']);
  await $.command.run({ command: 'taskboard', args: '' });
  expect(world.opened).toEqual(['taskplanner']);

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface });
    expect(await ui.find({ key: 'task-TASK-001' })).toBeDefined();
    expect(await ui.find({ key: 'task-TASK-002' })).toBeUndefined();
    await ui.press({ key: 'tab-backlog' });
    expect(await ui.find({ key: 'task-TASK-002' })).toBeDefined();
    await ui.press({ key: 'tab-in-progress' });
    await ui.unmount();
  }
  expect(world.calls).toEqual([]);
});

test('/taskplanner:board opens the same pane', async ($, on) => {
  const world = engine(on);
  await startSession($, world.clock);
  await $.command.run({ command: 'taskplanner:board', args: '' });
  expect(world.opened).toEqual(['taskplanner']);
});

test('the desktop pane draws cards, and the terminal a plain list', async ($, on) => {
  const world = engine(on);
  await startSession($, world.clock);
  await $.command.run({ command: 'taskboard', args: '' });

  const desktop = await $.ui.mount({ ...PANE, surface: 'desktop' });
  expect(await desktop.find({ key: 'card-TASK-001' })).toBeDefined();
  expect((await desktop.find({ key: 'task-TASK-001' }))?.text).toBe('First task');
  await desktop.unmount();

  const terminal = await $.ui.mount({ ...PANE, surface: 'terminal' });
  expect(await terminal.find({ key: 'card-TASK-001' })).toBeUndefined();
  expect((await terminal.find({ key: 'task-TASK-001' }))?.text).toBe('TASK-001 P1 First task');
});

test('a task opens from the files, moves through the server, and starts a Claude turn', async ($, on) => {
  const world = engine(on);
  await startSession($, world.clock);
  await $.command.run({ command: 'taskboard', args: '' });

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' });
  await ui.press({ key: 'task-TASK-001' });
  expect((await ui.find({ key: 'task-markdown' }))?.text).toBe('About the first task.');
  expect(await ui.find({ key: 'move-in-progress' })).toBeUndefined();
  expect(world.calls).toEqual([]);

  await ui.press({ key: 'move-next' });
  expect(world.calls).toEqual([
    {
      server: SERVER,
      tool: 'taskplanner_move',
      args: { workspace_root: ROOT, task_id: 'TASK-001', target_state: 'Next' },
    },
  ]);

  await ui.press({ key: 'start' });
  expect(world.submitted).toEqual([
    'Work on TASK-001 (First task) following the TaskPlanner workflow.',
  ]);

  await ui.press({ key: 'back' });
  expect(await ui.find({ key: 'task-TASK-001' })).toBeUndefined();
  await ui.press({ key: 'tab-next' });
  expect(await ui.find({ key: 'task-TASK-001' })).toBeDefined();
});

test('the terminal detail shows the whole task as markdown', async ($, on) => {
  const world = engine(on);
  await startSession($, world.clock);
  await $.command.run({ command: 'taskboard', args: '' });
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' });
  await ui.press({ key: 'task-TASK-001' });
  expect((await ui.find({ key: 'task-markdown' }))?.text).toMatch(/^## TASK-001: First task/);
});

test('a TaskPlanner write or a .tasks edit by Claude rereads the board', async ($, on) => {
  const world = engine(on);
  await startSession($, world.clock);
  const before = world.configReads();

  await $.tool.call({
    tool: 'mcp__taskplanner__taskplanner_move',
    task_id: 'TASK-002',
    target_state: 'Next',
  });
  await world.clock.settle();
  expect(world.configReads()).toBe(before + 1);

  await $.tool.call({ tool: 'Edit', file_path: '/work/.tasks/BACKLOG.md' });
  await world.clock.settle();
  expect(world.configReads()).toBe(before + 2);

  await $.tool.call({ tool: 'Read', file_path: '/work/.tasks/BACKLOG.md' });
  await world.clock.settle();
  expect(world.configReads()).toBe(before + 2);
});

test('the open pane polls and rereads only when .tasks files change', async ($, on) => {
  const world = engine(on);
  await startSession($, world.clock);
  await $.command.run({ command: 'taskboard', args: '' });
  const before = world.configReads();

  await world.clock.advance(5000);
  expect(world.configReads()).toBe(before);

  world.touch();
  await world.clock.advance(5000);
  expect(world.configReads()).toBe(before + 1);
});

test('the band shows the In Progress task beside what others draw and opens the board', async ($, on) => {
  const world = engine(on);
  await startSession($, world.clock);

  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ ...BAND, surface });
    expect(await band.find({ type: 'Text', text: /TASK-001 · First task/ })).toBeDefined();
    expect(await band.find({ type: 'Text', text: 'drawn by Claude Code' })).toBeDefined();
    await band.unmount();
  }

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' });
  await band.press({ key: 'taskplanner-board' });
  expect(world.opened).toEqual(['taskplanner']);
});

test('a folder without .tasks/ stays silent', async ($, on) => {
  const world = engine(on, { hasBoard: false });
  await startSession($, world.clock);
  expect(world.reads).toEqual([]);

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' });
  expect(await band.find({ type: 'Text', text: /TASK-/ })).toBeUndefined();

  await $.command.run({ command: 'taskboard', args: '' });
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' });
  expect(await ui.find({ type: 'Text', text: /No \.tasks\/ board/ })).toBeDefined();
  expect(world.reads).toEqual([]);
  expect(world.calls).toEqual([]);
});

test('with no surface attached the commands answer with the board digest', async ($, on) => {
  const world = engine(on, { surfaces: [] });
  for (const command of ['taskboard', 'taskplanner:board']) {
    const answer = await $.command.run({ command, args: '' });
    expect(answer.text).toBe(
      'Backlog 1 · Next 0 · In Progress 1 · Done 2 · Rejected 0\n- In Progress: TASK-001 P1 First task',
    );
  }
  expect(world.opened).toEqual([]);
});

test('a taken /taskboard leaves /taskplanner:board working', async ($, on) => {
  const world = engine(on, { takenCommands: ['taskboard'] });
  await startSession($, world.clock);
  expect(world.registered).toEqual([]);
  await $.command.run({ command: 'taskplanner:board', args: '' });
  expect(world.opened).toEqual(['taskplanner']);
});

for (const decision of ['ask', 'deny'] as const) {
  test(`a model call to the TaskPlanner tools keeps its "${decision}"`, async ($, on) => {
    engine(on);
    on('tool.check', () => ({ decision }));
    const verdict = await $.tool.check({
      tool: 'mcp__plugin_taskplanner_taskplanner__taskplanner_move',
      input: { task_id: 'TASK-001', target_state: 'Done' },
    });
    expect(verdict.decision).toBe(decision);
  });
}

test('a new task is created through the server and opens', async ($, on) => {
  const world = engine(on);
  await startSession($, world.clock);
  await $.command.run({ command: 'taskboard', args: '' });

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface });
    expect(await ui.find({ key: 'new-task' })).toBeDefined();
    await ui.unmount();
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' });
  await ui.press({ key: 'new-task' });
  await ui.select({ key: 'new-priority', value: 'P1' });
  await ui.input({ key: 'new-title', text: 'Write the docs' });
  expect(world.calls).toEqual([
    {
      server: SERVER,
      tool: 'taskplanner_create',
      args: { workspace_root: ROOT, title: 'Write the docs', priority: 'P1', state: 'Backlog' },
    },
  ]);
  expect(await ui.find({ type: 'Text', text: 'Created TASK-005 in Backlog.' })).toBeDefined();
});

test('the Create button uses the typed title and the chosen state', async ($, on) => {
  const world = engine(on);
  await startSession($, world.clock);
  await $.command.run({ command: 'taskboard', args: '' });

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' });
  await ui.press({ key: 'new-task' });
  await ui.select({ key: 'new-state', value: 'Next' });
  await ui.input({ key: 'new-title', text: 'Plan the release', kind: 'change' });
  await ui.press({ key: 'create-task' });
  expect(world.calls.map((call) => call.args)).toEqual([
    { workspace_root: ROOT, title: 'Plan the release', priority: 'P2', state: 'Next' },
  ]);
  expect((await ui.find({ key: 'task-markdown' }))?.text).toMatch(/^## TASK-005: Plan the release/);
});

test('an empty title asks for one and creates nothing', async ($, on) => {
  const world = engine(on);
  await startSession($, world.clock);
  await $.command.run({ command: 'taskboard', args: '' });
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' });
  await ui.press({ key: 'new-task' });
  await ui.press({ key: 'create-task' });
  expect(world.calls).toEqual([]);
  expect(await ui.find({ type: 'Text', text: 'Give the task a title first.' })).toBeDefined();
  await ui.press({ key: 'cancel-new' });
  expect(await ui.find({ key: 'task-TASK-001' })).toBeDefined();
});

test('Edit with Claude drafts the request in the prompt', async ($, on) => {
  const world = engine(on);
  await startSession($, world.clock);
  await $.command.run({ command: 'taskboard', args: '' });
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' });
  await ui.press({ key: 'task-TASK-001' });
  await ui.press({ key: 'edit' });
  expect(world.filled).toEqual(['Update TASK-001 (First task): ']);
  expect(world.submitted).toEqual([]);
  expect(
    await ui.find({
      type: 'Text',
      text: 'Describe the change in the prompt below and press Enter.',
    }),
  ).toBeDefined();
});

test('a board in a parent folder of the session is found, read and written there', async ($, on) => {
  const world = engine(on, { cwd: '/work/packages/app' });
  await startSession($, world.clock);
  await $.command.run({ command: 'taskboard', args: '' });
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' });
  expect(await ui.find({ key: 'task-TASK-001' })).toBeDefined();
  await ui.press({ key: 'task-TASK-001' });
  await ui.press({ key: 'move-next' });
  expect(world.calls[0]?.args.workspace_root).toBe('/work');
});

test('Show all lifts the 50-task cap for that state', async ($, on) => {
  const world = engine(on, { backlogTasks: 53 });
  await startSession($, world.clock);
  await $.command.run({ command: 'taskboard', args: '' });
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' });
  await ui.press({ key: 'tab-backlog' });
  expect(await ui.find({ type: 'Text', text: 'Showing 50 of 53.' })).toBeDefined();
  expect(await ui.find({ key: 'task-TASK-152' })).toBeUndefined();
  await ui.press({ key: 'show-all' });
  expect(await ui.find({ key: 'task-TASK-152' })).toBeDefined();
  expect(await ui.find({ key: 'show-all' })).toBeUndefined();
});

test('a task created while the board is reloading still opens', async ($, on) => {
  const world = engine(on);
  await startSession($, world.clock);
  await $.command.run({ command: 'taskboard', args: '' });
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' });
  await ui.press({ key: 'new-task' });

  const release = world.holdReads();
  await $.tool.call({ tool: 'Edit', file_path: '/work/.tasks/BACKLOG.md' });
  const reloading = world.clock.settle();
  const created = ui.input({ key: 'new-title', text: 'Created mid-reload' });
  release();
  await reloading;
  await created;

  expect(world.calls.map((call) => call.tool)).toEqual(['taskplanner_create']);
  expect(await ui.find({ type: 'Text', text: 'Created mid-reload' })).toBeDefined();
  expect(await ui.find({ key: 'edit' })).toBeDefined();
  expect(await ui.find({ key: 'move-backlog' })).toBeUndefined();
});

test('after /cd to another project the pane reads and writes the new board', async ($, on) => {
  const world = engine(on, { boardRoots: [ROOT, '/other'] });
  await startSession($, world.clock);
  await $.command.run({ command: 'taskboard', args: '' });
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' });
  expect(await ui.find({ key: 'task-TASK-001' })).toBeDefined();

  world.changeDirectory('/other');
  await $.tool.call({ tool: 'Edit', file_path: '/other/.tasks/BACKLOG.md' });
  await world.clock.settle();
  await ui.press({ key: 'task-TASK-001' });
  await ui.press({ key: 'move-next' });
  expect(world.calls[0]?.args.workspace_root).toBe('/other');
});
