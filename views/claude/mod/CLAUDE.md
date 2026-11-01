# views/claude/ — the Claude Code plugin (marketplace source `./views/claude`). This note sits in mod/ because a CLAUDE.md at the plugin root fails `claude plugin validate --strict`.

- Plugin root: `.claude-plugin/plugin.json`, `skills/`, `hooks/hooks.json`. The marketplace copies only this folder, so built files are committed here: `dist/mcp-server.js`, `ui/board/index.html` and `hooks/register.js`.
- Mod source: `mod/src/` (pane and band). `register.ts` is the only file that uses the mods API `$`; the rest is pure.
- The mod is a neutral ESM bundle with no node `fs`. It reads `.tasks/` through `$.fs` with the core parser, and writes through this plugin's MCP server from `ui.press` / `ui.input`. Lint forbids node modules, `core/store`, `configManager` and other harnesses.
- Skills are this plugin's own copy. Cursor and Codex have theirs; keep the version markers via `npm run build` + the pre-commit hook.
- Tests: `mod/test/*.spec.ts` (Vitest); `npm run validate:claude-plugin` runs `claude plugin validate` and the mod kit tests (`mod/test/pane.test.ts`, Claude Code ≥ 2.1.287).
