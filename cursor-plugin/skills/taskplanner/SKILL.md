---
name: taskplanner
description: >
  Manage tasks stored in .tasks/ markdown files. Use when the user mentions tasks, backlog,
  planning, priorities, sprints, or asks you to implement, create, or move tasks.
  Provides MCP tools for reading and modifying the task board.
---

# TaskPlanner Skill

You have access to a markdown-based task management system called TaskPlanner. Tasks are stored as `.md` files in the `.tasks/` directory of the workspace.

## Task File Structure

Each state has its own file:

| State | File |
|-------|------|
| Backlog | `BACKLOG.md` |
| Next | `NEXT.md` |
| In Progress | `IN_PROGRESS.md` |
| Done | `DONE.md` |
| Rejected | `REJECTED.md` |

Auxiliary: **Work Log** → `WORK_LOG.md` (rolling log of decisions and outcomes when tasks complete).

## Task Format

Each task is a `## ` heading section separated by `---`:

```markdown
## TASK-001: Task title here
**Priority:** P1 | **Tags:** tag1, tag2

Description text in markdown.

### Plan

- Step 1: ...
- Step 2: ...

---
```

## Available MCP Tools

Use these tools to interact with the task board:

- **taskplanner_board** — Get board overview with task counts per state. Pass `include_tasks: true` for full listings.
- **taskplanner_list** — List tasks for a specific state or all states. Supports `state` and `query` filters.
- **taskplanner_get** — Get full details of a single task by ID.
- **taskplanner_create** — Create a new task with auto-generated ID.
- **taskplanner_move** — Move a task between states (e.g. "Next" to "In Progress").
- **taskplanner_update** — Update task fields (title, description, priority, tags, plan).

## Workflow for Implementing a Task

1. **Pick the task** from Next or Backlog (highest priority first).
2. **Move to In Progress** using `taskplanner_move`.
3. **Write a plan** — if the project has `aiPlanRequired: true` in `.tasks/config.json`, add a `### Plan` subsection under the task heading in `IN_PROGRESS.md` before coding. Keep it short (3-7 bullets).
4. **Implement** the task.
5. **Move to Done** using `taskplanner_move`.
6. **Condense the `### Plan`** to a short done-summary.
7. **Append to `.tasks/WORK_LOG.md`** if that file exists — one short entry at the top (What / Decisions / Outcome).
8. **Add a CHANGELOG.md entry** under `## [Unreleased]` in the appropriate subsection (Added, Changed, Fixed, Removed).

## Important Rules

- Do NOT change task IDs.
- Do NOT modify tasks you are not working on.
- Keep the `---` separator between tasks.
- Priorities: P0 (critical), P1 (high), P2 (normal), P3 (low), P4 (wishlist).
- When moving to Done, condense the `### Plan` to a short done-summary.
- When moving to Done, append one short entry to `.tasks/WORK_LOG.md` if that file exists.
- Configuration lives in `.tasks/config.json` (ID prefix, next ID, states, settings).

## Creating a New Task

Use the `taskplanner_create` MCP tool. It auto-generates the task ID from `.tasks/config.json`. Default state is Backlog, default priority is P2.

## Continuing an In-Progress Task

Call `taskplanner_list` with `state: "In Progress"`, then `taskplanner_get` for full details. Follow the existing plan if present.
