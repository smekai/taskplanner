---
name: list-tasks
description: List TaskPlanner tasks from the repository board, grouped or filtered by state.
---

# List TaskPlanner Tasks

Use the TaskPlanner MCP tools to summarize the repository task board.

1. Determine the absolute current repository root and pass it as `workspace_root` on every MCP call.
2. Call `taskplanner_board` with `include_tasks: true` for a complete grouped summary.
3. If the user requested a state or text filter, call `taskplanner_list` instead.
4. Show task ID, title, priority, and assignee; omit full descriptions unless requested.
5. Highlight tasks currently in In Progress.

If the MCP server is unavailable, explain that the TaskPlanner plugin requires a workspace containing `.tasks/config.json`.
