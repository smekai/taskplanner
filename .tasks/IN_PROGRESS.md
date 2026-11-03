# In Progress

## TASK-076: Ship 3.0 on every platform and announce it
**Priority:** P2 | **Tags:** docs, ci | **Epic:** 3.0
**Updated:** 2026-11-03 20:49

Phase E of TASK-071. Last in the epic.

- Update READMEs (root, `packages/mcp-server/`, `plugins/taskplanner/`), CONTRIBUTING and marketplace listings.
- ~~Set 3.0.0~~: done in PR #21. Before publishing, add the `[3.0.0]` CHANGELOG section with the date, and get `npm run release:check` green.
- Publish to the VS Code Marketplace, Open VSX, npm `@smekai/taskplanner`, the Claude Code marketplace, Cursor and Codex.
- **Open VSX is behind:** it still serves 2.4.4 (checked 2026-10-30), and it is the largest audience (4268 downloads, mostly Cursor). Check why 2.5.x did not reach it. Consider publishing there even before 3.0.
- Announce on LinkedIn; decide whether smek.ai starts as a minimal updates page.

### Plan

- Release version: the next patch, 3.0.12, not 3.0.0. Plugins on `main` already report 3.0.11, and `update-taskplanner` treats a lower installed version as a downgrade.
- Set it with `scripts/bump-version.js`, rename `[Unreleased]` to `[3.0.12] - 2026-11-03`, check with `validate:versions`, then commit with `--no-verify`, as CLAUDE.md allows for an exact, validated version.
- `npm run release:check`, then `npm run package` for the VSIX and `package:codex-skills` for the Codex portal ZIP.
- The user publishes: VS Code Marketplace and Open VSX (VSIX), npm (`npm publish ./mcp`), a Cursor marketplace re-index, and the Codex portal upload. The Claude plugin comes from `main`.
- Then: tag `v3.0.12`, close issue #2, announce.
- Risk: no manual local check of each channel was done before publishing. Offer a quick local VSIX install first.

---
## TASK-071: TaskPlanner 3.0 release
**Priority:** P1 | **Tags:** feature, ui, docs, ci | **Epic:** 3.0
**Updated:** 2026-11-02 16:39

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

Umbrella for epic 3.0; each phase is its own task, branch and PR. Done when 3.0 has shipped.
- A. TASK-072 — band falls back In Progress → Next → Backlog; Set up when no board. Done (PR #19).
- B. TASK-073 — every view stays, one folder per harness on a domain-only core; no telemetry. Done (PR #22, #24).
- C. TASK-074 — `taskplanner_board_data` removed (it duplicated `board_visual`); 7 tools remain.
- D. TASK-075 — known defects. Done (PR #23).
- E. TASK-076 — docs, 3.0.0, publish everywhere, announcement.

---
