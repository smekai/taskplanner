# Done

## TASK-073: One folder per harness: views/ and mcp/, on a domain-only core
**Priority:** P2 | **Tags:** ui, docs | **Epic:** 3.0
**Updated:** 2026-11-01 20:30

Phase B of TASK-071.

## Decisions (2026-10-30)

- **No telemetry in 3.0.** In the Claude Code mod it is impossible (the mods API has no network access). In the MCP server it would be opt-in only, with no consent UI. Only the VS Code extension could do it properly (`vscode.env.createTelemetryLogger`, honouring `telemetry.telemetryLevel`), and that is the one surface we do not need data for. Revisit after 3.0 only if the public numbers are not enough.
- **Collect the public numbers instead.** GitHub traffic expires after 14 days, so it must be saved regularly or it is lost.
- **Keep every view, rather than choosing which to drop.** Drop a tool only once it is clearly irrelevant.
- **Direction:** one core, with every view a separate client of it. No view depends on another view, or on the MCP server, unless it has to.

## Public numbers, 2026-10-30

| Source | Numbers |
| --- | --- |
| Open VSX (Cursor) | 4268 downloads, ★5 (1); **still at 2.4.4** |
| VS Code Marketplace | 116 installs, 553 downloads, ★5 (1) |
| npm `@smekai/taskplanner` | 103 downloads in the last month |
| GitHub | 23★, 4 forks; 14 days: 153 clones (73 unique), 58 views (33 unique) |

## Coupling today

- **VS Code / Cursor extension** — core only (`TaskStore`, `ConfigManager`, `projectSync`). Touches MCP only to write `.mcp.json` during setup. Already independent.
- **MCP server** — core only.
- **MCP UI app** (`src/mcp/ui/board/`) — goes through the server's `taskplanner_board_data`, `taskplanner_get` and `taskplanner_move`. Coupled to the server by design: it runs inside the MCP host.
- **Claude Code mod** — reads through the core parser. Writes through the server's `taskplanner_move` / `taskplanner_create`: the mod has no node `fs`, and auto-mode approval rides on those calls. It also keeps its own `boardDigestText` beside `core/ai/boardDigest`.
- **`board` skill** — names `taskplanner_board_visual` / `taskplanner_board_data`, so it depends on the server.

## To do

- For each view, list what it re-implements that the core already has (start with the mod's digest versus `core/ai/boardDigest`, and the mod's board model versus `core/view/boardViewModel`), then move the shared parts into core.
- Write down which coupling to the MCP server is required (the mod's writes, the UI app) and which is incidental.
- Feed the list of tools each view needs into TASK-074.
- Optional: a small script or weekly scheduled task that saves the public numbers above.

### Plan

Done 2026-11-01. One folder per harness on a domain-only core, and duplicating code between harnesses is fine.
- Layout:
  - `src/core/`;
  - `mcp/` (server + npm package);
  - `views/vscode` (`src/`, `test/`), `views/mcp-app`;
  - `views/claude` (plus `mod/`), `views/cursor`, `views/codex`, each a separate plugin with its own skills and committed `dist/` and `ui/`.
- Moved with `git mv`, imports rewritten by script. The extension-only modules (`promptComposer`, `planMode`, `codexDeepLink`, `aiInstructions`, `projectSync`) left core; `DEFAULT_WORK_LOG_CONTENT` moved to `core/store/archive.ts`.
- Build:
  - esbuild builds once into `mcp/` and copies to every plugin;
  - `bump-version` / `validate-versions` cover 3 manifests and 9 skill files;
  - each validator checks only its own folder;
  - the marketplace `source` fields point at `views/*`.
- Lint boundaries (`no-restricted-imports` overrides) were each verified with throwaway violations (17 caught).
- Docs: root and per-harness `CLAUDE.md` (the Claude one sits in `mod/`, since `--strict` rejects one at the plugin root), README per plugin, CONTRIBUTING, AGENTS.md.
- Found along the way:
  - the VSIX shipped `.claude/settings.local.json`, `.github/` and dev configs (now excluded; 30 files);
  - `tsc` over `mcp/src/server.ts` has a pre-existing TS2536 that nothing runs.
- `release:check` green: 400 tests, smoke, 22 kit tests. npm `index.d.ts` is unchanged. Not done: a local Claude marketplace install from the branch.

---
## TASK-075: Fix the known defects before 3.0
**Priority:** P2 | **Tags:** testing | **Epic:** 3.0
**Updated:** 2026-10-30 20:08

Phase D of TASK-071.

- Sweep the Backlog and open GitHub issues for bugs and rough edges; pick what must land in 3.0.
- Fix the smoke `counter` case regression noted in TASK-070 (from TASK-069), so `npm run release:check` is fully green.
- **A failed move loses the task (seen 2026-10-29, Windows).** `taskplanner_update` on TASK-071 and `taskplanner_move` of TASK-072 ran concurrently, both writing `IN_PROGRESS.md`. The move had already removed TASK-072 from `BACKLOG.md`; its rename `IN_PROGRESS.md.tmp` → `IN_PROGRESS.md` then failed with `EPERM`. The task existed only in the leftover `.tmp` until it was renamed by hand. Two fixes to weigh: write the destination before cutting the source (a crash then leaves a duplicate, which the duplicate detector handles, instead of a loss), and retry the rename on `EPERM`/`EBUSY`, which Windows returns while another handle has the file open. Related: `moveAtomicity.test.ts`, TASK-064.

### Plan

Sweep (2026-10-30): two code defects, both fixed. Issue #2 (Codex plugin outdated) and Open VSX at 2.4.4 are publishing gaps → TASK-076.
- **Create read the whole board** (smoke `counter`, `EISDIR`): TASK-068's `openBoard()` always reloaded every state, undoing TASK-061. Added `openBoard({ loadAllStates })`; the MCP server's `freshStore` skips the full load when a target state is given.
- **A failed move lost the task**: `moveTask` now writes the destination first. `src/core/store/atomicWrite.ts` gives each write its own temp file, retries EPERM/EBUSY/EACCES renames and removes the temp file on final failure.
- Tests: `atomicWrite.test.ts`, a second-write-fails case in `moveAtomicity` (fails on the old order), and `openBoard` without loading states. `release:check` fully green, 399 tests.
- Not fixed: two processes writing the same file at once can still lose one update (read-modify-write); that belongs with TASK-064.

---
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
