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
npm test             # Run unit tests (Vitest)
npm run lint         # Run ESLint
npm run format       # Run Prettier
npm run package      # Create .vsix package
```

## Release Channels

TaskPlanner is distributed through two channels:

- **Extension channel**: VS Code Marketplace / Open VSX (`refined.taskplanner`) for editor UI/runtime features.
- **Plugin channel**: shared Cursor/Codex package (`plugins/taskplanner/`) for agent-native MCP, skills, Cursor rules, and commands.

Every commit must include a patch version bump. The configured pre-commit hook runs `scripts/bump-version.js` and stages all synchronized version-bearing files. If an exact release version was set manually before committing, use `--no-verify` only after `npm run validate:versions` passes to avoid a second bump.

When preparing a plugin publish, run `npm run release:check` before submitting the repository at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish).

### Cursor Marketplace submit (manual)

1. Confirm [github.com/smekai/taskplanner](https://github.com/smekai/taskplanner) is **public** and `main` includes `plugins/taskplanner/` plus both marketplace files.
2. Run locally: `npm run release:check`, then `scripts\install-cursor-plugin-local.cmd` + `scripts\register-cursor-plugin-local.cmd`, restart Cursor, and smoke-test MCP / skill / board.
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

Packaged artifacts are gitignored and grouped by release channel:

- `dist/vscode/taskplanner-<version>.vsix`
- `dist/codex/taskplanner-codex-skills-<version>/`

Run `npm run package` or `npm run package:codex-skills` after the latest commit.

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
  "taskplannerVersion": "2.1.0",
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
