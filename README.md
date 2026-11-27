<p align="center">
  <img src="resources/icons/taskplanner-color.png" alt="TaskPlanner logo" width="112" height="112" />
</p>

<h1 align="center">TaskPlanner</h1>

<p align="center">
  Git-tracked markdown task planning for developers and AI agents.
</p>

<p align="center">
  <a href="https://github.com/smekai/taskplanner/actions/workflows/ci.yml"><img src="https://github.com/smekai/taskplanner/actions/workflows/ci.yml/badge.svg" alt="CI status" /></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=refined.taskplanner"><img src="https://vsmarketplacebadges.dev/version-short/refined.taskplanner.svg" alt="VS Code Marketplace version" /></a>
  <a href="https://open-vsx.org/extension/refined/taskplanner"><img src="https://img.shields.io/open-vsx/v/refined/taskplanner?label=Open%20VSX" alt="Open VSX version" /></a>
  <a href="https://www.npmjs.com/package/@smekai/taskplanner"><img src="https://img.shields.io/npm/v/@smekai/taskplanner?label=npm" alt="npm version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license" /></a>
</p>

Your AI agent is fast, but it forgets what you agreed on. TaskPlanner gives you and the agent one shared board, kept as plain markdown in your repository. The agent picks the next task, writes a plan, builds it and moves it to Done. You review all of it in the same pull request as the code.

<p align="center">
  <img src="resources/screenshots/claude-board.gif" alt="TaskPlanner in the Claude Desktop Code tab: the band names the next task, the board pane lists tasks by state, and an opened task offers Start with Claude" width="900" />
</p>

<p align="center"><sub>The board pane in the Claude Desktop Code tab, on this repository's own tasks.</sub></p>

## Why TaskPlanner

- **Your agent follows a workflow.** It always works on the highest-priority task, plans before coding, and records what it did.
- **Tasks live next to the code.** No context switching to Jira, Linear or Asana, and no account to create.
- **Everything is in git.** Every task change is in your history and goes through review like code.
- **Anyone can read it.** Plain markdown files that work without any plugin installed.
- **One board for every tool.** Claude, Codex, Cursor and VS Code read and write the same files, so a team can mix them.

## How it works

1. You add tasks: ask the agent, use the board, or write markdown.
2. The agent picks the highest-priority task and moves it to **In Progress**.
3. It writes a short `### Plan` inside the task before touching code.
4. It implements the task.
5. It moves the task to **Done**, keeping the plan as a summary of what was built.

A task is just a section in `.tasks/NEXT.md`:

```markdown
## TASK-042: Add rate limiting to the public API
**Priority:** P1 | **Tags:** api, security

Sliding window, 100 requests per minute per API key.

---
```

## Works with

| Tool | What you get | How to get it today |
| --- | --- | --- |
| **Claude Code and Claude Desktop** | A live board pane beside the chat, the current task above the prompt, MCP tools and workflow skills | Not in Anthropic's plugin directory yet: [install from this repository](docs/INSTALL.md#claude-code-and-claude-desktop) |
| **Cursor** | Sidebar and Kanban board, plus MCP tools, skills, a workflow rule and an inline board in Agent chat | Not in the Cursor Marketplace yet: [the extension from Open VSX brings the plugin along](docs/INSTALL.md#cursor) |
| **Codex** | MCP tools and workflow skills | [This repository's marketplace](docs/INSTALL.md#codex), or the Codex directory (skills only) |
| **VS Code** | Task list, Kanban board, sidebar and setup menu | [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=refined.taskplanner) |
| **Any MCP host** | The TaskPlanner MCP tools | [`@smekai/taskplanner` on npm](docs/INSTALL.md#any-mcp-host) |

**[Install guide →](docs/INSTALL.md)**

## Usage

<!-- README-STATS:START -->
| Channel | Version | Usage |
| --- | --- | --- |
| [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=refined.taskplanner) | 3.0.12 | 126 installs |
| [Open VSX](https://open-vsx.org/extension/refined/taskplanner) (Cursor and other editors) | 3.0.12 | 4,831 downloads |
| [npm `@smekai/taskplanner`](https://www.npmjs.com/package/@smekai/taskplanner) | 3.0.12 | 447 downloads last month |
| Claude Code plugin ([repository marketplace](docs/INSTALL.md#claude-code-and-claude-desktop)) | 3.0.63 | installs from `main` |
| [Codex plugin directory](https://chatgpt.com/plugins/plugins_6a61139e52e88191907919d50300a246) | 3.0.18 | listed |
| [GitHub](https://github.com/smekai/taskplanner) | v3.0.12 | 25 stars · 4 forks |

<sub>Numbers as of 2026-11-27, refreshed by a daily check.</sub>
<!-- README-STATS:END -->

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, project structure and PR guidelines. Before a release, `npm run release:check` builds everything, runs tests and lint, validates the Claude, Cursor and Codex plugins, and smoke-tests the MCP server.

## License

TaskPlanner is licensed under the [MIT License](LICENSE). README attribution is appreciated but voluntary and is not a condition of the license.

<!-- TASKPLANNER:ATTRIBUTION:START -->
This project uses [TaskPlanner](https://github.com/smekai/taskplanner) for task planning.
<!-- TASKPLANNER:ATTRIBUTION:END -->
