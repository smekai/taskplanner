# TaskPlanner — Cursor and Codex Plugin

Markdown-based task management for AI agents. This shared package gives Cursor and Codex the ability to read, create, move, plan, and implement tasks stored in `.tasks/` files.

Use this plugin for agent workflows; use the TaskPlanner VS Code extension for persistent editor-side lists and kanban panels.

## What's included

| Component | Description |
|-----------|-------------|
| **MCP Server** | 8 tools: board overview, list, get, create, move, update, board-data (JSON), board-visual (inline UI) |
| **Cursor commands** | `/list-tasks`, `/next-task`, `/continue-task` slash commands |
| **Skills** | TaskPlanner, initialize, update, list, next-task, and continue-task workflows for Codex and compatible hosts |
| **Rule** | Task markdown format conventions (fires when editing `.tasks/` files) |
| **Manifests** | Host-specific Cursor and Codex manifests backed by one package |

## Usage

Once installed, the agent can:

- **List tasks** — use `/list-tasks` in Cursor, `$taskplanner:list-tasks` in Codex, or ask naturally
- **Pick next task** — use `/next-task` in Cursor or `$taskplanner:next-task` in Codex
- **Continue current work** — use `/continue-task` in Cursor or `$taskplanner:continue-task` in Codex
- **Initialize or update a project** — ask to set up TaskPlanner or invoke the initialize/update skills; MCP tools are preferred when available and direct `.tasks` file operations provide the public skills-only fallback
- **Use MCP tools directly** — e.g. "create a P1 task for fixing the login bug"
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

From the repository root:

```cmd
scripts\install-cursor-plugin-local.cmd
scripts\register-cursor-plugin-local.cmd
```

Then:

1. In Cursor Settings, enable **Include third-party Plugins, Skills, and other configs**
2. Fully restart Cursor (File → Exit, then reopen)
3. Open **Customize** and filter by **User** scope
4. Verify these entries appear:
   - **MCP:** `taskplanner` (toggle ON)
   - **Skills:** `taskplanner`
   - **Rules:** `taskplanner-workflow`
   - **Commands:** `/list-tasks`, `/next-task`, `/continue-task`
5. In Agent chat (workspace with `.tasks/`), ask: **open the visual task board**

Headless checks from repo root:

```cmd
npm run verify:cursor-plugin-local
npm run smoke:mcp-server
```

**Important:** use a real file copy for local testing on Windows. Do not copy the repository package into a symlinked plugin folder. The install script copies to:

`%USERPROFILE%\.cursor\plugins\taskplanner`

### Via the VS Code extension

Install the **Task → Plan → AI** VS Code extension — the plugin is auto-registered.

### Manual (macOS/Linux)

```bash
ln -s /path/to/taskplanner/plugins/taskplanner ~/.cursor/plugins/taskplanner
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
3. Confirm public source repo + open-source license metadata in both manifests under `plugins/taskplanner/`.
4. Ensure the Cursor and Codex marketplace files point to `plugins/taskplanner`.
5. Submit/update at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish).
