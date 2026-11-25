# Done

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
