# Installing and using TaskPlanner

TaskPlanner runs in several tools at once, all on the same `.tasks/` folder, so a team can mix them. Pick yours:

- [Claude Code and Claude Desktop](#claude-code-and-claude-desktop)
- [Cursor](#cursor)
- [Codex](#codex)
- [VS Code](#vs-code)
- [Any MCP host](#any-mcp-host)

Then see [First steps](#first-steps), and [Task format and agent workflow](#task-format-and-agent-workflow) for how the files look.

## Claude Code and Claude Desktop

> **Not in Anthropic's plugin directory yet.** The listing is under review. Until then, install from this repository, which is its own plugin marketplace.

In a Claude Code session:

```
/plugin marketplace add smekai/taskplanner
/plugin install taskplanner@refined-taskplanner
```

Or from a shell, in one step:

```bash
claude plugin install taskplanner --marketplace smekai/taskplanner
```

In the **Claude Desktop** app: click **+** next to the prompt box, then **Plugins → Add marketplace**, enter `smekai/taskplanner`, and add **taskplanner**. A plugin installed at user scope also loads in the Desktop Code tab.

Then, in any project, ask Claude to *set up TaskPlanner*, or open the board with `/taskboard`. You get:

- **MCP tools** to list, create, move and update tasks, and **skills** for the workflow (next task, continue task, initialize, update)
- **A board pane** beside the transcript, with a list per state, task details, **Start with Claude** and a new-task form
- **A band above the prompt** that names the task in progress, or the next one to pick

The pane and the band are a Claude Code *mod*, an API Anthropic marks as early access. They need Claude Code 2.1.287 or later in the terminal, or 2.1.286 or later in the Desktop Code tab. Details, limits, permissions and everything the mod reads and sends: [`views/claude/README.md`](../views/claude/README.md).

## Cursor

> **Not in the Cursor Marketplace yet.** Use one of the two ways below.

**A. Through the extension (easiest).** Install **TaskPlanner** from the Extensions view; Cursor pulls it from [Open VSX](https://open-vsx.org/extension/refined/taskplanner). The extension adds the sidebar, the Kanban board and the setup menu, and registers the bundled Cursor plugin: MCP tools, skills, a workflow rule, slash commands and an inline board in Agent chat.

**B. Manually, from this repository.** The plugin's built files are committed, so no build is needed. Clone the repository once:

```bash
git clone https://github.com/smekai/taskplanner
```

Then, from the folder that holds the clone, replace Cursor's local copy of the plugin with `views/cursor`. The same commands install and update: they delete the old copy first, because copying onto an existing folder would nest the new files inside it and leave the old ones active.

```powershell
$target = "$env:USERPROFILE\.cursor\plugins\local\taskplanner"
if (Test-Path $target) { Remove-Item -Recurse -Force $target }
New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
Copy-Item -Recurse taskplanner\views\cursor $target
```

```bash
rm -rf ~/.cursor/plugins/local/taskplanner
mkdir -p ~/.cursor/plugins/local
cp -R taskplanner/views/cursor ~/.cursor/plugins/local/taskplanner
```

Then restart Cursor (or run **Developer: Reload Window**), open **Customize**, and check that the TaskPlanner MCP server, skills, the `taskplanner-workflow` rule and the `/list-tasks`, `/next-task`, `/continue-task` commands are there. To update later, run `git -C taskplanner pull`, then the replace commands above again. More: [`views/cursor/README.md`](../views/cursor/README.md).

## Codex

Add this repository as a plugin marketplace, then install the plugin:

```bash
codex plugin marketplace add smekai/taskplanner
codex plugin add taskplanner@refined-taskplanner
```

Start a new Codex task afterwards. Open **Plugins → TaskPlanner** to check that the skills and MCP tools are enabled. Node.js must be installed, because the MCP server runs locally.

The [Codex plugin directory](https://chatgpt.com/plugins/plugins_6a61139e52e88191907919d50300a246) also lists TaskPlanner, as skills only, without the MCP tools. See [`views/codex/README.md`](../views/codex/README.md).

## VS Code

Install **TaskPlanner** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=refined.taskplanner), open a folder, and click the TaskPlanner icon in the activity bar. The welcome view offers **Initialize Project**; then run **Initialize AI Instructions** so your agents get the workflow.

Views, the setup menu and settings: [`views/vscode/README.md`](../views/vscode/README.md).

## Any MCP host

The MCP server ships on npm. Add it to your host's MCP config, with the absolute path of the project that holds `.tasks/`:

```json
{
  "mcpServers": {
    "taskplanner": {
      "command": "npx",
      "args": ["-y", "@smekai/taskplanner"],
      "env": {
        "TASKPLANNER_WORKSPACE_ROOT": "/absolute/path/to/project"
      }
    }
  }
}
```

Without it, some hosts start the server in another folder: it runs but finds no tasks.

The same package is a library for code that reads or edits the board directly. See [`mcp/README.md`](../mcp/README.md).

## First steps

1. Ask your agent to **set up TaskPlanner**, or run **TaskPlanner: Initialize Project** in VS Code or Cursor. This creates `.tasks/` and the agent instruction files.
2. Add tasks: ask the agent (*"create a P1 task for the login bug"*), use the board's **New task**, or edit `.tasks/BACKLOG.md` by hand.
3. Ask the agent to **work on the next task**, or press **Start with Claude** on a card.

## Task format and agent workflow

Tasks are stored in `.tasks/` as plain markdown:

```
.tasks/
├── config.json
├── BACKLOG.md
├── NEXT.md
├── IN_PROGRESS.md
├── DONE.md
├── REJECTED.md
└── RECURRING.md
```

Each task is a `##` heading section:

```markdown
## TASK-001: Set up OAuth2 authentication
**Priority:** P0 | **Tags:** auth, backend | **Assignee:** Alice
**Updated:** 2026-03-19 14:30

Implement OAuth2 flow with Google and GitHub providers.
Add token refresh logic and session management.

---

## TASK-002: Add rate limiting to API endpoints
**Priority:** P1 | **Tags:** api, security | **Assignee:** Bob
**Updated:** 2026-03-18 09:15

Apply rate limiting middleware to all public endpoints.
Use sliding window algorithm, 100 req/min per API key.

---
```

### Priorities

| Level | Meaning | Color |
|-------|---------|-------|
| P0 | Blocker | Purple |
| P1 | Critical | Red |
| P2 | High | Orange |
| P3 | Medium | Blue |
| P4 | Low | Grey |

### Assignee & Updated

Each task can have an optional **Assignee** (who owns the task) and an **Updated** timestamp (auto-set when tasks are created, moved, or edited). Both fields are searchable in the filtered task list.

### Agent workflow

Setup writes the workflow into **`AGENTS.md`** (Codex and compatible agents), **`CLAUDE.md`** (Claude Code) and **`.cursorrules`** (Cursor). It teaches agents to:

1. Pick the highest-priority task from `.tasks/NEXT.md` or `BACKLOG.md`
2. Move it to `.tasks/IN_PROGRESS.md`
3. Write a `### Plan` subsection under the task (if AI Planning is enabled)
4. Implement the task
5. Move it to `.tasks/DONE.md`

With a plugin installed, agents do each step through the TaskPlanner MCP tools instead of editing the files.

### Recurring tasks

Work that never finishes, such as a daily check, lives in the **Recurring** state (`RECURRING.md`). A recurring task has a cron schedule and keeps its last 7 results:

```markdown
## TASK-004: Update dependencies
**Priority:** P2 | **Tags:** maintenance
**Repeats:** 0 7 * * 1
**Last run:** 2026-11-23 07:12

### Runs
- 2026-11-23 07:12 — 3 packages updated, tests green
- 2026-11-16 07:05 — nothing to update

---
```

- **The schedule is in UTC.** `0 7 * * 1` is Mondays at 07:00 UTC, whatever your time zone. Five-field cron and shortcuts such as `@daily` work.
- **Due** means the schedule has fired since `**Last run:**`. A task with a `**Waiting until:**` date in the future is not due yet. The board views mark due tasks, and `taskplanner_list` with `due: true` lists them.
- **TaskPlanner doesn't run the schedule itself.** A scheduler you already have (a Claude scheduled task, cron, CI) starts the agent. The agent does the work and calls `taskplanner_record_run` with a one-line result, which sets `**Last run:**` and adds the line to `### Runs`.
- Recurring tasks never move to In Progress or Done and need no plan. Create one with `taskplanner_create` and a `repeats` schedule; it goes to Recurring on its own.
- Existing boards gain the Recurring state once, the first time TaskPlanner 3.1 opens them. If you remove it from `config.json`, it stays removed.

### AI Planning

When enabled (default), agents must write a plan before coding. The plan lives inside the task:

```markdown
## TASK-003: Migrate database to PostgreSQL
**Priority:** P1 | **Tags:** database, migration | **Assignee:** Claude
**Updated:** 2026-03-19 10:00

Replace SQLite with PostgreSQL for production readiness.

### Plan

- Add pg driver and connection pool configuration
- Create migration scripts for all existing tables
- Update repository layer to use parameterized queries
- Add integration tests against test database

---
```

When a task is moved to Done, the `### Plan` section is kept as a condensed summary of what was implemented — preserving implementation history for future reference.

Toggle via the Setup menu or set `aiPlanRequired` in `.tasks/config.json`.

### Auto-init

When `autoInitAiFiles` is enabled (default), AI instruction files are automatically created or updated during project initialization — so agents get the workflow from the first commit.

### Version-aware updates and attribution

TaskPlanner records the last synchronized product version in `.tasks/config.json` as `taskplannerVersion`. On activation, a newer installed version refreshes only TaskPlanner marker blocks in `AGENTS.md`, `CLAUDE.md`, and `.cursorrules`, applies safe config defaults, and retries later if any write fails. An older installed version never downgrades project files.

Initialization also adds a small managed TaskPlanner attribution block to an existing root `README.md` by default. The attribution is voluntary, removable, and is not an MIT license requirement. Disable future insertion with **Setup → README Attribution** or set `readmeAttribution` to `false`; disabling it does not delete an existing block.

### Configuration

Custom states, priorities (P0–P4), tags, ID prefix and sort order live in `.tasks/config.json`; see [CONTRIBUTING.md](../CONTRIBUTING.md) for the full reference. Renamed states work in every view, with two known limits: the Claude band uses only **In Progress**, **Next** and **Backlog**, and the MCP board's *Show more* loads completed tasks only for **Done** and **Rejected**.
