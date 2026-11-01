---
name: list-tasks
description: List TaskPlanner tasks from the repository board, grouped or filtered by state. Use for board summaries, status checks, backlog queries, and finding current work.
---

# List TaskPlanner Tasks

1. Run the sibling `taskplanner` skill's version preflight once.
2. Determine the absolute active repository root.
3. Prefer `taskplanner_board` with `include_tasks: true`, passing `workspace_root`. For a state/text filter, prefer `taskplanner_list`.
4. If MCP is unavailable or cannot access the repository, read `.tasks/config.json`, then parse the configured state files by `##` task sections.
5. Show ID, title, priority, and assignee; omit descriptions unless requested and highlight In Progress work.

Do not alter the board while listing it.
