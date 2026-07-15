---
name: taskplanner
description: >
  Manage tasks stored in .tasks/ markdown files (TaskPlanner). Includes an agentic view via an MCP App
  (`taskplanner_board_visual`) plus tools for reading/creating/moving/updating tasks.
---

# TaskPlanner (Cursor MCP + Agentic View)

This workspace includes an MCP server named `taskplanner` plus an interactive **MCP App** board UI.

## Agentic view (interactive UI)

- Run the MCP tool **`taskplanner_board_visual`** to open the kanban board.
  - Drag cards between columns to move tasks (uses `taskplanner_move`).
  - Click a card to view details (uses `taskplanner_get`).

## Task file structure

TaskPlanner stores tasks as markdown files under `.tasks/`:

| State | File |
|------:|------|
| Backlog | `BACKLOG.md` |
| Next | `NEXT.md` |
| In Progress | `IN_PROGRESS.md` |
| Done | `DONE.md` |
| Rejected | `REJECTED.md` |

Auxiliary: **Work Log** → `WORK_LOG.md` (rolling log of decisions and outcomes when tasks complete).

Each task is a `##` section separated by `---`.

## Available MCP tools

- `taskplanner_board` — board overview (counts; optional listings)\n+- `taskplanner_list` — list tasks (by state; optional query)\n+- `taskplanner_get` — get a task by ID\n+- `taskplanner_create` — create a new task (auto ID)\n+- `taskplanner_move` — move a task to another state\n+- `taskplanner_update` — update title/description/priority/tags/assignee/plan\n+- `taskplanner_board_data` — JSON board data (used by the UI)\n+- `taskplanner_board_visual` — open the interactive board (MCP App)\n+
## Workflow for implementing a task

1. Pick a task from **Next** or **Backlog** (highest priority first).
2. Move it to **In Progress** (`taskplanner_move`).
3. Add a `### Plan` section under the task heading in `IN_PROGRESS.md` before coding (keep it 3–7 bullets).
4. Implement the task.
5. Move it to **Done** (`taskplanner_move`).
6. Condense the `### Plan` to a short done-summary.
7. Append a short entry to `.tasks/WORK_LOG.md` if that file exists (newest at top).
8. Add a `CHANGELOG.md` entry under `## [Unreleased]`.

