---
name: next-task
description: Select and implement the highest-priority TaskPlanner task from Next or Backlog. Use when the user asks to start, pick, or complete the next planned task.
---

# Start the Next TaskPlanner Task

1. Run the sibling `taskplanner` skill's version preflight once.
2. Prefer `taskplanner_list` for Next, then Backlog, always passing the absolute repository as `workspace_root`. If MCP cannot access the repository, read and parse the configured state files directly.
3. Select the highest priority task and identify it to the user.
4. Move its complete section to In Progress with `taskplanner_move` or a direct cut/insert.
5. Read `.tasks/config.json`; when `aiPlanRequired` is true, add a concise `### Plan` before coding.
6. Implement and verify the task.
7. Condense the plan, move the task to Done, add a top `.tasks/WORK_LOG.md` entry when present, and update `CHANGELOG.md` when required.

Never change task IDs or modify unrelated task sections.
