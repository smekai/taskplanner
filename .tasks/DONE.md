# Done

## TASK-072: Band shows the next task when nothing is in progress, and offers setup when there is no board
**Priority:** P1 | **Tags:** ui, feature | **Epic:** 3.0
**Updated:** 2026-10-29 17:02

Phase A of TASK-071 (3.0 first-run experience).

The Claude Code mod's band above the prompt draws only when a task is In Progress, and a folder without `.tasks/` gets a passive "ask Claude to initialize" line. A freshly installed plugin therefore looks like it does nothing.

- When nothing is In Progress, the band shows the highest-priority Next task; when Next is empty, the highest-priority Backlog task. Tasks whose **Waiting until** has not arrived are skipped. It reads `Next · ID · title` with **Start** and **Board**.
- With no board, the pane and band offer **Set up TaskPlanner**, which runs the `initialize-taskplanner` skill.
- Open, not in this task: whether `taskplanner_create` should initialize `.tasks/` itself on first add.

### Plan

- `focusTask` picks In Progress, else the highest-priority non-waiting Next, else Backlog, from full priority-sorted lists that `buildBoard` hands over (review on PR #19: the 50-task view cap could hide the only runnable task).
- Band: `Next · ID · title` with Start + Board; `TaskPlanner · no board here` with Set up where there is no `.tasks/`. Pane: Set up TaskPlanner button. Both submit a prompt for the `initialize-taskplanner` skill.
- Tests: 392 vitest, 22 kit. Merged as PR #19 (admin merge). Not yet checked by hand in Claude Desktop.

---
## TASK-060: A CRLF board parses as an empty one, and a read rewrites config.json
**Priority:** P0 | **Tags:** core, mcp
**Updated:** 2026-10-15 19:48

Two defects: a CRLF board parsed to zero tasks, and every MCP read rewrote `config.json` via migration-on-load.

### Plan

- Split lines on `/\r?\n/` so headings and metadata values stay clean under Git for Windows defaults.
- `load({ persistMigration: false })` for MCP reads; extension still migrates on open. 204 tests.

---
## TASK-070: Claude Code plugin + mod: TaskPlanner pane in Claude Desktop Code tab
**Priority:** P2 | **Tags:** feature, ui
**Updated:** 2026-10-15 19:46

Since 2026-10-01 Claude Code supports **mods**: plugin code that draws its own UI. This task makes `plugins/taskplanner/` a Claude Code plugin whose mod opens a live TaskPlanner pane beside the transcript, in the Claude Desktop Code tab and in the terminal. Cursor's Agents Window still has no such surface (TASK-033).

**Delivered**
- `/taskplanner:board` (the shared `board` skill, answered by the mod) and `/taskboard` open the pane. In Cursor and Codex the same skill shows the board through the MCP tools.
- The pane has tabs per state and task rows; in Desktop, cards with coloured priorities, plus the type scale on Claude Code 2.1.299+.
- The task view has "Move to another state" buttons, **Start with Claude** (submits a prompt) and **Edit with Claude** (drafts "Update TASK-…: " in the prompt box).
- **New task** form: title, priority and state, created by the server so it assigns the ID.
- A band above the prompt shows the In Progress task.
- The mod reads `.tasks/` itself with the core parser, so reading needs no permission. Writes go through the plugin's MCP server (`taskplanner_move` / `taskplanner_create`) from `ui.press` / `ui.input` hooks, where the mod approves them; this also works in auto mode.
- There is no Desktop top-bar icon: the mods API has no launcher hook.

### Plan

- Plugin: `.claude-plugin/plugin.json` (inline `node ${CLAUDE_PLUGIN_ROOT}/dist/mcp-server.js` server, `commands: []`), `hooks/hooks.json`, root `.claude-plugin/marketplace.json`, and a shared `skills/board/SKILL.md`.
- Mod source in `src/claude-mod/`:
  - `register.ts` is the only `$` user;
  - `boardModel.ts`, `boardReader.ts` and `paneView.ts` are pure.
  - esbuild bundles an unminified ESM `plugins/taskplanner/hooks/register.js` on the neutral platform.
- Reads: `$.fs` plus the core `parseTasks` / `filterAndPaginate` / `countTaskHeadings`. `normalizeStates` moved to `src/core/config/configStates.ts` so the mod shares the server's config rules.
- Why reads moved off MCP: a `$.mcp.call` from a timer or `onPress` skips the mod's own `tool.check` (re-entry), so auto mode's classifier refused it. Writes now run inside the `ui.press` / `ui.input` hooks, where the mod's approval applies; this was verified in the debug log.
- Desktop type scale is gated on `$.session.version()` ≥ 2.1.299; 2.1.295 refuses `Text.size`, which was verified.
- Scripts:
  - versions: the bump and validate scripts and the pre-commit hook cover the Claude manifest;
  - `validate:claude-plugin` (claude plugin validate + test, CLI ≥ 2.1.287) is in `release:check`;
  - the server also reads `CLAUDE_PROJECT_DIR`.
- Tests: 377 vitest (model, reader, view); 16 kit tests pass on 2.1.292, 2.1.295 and 2.1.299. `release:check` is green except the smoke `counter` case, a pre-existing regression on main from TASK-069.

---
