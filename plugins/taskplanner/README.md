# TaskPlanner — Cursor, Codex and Claude Code Plugin

Markdown-based task management for AI agents. This shared package gives Cursor, Codex and Claude Code the ability to read, create, move, plan, and implement tasks stored in `.tasks/` files.

Use this plugin for agent workflows; use the TaskPlanner VS Code extension for persistent editor-side lists and kanban panels.

## What's included

| Component | Description |
|-----------|-------------|
| **MCP Server** | 8 tools: board overview, list, get, create, move, update, board-data (JSON), board-visual (inline UI) |
| **Cursor commands** | `/list-tasks`, `/next-task`, `/continue-task` slash commands |
| **Skills** | TaskPlanner, initialize, update, list, next-task, continue-task, and board workflows for Codex and compatible hosts |
| **Rule** | Task markdown format conventions (fires when editing `.tasks/` files) |
| **Claude Code board pane** | `/taskplanner:board` (or `/taskboard`) opens a live board beside the transcript in the Claude Code terminal and the Claude Desktop Code tab; a band above the prompt shows the task in progress |
| **Manifests** | Host-specific Cursor, Codex and Claude Code manifests backed by one package |

## Usage

Once installed, the agent can:

- **List tasks** — use `/list-tasks` in Cursor, `$taskplanner:list-tasks` in Codex, or ask naturally
- **Pick next task** — use `/next-task` in Cursor or `$taskplanner:next-task` in Codex
- **Continue current work** — use `/continue-task` in Cursor or `$taskplanner:continue-task` in Codex
- **Initialize or update a project** — ask to set up TaskPlanner or invoke the initialize/update skills; MCP tools are preferred when available and direct `.tasks` file operations provide the public skills-only fallback
- **Use MCP tools directly** — e.g. "create a P1 task for fixing the login bug"
- **Show the board** — `/taskplanner:board` in Claude Code opens the board pane; `$taskplanner:board` in Codex and the `board` skill in Cursor show it through the MCP tools
- **Show the visual board** — ask "open the visual task board" (or invoke `taskplanner_board_visual`) to render an inline interactive kanban with drag-to-move and click-for-details (requires an [MCP Apps](https://modelcontextprotocol.io/extensions/apps) host, such as Cursor 2.6+)
- **Get board JSON** — invoke `taskplanner_board_data` for a machine-readable board view-model (states + cards), useful for hosts without MCP UI rendering

The MCP board is separate from the VS Code extension's `TaskPlanner: Open Kanban Board` panel. Inline rendering is experimental in Codex; text and structured JSON remain available when the UI is not rendered.

## Requirements

- A workspace with a `.tasks/` directory (run `TaskPlanner: Initialize Project` from the VS Code extension)
- Node.js (the MCP server runs as a Node process)
- Built plugin artifacts (`dist/mcp-server.js` and `ui/board/index.html`) present in the plugin package

If your host does not support MCP Apps UI, `taskplanner_board_visual` may not render an iframe; use `taskplanner_board_data` and the standard task tools (`taskplanner_list`, `taskplanner_get`, `taskplanner_move`, etc.) as fallback.

All TaskPlanner tools accept `workspace_root`. Agent workflows pass the absolute active repository path explicitly because Codex starts bundled MCP servers from the installed plugin cache, not from the repository.

## Installation

### Claude Code (terminal and Claude Desktop Code tab)

The repository marketplace lives at `.claude-plugin/marketplace.json`. In a Claude Code terminal session:

```
/plugin install taskplanner --marketplace smekai/taskplanner
```

From a shell: `claude plugin install taskplanner --marketplace smekai/taskplanner`. In the Claude Desktop app, click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `smekai/taskplanner`, then **Add plugin**. A plugin installed at user scope also loads in the Desktop Code tab's local sessions.

Then, in a project with `.tasks/`, run `/taskplanner:board` (or the shorter `/taskboard`):

- The pane lists tasks per state (digits switch tabs, `r` refreshes). Open states are sorted by priority, while Done and Rejected keep file order, newest first. A long list shows 50 tasks and a **Show all** button. Pressing a task opens its description and plan. From there you can:
  - **Move to another state**: the row of state buttons (digits) changes the task's status, for example Backlog → Next.
  - **Start with Claude** (`s`): sends "Work on TASK-… following the TaskPlanner workflow" as your next prompt.
  - **Edit with Claude** (`e`): puts "Update TASK-…: " in the prompt box for you to finish. Editing title, description, plan, tags or priority goes through Claude.
- **New task** (`n`) opens a short form: title, priority and state. Enter or **Create** creates it, and the server assigns the ID. The new task then opens, ready for **Edit with Claude** to add a description.
- In the Desktop Code tab the list is richer: a titled header with counts per state, tasks as cards with a coloured priority, and a primary **Start with Claude** button. With Claude Code 2.1.299 or later it also uses the Desktop type scale. The terminal keeps a compact list.
- The pane follows the board while it is open. It rereads `.tasks/` after TaskPlanner tools or file edits there, and checks the files every 5 seconds for changes made elsewhere.
- While a task is **In Progress**, a band above the prompt names it; its **Board** button opens the pane.
- Like the MCP server, the pane finds `.tasks/` in the session folder or in any folder above it, so it also works from a package subfolder. Where there is none, the plugin draws nothing.

Requirements and limits:

- Claude Code 2.1.287 or later in the terminal (`claude update`), or 2.1.286 or later in the Desktop Code tab (`/status` shows it). The pane is a Claude Code *mod*, an API Anthropic marks as early access, and it may change between releases.
- The pane is not drawn in Desktop WSL sessions, in the VS Code extension's chat panel, or under `claude -p`. There, the commands reply with a text digest of the board.
- Plugins cannot choose where a pane sits, and the mods API has no way to add a launcher icon to the Desktop top bar. A wide fullscreen terminal docks the pane beside the transcript, and a narrower one opens it above the prompt. The Desktop app places it itself.
- `/taskplanner:board` is this plugin's `board` skill, which the mod answers by opening the pane. In Cursor and Codex the same skill shows the board through the MCP tools. `/taskboard` is the short name; `/tasks` is built into Claude Code and `/taskplanner` belongs to the plugin's main skill.
- The mod runs unsandboxed with your permissions, like any Claude Code mod. It reads the `.tasks/` files itself with the same parser the MCP server uses, so reading the board never needs a permission. `claude plugin validate plugins/taskplanner` lists every call it makes.
- Moving and creating a task go through this plugin's MCP server (`taskplanner_move`, `taskplanner_create`), so IDs, timestamps and file layout stay exactly as the server writes them. When you move or create a task in the pane and your permission rules would only *ask*, the mod approves its own call. So there is no prompt, and the call also passes in auto mode. A `deny` rule, or any other decision your rules reach, stands. When Claude calls the TaskPlanner tools itself, your normal permission rules apply. The mobile surface stays read-only.
- If your project's `.mcp.json` also runs `npx @smekai/taskplanner`, Claude sees the TaskPlanner tools twice. That happens because Claude Code merges servers only when their commands match. Remove the project entry once the plugin is installed.

### Codex app and CLI — repository marketplace

The repository marketplace lives at `.agents/plugins/marketplace.json`. From the repository root, register the non-default local marketplace and install the plugin:

```bash
codex plugin marketplace add .
codex plugin add taskplanner@refined-taskplanner
```

The local development flow applies a Codex cachebuster before reinstalling. Always start a new Codex task after reinstalling so the updated skills are loaded.

Restart the ChatGPT desktop app or start a new Codex task after installation. Open **Plugins**, choose **TaskPlanner**, and verify the `taskplanner` skills and MCP tools are enabled. Node.js must be available because the bundled MCP server runs locally over stdio.

For local changes, rebuild and reinstall the plugin before opening a new task:

```bash
npm run build
npm run validate:codex-plugin
codex plugin add taskplanner@refined-taskplanner
```

### Via Cursor Marketplace

Search for "taskplanner" in the Cursor marketplace panel.

### Local test on Windows (recommended before publish)

Build and validate from the repository root, then copy the plugin into Cursor's supported local-development directory:

```powershell
npm.cmd run build
npm.cmd run validate:cursor-plugin

$cursorPluginTarget = Join-Path $env:USERPROFILE '.cursor\plugins\local\taskplanner'
if (Test-Path -LiteralPath $cursorPluginTarget) {
  Remove-Item -LiteralPath $cursorPluginTarget -Recurse -Force
}
Copy-Item -LiteralPath 'plugins\taskplanner' -Destination $cursorPluginTarget -Recurse
```

Then:

1. Fully restart Cursor or run **Developer: Reload Window**.
2. Open **Customize** and locate the local TaskPlanner plugin.
3. Verify these entries appear:
   - **MCP:** `taskplanner` (toggle ON)
   - **Skills:** `taskplanner`
   - **Rules:** `taskplanner-workflow`
   - **Commands:** `/list-tasks`, `/next-task`, `/continue-task`
4. In Agent chat (workspace with `.tasks/`), ask: **open the visual task board**

Headless checks from repo root:

```cmd
npm run validate:cursor-plugin
npm run smoke:mcp-server
```

The local plugin path is:

`%USERPROFILE%\.cursor\plugins\local\taskplanner`

### Via the VS Code extension

Install the **Task → Plan → AI** VS Code extension — the plugin is auto-registered.

### Manual (macOS/Linux)

```bash
ln -s /path/to/taskplanner/plugins/taskplanner ~/.cursor/plugins/local/taskplanner
```

## Task format

Tasks live in `.tasks/*.md` as `## TASK-###: Title` sections separated by `---`:

```markdown
## TASK-001: Example task
**Priority:** P1
**Tags:** feature, core

Description in markdown.

---
```

## License

MIT. The optional README attribution added during initialization is voluntary and removable; it is not a license condition.

## Marketplace submission checklist

For maintainers preparing a publish/update:

1. Build the repo root artifacts:
   - `npm run build`
2. Validate plugin packaging from repo root:
   - `npm run validate:cursor-plugin`
   - `npm run validate:codex-plugin`
   - `npm run validate:claude-plugin` (needs Claude Code 2.1.287+)
3. Confirm public source repo + open-source license metadata in both manifests under `plugins/taskplanner/`.
4. Ensure the Cursor and Codex marketplace files point to `plugins/taskplanner`.
5. Submit/update at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish).
