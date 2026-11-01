# views/mcp-app/ — the board inside an MCP host (MCP Apps)

- Source: `board/board.ts`, `board.html`, `board.css`. It runs in the host's browser iframe.
- It imports nothing from the repository: no core and no node modules, enforced by lint. It talks to the server only through MCP tools (`taskplanner_board_data`, `taskplanner_get`, `taskplanner_move`).
- `npm run build` inlines JS and CSS into one `index.html`, written to `mcp/ui/board/` and to each `views/{claude,cursor,codex}/ui/board/`.
- Typecheck: `tsconfig.json` in this folder (DOM lib).
