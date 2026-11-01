# views/vscode/ — the VS Code and Cursor extension

- Source: `src/extension.ts` and below. It may import only `src/core/` and itself, enforced by lint. The manifest is the root `package.json` (`main: ./dist/extension.js`), because the VSIX is packaged from the repository root.
- Webviews: `src/views/webview/` (task list, kanban). They are this harness's own rendering; duplicating logic other harnesses have is fine.
- In Cursor, `extension.ts` registers the bundled `views/cursor/` plugin, which is why the VSIX ships that folder (`.vscodeignore`).
- Tests: `test/` (Vitest, run by `npm test`).
- Build: `npm run build` → `dist/extension.js`. Package: `npm run package`.
