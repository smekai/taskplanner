---
name: next-task
description: Select and implement the highest-priority TaskPlanner task from Next or Backlog.
---

# Start the Next TaskPlanner Task

1. Determine the absolute current repository root and pass it as `workspace_root` on every MCP call.
2. Call `taskplanner_list` for the Next state; fall back to Backlog when Next is empty.
3. Select the highest-priority task and identify it to the user.
4. Follow repository approval and plan-mode requirements before implementation.
5. Move the chosen task to In Progress with `taskplanner_move`.
6. Read `.tasks/config.json`; when `aiPlanRequired` is true, add a concise `### Plan` before coding.
7. Implement and verify the task.
8. Condense the plan, move the task to Done, update `.tasks/WORK_LOG.md` when present, and update `CHANGELOG.md` when required by repository guidance.

Never change task IDs or modify unrelated task sections.
