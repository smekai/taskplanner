# TaskPlanner — Codex plugin

Markdown-based task management for AI agents. This plugin gives Codex the ability to read, create, move, plan, and implement tasks stored in `.tasks/` files.

The same TaskPlanner ships as separate plugins for Claude Code (`views/claude/`) and Cursor (`views/cursor/`), and as a VS Code extension.

## What's included

TaskPlanner has two Codex packages:

| Component | Repository installation (`views/codex/`) | Public directory upload ZIP |
|-----------|----------------------------------------|-----------------------------|
| **7 skills** | TaskPlanner, initialize, update, list, next-task, continue-task, and board | The same seven workflows |
| **Local MCP server** | 7 tools: `taskplanner_board`, `taskplanner_list`, `taskplanner_get`, `taskplanner_create`, `taskplanner_move`, `taskplanner_update`, `taskplanner_board_visual` | Not bundled |
| **Interactive MCP board** | Included; rendering depends on host support | Not bundled |
| **Manifest and icon** | Included | Included |
| **MIT license** | Repository license | License file included |

`npm run package:codex-skills` creates the public skills-only ZIP. It intentionally removes the MCP declaration and excludes the server and board UI. Those skills prefer compatible TaskPlanner MCP tools when already available; otherwise they work directly with the repository's `.tasks/` files.

Bundled MCP support in the public package is tracked in TASK-081. OpenAI currently requires approval and organization allowlisting for public local-MCP submissions; see [Submit desktop-only plugins](https://developers.openai.com/plugins/deploy/desktop-only).

## Usage

Once installed, the agent can:

- **List tasks** — `$taskplanner:list-tasks`, or ask naturally
- **Pick next task** — `$taskplanner:next-task`
- **Continue current work** — `$taskplanner:continue-task`
- **Initialize or update a project** — ask to set up TaskPlanner or invoke the initialize/update skills; MCP tools are preferred when available and direct `.tasks` file operations provide the public skills-only fallback
- **Use MCP tools directly** — e.g. "create a P1 task for fixing the login bug"
- **Show the board** — `$taskplanner:board` uses MCP when available and reads the board files otherwise
- **Show the visual board** — with the MCP server connected, ask "open the visual task board" (or invoke `taskplanner_board_visual`) to render an inline interactive kanban with drag-to-move and click-for-details (requires an [MCP Apps](https://modelcontextprotocol.io/extensions/apps) host)

Inline rendering is experimental in Codex; text and structured JSON remain available when the UI is not rendered.

## Requirements

- Access to the repository files. If there is no `.tasks/` board yet, ask the initialize-taskplanner skill to create one.
- For the repository-installed MCP server: Node.js and built artifacts (`dist/mcp-server.js` and `ui/board/index.html`) in the plugin package.
- The public skills-only ZIP needs no bundled Node process or MCP connection; it uses the agent's file access when MCP is unavailable.

If your host does not support MCP Apps UI, `taskplanner_board_visual` may not render an iframe; use `taskplanner_board` and the standard task tools (`taskplanner_list`, `taskplanner_get`, `taskplanner_move`, etc.) as fallback.

All TaskPlanner tools accept `workspace_root`. Agent workflows pass the absolute active repository path explicitly because Codex starts bundled MCP servers from the installed plugin cache, not from the repository.

## Installation

### Repository marketplace (skills and local MCP)

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

### Public directory (skills only)

The upload artifact is `dist/codex/taskplanner-codex-skills-<version>.zip`, produced by `npm run package:codex-skills`. Once approved and published, the directory listing distributes the skills-only package described above. Installing it does not install or connect the bundled MCP server from the repository package.

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

1. Run `npm run build`, `npm run validate:codex-plugin`, `npm run package:codex-skills`, then `npm run validate:codex-submission` from the repo root. The plugin validator checks the repository package; the submission validator checks the generated skills-only package and ZIP.
2. Confirm public source repo + open-source license metadata in `views/codex/.codex-plugin/plugin.json`.
3. Ensure `.agents/plugins/marketplace.json` points to `./views/codex`.
4. Submission copy and reviewer cases: [`docs/CODEX_PLUGIN_SUBMISSION.md`](../../docs/CODEX_PLUGIN_SUBMISSION.md).
