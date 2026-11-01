# views/codex/ — the Codex plugin (marketplace source `./views/codex`)

- Plugin root: `.codex-plugin/plugin.json` and `submission.json`, `.mcp.json` (cwd `.`, runs `dist/mcp-server.js`), `skills/` (with `agents/openai.yaml` UI metadata) and `assets/taskplanner-color.png`.
- Built files are committed here because the marketplace copies only this folder: `dist/mcp-server.js` and `ui/board/index.html`, both from `npm run build`.
- Skills are this plugin's own copy; Claude and Cursor have theirs.
- Checks: `npm run validate:codex-plugin`, `npm run validate:codex-submission`; `npm run package:codex-skills` builds the public skills bundle. The submission copy is in `docs/CODEX_PLUGIN_SUBMISSION.md`.
