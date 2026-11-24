# Done

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
