---
name: continue-task
description: Resume a TaskPlanner task that is already In Progress. Use when the user asks to continue, resume, finish, or inspect active TaskPlanner work.
---

# Continue an In-Progress TaskPlanner Task

1. Run the sibling `taskplanner` skill's version preflight once.
2. Prefer `taskplanner_list` for In Progress and `taskplanner_get` for details, passing the absolute repository as `workspace_root`.
3. If MCP cannot access the repository, read the In Progress file from the state mapping in `.tasks/config.json` and parse complete task sections directly.
4. If none exist, suggest `next-task`; if several exist, ask which to resume.
5. Follow the selected task's existing plan. Add a required missing plan before coding.
6. Implement and verify the remaining work.
7. Condense the plan, move the task to Done, add a top `.tasks/WORK_LOG.md` entry when present, and update `CHANGELOG.md` when required.

Never change task IDs or modify unrelated task sections.
