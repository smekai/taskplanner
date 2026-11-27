<p align="center">
  <img src="https://raw.githubusercontent.com/smekai/taskplanner/main/resources/icons/taskplanner-color.png" alt="TaskPlanner logo" width="112" height="112" />
</p>

<h1 align="center">TaskPlanner</h1>

<p align="center">
  Git-tracked markdown task planning for developers and AI agents.
</p>

TaskPlanner keeps your tasks as plain markdown in `.tasks/`, next to the code. You and your AI agent work from the same board: the agent picks a task, writes a plan, builds it and moves it to Done, and every step lands in git.

This extension gives VS Code and Cursor a task list, a Kanban board and a sidebar over those files, and writes the agent instruction files. The same board also runs in Claude Code, Claude Desktop and Codex. See [the project page](https://github.com/smekai/taskplanner) and [the install guide](https://github.com/smekai/taskplanner/blob/main/docs/INSTALL.md).

![TaskPlanner in VS Code](https://raw.githubusercontent.com/smekai/taskplanner/main/resources/screenshots/overview.png)

## Quick Start

1. Install **TaskPlanner** from the VS Code Marketplace, or in Cursor from the Extensions view (Open VSX).
2. Open a project folder and click the TaskPlanner icon in the activity bar. The welcome view offers **Initialize Project**.
3. Run **Initialize AI Instructions** to generate `AGENTS.md`, `CLAUDE.md` and `.cursorrules` for your AI tools.
4. Create tasks, and ask your agent to work on the next one.

You can also run `TaskPlanner: Initialize Project` from the command palette (`Ctrl+Shift+P`).

In Cursor, the extension also registers the bundled TaskPlanner plugin: MCP tools, skills, a workflow rule, slash commands and an inline board in Agent chat.

## Views

### Filtered Task List (Main View)

The primary view opens automatically when you click the TaskPlanner sidebar icon. Features:

- **Grouping** — group tasks by Status (default), Assignee, Date, or no grouping
- **Collapsible groups** — Backlog, Done, and Rejected are collapsed by default to focus on active work
- **Search** — search across task ID, title, assignee, and date
- **Status filter** — filter to a specific state
- **Task actions** — move between states, delete, open in editor

### Kanban Board

Open via command palette → `TaskPlanner: Open Kanban Board`. Columns: **Backlog**, **Active** (Next + In Progress), **Recurring** and any custom states, and **Completed** (Done + Rejected). Drag cards between columns or sub-zones to change state. Task cards show assignee and last update time.

### Recurring tasks

Work that never finishes, such as a daily check, lives in the **Recurring** state with a cron schedule. The task list and the Kanban board mark a recurring task as due once its schedule has fired since the last run, and show the schedule. Open a task to see its last run and run history, and to edit the schedule; a schedule that is not valid cron is refused. Schedules are in UTC. TaskPlanner doesn't run them itself: a scheduler starts your agent, and the agent records each run with the `taskplanner_record_run` MCP tool. See [the install guide](https://github.com/smekai/taskplanner/blob/main/docs/INSTALL.md#recurring-tasks).

### Sidebar Tree

Always visible in the activity bar. Tasks grouped under collapsible state nodes with task counts. Drag-and-drop between states. Priority shown as colored icons.

### Agent Chat Board (MCP UI)

On hosts that render MCP Apps, the plugin can display a board inline through `taskplanner_board_visual`. This is supported by Cursor and experimental in Codex. It is separate from the extension Kanban panel and uses the same task files. When the host does not render the UI, use `taskplanner_board` or the standard task tools.

### Parse Warnings

Malformed task markdown triggers a dismissible banner with jump-to-file; errors log to the **TaskPlanner** output channel. Edit `.tasks/*.md` by hand and every view updates instantly.

## Implement with AI (Beta)

Opens a composed prompt for a task in Codex, Cursor, Claude Code, VS Code Chat, the Claude CLI, or the clipboard. Configure it with `taskplanner.aiTool` or **TaskPlanner: Configure AI Provider**.

## Setup Menu

Click the **gear icon** in the TaskPlanner sidebar title bar:

- **Initialize Project** — create `.tasks/` folder and state files
- **Initialize AI Instructions** — generate/update `AGENTS.md`, `CLAUDE.md`, and `.cursorrules`
- **AI Planning: Enable/Disable** — toggle whether agents must plan before coding
- **README Attribution: Enable/Disable** — control future insertion of the voluntary managed README block
- **Sort By** — change task sort order (Priority / Name / ID / File order)
- **Open Settings** — open VS Code extension settings

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `taskplanner.taskDirectory` | `.tasks` | Directory for task files relative to workspace root |
| `taskplanner.autoInitAiFiles` | `true` | Auto-create/update AI instruction files on init |
| `taskplanner.sortBy` | `priority` | Sort order for tasks: `priority`, `name`, `id`, or `file` (markdown order) |
| `taskplanner.groupBy` | `status` | Group tasks by: `status`, `assignee`, `date`, or `none` |
| `taskplanner.aiTool` **(Beta)** | `auto` | AI tool for "Implement with AI": `auto`, `codex-app`, `cursor`, `claude-code`, `vscode-chat`, `claude-cli`, `clipboard` |
| `taskplanner.cursorPlanAndSubmitAfterOpen` **(Beta)** | `true` | Cursor: when AI Planning is enabled, best-effort Plan mode and submit after opening the task |
| `taskplanner.claudeCliCommand` **(Beta)** | `claude {{file}}` | claude-cli: shell command; `{{file}}` is replaced with temp prompt path |

Project config is stored in `.tasks/config.json`. The task format, priorities and agent workflow are described in [the install guide](https://github.com/smekai/taskplanner/blob/main/docs/INSTALL.md#task-format-and-agent-workflow).

## License

MIT. README attribution is appreciated but voluntary and is not a condition of the license.
