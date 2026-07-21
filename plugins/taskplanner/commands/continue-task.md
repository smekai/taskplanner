---
name: continue-task
description: Resume work on the current in-progress task
---

# Continue Task

Resume implementation of a task that is already in progress.

## Steps

Determine the absolute current repository root first and pass it as `workspace_root` on every MCP call.

1. Call `taskplanner_list` with `state: "In Progress"` to find current tasks.
2. If no tasks are in progress, tell the user and suggest using `/next-task` instead.
3. If exactly one task is in progress, proceed with that task.
4. If multiple tasks are in progress, show them all and ask the user which one to continue.
5. Call `taskplanner_get` with the selected task ID to retrieve full details including the existing plan.
6. Present the task details to the user:
   - Task ID and title
   - Priority and tags
   - Description
   - Existing plan (if any)
7. Continue implementing the task from where it was left off:
   a. If there is an existing `### Plan`, follow it — check off completed steps and continue with the next ones.
   b. If there is no plan and `.tasks/config.json` has `aiPlanRequired: true`, write the plan first.
   c. Implement the remaining work.
   d. When done, call `taskplanner_move` to move the task to "Done".
   e. Update the `### Plan` to a short done-summary.
   f. Append a short entry to `.tasks/WORK_LOG.md` if that file exists (newest at top).
   g. Add a CHANGELOG.md entry under `## [Unreleased]`.

## Conventions

- Do NOT change task IDs.
- Keep the `---` separator between tasks in markdown files.
- Refer to `.tasks/config.json` and `CLAUDE.md` for project-specific conventions.
