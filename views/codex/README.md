# TaskPlanner — Codex plugin

Markdown-based task management for AI agents. This plugin gives Codex the ability to read, create, move, plan, and implement tasks stored in `.tasks/` files.

The same TaskPlanner ships as separate plugins for Claude Code (`views/claude/`) and Cursor (`views/cursor/`), and as a VS Code extension.

## What's included

| Component | Description |
|-----------|-------------|
| **MCP Server** | 8 tools: board overview, list, get, create, move, update, board-data (JSON), board-visual (inline UI) |
| **Skills** | TaskPlanner, initialize, update, list, next-task, continue-task, and board workflows |

## Usage

Once installed, the agent can:

- **List tasks** — `$taskplanner:list-tasks`, or ask naturally
- **Pick next task** — `$taskplanner:next-task`
- **Continue current work** — `$taskplanner:continue-task`
- **Initialize or update a project** — ask to set up TaskPlanner or invoke the initialize/update skills; MCP tools are preferred when available and direct `.tasks` file operations provide the public skills-only fallback
- **Use MCP tools directly** — e.g. "create a P1 task for fixing the login bug"
- **Show the board** — `$taskplanner:board` shows it through the MCP tools
- **Show the visual board** — ask "open the visual task board" (or invoke `taskplanner_board_visual`) to render an inline interactive kanban with drag-to-move and click-for-details (requires an [MCP Apps](https://modelcontextprotocol.io/extensions/apps) host)
- **Get board JSON** — invoke `taskplanner_board_data` for a machine-readable board view-model (states + cards), useful for hosts without MCP UI rendering

Inline rendering is experimental in Codex; text and structured JSON remain available when the UI is not rendered.

## Requirements

- A workspace with a `.tasks/` directory (run `TaskPlanner: Initialize Project` from the VS Code extension)
- Node.js (the MCP server runs as a Node process)
- Built plugin artifacts (`dist/mcp-server.js` and `ui/board/index.html`) present in the plugin package

If your host does not support MCP Apps UI, `taskplanner_board_visual` may not render an iframe; use `taskplanner_board_data` and the standard task tools (`taskplanner_list`, `taskplanner_get`, `taskplanner_move`, etc.) as fallback.

All TaskPlanner tools accept `workspace_root`. Agent workflows pass the absolute active repository path explicitly because Codex starts bundled MCP servers from the installed plugin cache, not from the repository.

## Installation

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

1. `npm run build`, then `npm run validate:codex-plugin` and `npm run validate:codex-submission` from the repo root.
2. Confirm public source repo + open-source license metadata in `views/codex/.codex-plugin/plugin.json`.
3. Ensure `.agents/plugins/marketplace.json` points to `./views/codex`.
4. Submission copy and reviewer cases: [`docs/CODEX_PLUGIN_SUBMISSION.md`](../../docs/CODEX_PLUGIN_SUBMISSION.md).
