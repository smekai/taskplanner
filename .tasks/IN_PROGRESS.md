# In Progress

## TASK-072: Band shows the next task when nothing is in progress, and offers setup when there is no board
**Priority:** P1 | **Tags:** ui, feature | **Epic:** 3.0
**Updated:** 2026-10-29 15:17

Phase A of TASK-071 (3.0 first-run experience).

The Claude Code mod's band above the prompt draws only when a task is In Progress, and a folder without `.tasks/` gets a passive "ask Claude to initialize" line. A freshly installed plugin therefore looks like it does nothing.

- When nothing is In Progress, the band shows the highest-priority Next task; when Next is empty, the highest-priority Backlog task. Tasks whose **Waiting until** has not arrived are skipped. It reads `Next · ID · title` with **Start** and **Board**.
- With no board, the pane and band offer **Set up TaskPlanner**, which runs the `initialize-taskplanner` skill.
- Open, not in this task: whether `taskplanner_create` should initialize `.tasks/` itself on first add.

### Plan

- `boardReader.ts`: pure `focusTask(snapshot, index, now)` — first In Progress, else first non-waiting Next, else first non-waiting Backlog (views are priority-sorted; waiting via core `isWaiting` on the indexed `Task`).
- `boardModel.ts`: drop `inProgressTask`; `NEXT_STATE` / `BACKLOG_STATE` constants.
- `paneView.ts`: `renderBand` takes the focus and `{ open, start }`; In Progress keeps `▶ ID · title` + Board, otherwise `Next · ID · title` + Start + Board. Missing board: Set up button in pane and band.
- `register.ts`: AbovePrompt uses `focusTask`; Start submits `startPrompt`; Set up submits a prompt for the `initialize-taskplanner` skill.
- Tests in `mod/test/` (reader, view, kit); CHANGELOG and README band sentence.
- Risk: the band now shows on almost every board, so it must stay one dim line.

---
## TASK-071: TaskPlanner 3.0 release
**Priority:** P1 | **Tags:** feature, ui, docs, ci | **Epic:** 3.0
**Updated:** 2026-10-29 15:16

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
- A. TASK-072 — band falls back In Progress → Next → Backlog; Set up when no board.
- B. TASK-073 — decide which board surfaces stay; telemetry decision (default: none).
- C. TASK-074 — remove unneeded MCP tools (follows B; breaking for the npm package).
- D. TASK-075 — known defects, smoke `counter` regression.
- E. TASK-076 — docs, 3.0.0, publish everywhere, announcement.

---
