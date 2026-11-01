# TaskPlanner — Cursor plugin

Markdown-based task management for AI agents. This plugin gives Cursor's agent the ability to read, create, move, plan, and implement tasks stored in `.tasks/` files.

Use this plugin for agent workflows; use the TaskPlanner VS Code extension for persistent editor-side lists and kanban panels.

The same TaskPlanner ships as separate plugins for Claude Code (`views/claude/`) and Codex (`views/codex/`).

## What's included

| Component | Description |
|-----------|-------------|
| **MCP Server** | 8 tools: board overview, list, get, create, move, update, board-data (JSON), board-visual (inline UI) |
| **Cursor commands** | `/list-tasks`, `/next-task`, `/continue-task` slash commands |
| **Skills** | TaskPlanner, initialize, update, list, next-task, continue-task, and board workflows |
| **Rule** | Task markdown format conventions (fires when editing `.tasks/` files) |

## Usage

Once installed, the agent can:

- **List tasks** — `/list-tasks`, or ask naturally
- **Pick next task** — `/next-task`
- **Continue current work** — `/continue-task`
- **Initialize or update a project** — ask to set up TaskPlanner or invoke the initialize/update skills; MCP tools are preferred when available and direct `.tasks` file operations provide the public skills-only fallback
- **Use MCP tools directly** — e.g. "create a P1 task for fixing the login bug"
- **Show the board** — the `board` skill shows it through the MCP tools
- **Show the visual board** — ask "open the visual task board" (or invoke `taskplanner_board_visual`) to render an inline interactive kanban with drag-to-move and click-for-details (requires an [MCP Apps](https://modelcontextprotocol.io/extensions/apps) host, such as Cursor 2.6+)
- **Get board JSON** — invoke `taskplanner_board_data` for a machine-readable board view-model (states + cards), useful for hosts without MCP UI rendering

The MCP board is separate from the VS Code extension's `TaskPlanner: Open Kanban Board` panel.

## Requirements

- A workspace with a `.tasks/` directory (run `TaskPlanner: Initialize Project` from the VS Code extension)
- Node.js (the MCP server runs as a Node process)
- Built plugin artifacts (`dist/mcp-server.js` and `ui/board/index.html`) present in the plugin package

If your host does not support MCP Apps UI, `taskplanner_board_visual` may not render an iframe; use `taskplanner_board_data` and the standard task tools (`taskplanner_list`, `taskplanner_get`, `taskplanner_move`, etc.) as fallback.


## Installation

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
Copy-Item -LiteralPath 'views\cursor' -Destination $cursorPluginTarget -Recurse
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
ln -s /path/to/taskplanner/views/cursor ~/.cursor/plugins/local/taskplanner
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

1. `npm run build`, then `npm run validate:cursor-plugin` from the repo root.
2. Confirm public source repo + open-source license metadata in `views/cursor/.cursor-plugin/plugin.json`.
3. Ensure `.cursor-plugin/marketplace.json` points to `views/cursor`.
4. Submit/update at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish).
