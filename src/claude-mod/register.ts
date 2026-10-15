import type {
  CommandRunResult,
  Engine,
  McpToolResult,
  On,
  Timer,
  ToolCheckResult,
} from './modApi.js';
import {
  BOARD_FILE_PATTERN,
  BoardFileStat,
  BoardSnapshot,
  TaskDetail,
  TaskDraft,
  createdTaskId,
  editPrompt,
  startDraft,
  boardDigestText,
  boardSignature,
  errorMessage,
  inProgressTask,
  isCompletedState,
  isOwnPlugin,
  isPaneWriteByOwnPlugin,
  joinPath,
  moveTargetForKey,
  pickTab,
  resultText,
  shouldRefreshAfterTool,
  startPrompt,
  supportsTextScale,
} from './boardModel.js';
import { IndexedTask, buildBoard, readConfigStates, taskDetailOf } from './boardReader.js';
import { renderBand, renderPane } from './paneView.js';

const PANE_ID = 'taskplanner';
const PANE_TITLE = 'TaskPlanner';
const SERVER_KEY = 'taskplanner';
const POLL_INTERVAL_MS = 5000;
const MISSING_BOARD_TEXT = 'No .tasks/ board in this folder.';

let serverName: string | null = null;
let board: BoardSnapshot | null = null;
let taskIndex = new Map<string, IndexedTask>();
let issueCount = 0;
let activeTab: string | null = null;
let detail: TaskDetail | null = null;
let errorText: string | null = null;
let isLoading = false;
let isMissingBoard = false;
let lastSignature: string | null = null;
let pollTimer: Timer | null = null;
let isRefreshing = false;
let needsRefresh = false;
let hasTextScale = false;
let draft: TaskDraft | null = null;
let notice: string | null = null;

async function connectServer($: Engine): Promise<string> {
  if (serverName) return serverName;
  const connection = await $.mcp.connect(SERVER_KEY);
  if (!connection.isConnected) throw new Error(connection.message);
  serverName = connection.server;
  return connection.server;
}

async function callTaskplanner(
  $: Engine,
  tool: string,
  args: Record<string, unknown>,
): Promise<McpToolResult> {
  const server = await connectServer($);
  const root = await $.session.root();
  return $.mcp.call(server, tool, { workspace_root: root, ...args });
}

async function boardExists($: Engine): Promise<boolean> {
  const root = await $.session.root();
  return $.fs.exists(joinPath(root, '.tasks', 'config.json'));
}

async function readTextOrEmpty($: Engine, path: string): Promise<string> {
  try {
    return await $.fs.read(path);
  } catch {
    return '';
  }
}

async function readSignature($: Engine): Promise<string> {
  const root = await $.session.root();
  const tasksDir = joinPath(root, '.tasks');
  const entries = await $.fs.list(tasksDir);
  const files: BoardFileStat[] = [];
  for (const entry of entries) {
    if (entry.kind !== 'file' || !BOARD_FILE_PATTERN.test(entry.name)) continue;
    const stat = await $.fs.stat(joinPath(tasksDir, entry.name));
    files.push({ name: entry.name, size: stat.size, mtimeMs: stat.mtimeMs });
  }
  return boardSignature(files);
}

function forgetBoard(): void {
  board = null;
  taskIndex = new Map();
  issueCount = 0;
  detail = null;
  lastSignature = null;
}

function detailFor(id: string): TaskDetail | null {
  const indexed = taskIndex.get(id);
  return indexed ? taskDetailOf(indexed) : null;
}

async function loadBoard($: Engine): Promise<void> {
  if (!(await boardExists($))) {
    isMissingBoard = true;
    forgetBoard();
    return;
  }
  isMissingBoard = false;
  const root = await $.session.root();
  const tasksDir = joinPath(root, '.tasks');
  const signature = await readSignature($);
  const states = readConfigStates(await $.fs.read(joinPath(tasksDir, 'config.json')));
  const texts = new Map<string, string>();
  for (const state of states) {
    texts.set(state.fileName, await readTextOrEmpty($, joinPath(tasksDir, state.fileName)));
  }
  const read = buildBoard(states, texts, isCompletedState(activeTab) || detail !== null, root);
  board = read.snapshot;
  taskIndex = read.tasks;
  issueCount = read.issueCount;
  activeTab = pickTab(board, activeTab);
  lastSignature = signature;
  if (detail) detail = detailFor(detail.id);
}

async function refreshBoard($: Engine): Promise<void> {
  if (isRefreshing) {
    needsRefresh = true;
    return;
  }
  isRefreshing = true;
  isLoading = true;
  $.ui.invalidate('ui.render');
  try {
    do {
      needsRefresh = false;
      try {
        await loadBoard($);
        errorText = null;
      } catch (error) {
        errorText = errorMessage(error);
      }
    } while (needsRefresh);
  } finally {
    isRefreshing = false;
    isLoading = false;
    $.ui.invalidate('ui.render');
  }
}

async function syncIfChanged($: Engine): Promise<void> {
  try {
    if (!(await boardExists($))) {
      if (!isMissingBoard || board) {
        isMissingBoard = true;
        forgetBoard();
        $.ui.invalidate('ui.render');
      }
      return;
    }
    if (board && (await readSignature($)) === lastSignature) return;
  } catch (error) {
    errorText = errorMessage(error);
    $.ui.invalidate('ui.render');
    return;
  }
  await refreshBoard($);
}

function startPolling($: Engine): void {
  if (pollTimer) return;
  pollTimer = $.clock.every(POLL_INTERVAL_MS, () => {
    void syncIfChanged($);
  });
}

function stopPolling(): void {
  pollTimer?.cancel();
  pollTimer = null;
}

async function openPane($: Engine): Promise<void> {
  await $.ui.open({ id: PANE_ID, title: PANE_TITLE, focus: true, closeOnEscape: true });
  startPolling($);
  await refreshBoard($);
}

async function resumeAfterLoad($: Engine): Promise<void> {
  const panes = await $.ui.panes();
  if (panes.some((pane) => pane.id === PANE_ID)) startPolling($);
  await syncIfChanged($);
}

async function selectTab($: Engine, state: string): Promise<void> {
  const needsCompleted = isCompletedState(state) && !isCompletedState(activeTab);
  activeTab = state;
  detail = null;
  $.ui.invalidate('ui.render');
  if (needsCompleted) await refreshBoard($);
}

function openTask($: Engine, id: string): void {
  notice = null;
  detail = detailFor(id);
  errorText = detail ? null : `${id} is no longer on the board.`;
  $.ui.invalidate('ui.render');
}

async function moveTask($: Engine, id: string, target: string): Promise<void> {
  try {
    const result = await callTaskplanner($, 'taskplanner_move', {
      task_id: id,
      target_state: target,
    });
    if (result.isError) throw new Error(resultText(result));
  } catch (error) {
    errorText = errorMessage(error);
    $.ui.invalidate('ui.render');
    return;
  }
  await refreshBoard($);
}

async function createTask($: Engine): Promise<void> {
  if (!draft) return;
  const title = draft.title.trim();
  if (!title) {
    notice = 'Give the task a title first.';
    $.ui.invalidate('ui.render');
    return;
  }
  const { priority, state } = draft;
  try {
    const result = await callTaskplanner($, 'taskplanner_create', { title, priority, state });
    if (result.isError) throw new Error(resultText(result));
    const id = createdTaskId(result);
    draft = null;
    activeTab = state;
    notice = id ? `Created ${id} in ${state}.` : `Created the task in ${state}.`;
    await refreshBoard($);
    if (id) detail = detailFor(id);
  } catch (error) {
    errorText = errorMessage(error);
  }
  $.ui.invalidate('ui.render');
}

async function editTask($: Engine, task: TaskDetail): Promise<void> {
  const text = editPrompt(task);
  const filled = await $.prompt.fill({ text });
  notice = filled.isFilled
    ? 'Describe the change in the prompt below and press Enter.'
    : `Ask Claude: "${text}…"`;
  $.ui.invalidate('ui.render');
}

async function boardDigest($: Engine): Promise<string> {
  await refreshBoard($);
  if (isMissingBoard) return MISSING_BOARD_TEXT;
  if (!board) return `TaskPlanner: ${errorText ?? 'the board could not be read.'}`;
  return boardDigestText(board);
}

function paneApproval(origin: string, tool: string): ToolCheckResult | null {
  return isPaneWriteByOwnPlugin(origin, tool)
    ? { decision: 'allow', reason: 'Requested from the TaskPlanner board pane.' }
    : null;
}

async function runBoardCommand($: Engine): Promise<CommandRunResult> {
  const surfaces = await $.session.surfaces();
  if (surfaces.length === 0) return { text: await boardDigest($) };
  await openPane($);
  return {};
}

export function register(on: On): void {
  on('session.start', async ($, e, next) => {
    await $.command
      .register({
        name: 'taskboard',
        description: 'Open the TaskPlanner board pane',
        immediate: true,
      })
      .catch((error: unknown) => {
        errorText = errorMessage(error);
      });
    hasTextScale = await $.session
      .version()
      .then(({ version }) => supportsTextScale(version))
      .catch(() => false);
    $.clock.after(0, () => {
      void resumeAfterLoad($);
    });
    return next(e);
  });

  on('command.run', { command: 'taskboard' }, ($) => runBoardCommand($));

  on('command.run', { command: 'taskplanner:board' }, ($) => runBoardCommand($)).catch(
    (_engine, e, next) => next(e),
  );

  on('ui.render', { component: 'Pane', requestId: 'taskplanner' }, async ($, e) => {
    const elements = $.ui.resolve(e);
    return renderPane(
      elements,
      {
        board,
        tab: activeTab,
        detail,
        draft,
        notice,
        error: errorText,
        issueCount,
        isLoading,
        isMissingBoard,
        columns: e.props.bodyColumns,
        surface: e.surface,
        hasTextScale,
      },
      {
        selectTab: (state) => {
          notice = null;
          void selectTab($, state);
        },
        openTask: (id) => openTask($, id),
        back: () => {
          detail = null;
          notice = null;
          $.ui.invalidate('ui.render');
        },
        move: (id, target) => {
          void moveTask($, id, target);
        },
        start: (task) => {
          void $.prompt.submit({ text: startPrompt(task), asUser: true });
        },
        refresh: () => {
          void refreshBoard($);
        },
        edit: (task) => {
          void editTask($, task);
        },
        newTask: () => {
          draft = startDraft(board, activeTab);
          detail = null;
          notice = null;
          $.ui.invalidate('ui.render');
        },
        cancelNew: () => {
          draft = null;
          $.ui.invalidate('ui.render');
        },
        setDraftTitle: (title) => {
          if (draft) draft = { ...draft, title };
        },
        setDraftPriority: (priority) => {
          if (draft) draft = { ...draft, priority };
          $.ui.invalidate('ui.render');
        },
        setDraftState: (state) => {
          if (draft) draft = { ...draft, state };
          $.ui.invalidate('ui.render');
        },
        create: () => {
          void createTask($);
        },
      },
    );
  });

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const task = e.props.hasSurvey ? null : inProgressTask(board);
    if (!task) return next(e);
    const elements = $.ui.resolve(e);
    const below = await next(e);
    return renderBand(elements, task, e.props.bodyColumns, below, () => {
      void openPane($);
    });
  });

  on('ui.press', async ($, e, next) => {
    if (!isOwnPlugin(e.plugin)) return next(e);
    if (e.element === 'create-task' && draft) {
      await createTask($);
      return { element: e.element };
    }
    const target = board && detail ? moveTargetForKey(board, detail.state, e.element) : null;
    if (!target || !detail) return next(e);
    await moveTask($, detail.id, target);
    return { element: e.element };
  }).catch((_engine, e, next) => next(e));

  on('ui.input', async ($, e, next) => {
    if (!isOwnPlugin(e.plugin) || e.element !== 'new-title' || e.kind !== 'submit' || !draft) {
      return next(e);
    }
    draft = { ...draft, title: e.value };
    await createTask($);
    return { element: e.element, value: e.value };
  }).catch((_engine, e, next) => next(e));

  on(
    'tool.check',
    async (_engine, e, next) => paneApproval(next.origin.plugin, e.tool) ?? next(e),
  ).catch((_engine, e, next) => next(e));

  on('tool.call', async ($, e, next) => {
    const result = await next(e);
    if (shouldRefreshAfterTool(e.tool, e)) {
      $.clock.after(0, () => {
        void refreshBoard($);
      });
    }
    return result;
  }).catch((_engine, e, next) => next(e));

  on('ui.close', async (_engine, e, next) => {
    const result = await next(e);
    if (e.id === PANE_ID) {
      detail = null;
      stopPolling();
    }
    return result;
  }).catch((_engine, e, next) => next(e));

  on('turn.complete', async ($, e, next) => {
    const result = await next(e);
    $.clock.after(0, () => {
      void syncIfChanged($);
    });
    return result;
  }).catch((_engine, e, next) => next(e));
}
