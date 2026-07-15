# Done

## TASK-037: Work log convention — `.tasks/WORK_LOG.md` for top-level decisions and outcomes
**Priority:** P2 | **Tags:** docs, core
**Updated:** 2026-07-15 10:30

Add a repo-level rolling work log at `.tasks/WORK_LOG.md`. Agents append one short entry (what, key decisions, outcome) when moving a task to Done. Update AI instructions, skills, and project init to seed the file. Convention-only in v1 — no MCP/parser changes.

### Plan (done)

- Added `.tasks/WORK_LOG.md` with header, entry template, and sample entries from TASK-032/033/035.
- Extended `aiInstructions.ts` with auxiliary file listing, `### Work Log` section, workflow step, and mandatory checklist bullet; exported `DEFAULT_WORK_LOG_CONTENT`.
- Synced `.cursorrules`, `CLAUDE.md`, skills, `continue-task.md`, and example AI files.
- `fileStore.initializeStateFiles()` seeds `WORK_LOG.md` on new project init; Vitest coverage for generated instructions.

---

## TASK-035: Test Cursor Agents MCP board adapter and publish plugin to marketplace
**Priority:** P2 | **Tags:** testing, docs, setup
**Updated:** 2026-04-23 18:44

End-to-end verify the `taskplanner_board_visual` MCP App shipped in TASK-033, then prepare the cursor-plugin for Cursor Marketplace submission.

### Part A — Local test in Cursor 2.6+ (Windows)

1. **Sideload the plugin** (symlink into Cursor's local plugin tree):

   ```cmd
   cmd /c mklink /D "%USERPROFILE%\.cursor\plugins\taskplanner" "C:\Development\taskplanner\cursor-plugin"
   ```

2. **Register it** in `%USERPROFILE%\.claude\plugins\installed_plugins.json`:

   ```json
   { "plugins": { "taskplanner@local": [ { "scope": "user", "installPath": "C:\\Users\\novik\\.cursor\\plugins\\taskplanner" } ] } }
   ```

3. **Enable** in `%USERPROFILE%\.claude\settings.json`:

   ```json
   { "enabledPlugins": { "taskplanner@local": true } }
   ```

4. In Cursor **Settings → Features**, enable **"Include third-party Plugins, Skills, and other configs"**, then restart Cursor.
5. Open a workspace with a `.tasks/` folder (this repo works). Ask the agent "open the visual task board" or invoke `taskplanner_board_visual` directly.
6. **Verify**:
   - Iframe renders inline in the agent chat with columns + cards.
   - Drag a card to another column → `taskplanner_move` fires → the `.md` file on disk updates → VS Code Kanban view reflects the change on next reload.
   - Click a card → details drawer shows description and plan.
   - Empty state (all columns empty) renders gracefully.
7. **Fallback** if Cursor's iframe host misbehaves: smoke-test against `@modelcontextprotocol/ext-apps/examples/basic-host` to isolate whether the bug is in our tool or in Cursor.

### Part B — Pre-submission gaps to close

- Bump `cursor-plugin/.cursor-plugin/plugin.json` version `1.0.0` → `1.1.0` (new tools shipped).
- Re-read the new `taskplanner_board_visual` bullet in `cursor-plugin/README.md` — tighten wording if needed.
- Decide build-artifact policy: `mcp.json` runs `node ${CURSOR_PLUGIN_ROOT}/dist/mcp-server.js` and needs `cursor-plugin/ui/board/index.html`. Either commit `cursor-plugin/dist/` and `cursor-plugin/ui/board/` or add a prepublish build step. Check `.gitignore`.
- Confirm `https://github.com/refined/taskplanner` is public and matches `cursor-plugin/.cursor-plugin/plugin.json`.

### Part C — Marketplace submission

- Submit at <https://cursor.com/marketplace/publish> with the GitHub repo URL.
- Reviewer checklist to self-audit first: valid `.cursor-plugin/plugin.json` manifest, unique kebab-case name (`taskplanner` ✓), README present, logo (`assets/logo.svg` ✓), "tested locally" (Part A).
- **Open question**: whether Cursor requires signed/notarized builds or publisher identity verification — public docs don't mention it; confirm in the reviewer queue if they flag it.

### Plan

- Wire local plugin loading on this machine (`mklink`, `installed_plugins.json`, `settings.json`) and capture what can be verified headlessly vs manually in Cursor UI.
- Complete pre-submission edits: bump plugin version, tighten board-visual README wording, and align artifact policy with `mcp.json` runtime expectations.
- Build MCP artifacts so `cursor-plugin/dist/mcp-server.js` and `cursor-plugin/ui/board/index.html` exist and are ready for packaging.
- Run validation checks (build/lint/test scope as needed) and confirm repository URL consistency in plugin metadata.
- Move TASK-035 to `DONE.md` with a condensed done-plan and add a `[Unreleased]` changelog entry.

---

## TASK-033: Visual views for Cursor Agents Window
**Priority:** P3 | **Tags:** feature, ui
**Updated:** 2026-04-22 21:20

Shipped an interactive TaskPlanner board that renders inline in Cursor agent chats via the MCP Apps extension (`_meta.ui.resourceUri` + `ui://` resource). Cursor 3 plugins still cannot contribute to the real Agents Window sidebar; this is the closest surface the plugin API exposes today. Literal "alongside agent chats" placement remains blocked on Cursor to ship a panel contribution API.

### Plan (done)

- Confirmed MCP Apps spec: `_meta.ui.resourceUri` goes on the **tool description** (not response), URI scheme `ui://`, MIME `text/html;profile=mcp-app`, iframe uses `App.callServerTool` from `@modelcontextprotocol/ext-apps`.
- Added pure `buildBoardViewModel()` in [src/core/view/boardViewModel.ts](../src/core/view/boardViewModel.ts); refactored [src/extension/views/webview/kanbanPanel.ts](../src/extension/views/webview/kanbanPanel.ts) to share it — no behavior change for the VS Code kanban.
- [src/mcp/server.ts](../src/mcp/server.ts): new tools `taskplanner_board_data` (returns JSON view-model) and `taskplanner_board_visual` (carries `_meta.ui.resourceUri`, also sets legacy `ui/resourceUri` for older hosts); new resource `ui://taskplanner/board`. Chose plain `server.registerTool`/`registerResource` over `@modelcontextprotocol/ext-apps/server` helpers to avoid CJS/ESM import friction — the helpers just default the MIME and duplicate the legacy `_meta` key, both inlined.
- Authored self-contained iframe UI in [src/mcp/ui/board/](../src/mcp/ui/board/) (TS + CSS + HTML template, ~500 lines). v1 behaviors: columns per state, priority/assignee/tags on cards, drag-to-move (calls `taskplanner_move`), click-to-open details drawer (calls `taskplanner_get`), Esc closes drawer, error banners. Dark/light theme via `prefers-color-scheme`.
- Extended [esbuild.js](../esbuild.js) with a browser-platform IIFE build that inlines bundled JS + CSS into `board.html` → writes `cursor-plugin/ui/board/index.html` (single file, CSP-safe). MCP server reads it lazily with an in-process cache.
- Excluded `src/mcp/ui/**/*.ts` from the main `tsconfig.json` (DOM lib not appropriate for server code); added `src/mcp/ui/tsconfig.json` for editor-time type checking of the browser UI.
- Verified: `npm run lint` clean, `npm test` 100/100, `npm run build` produces the bundle, manual stdio JSON-RPC smoke test confirms tools/list, `_meta.ui.resourceUri`, `resources/list`, resource read (text/html;profile=mcp-app), and board-data JSON shape are all correct.
- Deferred (follow-up tasks): inline edit via `taskplanner_update`, search/filter, drag-reorder within a column, real-time updates.

---

## TASK-020: Technical debt cleanup and code simplification
**Priority:** P2 | **Tags:** refactor
**Updated:** 2026-04-20 18:00

Audit the codebase for duplicated logic, overly complex methods, and inconsistent base styles. Simplify and unify where possible.

### Plan (done)

- Extracted `stripBom()` in `src/core/parser/taskParser.ts` — removed 3 inlined BOM checks.
- Extracted generic `applyLimit<T>()` in `src/core/filter/taskFilter.ts` — removed 3 duplicated `limit !== null` slice pairs.
- Unified `TaskStore.reloadSync()` / `reloadAsync()`: renamed `applyReloadSync` → `reloadSync`, factored `resetReloadState`, `applyDeferredState`, `applyParsedState` helpers so both paths are ~6 lines each.
- Added `src/core/util/time.ts` exporting `currentTimestamp()`; replaced the static `TaskStore.now()` and its 3 call sites. Format preserved (`YYYY-MM-DD HH:MM`).
- Added `src/extension/config/extensionConfig.ts` with typed getters/setters (`getTaskDirectory`, `getAutoInitAiFiles`, `getAiTool`/`setAiTool`, `getClaudeCliCommand`, `getCursorPlanAndSubmitAfterOpen`, `getSortBy`/`setSortBy`, `getGroupBy`/`setGroupBy`). Routed all `extension.ts`, `initProject.ts`, `implementWithAi.ts`, `setup.ts`, `taskListPanel.ts`, `kanbanPanel.ts` callers through it — zero direct `getConfiguration('taskplanner')` calls remain.
- Added missing `ParseWarning` import in `taskParser.ts` (latent type error surfaced while touching imports).
- Verified: `npm run lint` clean, `npm test` 100/100 passing, `npm run build` succeeds.
- Deliberately skipped: deferred-loading internals, parser state machine, FileStore sync/async pair consolidation, and on-disk timestamp format (each is a separate task).

---

## TASK-034: When two users create a task
**Priority:** P1 | **Tags:** consistency
**Updated:** 2026-04-20 12:00

When two users on the same git repo each create a task on their own branch, both read `nextId` from `.tasks/config.json` and allocate the same `TASK-NNN`. On merge, the repo ends up with duplicate IDs and the next allocation collides again. Fixed by treating the actual task files as the source of truth and reconciling `config.nextId` against the highest ID present on disk both on extension activate and immediately before each task creation.

### Plan (done)

- Added `maxTaskIdNumber(rawContent, prefix)` in `src/core/parser/taskParser.ts` — raw-content scan keeps deferred `Done`/`Rejected` files unparsed.
- Added `ConfigManager.reconcileNextId(floor)` and `reloadFromDisk()`.
- Added `TaskStore.getMaxTaskIdNumber()` — loaded states walk in-memory tasks; deferred states scan raw file content via `fileStore.readRawContent`.
- `TaskStore.createTask` now calls `reloadFromDisk` + `reconcileNextId(getMaxTaskIdNumber()+1)` before `idGenerator.next()`.
- Same reconcile call wired into `extension.ts` after `taskStore.reloadAsync()`.
- Vitest coverage: parser scan (BOM, prefix isolation), `reconcileNextId` (bump vs no-op), `reloadFromDisk` (cross-process pickup), `getMaxTaskIdNumber` reading deferred states without forcing a parse, `createTask` allocating past a higher on-disk ID and past a higher on-disk `nextId`.

---

## TASK-024: Performance measurement and scalability limits
**Priority:** P2 | **Tags:** core, testing
**Updated:** 2026-04-01 19:36

Measure performance of the current parser, serializer, and webview rendering with large task sets. Identify limitations and bottlenecks. Propose architectural updates (pagination, lazy loading, indexing) that would allow the system to handle significantly more tasks.
The first ideas for performance:
Use Async instead of Sync on file loads. Do not load Done and Rejected, before clicing on them. The number of tasks there might be stored in meta data.

### Plan

- **Implemented:** `countTaskHeadings()` (regex line scan); Vitest perf smoke tests (`src/test/core/performance/scalability.perf.test.ts`) and deferred-store tests; `FileStore.readStateAsync` / `readRawContentAsync` / `readAllStatesAsync`; `TaskStore.reloadAsync()` plus deferred **Done**/**Rejected** (heading counts in `getStateDisplayCounts`, full parse on `ensureStateLoaded`); `groupTasks` / `filterAndPaginate` optional `stateDisplayCounts`; sidebar expand/show-all and Kanban `showCompleted` load deferred states; `findTask` / `moveTask` / `createTask` / `fixDuplicates` / search-or-non-status grouping loads as needed; duplicate checks and move-without-id pick list call `ensureAllDeferredStatesLoaded()`.
- **Bottlenecks (measurement):** parsing and serializing very large markdown dominates; grouping iterates all in-memory tasks; webviews still rebuild full HTML on each update.
- **Follow-ups (not implemented):** virtualized list or incremental `postMessage` updates; sidecar offsets or streaming parse for huge single files; optional deferral for additional states.

---

## TASK-032: AI workflow onboarding — activation prompt and stronger instructions (Phase 1)
**Priority:** P2 | **Tags:** feature, setup
**Updated:** 2026-04-01

When a workspace has `.tasks/` but root AI files lack TaskPlanner marker sections, prompt (per workspace, dismissible) to run **Initialize AI Instructions**. Strengthen `generateAiInstructions` output: mandatory **In Progress → Done** steps and a short **### Plan** guideline. Defer later phases (e.g. versioned post-update nudge, MCP tools).

### Plan

- **`scheduleAiInstructionSyncPrompt`** on activate when `.tasks/config.json` exists: if neither `CLAUDE.md` nor `.cursorrules` contains `MARKER_START`, show **InformationMessage** with **Sync AI Instructions** / **Don't show again** / **Later**; workspace state key suppresses repeat.
- **`contentHasTaskPlannerMarkers`** in `aiInstructions.ts` for detection; Vitest coverage.
- **`buildInstructionContent`:** short-plan guidance (3–7 bullets); new **Mandatory checklist** section (move to In Progress before coding, Done + CHANGELOG after, plan timing).

---

## TASK-031: Make tasks draggable in the basic Task list view
**Priority:** P2 | **Tags:** ui, feature
**Updated:** 2026-04-01

Allow users to reorder tasks in the basic Task list view by dragging (within a group and/or between groups, consistent with how grouping works). Align drag-and-drop behavior and feedback with the Kanban board where it makes sense.

### Plan

- **Core:** `TaskStore.reorderTaskToIndex`, `moveTask(..., targetIndex?)` for arbitrary positions; Vitest coverage.
- **List webview:** HTML5 DnD when grouped by **Status** only; `.group-tasks` + **group header** drop zones (collapsed sections); dashed `drag-over`, drop line, `expandGroup` after drop on collapsed header; suppress accidental open after drag.
- **Sort:** `taskplanner.sortBy` value **file** (markdown order) so reordered lists stay stable; Kanban/setup pickers updated.
- **Messages:** `reorderTask`, `moveTask.targetIndex`, `expandGroup`.

---

## TASK-017: Invalid data notification and parser test coverage
**Priority:** P1 | **Tags:** ui, testing, core
**Updated:** 2026-04-01

If a task or text cannot be parsed, display a notification banner at the top of the main screen. Add comprehensive tests for different markdown formats — both valid and malformed inputs.

### Plan

- Introduced `ParseResult` / `ParseWarning`; `parseTasks` returns tasks plus per-line warnings (orphan text, invalid `##` headings, empty titles, BOM strip, harmless `---` when no task open).
- `FileStore` / `TaskStore` propagate warnings; `getWarnings()` grouped by state file for the UI.
- Dismissible warning banner in sidebar task list (list + detail) and Kanban, with Open-at-line; dismiss resets when warning set changes.
- File watcher logs reload failures to **TaskPlanner** output channel instead of swallowing errors.
- Extended Vitest parser coverage: assignee/updated, round-trip serialize, malformed inputs, BOM, duplicates.

---

## TASK-030: Cursor sidebar prompt integration
**Priority:** P3 | **Tags:** feature, ui
**Updated:** 2026-04-01 20:45

Update `dispatchCursor()` to use Cursor 2.3+ prompt injection support: try `workbench.action.chat.open` with query, then `composer.newAgentChat` + clipboard paste, then copy-only fallback. When `aiPlanRequired` is true, prepend a plan-mode line to the composed prompt.

### Plan

- Tier 1: `workbench.action.chat.open` with `{ query, isPartialQuery: false }` in `implementWithAi.ts`
- Tier 2: save clipboard, write prompt, `composer.newAgentChat`, delay 150ms, `editor.action.clipboardPasteAction`, restore clipboard
- Tier 3: existing `copyToClipboard` message
- `promptComposer.ts`: prepend "Use plan mode. Read and analyze before making changes." when `aiPlanRequired`
- Extended Vitest coverage for plan-mode line; Claude Code path unchanged

---

## TASK-026: [Claude] Implement with AI button on tasks
**Priority:** P1 | **Tags:** feature, ui
**Updated:** 2026-04-01 12:38

Add an "Implement with AI" action button to task cards/detail view. When clicked, it should open the available AI extension (Cursor AI / Copilot), pass the task context, and start planning the implementation. The AI should then follow the existing task pipeline (move to In Progress, plan, implement, move to Done).

### Plan

- Added `composeImplementationPrompt()` in `src/core/ai/promptComposer.ts` — pure function composing task context into an AI prompt
- Added `taskplanner.implementWithAi` command in `src/extension/commands/implementWithAi.ts` with auto-detection: Cursor Composer, Claude Code URI handler (`vscode://anthropic.claude-code/open?prompt=...`), or clipboard fallback. Sidebar prompt injection pending anthropics/claude-code#42000
- Added `taskplanner.aiTool` setting (auto/cursor/claude-code/clipboard) to `package.json`
- Added "Implement with AI" primary button to task detail view in `taskListPanel.ts`
- Added hover-revealed AI sparkle button to kanban cards in `kanbanPanel.ts`
- Registered command in `extension.ts`
- Unit tests for prompt composition (8 tests)

---

## TASK-029: Changelog for extension marketplace
**Priority:** P1 | **Tags:** docs, setup
**Updated:** 2026-03-22

The VS Code marketplace page shows an empty Changelog tab. Create and maintain a `CHANGELOG.md` at the project root following the [Keep a Changelog](https://keepachangelog.com) format. The changelog should be auto-updated whenever a task is moved to Done — the AI agent completing the task appends an entry under the current `[Unreleased]` section.

### Plan

- Created `CHANGELOG.md` at project root with retrospective entries from all completed tasks, grouped into versions 1.0.0, 1.1.0, 1.2.0
- Added `[Unreleased]` section at top for ongoing entries
- Added changelog update rule to `CLAUDE.md` so AI agents append entries when moving tasks to Done
- Follows [Keep a Changelog](https://keepachangelog.com) format

---

## TASK-028: search on Kanban board
**Priority:** P3 | **Tags:** UI, search | **Assignee:** Fedor
**Updated:** 2026-03-22 14:09

I want to have same search abilities as on a List Board. Search field only, we already have sorting, and other "query" functionalities is not applicable to Kanban Board.

### Plan

- Added search input to kanban toolbar with 200ms debounced filtering
- Reused existing `filterAndPaginate` + `matchesQuery` from core
- Removed delete button from kanban (not needed for now)
- Reduced column gap from 12px to 6px
- Added branch naming convention (`feature/TASK-NNN-desc`, `bug/TASK-NNN-desc`) to project CLAUDE.md and generated AI instructions
- Key files: `kanbanPanel.ts`, `aiInstructions.ts`, `CLAUDE.md`

---

## TASK-022: Split README into dev docs and user-facing page
**Priority:** P3 | **Tags:** docs
**Updated:** 2026-03-21

Refocused the GitHub README on development process, technical docs, and contribution guide. Created a separate user-facing page with feature highlights, screenshots, and setup guidelines.

---

## TASK-025: Refactor Kanban board column layout
**Priority:** P2 | **Tags:** ui, refactor
**Updated:** 2026-03-21

Restructured Kanban board columns from Next+Backlog | In Progress | Done+Rejected to Backlog | Active (Next+In Progress) | Completed (Done+Rejected).

### Plan

- Replaced `buildNextBacklogColumn()` with `buildActiveColumn()` merging Next + In Progress as sub-zones
- Backlog now renders as a standalone standard column
- In Progress shown at top of Active column, Next below it
- Completed column unchanged

---

## TASK-016: AI plan persistence in task workflow
**Priority:** P1 | **Tags:** core, feature
**Updated:** 2026-03-21

When AI moves a task to In Progress, the plan is saved as a `### Plan` subsection. When moved to Done, the plan is preserved for history.

### Plan

- Added `plan?: string` field to Task model
- Updated parser to detect `### Plan` heading and capture content separately from description
- Updated serializer to render plan section after description
- Updated AI instruction template with plan persistence convention
- Added parser and serializer tests

---

## TASK-018: Auto-increment package version on commit
**Priority:** P3 | **Tags:** setup
**Updated:** 2026-03-21

Automatically bump the patch version in package.json via a git pre-commit hook. Uses `core.hooksPath` pointing to `.githooks/pre-commit` — no husky dependency. The `prepare` npm script configures the hooks path on `npm install`.

---

## TASK-027: Save button should close form and return to list
**Priority:** P1 | **Tags:** ui, feature
**Updated:** 2026-03-20

After clicking the Save button on the task edit form, the form should close and navigate back to the task list view.

---

## TASK-001: Project scaffolding and initial setup
**Priority:** P1 | **Tags:** core, setup | **Assignee:** Fedor
**Updated:** 2026-03-16 00:00

Set up TypeScript project with esbuild bundler, VS Code extension shell, core library structure (models, parser, serializer, store), and Vitest test framework.

---

## TASK-002: Task parser and serializer
**Priority:** P1 | **Tags:** core
**Updated:** 2026-03-16 00:00

Implement regex-based markdown parser that extracts tasks from `## TASK-XXX: Title` headings with priority, tags, epic metadata. Implement serializer that converts Task objects back to markdown format with pipe-separated metadata.

---

## TASK-003: Extension icon and branding
**Priority:** P3 | **Tags:** ui, setup
**Updated:** 2026-03-16 00:00

Create SVG and PNG icons for the TaskPlanner activity bar and marketplace listing.

---

## TASK-004: Kanban board and filtered task list webviews
**Priority:** P1 | **Tags:** ui, feature
**Updated:** 2026-03-16 00:00

Implement Kanban board with drag-and-drop cards between columns (Next+Backlog merged, In Progress, Done+Rejected merged). Implement filtered task list with status dropdown and search-by-ID/title. Both use webview panels with VS Code theme integration.

---

## TASK-005: Task example files and webview polish
**Priority:** P3 | **Tags:** docs, ui
**Updated:** 2026-03-16 00:00

Create example `.tasks/` folder with sample tasks across all states. Polish webview card layout and flow.

---

## TASK-006: AI instruction generation and workflow
**Priority:** P2 | **Tags:** feature, core
**Updated:** 2026-03-16 00:00

Implement auto-generation of `CLAUDE.md` and `.cursorrules` files that teach AI agents the task pickup workflow (read NEXT.md, move to IN_PROGRESS, plan, implement, move to DONE).

---

## TASK-007: Setup menu and configuration options
**Priority:** P2 | **Tags:** ui, feature
**Updated:** 2026-03-18 00:00

Add gear icon setup menu with quick pick: Initialize Project, Initialize AI Instructions, AI Planning toggle, Sort By selection, Open Settings. Add `taskplanner.sortBy` configuration property.

---

## TASK-008: Compact tree view and card layout
**Priority:** P3 | **Tags:** ui
**Updated:** 2026-03-18 00:00

Refine sidebar tree view with priority-colored circle icons, task count badges, and drag-and-drop between states. Compact card layout with full word-wrap titles.

---

## TASK-009: Icon and screenshot updates
**Priority:** P4 | **Tags:** ui, docs
**Updated:** 2026-03-18 00:00

Update activity bar icon design, add overview screenshot for README and marketplace listing.

---

## TASK-010: GitHub community files and CI rules
**Priority:** P3 | **Tags:** setup, docs
**Updated:** 2026-03-18 00:00

Add GitHub repository configuration: community guidelines, contribution rules.

---

## TASK-011: README documentation
**Priority:** P2 | **Tags:** docs
**Updated:** 2026-03-18 00:00

Write comprehensive README with features overview, quick start guide, task format spec, AI agent workflow, views documentation, settings reference, and platform support matrix.

---

## TASK-012: Additional setup options and configuration
**Priority:** P3 | **Tags:** feature, setup
**Updated:** 2026-03-18 00:00

Add Rejected state support, config migration (v1→v2), insert position setting, and additional setup menu entries.

---

## TASK-013: MVP launch preparation
**Priority:** P1 | **Tags:** feature, ui | **Assignee:** Fedor
**Updated:** 2026-03-19 00:00

Replace main screen with filtered task list (grouped by status, hiding Backlog/Done/Rejected by default). Add Assignee and Updated datetime fields to tasks. Add grouping controls (by status, assignee, date, or none). Add search across all fields. Update README.

Additionally, polished the sidebar sorting and grouping UX:
- Use standard VS Code fonts for sort/group dropdown/popup controls.
- Render sort/group as icon buttons that open dropdown menus.
- Remove the Delete button from the task detail editor.
- Show a visible save confirmation toast after saving a task.
- Persist sort (and grouping) in workspace settings and keep sorting consistent between the sidebar tree view and the Kanban board.

---

## TASK-015: Fix Cursor sorting and grouping panels
**Priority:** P1
**Updated:** 2026-03-19 00:00

Use VS Code styling for the sorting/grouping popup controls, switch to icon-based dropdown menus, remove the broken Delete action from the sidebar detail panel, add a clear save confirmation, and keep sorting synchronized across the sidebar tree view and the Kanban board.

---

## TASK-014: Conflict resolution
**Priority:** P1
**Updated:** 2026-03-19 01:00

There is a quite an issue. Somtimes is possible because of conflicts on Github we might endup having the same task with same number twice.
In this case I propose to notify user. We can give user select - or make an autofix with taken the latest task (if date is the same or not presented we should take the latest by status) - so user would need only approve.
Please update after resolution the minor version of a package

---
