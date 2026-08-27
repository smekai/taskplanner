# Contributing to TaskPlanner

[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=refined.taskplanner) | [Open VSX](https://open-vsx.org/extension/refined/taskplanner) | [GitHub](https://github.com/smekai/taskplanner)

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Prerequisites

- [Node.js](https://nodejs.org/) (v24+)
- [VS Code](https://code.visualstudio.com/)
- npm (comes with Node.js)

## Getting Started

```bash
git clone https://github.com/smekai/taskplanner.git
cd taskplanner
npm install
```

To run the extension in development mode:

1. Open the project in VS Code
2. Press **F5** to launch the Extension Development Host
3. The extension activates in the new VS Code window

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Bundler:** esbuild
- **Unit tests:** Vitest (`npm test`)
- **Linter:** ESLint (`npm run lint`)
- **Formatter:** Prettier (`npm run format`)

## Key Commands

```bash
npm install          # Install dependencies
npm run build        # Production build (esbuild)
npm run watch        # Dev build with watch mode
npm run validate:cursor-plugin  # Validate Cursor plugin manifest/artifacts
npm run validate:codex-plugin   # Validate Codex plugin manifest/marketplace
npm run release:check # Build + plugin readiness checks
npm run smoke:mcp-server        # Pack, install, and exercise the published npm package
npm test             # Run unit tests (Vitest)
npm run lint         # Run ESLint
npm run format       # Run Prettier
npm run package      # Create .vsix package
```

## Release Channels

TaskPlanner is distributed through three channels:

- **Extension channel**: VS Code Marketplace / Open VSX (`refined.taskplanner`) for editor UI/runtime features.
- **Plugin channel**: shared Cursor/Codex package (`plugins/taskplanner/`) for agent-native MCP, skills, Cursor rules, and commands.
- **npm channel**: [`@smekai/taskplanner`](packages/mcp-server/README.md) (`packages/mcp-server/`) — the board as a library and as an MCP server, for any host that is not an editor plugin install.

Every commit must include a patch version bump. The configured pre-commit hook runs `scripts/bump-version.js` and stages all synchronized version-bearing files. If an exact release version was set manually before committing, use `--no-verify` only after `npm run validate:versions` passes to avoid a second bump.

When preparing a plugin publish, run `npm run release:check` before submitting the repository at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish).

### Cursor Marketplace submit (manual)

1. Confirm [github.com/smekai/taskplanner](https://github.com/smekai/taskplanner) is **public** and `main` includes `plugins/taskplanner/` plus both marketplace files.
2. Run `npm run release:check`, copy `plugins/taskplanner` to `%USERPROFILE%\.cursor\plugins\local\taskplanner`, restart Cursor, and smoke-test the MCP server, skills, and board.
3. Sign into Cursor → open [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish) → submit repository URL `https://github.com/smekai/taskplanner`.
4. Wait for Cursor’s manual review (not self-serve). Re-index after later updates.

### Extension publish (VS Code Marketplace + Open VSX)

Identity stays `refined.taskplanner`. Package then publish with your publisher PATs:

```bash
npm run package
# VS Code Marketplace (Azure DevOps PAT with Marketplace scope for publisher refined):
npx @vscode/vsce publish --packagePath dist/vscode/taskplanner-<version>.vsix --pat <VSCE_PAT>
# Open VSX (token from https://open-vsx.org/user-settings/tokens for namespace refined):
npx ovsx publish dist/vscode/taskplanner-<version>.vsix -p <OVSX_PAT>
```

### npm publish (`@smekai/taskplanner`)

The MCP server is published from `packages/mcp-server/`. It ships the **same bundle bytes** as
`plugins/taskplanner/dist/mcp-server.js` — `esbuild.js` builds once and copies, and
`npm run validate:versions` fails if the two ever diverge. There is one MCP server in this repo, in
two install locations; do not build a second one.

The package has two entry points, both built from `src/core/`:

| Specifier | Output | For |
| --- | --- | --- |
| `@smekai/taskplanner` | `dist/index.js` + `dist/*.d.ts` | The library, from `src/core/index.ts`. Callers using their own code. |
| `@smekai/taskplanner/mcp-server` | `dist/mcp-server.js` | The stdio server, from `src/mcp/server.ts`. Callers exposing tools to a model. |

Types come from `npm run build:types` (`tsconfig.types.json`, declaration-only), which `npm run build`
chains after esbuild. `npm run watch` does **not** rebuild them — run `build:types` if you are
changing the library's public shape. Anything added to `src/core/index.ts` becomes public API.

`packages/mcp-server/dist/` and `packages/mcp-server/ui/` are generated and gitignored, so the build
must run before the pack:

```bash
npm run release:check                       # includes the build and the published-artifact smoke test
npm publish ./packages/mcp-server --access public
```

`@smekai` is the personal scope of the `smekai` npm account, so no organization is involved and
nothing needs creating. `--access public` is required because scoped packages default to private,
which is a paid plan; `publishConfig.access` already sets it, and the flag repeats it explicitly.

Publishing requires 2FA on the account — a passkey or security key, set up at
[npmjs.com/settings/~/profile](https://www.npmjs.com/settings/~/profile). npm stopped accepting new
authenticator-app (TOTP) enrolments in September 2025.

Whoever runs `npm publish` is recorded permanently in each published version's `_npmUser` metadata,
username and account email included, and is listed as the package maintainer. Publish from the
account you want associated with the package publicly.

`npm run smoke:mcp-server` is the gate that this artifact runs outside an editor: it packs the
package, installs the tarball into an empty temp directory, spawns it with plain `node`, and checks
both workspace-root paths plus the `**Assignee:**` round-trip. Keep the bundle format CommonJS —
the server reads its board HTML through `__dirname`.

Packaged artifacts are gitignored and grouped by release channel:

- `dist/vscode/taskplanner-<version>.vsix`
- `dist/codex/taskplanner-codex-skills-<version>/`
- `dist/codex/taskplanner-codex-skills-<version>.zip`

Run `npm run package` or `npm run package:codex-skills` after the latest commit. The Codex package command creates both the inspectable plugin root and the upload-ready ZIP with portable archive paths.

For a clean local Cursor test on Windows:

```powershell
$cursorPluginTarget = Join-Path $env:USERPROFILE '.cursor\plugins\local\taskplanner'
if (Test-Path -LiteralPath $cursorPluginTarget) {
  Remove-Item -LiteralPath $cursorPluginTarget -Recurse -Force
}
Copy-Item -LiteralPath 'plugins\taskplanner' -Destination $cursorPluginTarget -Recurse
```

## Project Structure

```
src/
├── core/           # Pure logic, zero VS Code dependencies
│                   # Models, parser, serializer, stores, config
├── extension/      # VS Code extension shell
│                   # Commands, views, providers, watchers
├── test/
│   ├── core/       # Vitest unit tests for core library
│   └── extension/  # VS Code integration tests
resources/          # SVG icons and templates
plugins/taskplanner/ # Shared Cursor/Codex plugin source and manifests
dist/               # Generated output (extension bundle and release packages)
```

## Architecture Decisions

- **Core is VS Code-free** — `src/core/` has no VS Code imports so it can be reused for a JetBrains plugin or CLI later.
- **Regex-based parsing** — no YAML dependency; the markdown format is simple enough for regex.
- **Single file per state** — one `.md` file per board column (BACKLOG.md, NEXT.md, etc.). Scales well for typical project task counts.
- **Config in `.tasks/config.json`** — stores operational metadata (next ID, settings).

## Config Reference

Project configuration lives in `.tasks/config.json`:

```json
{
  "version": 2,
  "taskplannerVersion": "2.1.16",
  "idPrefix": "TASK",
  "nextId": 1,
  "states": [
    { "name": "Backlog", "fileName": "BACKLOG.md", "order": 0 },
    { "name": "Next", "fileName": "NEXT.md", "order": 1 },
    { "name": "In Progress", "fileName": "IN_PROGRESS.md", "order": 2 },
    { "name": "Done", "fileName": "DONE.md", "order": 3 },
    { "name": "Rejected", "fileName": "REJECTED.md", "order": 4 }
  ],
  "priorities": ["P0", "P1", "P2", "P3", "P4"],
  "tags": [],
  "insertPosition": "top",
  "aiPlanRequired": true,
  "readmeAttribution": true,
  "sortBy": "priority"
}
```

| Field | Description |
|-------|-------------|
| `version` | Task-file schema version; independent from the installed application version |
| `taskplannerVersion` | Installed TaskPlanner version that last completed managed-project synchronization |
| `idPrefix` | Prefix for task IDs (e.g. `TASK` → `TASK-001`) |
| `states` | Task board columns with file mappings |
| `priorities` | Available priority levels |
| `insertPosition` | Where new tasks are added: `top` or `bottom` |
| `aiPlanRequired` | Whether AI agents must write a `### Plan` before coding |
| `readmeAttribution` | Whether future managed updates may add the voluntary attribution block to an existing root README |
| `sortBy` | Default sort order: `priority`, `name`, or `id` |

## Testing

- **Unit tests** — run `npm test` (Vitest). Tests live in `src/test/core/`.

## Code Style

The project uses ESLint and Prettier. Run `npm run lint` and `npm run format` before submitting a PR.

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes with tests where appropriate
3. Ensure `npm test` and `npm run lint` pass
4. Open a PR with a clear description of what changed and why

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
