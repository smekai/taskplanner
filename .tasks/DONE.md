# Done

## TASK-090: 3.1 phase C: show recurring tasks in every view
**Priority:** P0 | **Tags:** feature, ui | **Epic:** 3.1
**Updated:** 2026-11-25 16:55

Phase C of TASK-088. Starts after TASK-087 (core). It can run alongside phase B.

- **Shared:** `TaskViewItem` (`src/core/model/messages.ts`, `taskToViewItem`) gains `repeats`, `lastRun` and `due`.
- **Claude pane and band** (`views/claude/mod/src/boardModel.ts`, `boardReader.ts`, `paneView.ts`):
  - A Recurring tab with a due badge on each card and in the tab count.
  - The band never picks a recurring task as "next". It may show "N due" separately.
  - Rebuild `views/claude/hooks/register.js`.
- **MCP-app board** (`views/mcp-app/board/board.ts`, `viewOptions.ts`): a Recurring column with a due badge.
- **VS Code:**
  - Kanban (`kanbanPanel.ts` `buildHtml`) shows Recurring as its own column rather than a generic custom state.
  - The task list detail form edits `Repeats` and shows `Last run` and Runs.
- **Agent instructions:** `views/vscode/src/ai/aiInstructions.ts` and the per-host skills (Claude, Cursor, Codex) gain the Recurring state and the rule "record a run, never move it to Done".

Check visually in the Claude pane. Changelog entry.

### Plan

Done:
- **Unchanged, already in place:**
  - Every view draws columns and tabs from `config.states`, so Recurring (TASK-087 migration) needed no layout work.
  - The band's focus order (In Progress → Next → Backlog) never picks a recurring task.
- **Core:** `TaskViewItem` gains `repeats`, `lastRun` and a required `due` (from `isDue` in `taskToViewItem`). The compiler pointed at every fixture that builds one.
- **Claude pane and band:**
  - A due chip, or `🔁 schedule UTC`, on cards; "due" in terminal rows.
  - Tab label "Recurring 2 · 1 due".
  - Task detail shows Repeats (UTC), Last run and the Runs history.
  - Start on a recurring task asks for a run plus `taskplanner_record_run`, never Done.
  - The band adds "· N recurring due". With no other work it shows "Recurring · N due" with a Board button.
  - While the pane polls, it rebuilds from the files it already read when a schedule fires (`scheduleFiredSince`), not only when a file changes.
- **MCP App board:** a `due` / `🔁 schedule` badge on cards. The drawer already got the schedule and history from `taskplanner_get`.
- **VS Code:**
  - Kanban and list cards show `🔁 schedule · due`.
  - The task view has a Repeats (cron, UTC) field, sent on its own when the field commits (never inside another field's autosave) and checked with core `isValidCron` (a warning on invalid input), plus a read-only Last run and Runs list.
  - Values inlined into webview scripts go through `scriptJson`, which escapes `<`, so board text cannot end the `<script>`. Title, description and filters had the same exposure.
- **Agent instructions and skills:**
  - `aiInstructions.ts`: `taskplanner_record_run` and schedule rows, plus a "Recurring tasks" section with the markdown fallback.
  - The `taskplanner` skill in all three hosts covers the same.
  - `initialize-taskplanner` now asks for schema 4 and six states; it was still at schema 2 and five states.
  - The Codex submission expects six state files.
  - This repo's managed blocks were regenerated, and its config migrated to Recurring and schema 4.
- **Review on PR #43:** the four points above (stale due flag while polling, a band for recurring-only boards, the schedule inside other fields' autosave, raw text in inline scripts).
- **Tests:** 513 pass, `release:check` green including the mod kit (two new band tests) and the plugin validators. The new pane and `scriptJson` tests fail without their change.
- **Not checked by eye:** the Claude pane, the MCP board and the VS Code webviews. `docs/INSTALL.md` still shows five state files; that's TASK-093.

---
## TASK-089: 3.1 phase B: MCP tools for recurring tasks
**Priority:** P0 | **Tags:** feature, core | **Epic:** 3.1
**Updated:** 2026-11-25 14:34

Phase B of TASK-088. Starts after TASK-087 (core).

- `taskplanner_create` and `taskplanner_update` accept `repeats`. Reject an invalid cron expression with a clear error.
- New tool `taskplanner_record_run(task_id, result)` that calls `recordRun`. It is the only way a scheduler writes back.
- `formatTask` shows `Repeats`, `Last run` and due/overdue.
- `taskplanner_list` can filter for due recurring tasks.
- The MCP smoke test covers create recurring → due → record_run → not due.

Files: `mcp/src/server.ts`, `scripts/smoke-test-mcp-server.js`. Changelog entry.

### Plan

Done:
- **Create and update** (`mcp/src/server.ts`) take `repeats`, checked with `isValidCron`.
  - An invalid schedule returns `isError` with the expected format.
  - An empty string on update clears the schedule but keeps `Last run` and the history.
  - A create with `repeats` and no state goes to Recurring, falling back to Backlog on boards without it.
- **`taskplanner_record_run(task_id, result?)`** wraps `TaskStore.recordRun`. It is annotated as writing but not destructive. It refuses an unknown task or one without a schedule, and tells the caller how to fix it.
- **Output:**
  - `formatTask` shows `Repeats … UTC (due)`, `Last run` and the Runs list.
  - `structuredTask` gets `due`.
  - `taskplanner_list` takes `due: true`.
  - The board digest in core marks recurring tasks (`🔁 0 7 * * * UTC, due`).
- **Parser:** a hand-edited `**Repeats:**` that is not cron becomes a parse warning on its line, so the board diagnostics show it instead of the task silently never being due.
- **Smoke test:**
  - Covers 8 tools and the `record_run` annotations.
  - A recurring flow on a 3.0 board: migrated state, an invalid schedule refused, due → record_run → not due, the due filter, record_run refused on a one-off task, clearing and restoring the schedule with the history intact.
  - Fixed: it still expected config schema 3 after TASK-087.
- **Docs:** the `mcp/README.md` tool table and the Codex README tool list. Agent instructions and skills come in TASK-090.
- **Review on PR #42:**
  - **History after clearing the schedule:** `### Runs` is now run history when the task has `Repeats` or `Last run`, so a paused task keeps its history and can be scheduled again. History with neither line is refused on write.
  - **CI clean-build check:** the `record_run` example text contained the version, which `bump-version.js` rewrote inside the bundles only. The example no longer contains a version; the script itself is listed in TASK-094.
- **Self-review against `/code-quality`:**
  - The invalid-schedule warning above.
  - The digest test was split into two single-action tests.
  - A redundant guard in the due filter was removed.
  - Left for TASK-094: the default state for a recurring create is decided in the MCP handler (A3). Moving it needs `freshStore` reworked, because the targeted create deliberately avoids reading other states.
- **Checks:** the full gate and the packed smoke test pass.

---
## TASK-087: 3.1 phase A: recurring tasks in core
**Priority:** P0 | **Tags:** feature, core | **Epic:** 3.1
**Updated:** 2026-11-25 12:07

Phase A of TASK-088. Some work never moves to Done. For example, the daily store-status watch runs every day and today lives outside the board as a scheduled task. This phase gives `src/core/` everything the later phases need.

- **State:** `DEFAULT_STATES` (`src/core/model/state.ts`) gains `Recurring` / `RECURRING.md`. A config migration appends it to existing boards (precedent: `addRejectedState` in `configManager.ts`, plus a schema version bump). The migration leaves custom state lists alone apart from appending.
- **Fields:** `repeats?` (cron expression, UTC) and `lastRun?` (`YYYY-MM-DD HH:MM`) on `Task`, as `**Repeats:**` and `**Last run:**`. They go through the grammar, `taskSection.ts`, `taskSerializer.ts` and `sameTask`, the same path as `waitingUntil` in TASK-052.
- **Runs:** a `### Runs` section is parsed and serialized like `### Plan`, newest first, kept to the last 7 lines.
- **Due:** `isDue(repeats, lastRun, now)` in `src/core/util/time.ts` is true when the most recent cron fire time is after `lastRun`. Use `cron-parser` if `dist/extension.js` growth is acceptable (it pulls in Luxon, which TASK-059 wants anyway). Otherwise write a small 5-field evaluator. Measure before deciding and record the choice.
- **Store:** `recordRun(id, result)` stamps `lastRun` and prepends a line to Runs.
- **Special-cased names:** check `DEFERRED_STATE_NAMES`, `COLLAPSED_STATES` and the Done lookup so that Recurring behaves as an active state.

Tests: parser, round trip (byte identity, plus `Repeats` and `Last run` as reserved attribute names), config migration, `isDue`, `recordRun`. Changelog entry.

### Plan

Done:
- **Recurring state:** `Recurring` / `RECURRING.md` is in `DEFAULT_STATES`. Config schema 4 (`addRecurringState`) appends it once, gated on the version, so a removed state stays removed. It is not added when any state already uses the name or the file name in any case (`recurring.md` is the same file on Windows and macOS). A config without a `version` counts as unversioned; an empty or unreadable one does not, so loading it is never rewritten.
- **Fields:** `repeats`, `lastRun` and `runs` on `Task`, as `**Repeats:**`, `**Last run:**` and `### Runs` after Plan. They are reserved attribute names. `### Runs` is run history only in a task with `Repeats`; elsewhere it stays ordinary Markdown, so older boards keep their text. A recurring task's description or plan holding the heading is refused on write.
- **Cron:** `src/core/util/cron.ts` is a hand-written 5-field UTC evaluator: lists, ranges, steps, month and weekday names, `@daily`-style macros, cron's OR rule for the two day fields. It exports `parseCron`, `isValidCron`, `previousFire` and `isDue`. `cron-parser` with Luxon measured 100 KB minified / 31 KB gzipped; the hand-written version adds 1.7 KB to the extension.
- **Store:** `TaskStore.recordRun(id, result, now)` stamps `lastRun`, prepends `YYYY-MM-DD HH:MM — result` and keeps `MAX_RUNS` = 7. It throws for a task without `repeats`.
- **Tests:** 486 pass. Added `cron.test.ts`, recurring round trips, the migration cases (including the case-insensitive collision), `recordRun`, and `### Runs` in non-recurring tasks.
- **Review on PR #40:** two compatibility fixes, the non-recurring `### Runs` and the case-insensitive collision.

---
## TASK-071: TaskPlanner 3.0 release
**Priority:** P1 | **Tags:** feature, ui, docs, ci | **Epic:** 3.0
**Updated:** 2026-11-24 09:56

Scope for the 3.0 release. To be broken into subtasks when work starts.

### 0. First-run experience
- Show the board even when nothing is In Progress — fall back to Next (the next task to pick) instead of showing nothing.
- Initialize the board on first use (first task added / first open), so a freshly installed plugin visibly does something instead of staying silent.

### 1. Display surfaces
- Inventory every way the plugin shows the board today (VS Code/Cursor extension views, Claude Code mod pane and band, `/taskplanner:board` skill, MCP `taskplanner_board` / `board_visual` / `board_data`, Codex, etc.).
- Decide which to keep and which to drop.
- Consider collecting usage statistics (opt-in telemetry or another signal) to base that decision on data.

### 2. MCP surface
- Remove MCP tools/commands that are not used (e.g. check whether `taskplanner_board`, `taskplanner_board_visual`, `taskplanner_board_data` all earn their place).

### 3. Known defects
- Fix all known bugs and rough edges before release.

### 4. Documentation
- Update every README and other docs (root, `packages/mcp-server/`, `plugins/taskplanner/`, marketplace listings, CONTRIBUTING, CHANGELOG).

### 5. Release and announcement
- Release on all platforms: VS Code Marketplace, Open VSX, npm (`@smekai/taskplanner`), Claude Code plugin marketplace, Cursor, Codex.
- Announcement on LinkedIn.
- Possibly start the smek.ai site and publish updates there in a minimalist form.

### Plan

Done: 3.0 shipped as 3.0.12 (tag `v3.0.12`). Phases:
- A. TASK-072: the band falls back In Progress → Next → Backlog and offers Set up when there is no board (PR #19).
- B. TASK-073: every view stays; one folder per harness on a domain-only core; no telemetry (PR #22, #24).
- C. TASK-074: `taskplanner_board_data` removed; 7 tools remain.
- D. TASK-075: known defects fixed (PR #23).
- E. TASK-076: docs, release on every platform. The announcement continues in TASK-085.

---
## TASK-076: Ship 3.0 on every platform and announce it
**Priority:** P2 | **Tags:** docs, ci | **Epic:** 3.0
**Updated:** 2026-11-24 09:56

Phase E of TASK-071. Last in the epic.

- Update READMEs (root, `packages/mcp-server/`, `plugins/taskplanner/`), CONTRIBUTING and marketplace listings.
- ~~Set 3.0.0~~: done in PR #21. Before publishing, add the `[3.0.0]` CHANGELOG section with the date, and get `npm run release:check` green.
- Publish to the VS Code Marketplace, Open VSX, npm `@smekai/taskplanner`, the Claude Code marketplace, Cursor and Codex.
- **Open VSX is behind:** it still serves 2.4.4 (checked 2026-10-30), and it is the largest audience (4268 downloads, mostly Cursor). Check why 2.5.x did not reach it. Consider publishing there even before 3.0.
- Announce on LinkedIn; decide whether smek.ai starts as a minimal updates page.

### Plan

Done:
- Released 3.0.12 (not 3.0.0: plugins on `main` already reported 3.0.11), tagged `v3.0.12`. Live on the VS Code Marketplace, Open VSX and npm `@smekai/taskplanner`; the Codex directory lists TaskPlanner 3.0.18; the Claude plugin installs from `main`.
- The extension and the Codex plugin are called TaskPlanner again; the Codex listing fits OpenAI's limits.
- READMEs refreshed in TASK-084 (Claude GIF, install steps per host, usage table).
- Issue #2 (update the Codex plugin) closed.
- Moved out: the LinkedIn announcement is TASK-085; the Claude directory listing is tracked by the daily release watch (TASK-079).

---
## TASK-079: Claude plugin passes the Anthropic directory checks
**Priority:** P1 | **Tags:** feature, docs, ui | **Epic:** 3.0
**Updated:** 2026-11-24 09:56

List TaskPlanner in Anthropic's public plugin directory (claude.ai/directory/manage, repo `smekai/taskplanner`, folder `views/claude`).

The first validation reported 1 blocking finding, 11 policy holds and 3 warnings:
- **Blocking:** the mod's `tool.check` hook answers `allow` for the pane's own writes, and a mod must leave the decision to the user.
- **Holds:** the mod calls tools itself, submits prompts, reads tool calls, and reads environment paths. The MCP server bundle cannot be inspected. The author name "refined" looks like the publisher "Refine".
- **Warnings:** no icon, and `npx` mentioned in the docs.

Constraint: Cursor, Codex, VS Code/Open VSX and npm stay untouched; changes stay inside `views/claude/`.

### Plan

Done:
- PR #31: the mod no longer answers `tool.check`, so the user's permission rules decide pane writes; the README gives the `permissions.allow` rule (without one, Claude Code asks on every write, anthropics/claude-code#105938). `isOwnPlugin` accepts any marketplace; listing icon added; author is `smekai`.
- PR #32: the SDK's ajv provider is stubbed out of the server bundle (no `new Function`, ajv URL or fast-uri table), with a guard; the README has a hooks table and a note on third-party code in the bundles.
- Changes stayed inside `views/claude/` plus docs and version markers.
- Listing in Anthropic's directory is up to their review; the daily `taskplanner-release-watch` reports when it appears. New findings get a new task.

---
## TASK-086: README sells the product; install details move to docs/INSTALL.md
**Priority:** P0 | **Tags:** docs
**Updated:** 2026-11-24 10:10

The root README should hook a visitor: what TaskPlanner is, the GIF, why it helps, how it works and where it runs. Install and usage steps for every host (Claude, Codex, Cursor, VS Code, local MCP) move to `docs/INSTALL.md`; the extension gets its own Marketplace README.

Say plainly that neither the Claude plugin (Anthropic's directory) nor the Cursor plugin (Cursor Marketplace) can be installed from the official marketplace yet, and give the working alternative for each.

### Plan

Done:
- Root README is a product page: pitch and GIF, Why, How it works with a task example, a "Works with" table that says Claude (Anthropic's directory) and Cursor (Cursor Marketplace) aren't installable from the official marketplace yet, the usage table, short Contributing/License.
- `docs/INSTALL.md` holds every host's steps: Claude repository marketplace, Cursor via the Open VSX extension or a manual copy of `views/cursor`, Codex, VS Code, any MCP host (with `TASKPLANNER_WORKSPACE_ROOT`), plus first steps, task format and agent workflow.
- `views/vscode/README.md` is the Marketplace page (views, setup menu, settings) with absolute URLs; `scripts/package-vsix.js` passes it as `readmePath` (forward slashes; vsce matches packaged paths), and `.vscodeignore` re-includes it and drops the root README to avoid a case clash.
- Stats table's Claude row links to `docs/INSTALL.md`; Claude and Cursor READMEs say the same about marketplaces.
- Not verified: that the Open VSX extension registers the plugin in current Cursor.

---
## TASK-084: README: Claude demo animation, install steps per host, daily stats PR
**Priority:** P0 | **Tags:** docs, ci
**Updated:** 2026-11-24 09:10

The root README still opens with a static VS Code screenshot, while the main experience is now the Claude plugin (board pane and band).

- Record an animation of TaskPlanner working in Claude, on this repository itself, two ways: the Desktop Code tab (driven by computer use) and Claude Code in a terminal. Compare them and use the better one as the README hero.
- Add an Install section with steps for Claude Code / Desktop (repo marketplace, not yet in the official directory), Codex, Cursor, VS Code and npm/MCP.
- Refresh the rest of the README for 3.x.
- Add a marked stats block (version per store, downloads/installs, stars). The daily `taskplanner-release-watch` job keeps an open PR (`feature/readme-stats`) with fresh numbers and never merges or publishes it.

### Plan

Done:
- README hero is `resources/screenshots/claude-board.gif` (Desktop Code tab, 35 s, 0.8 MB), recorded on this repo's own board; the VS Code screenshot moved to the extension section. The GIF stays out of the VSIX.
- Recording: computer use can't drive Claude's own Desktop window, and in Windows Terminal it can't type into Claude Code, so the user drove and a PowerShell screen recorder captured frames that ImageMagick assembled. Only the Desktop variant was recorded.
- New Install section for Claude Code and Desktop (repository marketplace, not yet in the official directory), Codex, Cursor, VS Code and any MCP host. Commands checked against `claude plugin` and `codex plugin` help.
- Usage table between `README-STATS` markers, written by `scripts/update-readme-stats.js` (`npm run readme:stats`) from the release watch's `history.jsonl`; tested in `test/scripts/`.
- The daily `taskplanner-release-watch` job (outside the repo) now rebuilds `feature/readme-stats` from origin/main in its own worktree, refreshes the table and keeps one PR open; it never merges. It starts working once this PR is on main.

---
## TASK-083: Claude: dismiss the "no board here" setup band per folder
**Priority:** P2 | **Tags:** ui, feature
**Updated:** 2026-11-11 22:08

In Claude Code the band above the prompt says `TaskPlanner · no board here` with `Set up` in every folder without `.tasks/config.json`, and cannot be closed.

Add a close button; pressing it asks for confirmation that the band will not come back in this folder (`/taskboard` still offers setup). On confirm, remember the folder in the plugin store (`$.store`) and stop drawing the band there. Other platforms have no such band.

### Plan

Done: the setup band has a close button (`role: 'dismiss'`) that switches to "Never show this here again? Ask Claude to bring it back." with Hide / Cancel. Hide sets `setupDismissed:<session root>` to `true` in `$.store`, one key per folder so concurrent sessions and failed reads cannot drop other folders. The mod also registers a `setup_band` tool (`show: boolean`) so Claude can hide the band or bring it back on request. The store is read before the band first draws, so it never flashes. Covered by paneView/boardModel specs and mod kit tests (hide flow, unreadable store, tool hide/show, previously hidden folder).

---
