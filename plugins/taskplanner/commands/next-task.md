---
name: next-task
description: Pick the highest-priority task and start implementing it
---

# Next Task

Pick the highest-priority unstarted task and begin implementation.

## Steps

1. Call `taskplanner_list` with `state: "Next"` to find tasks queued for implementation.
2. If no tasks are in Next, fall back to `taskplanner_list` with `state: "Backlog"`.
3. Select the first task (highest priority, since tasks are sorted by priority).
4. Show the user which task you are picking and ask for confirmation before proceeding.
5. Once confirmed:
   a. Call `taskplanner_move` to move the task to "In Progress".
   b. Read `.tasks/config.json` to check if `aiPlanRequired` is true.
   c. If plan is required, write a `### Plan` subsection under the task heading in `IN_PROGRESS.md` before writing any code. The plan should have 3-7 bullets covering: intended changes, key files, and notable risks.
   d. Implement the task.
   e. When done, call `taskplanner_move` to move the task to "Done".
   f. Add a CHANGELOG.md entry under `## [Unreleased]` in the appropriate subsection (Added, Changed, Fixed, Removed).

## Conventions

- Do NOT change task IDs.
- Keep the `---` separator between tasks in markdown files.
- When moving to Done, condense the `### Plan` to a short summary of what was actually done.
