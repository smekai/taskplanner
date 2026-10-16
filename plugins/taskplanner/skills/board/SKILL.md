---
name: board
description: Show the TaskPlanner board for the current repository. Use when the user asks to open, show, or look at the task board, kanban, or what is in progress. In Claude Code the board pane opens directly and this skill does not run.
---

# Show the TaskPlanner Board

1. Determine the absolute active repository root and pass it as `workspace_root` on every MCP call.
2. If the host renders MCP Apps (Cursor, Claude Desktop chat, VS Code), call `taskplanner_board_visual` to show the interactive board.
3. Otherwise call `taskplanner_board` and show the counts per state, then the In Progress and Next tasks with ID, priority, and title.
4. If MCP is unavailable or cannot access the repository, read `.tasks/config.json`, then count the `##` task sections in each configured state file.

Do not alter the board while showing it.
