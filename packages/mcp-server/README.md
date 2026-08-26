# @refined/taskplanner

[TaskPlanner](https://github.com/smekai/taskplanner)'s task board as a standalone npm package — as a
library you call, and as an MCP server you spawn.

TaskPlanner stores tasks as markdown in a repository's `.tasks/` directory. This package reads and
writes that board: directly from your code, or over stdio for an MCP client. It is the same server
the VS Code extension and the Cursor/Codex plugin run, built from the same sources. There is one
board parser, not a fork.

```bash
npm install @refined/taskplanner
```

The published bundle is self-contained (the MCP SDK and Zod are bundled in), so the package has no
runtime dependencies. It is CommonJS and requires Node >= 20.

## Two entry points

Pick by who is calling:

| Entry | Import | Use when |
| --- | --- | --- |
| Library | `@refined/taskplanner` | **Your own code** reads or edits the board. Direct calls, typed, no subprocess. |
| MCP server | `@refined/taskplanner/mcp-server` | **A model** picks the tools. Spawned over stdio; ships tool schemas, descriptions, and safety annotations. |

Both are built from the same `src/core/`, so they cannot disagree about what a board says. Use both
in one host if it suits — the agent gets MCP tools, your own code calls the library.

## Using it as a library

```js
const { parseTasks, TaskStore, FileStore, ConfigManager } = require('@refined/taskplanner');

// Parse a single state file
const { tasks, warnings } = parseTasks(fs.readFileSync('.tasks/BACKLOG.md', 'utf8'));

// Or drive the whole board
const configManager = new ConfigManager('/path/to/repo/.tasks');
configManager.load();
const store = new TaskStore(configManager, new FileStore('/path/to/repo/.tasks'));
store.reload();
store.moveTask('TASK-001', 'In Progress');
```

TypeScript declarations ship with the package. ESM named imports work too:

```js
import { parseTasks } from '@refined/taskplanner';
```

Requiring the library does **not** start a server — that lives on its own subpath precisely so this
import stays inert.

## Spawning the server

**Spawn `process.execPath` with a resolved module path. Never spawn a bare bin name.**

```js
const { spawn } = require('node:child_process');

const serverPath = require.resolve('@refined/taskplanner/mcp-server');

const child = spawn(process.execPath, [serverPath], {
  env: { ...process.env, TASKPLANNER_WORKSPACE_ROOT: '/path/to/the/repo' },
  stdio: ['pipe', 'pipe', 'pipe'],
});
```

From ESM:

```js
import { createRequire } from 'node:module';
const serverPath = createRequire(import.meta.url).resolve('@refined/taskplanner/mcp-server');
```

Why not the bin name? `taskplanner-mcp` resolves to a `.cmd` shim on Windows, and spawning a `.cmd`
requires `shell: true` under Node >= 20's [command injection
rule](https://nodejs.org/en/blog/vulnerability/april-2024-security-releases-2) — which then
re-introduces quoting problems on paths with spaces. `process.execPath` plus a resolved path has
none of that, and behaves identically on Windows, macOS, and Linux. The `taskplanner-mcp` bin
exists for `npx` and interactive shell use only.

## Telling the server which repository to read

The server needs a workspace root. In order of precedence:

1. The `workspace_root` argument on any tool call — per call, so one client can drive several
   repositories.
2. The `TASKPLANNER_WORKSPACE_ROOT` environment variable — process-wide, for a host that spawns one
   server per repository.
3. MCP `roots/list`, if the client advertises the `roots` capability.
4. The process working directory.

Both path 1 and path 2 are supported and stay supported; editor clients tend to use the tool input,
and hosts driving several projects from one process tend to use the environment variable.

Whichever root is supplied, the server walks **up** from it looking for a `.tasks/config.json`, so
pointing it at a subdirectory of the repository works.

If no `.tasks/` is found, tool calls fail with an error listing every directory that was checked.

## MCP client configuration

For clients that read a JSON config, resolve the path once and write it in:

```json
{
  "mcpServers": {
    "taskplanner": {
      "command": "node",
      "args": ["/absolute/path/to/node_modules/@refined/taskplanner/dist/mcp-server.js"],
      "env": { "TASKPLANNER_WORKSPACE_ROOT": "/path/to/the/repo" }
    }
  }
}
```

## Tools

| Tool                       | Purpose                                                       |
| -------------------------- | ------------------------------------------------------------- |
| `taskplanner_board`        | Board overview: task counts per state, optionally every task. |
| `taskplanner_list`         | List tasks, filtered by state and/or a text query.            |
| `taskplanner_get`          | Read one task by ID, including its `### Plan`.                |
| `taskplanner_create`       | Create a task in a given state.                               |
| `taskplanner_update`       | Update title, description, priority, tags, assignee, or plan. |
| `taskplanner_move`         | Move a task to another state.                                 |
| `taskplanner_board_data`   | Structured board view model (for UI hosts).                   |
| `taskplanner_board_visual` | Board rendered as an MCP App UI resource.                     |

Every tool accepts the optional `workspace_root` argument described above.

## Task fields

Tasks are plain markdown sections and may be written by tools other than TaskPlanner. All task
metadata round-trips through this server unchanged, including `**Assignee:**`:

```markdown
## TASK-001: Task title
**Priority:** P1
**Tags:** core
**Assignee:** owner

Description.

---
```

Reading that task back reports `assignee: "owner"`, and the value survives `taskplanner_update` and
`taskplanner_move`. (The serializer normalises metadata onto a single `|`-joined line when it
rewrites a section — the field and its value are preserved, the line layout is not.)

## License

MIT
