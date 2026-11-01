# views/cursor/ — the Cursor plugin (marketplace source `views/cursor`)

- Plugin root: `.cursor-plugin/plugin.json`, `mcp.json` (`${CURSOR_PLUGIN_ROOT}/dist/mcp-server.js`), `skills/`, `rules/`, `commands/` and `assets/logo.svg`.
- Built files are committed here because the marketplace copies only this folder: `dist/mcp-server.js` and `ui/board/index.html`, both from `npm run build`.
- The VS Code extension also ships this folder in the VSIX and registers it in Cursor.
- Skills are this plugin's own copy; Claude and Codex have theirs.
- Check: `npm run validate:cursor-plugin`. For a local install, see README "Local test on Windows".
