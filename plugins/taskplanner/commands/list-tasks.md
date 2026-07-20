---
name: list-tasks
description: List all tasks from the TaskPlanner board grouped by status
---

# List Tasks

Show the user a summary of all tasks in their TaskPlanner board.

## Steps

1. Call the `taskplanner_board` MCP tool with `include_tasks: true` to get the full board overview.
2. Present the results to the user in a clear, readable format grouped by state (Backlog, Next, In Progress, Done).
3. If the user asked for a specific filter (e.g. "show me P0 tasks" or "tasks assigned to me"), use the `taskplanner_list` MCP tool with the appropriate `query` or `state` parameter instead.
4. Highlight any tasks in "In Progress" state — these are actively being worked on.
5. Keep the output concise: show task ID, title, priority, and assignee. Omit full descriptions unless the user asks for details.
