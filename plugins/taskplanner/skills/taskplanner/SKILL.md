---
name: taskplanner
description: Manage tasks stored in .tasks markdown files. Use when the user mentions tasks, backlog, planning, priorities, sprints, or asks to create, implement, update, list, or move TaskPlanner tasks. Prefer TaskPlanner MCP tools when they can access the active workspace and otherwise operate on the files directly.
---

# TaskPlanner

<!-- TASKPLANNER:VERSION:2.1.1 -->

TaskPlanner stores a git-tracked board in `.tasks/`. Use MCP tools when available, always passing the absolute active repository as `workspace_root`. If a tool is unavailable or cannot see that repository, use the direct file workflow below without blocking the user.

## Version preflight

Run this once before the first TaskPlanner operation in a Codex/Cursor task:

1. Read `.tasks/config.json` and compare `taskplannerVersion` with the embedded version above. Strip SemVer build metadata such as `+codex.*` before comparing.
2. If the stored value is missing, malformed, or older, follow the sibling `update-taskplanner` skill before continuing.
3. If equal, continue without writes.
4. If the stored value is newer, warn that the installed plugin is older and do not downgrade managed files.

The installed skill bundle is authoritative. Never query GitHub or invoke a marketplace update.

## Board files

Use the `states` mapping in `.tasks/config.json`; defaults are Backlog (`BACKLOG.md`), Next (`NEXT.md`), In Progress (`IN_PROGRESS.md`), Done (`DONE.md`), and Rejected (`REJECTED.md`). `WORK_LOG.md` is an optional completion log, not a state.

Each task is a complete section from its `## ID: Title` heading through its trailing `---` separator:

```markdown
## TASK-001: Task title
**Priority:** P1 | **Tags:** tag1, tag2

Description.

### Plan

- Step 1

---
```

## MCP path

Prefer `taskplanner_board`, `taskplanner_list`, `taskplanner_get`, `taskplanner_create`, `taskplanner_move`, and `taskplanner_update`. Use `taskplanner_board_data` when structured board data is useful and `taskplanner_board_visual` only when the host renders MCP Apps.

## Direct file path

- List by reading configured state files and parsing `##` sections.
- Create by reading `idPrefix` and `nextId`, generating the padded ID, incrementing and saving `nextId`, then inserting one complete section at the configured top/bottom position.
- Update only the selected task section; preserve its ID and every unrelated section.
- Move by cutting the complete section, including its separator, from the source state file and inserting it into the target state file.
- Preserve user configuration choices and all content outside the selected task or TaskPlanner marker blocks.

## Implementing work

1. Select the highest-priority task from Next, then Backlog, unless the user chose one.
2. Move it to In Progress before substantive implementation.
3. When `aiPlanRequired` is true, add a concise `### Plan` before coding.
4. Implement and verify the work.
5. Condense the plan to a done-summary and move the task to Done.
6. Add one short entry at the top of `.tasks/WORK_LOG.md` when it exists.
7. Add a `CHANGELOG.md` entry under `## [Unreleased]` when repository guidance requires it.

Never change task IDs or modify unrelated task sections.
