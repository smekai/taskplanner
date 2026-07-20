# Changelog

All notable changes to the **Task → Plan → AI** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.8.0] - 2026-07-20

### Added

- Codex app/CLI support through a shared installable plugin, repository marketplace, workflow skills, structured MCP tools, `AGENTS.md` synchronization, and a Codex “Implement with AI” provider (TASK-038).
- Rolling work log at `.tasks/WORK_LOG.md` — agents append a short What/Decisions/Outcome entry when moving tasks to Done; seeded on project init (TASK-037).
- Interactive task board inside Cursor agent chats via MCP Apps — invoke `taskplanner_board_visual` (requires a host that supports the MCP Apps extension, e.g. Cursor 2.6+). Shows columns with drag-to-move and click-to-view-details (TASK-033).

### Changed

- Internal refactor: removed duplicated BOM stripping, pagination slicing, and sync/async reload scaffolding in core; centralized VS Code extension settings access behind typed getters/setters. No user-visible behavior change (TASK-020).

### Fixed

- Task IDs no longer collide after a merge: `nextId` is reconciled against the highest ID actually present in the task files on activate and before every create, so a stale or merged `config.json` never re-issues an existing ID (TASK-034).

## [1.4.2] - 2026-04-09

### Added

- **(Beta)** Cursor plugin bundled with the extension: MCP server (stdio) with task-oriented tools, slash commands `/list-tasks`, `/next-task`, `/continue-task`, a TaskPlanner **skill**, and a workflow **rule**; intended for agent use alongside `.tasks/` (now located at `plugins/taskplanner/README.md`).

### Changed

- Large **Done** / **Rejected** files: heading-only counts on load, full parse when you expand those groups, use **Show all**, open the Kanban completed section, or when a command needs those tasks; reload uses async I/O. Scalability timing tests added (TASK-024).
- Generated AI instructions (`Initialize AI Instructions`) and **Implement with AI** prompts no longer tell agents to create a git branch; branching remains optional for the user.
- Activity bar, sidebar views, and settings section title use **Task → Plan → AI** (arrow styling) instead of **Task. Plan. AI.**

### Fixed

- Sidebar task list: **Next** group could not be collapsed in some cases.

## [1.3.0] - 2026-04-02

### Added

- **(Beta)** Prompt to **Initialize AI Instructions** on activation when the workspace has `.tasks/` but neither `CLAUDE.md` nor `.cursorrules` contains the TaskPlanner marker block; dismissible per workspace (TASK-032)
- **(Beta)** Stronger generated AI workflow text: mandatory In Progress → Done checklist, CHANGELOG reminder, and short **### Plan** guidance (TASK-032)
- Sidebar task list: drag-and-drop reorder and cross-state moves when grouped by **Status** (Kanban-style feedback); drop on **folded** group headers; optional **File order** sort so order matches markdown (TASK-031)
- Parse warnings for malformed task markdown: dismissible banner in the task list and Kanban with jump-to-file; reload errors log to the **TaskPlanner** output channel (TASK-017)
- **(Beta)** Cursor Tier 1 chat failure logs to **TaskPlanner AI** output and shows a warning before the Agent Chat paste fallback (TASK-030)
- **(Beta)** Optional `taskplanner.cursorPlanAndSubmitAfterOpen` — after Cursor Tier 1 succeeds, best-effort plan/submit commands (TASK-030)
- **(Beta)** AI providers for **Implement with AI**: `vscode-chat`, `claude-cli` (terminal + `taskplanner.claudeCliCommand`, default `claude {{file}}`); optional first-run prompt and **TaskPlanner: Configure AI Provider** command (TASK-030)
- **(Beta)** Cursor "Implement with AI" uses tiered delivery: native chat open, then Agent Chat paste workaround, then clipboard (TASK-030)
- **(Beta)** AI prompts include a plan-mode instruction when project config requires an agent plan (TASK-030)
- **(Beta)** "Implement with AI" button on task detail view and kanban cards — auto-detects Cursor or Claude Code, with clipboard fallback (TASK-026)
- **(Beta)** `taskplanner.aiTool` setting to choose preferred AI tool (window-scoped; includes auto/cursor/claude-code/vscode-chat/claude-cli/clipboard) (TASK-026)
- Changelog for VS Code marketplace with retrospective entries and auto-update rule in CLAUDE.md (TASK-029)

### Fixed

- Task detail **Status** and **Priority** pickers use theme-colored popup menus instead of native `<select>` lists, so options stay readable in dark themes and match VS Code styling.

### Changed

- **(Beta)** Claude Code integration simplified to URI handler — removed intermediate QuickPick menu (TASK-026)

## [1.2.0] - 2026-03-22

### Added

- Search/filter on Kanban board with debounced input (TASK-028)
- AI plan persistence — plans saved as `### Plan` subsections when tasks move through the workflow (TASK-016)
- Auto-increment patch version on every commit via git pre-commit hook (TASK-018)

### Changed

- Kanban board columns restructured: Backlog | Active (Next + In Progress) | Completed (Done + Rejected) (TASK-025)
- README split into developer docs and user-facing marketplace page (TASK-022)

## [1.1.0] - 2026-03-20

### Added

- Filtered task list as main view — grouped by status, searchable across all fields (TASK-013)
- Assignee and Updated datetime fields on tasks (TASK-013)
- Grouping controls: by status, assignee, date, or none (TASK-013)
- Duplicate task conflict detection with auto-fix (TASK-014)
- Sort/group icon-button dropdowns with VS Code native styling (TASK-015)

### Fixed

- Save button now closes the edit form and returns to list view (TASK-027)

## [1.0.0] - 2026-03-18

### Added

- Project scaffolding: TypeScript + esbuild + Vitest + VS Code extension shell (TASK-001)
- Regex-based markdown parser and serializer for task files (TASK-002)
- Extension icon and activity bar branding (TASK-003)
- Kanban board with drag-and-drop between columns (TASK-004)
- Filtered task list with status dropdown and search (TASK-004)
- AI instruction generation — auto-generates `CLAUDE.md` and `.cursorrules` (TASK-006)
- Setup menu: Initialize Project, AI Instructions, Planning toggle, Sort By (TASK-007)
- Compact tree view with priority-colored icons and task count badges (TASK-008)
- Example `.tasks/` folder with sample tasks (TASK-005)
- README with features, quick start, format spec, AI workflow docs (TASK-011)
- Rejected state, config migration v1 to v2, insert position setting (TASK-012)
- GitHub community files and CI rules (TASK-010)
- Overview screenshots for README and marketplace (TASK-009)
