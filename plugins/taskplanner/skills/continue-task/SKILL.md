---
name: continue-task
description: Resume a TaskPlanner task that is already in the In Progress state.
---

# Continue an In-Progress TaskPlanner Task

1. Determine the absolute current repository root and pass it as `workspace_root` on every MCP call.
2. Call `taskplanner_list` for In Progress.
3. If none exist, suggest the `next-task` skill. If several exist, ask which task to resume.
4. Call `taskplanner_get` for the selected task and follow its existing plan.
5. If a required plan is missing, add it before coding.
6. Implement and verify the remaining work.
7. Condense the plan, move the task to Done, update `.tasks/WORK_LOG.md` when present, and update `CHANGELOG.md` when required.

Never change task IDs or modify unrelated task sections.
