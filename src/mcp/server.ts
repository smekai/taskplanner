import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ConfigManager } from '../core/config/configManager.js';
import { FileStore } from '../core/store/fileStore.js';
import { TaskStore } from '../core/store/taskStore.js';
import { Task, Priority, isPriority } from '../core/model/task.js';
import { buildBoardViewModel } from '../core/view/boardViewModel.js';

function findExistingTasksDir(rootDir: string): string | null {
  let current = path.resolve(rootDir);
  let previous = '';
  while (current !== previous) {
    const tasksDir = path.join(current, '.tasks');
    if (fs.existsSync(path.join(tasksDir, 'config.json'))) return tasksDir;
    previous = current;
    current = path.dirname(current);
  }
  return null;
}

function candidateRoots(clientRoots: string[], explicitRoot?: string): string[] {
  const candidates = new Set<string>();
  const push = (value: string | undefined) => {
    if (!value || !value.trim()) return;
    candidates.add(path.resolve(value));
  };

  push(explicitRoot);
  push(process.env.TASKPLANNER_WORKSPACE_ROOT);
  for (const root of clientRoots) push(root);
  push(process.cwd());
  push(process.env.CURSOR_WORKSPACE_ROOT);
  push(process.env.VSCODE_WORKSPACE_ROOT);
  push(process.env.PWD);
  push(process.env.INIT_CWD);
  push(path.resolve(__dirname, '..', '..'));

  try {
    const realDistDir = fs.realpathSync(__dirname);
    push(path.resolve(realDistDir, '..', '..'));
  } catch {
    // best-effort only
  }

  return Array.from(candidates);
}

async function readClientRoots(): Promise<string[]> {
  if (!server.server.getClientCapabilities()?.roots) return [];
  try {
    const result = await server.server.listRoots();
    return result.roots.flatMap((root) => {
      try {
        const url = new URL(root.uri);
        return url.protocol === 'file:' ? [fileURLToPath(url)] : [];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

async function findTasksDir(explicitRoot?: string): Promise<string> {
  const checked: string[] = [];
  for (const root of candidateRoots(await readClientRoots(), explicitRoot)) {
    checked.push(root);
    const resolved = findExistingTasksDir(root);
    if (resolved) return resolved;
  }
  throw new Error(
    `No .tasks/ directory found. Checked: ${checked.join(', ')}. ` +
      'Open a workspace with .tasks/ (or run "TaskPlanner: Initialize Project" first).',
  );
}

async function freshStore(explicitRoot?: string): Promise<{
  taskStore: TaskStore;
  configManager: ConfigManager;
  workspaceRoot: string;
}> {
  const tasksDir = await findTasksDir(explicitRoot);
  const configManager = new ConfigManager(tasksDir);
  configManager.load();
  const fileStore = new FileStore(tasksDir);
  const taskStore = new TaskStore(configManager, fileStore);
  taskStore.reload();
  return { taskStore, configManager, workspaceRoot: path.dirname(tasksDir) };
}

function formatTask(task: Task, stateName: string): string {
  const lines: string[] = [];
  lines.push(`## ${task.id}: ${task.title}`);
  const meta: string[] = [`Priority: ${task.priority}`, `Status: ${stateName}`];
  if (task.tags.length > 0) meta.push(`Tags: ${task.tags.join(', ')}`);
  if (task.assignee) meta.push(`Assignee: ${task.assignee}`);
  if (task.updatedAt) meta.push(`Updated: ${task.updatedAt}`);
  lines.push(meta.join(' | '));
  if (task.description.trim()) {
    lines.push('', task.description.trim());
  }
  if (task.plan?.trim()) {
    lines.push('', '### Plan', task.plan.trim());
  }
  return lines.join('\n');
}

function structuredTask(task: Task, stateName: string): Record<string, unknown> {
  return { ...task, state: stateName };
}

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const CREATE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

const MODIFY_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
} as const;

const WORKSPACE_ROOT_INPUT = z
  .string()
  .min(1)
  .optional()
  .describe(
    'Absolute path to the active repository workspace. Always pass the current workspace root when known; Codex launches plugin MCP servers from the plugin cache.',
  );

const server = new McpServer({
  name: 'taskplanner',
    version: '2.0.1',
});

// ── taskplanner_board ───────────────────────────────────
server.registerTool(
  'taskplanner_board',
  {
    description: 'Get a board overview with task counts per state and optionally list all tasks',
    inputSchema: {
      workspace_root: WORKSPACE_ROOT_INPUT,
      include_tasks: z
        .boolean()
        .optional()
        .describe('If true, include full task listings per state (default: false)'),
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  async ({ workspace_root, include_tasks }) => {
    const { taskStore } = await freshStore(workspace_root);
    const config = taskStore.config;
    const lines: string[] = ['# Task Board'];
    const states: Record<string, unknown>[] = [];

    for (const state of config.states) {
      taskStore.ensureStateLoaded(state.name);
      const tasks = taskStore.getTasksByState(state.name);
      states.push({
        name: state.name,
        count: tasks.length,
        ...(include_tasks ? { tasks: tasks.map((task) => structuredTask(task, state.name)) } : {}),
      });
      lines.push(`\n## ${state.name} (${tasks.length})`);

      if (include_tasks && tasks.length > 0) {
        for (const task of tasks) {
          lines.push(
            `- **${task.id}**: ${task.title} [${task.priority}]${task.assignee ? ` @${task.assignee}` : ''}`,
          );
        }
      }
    }

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
      structuredContent: { states, includeTasks: include_tasks === true },
    };
  },
);

// ── taskplanner_list ────────────────────────────────────
server.registerTool(
  'taskplanner_list',
  {
    description: 'List tasks for a specific state or all states, with optional text query filter',
    inputSchema: {
      workspace_root: WORKSPACE_ROOT_INPUT,
      state: z
        .string()
        .optional()
        .describe(
          'State name to filter by (e.g. "Backlog", "Next", "In Progress", "Done", "Rejected"). Omit for all states.',
        ),
      query: z.string().optional().describe('Text query to filter tasks by ID, title, or assignee'),
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  async ({ workspace_root, state, query }) => {
    const { taskStore } = await freshStore(workspace_root);
    const config = taskStore.config;
    const statesToList = state
      ? config.states.filter((s) => s.name.toLowerCase() === state.toLowerCase())
      : config.states;

    if (state && statesToList.length === 0) {
      const validNames = config.states.map((s) => s.name).join(', ');
      return {
        content: [
          {
            type: 'text',
            text: `Unknown state "${state}". Valid states: ${validNames}`,
          },
        ],
        isError: true,
      };
    }

    const lines: string[] = [];
    const structuredTasks: Record<string, unknown>[] = [];
    let totalCount = 0;

    for (const s of statesToList) {
      taskStore.ensureStateLoaded(s.name);
      let tasks = taskStore.getTasksByState(s.name);
      if (query) {
        const q = query.toLowerCase();
        tasks = tasks.filter(
          (t) =>
            t.id.toLowerCase().includes(q) ||
            t.title.toLowerCase().includes(q) ||
            (t.assignee && t.assignee.toLowerCase().includes(q)),
        );
      }
      if (tasks.length === 0) continue;

      lines.push(`## ${s.name} (${tasks.length})`);
      for (const task of tasks) {
        lines.push(formatTask(task, s.name), '\n---');
        structuredTasks.push(structuredTask(task, s.name));
      }
      totalCount += tasks.length;
    }

    if (totalCount === 0) {
      return {
        content: [{ type: 'text', text: 'No tasks found matching the criteria.' }],
        structuredContent: { tasks: [], totalCount: 0, state: state ?? null, query: query ?? null },
      };
    }

    return {
      content: [{ type: 'text', text: `${totalCount} task(s) found\n\n${lines.join('\n')}` }],
      structuredContent: {
        tasks: structuredTasks,
        totalCount,
        state: state ?? null,
        query: query ?? null,
      },
    };
  },
);

// ── taskplanner_get ─────────────────────────────────────
server.registerTool(
  'taskplanner_get',
  {
    description: 'Get full details of a single task by its ID',
    inputSchema: {
      workspace_root: WORKSPACE_ROOT_INPUT,
      task_id: z.string().describe('Task ID (e.g. "TASK-001")'),
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  async ({ workspace_root, task_id }) => {
    const { taskStore } = await freshStore(workspace_root);
    const found = taskStore.findTask(task_id);
    if (!found) {
      return {
        content: [{ type: 'text', text: `Task "${task_id}" not found.` }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: formatTask(found.task, found.stateName) }],
      structuredContent: { task: structuredTask(found.task, found.stateName) },
    };
  },
);

// ── taskplanner_create ──────────────────────────────────
server.registerTool(
  'taskplanner_create',
  {
    description: 'Create a new task. Returns the created task with its auto-generated ID.',
    inputSchema: {
      workspace_root: WORKSPACE_ROOT_INPUT,
      title: z.string().describe('Task title'),
      description: z.string().optional().describe('Task description in markdown'),
      priority: z
        .enum(['P0', 'P1', 'P2', 'P3', 'P4'])
        .optional()
        .describe('Priority level (default: P2)'),
      tags: z.array(z.string()).optional().describe('Tags for the task'),
      assignee: z.string().optional().describe('Assignee name'),
      state: z.string().optional().describe('Target state (default: "Backlog")'),
    },
    annotations: CREATE_ANNOTATIONS,
  },
  async ({ workspace_root, title, description, priority, tags, assignee, state: targetState }) => {
    const { taskStore, configManager } = await freshStore(workspace_root);
    const stateName = targetState || 'Backlog';
    const validState = configManager
      .get()
      .states.find((s) => s.name.toLowerCase() === stateName.toLowerCase());
    if (!validState) {
      return {
        content: [{ type: 'text', text: `Unknown state "${stateName}".` }],
        isError: true,
      };
    }

    const p = priority && isPriority(priority) ? (priority as Priority) : Priority.P2;
    const task = taskStore.createTask(
      {
        title,
        description: description || '',
        priority: p,
        tags: tags || [],
        assignee,
      },
      validState.name,
    );

    return {
      content: [
        {
          type: 'text',
          text: `Created ${task.id}: ${task.title} [${task.priority}] in ${validState.name}`,
        },
      ],
      structuredContent: { task: structuredTask(task, validState.name) },
    };
  },
);

// ── taskplanner_move ────────────────────────────────────
server.registerTool(
  'taskplanner_move',
  {
    description: 'Move a task to a different state (e.g. from Backlog to In Progress)',
    inputSchema: {
      workspace_root: WORKSPACE_ROOT_INPUT,
      task_id: z.string().describe('Task ID to move'),
      target_state: z
        .string()
        .describe('Target state name (e.g. "Backlog", "Next", "In Progress", "Done", "Rejected")'),
    },
    annotations: MODIFY_ANNOTATIONS,
  },
  async ({ workspace_root, task_id, target_state }) => {
    const { taskStore, configManager } = await freshStore(workspace_root);
    const validState = configManager
      .get()
      .states.find((s) => s.name.toLowerCase() === target_state.toLowerCase());
    if (!validState) {
      return {
        content: [{ type: 'text', text: `Unknown state "${target_state}".` }],
        isError: true,
      };
    }

    const result = taskStore.moveTask(task_id, validState.name);
    if (!result) {
      return {
        content: [{ type: 'text', text: `Task "${task_id}" not found.` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Moved ${result.id}: ${result.title} → ${validState.name}`,
        },
      ],
      structuredContent: { task: structuredTask(result, validState.name) },
    };
  },
);

// ── taskplanner_update ──────────────────────────────────
server.registerTool(
  'taskplanner_update',
  {
    description: 'Update fields of an existing task',
    inputSchema: {
      workspace_root: WORKSPACE_ROOT_INPUT,
      task_id: z.string().describe('Task ID to update'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      priority: z.enum(['P0', 'P1', 'P2', 'P3', 'P4']).optional().describe('New priority'),
      tags: z.array(z.string()).optional().describe('New tags (replaces existing)'),
      assignee: z.string().optional().describe('New assignee'),
      plan: z.string().optional().describe('New or updated plan text'),
    },
    annotations: MODIFY_ANNOTATIONS,
  },
  async ({ workspace_root, task_id, title, description, priority, tags, assignee, plan }) => {
    const { taskStore } = await freshStore(workspace_root);
    const existing = taskStore.findTask(task_id);
    const updates: Partial<Omit<Task, 'id'>> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (priority !== undefined && isPriority(priority)) updates.priority = priority as Priority;
    if (tags !== undefined) updates.tags = tags;
    if (assignee !== undefined) updates.assignee = assignee;
    if (plan !== undefined) updates.plan = plan;

    const result = taskStore.updateTask(task_id, updates);
    if (!result) {
      return {
        content: [{ type: 'text', text: `Task "${task_id}" not found.` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Updated ${result.id}: ${result.title} [${result.priority}]`,
        },
      ],
      structuredContent: {
        task: structuredTask(result, existing?.stateName ?? 'Unknown'),
      },
    };
  },
);

// ── taskplanner_board_data (JSON for the visual board UI) ──
server.registerTool(
  'taskplanner_board_data',
  {
    description: 'Get board state as JSON (states + tasks). Used by the visual board iframe.',
    inputSchema: {
      workspace_root: WORKSPACE_ROOT_INPUT,
      query: z.string().optional().describe('Optional text query to filter tasks'),
      include_completed: z
        .boolean()
        .optional()
        .describe('If true, force-load Done/Rejected states before building board data'),
      limit: z
        .number()
        .int()
        .positive()
        .nullable()
        .optional()
        .describe(
          'Per-state task limit. Omit for default, set null to disable cap and return all tasks.',
        ),
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  async ({ workspace_root, query, include_completed, limit }) => {
    const { taskStore, configManager, workspaceRoot } = await freshStore(workspace_root);
    if (include_completed) {
      taskStore.ensureStateLoaded('Done');
      taskStore.ensureStateLoaded('Rejected');
    }
    const viewModel = buildBoardViewModel(taskStore, configManager, {
      searchQuery: query,
      limit,
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(viewModel) }],
      structuredContent: { board: viewModel, workspaceRoot },
    };
  },
);

// ── taskplanner_board_visual (MCP Apps UI entry) ─────────
// MCP Apps spec: https://modelcontextprotocol.io/extensions/apps
const BOARD_RESOURCE_URI = 'ui://taskplanner/board';
const MCP_APP_MIME_TYPE = 'text/html;profile=mcp-app';
const LEGACY_UI_META_KEY = 'ui/resourceUri';

let cachedBoardHtml: string | null = null;
function readBoardHtml(): string {
  if (cachedBoardHtml) return cachedBoardHtml;
  const htmlPath = path.join(__dirname, '..', 'ui', 'board', 'index.html');
  cachedBoardHtml = fs.readFileSync(htmlPath, 'utf8');
  return cachedBoardHtml;
}

server.registerResource(
  'TaskPlanner Board',
  BOARD_RESOURCE_URI,
  {
    mimeType: MCP_APP_MIME_TYPE,
    description: 'Interactive kanban board for TaskPlanner tasks.',
  },
  async () => ({
    contents: [
      {
        uri: BOARD_RESOURCE_URI,
        mimeType: MCP_APP_MIME_TYPE,
        text: readBoardHtml(),
      },
    ],
  }),
);

server.registerTool(
  'taskplanner_board_visual',
  {
    title: 'Visual Task Board',
    description:
      'Request the interactive TaskPlanner board. Rendering depends on MCP Apps host support; use taskplanner_board_data as the guaranteed fallback.',
    inputSchema: {
      workspace_root: WORKSPACE_ROOT_INPUT,
    },
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: {
      ui: { resourceUri: BOARD_RESOURCE_URI },
      [LEGACY_UI_META_KEY]: BOARD_RESOURCE_URI,
    },
  },
  async ({ workspace_root }) => {
    const { taskStore, configManager, workspaceRoot } = await freshStore(workspace_root);
    const viewModel = buildBoardViewModel(taskStore, configManager, {});
    const totals = viewModel.states.map((s) => `${s.name}: ${s.totalCount}`).join(' | ');
    return {
      content: [
        {
          type: 'text',
          text: `TaskPlanner board requested (${totals}). If no interactive view appears, call taskplanner_board_data.`,
        },
      ],
      structuredContent: {
        board: viewModel,
        workspaceRoot,
        renderMode: 'mcp-app',
        fallbackTool: 'taskplanner_board_data',
      },
    };
  },
);

// ── Start ───────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('TaskPlanner MCP server running on stdio');
}

main().catch((e) => {
  console.error('TaskPlanner MCP server failed to start:', e);
  process.exit(1);
});
