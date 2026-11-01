# mcp/ — MCP server and the npm package `@smekai/taskplanner`

- Source: `src/server.ts` (stdio MCP server). It imports only `src/core/`, enforced by lint.
- `npm run build` writes `dist/mcp-server.js`, `dist/index.js` (the core library) and `ui/board/index.html`. All three are gitignored here. The same server and board are copied into each plugin in `views/{claude,cursor,codex}/`.
- The version string in `src/server.ts` is set by `scripts/bump-version.js`; do not edit it by hand.
- Tests: `npm run smoke:mcp-server` packs this folder, installs the tarball and drives the server over stdio.
- Every tool takes `workspace_root`. Hosts start the server from their plugin cache, not from the repository.
