# The code standard (A1–A9), applied to TaskPlanner

The rules and their ids come from the Isotopy code standard and keep their numbers so a finding reads the same in both repositories. Each rule says what it means here and where to look. A finding names the rule: `A3 mcp/src/server.ts:430 — …`.

## Simplicity first

These two govern every other rule, in analysis and in fixes:

- **Smallest correct change.** Solve exactly what the finding needs and bring the code you touch up to the standard. No repo-wide rewrite, no speculative abstraction, no option nobody asked for. A rule that would need a framework to satisfy is a finding to report, not a framework to build.
- **Replace, don't accumulate.** A new approach deletes the old one in the same change: its code, its tests and its docs. A `new ?? old` fallback, an adapter between two models, or an `A | B` parameter with a cast is the alarm that two things should have been one. Before calling a change done, look at its net line count: a capability may add lines, a *replacement* that adds lines means the old thing is still there.

## A1 — Comments are a smell

A function that needs a comment is badly named or badly factored: rename or extract first. Source files carry almost no comments (`npm run lint` already fails on them outside tests). The survivors are `WHY:` lines, and a `WHY:` must point at intricate *local* logic right at the line (a regex, a platform quirk, cron's day-field rule). A design rationale is not a `WHY:` — it goes to A8. Tests may explain themselves freely. The detailed keep/remove list is the `comment-hygiene` skill.

## A2 — SOLID; depend on interfaces

One reason to change per module. Receive a dependency rather than importing a concretion where a seam exists: `TaskStore` receives `ConfigManager` and `FileStore` — copy that shape. A module doing two jobs is split along the axis that changes independently. No barrel files beyond the public entry `src/core/index.ts`; callers import the file they need.

## A3 — Fat domain, thin edges

`src/core/` is the domain; the harnesses (`mcp/`, `views/*`) are edges.

- **Pure core:** `model/`, `parser/`, `util/`, `filter/`, `view/`, `ai/` — no I/O.
- **I/O core:** `store/`, `config/` — reading and writing files, nothing else to decide.
- **Edges map, they don't decide.** An MCP tool handler, a webview message handler or a mod hook turns input into a core call and a result into output. A rule about tasks (which state a new task goes to, when a task is due, what a valid schedule is) in a harness is a finding: it belongs in core, where every harness gets it and a test can reach it.

Placement test: does the file name a TaskPlanner concept (task, state, board, run)? If it would make as much sense in another product, it is a util.

## A4 — Long-running work is a workflow

Not applicable today: TaskPlanner has no long-running work. Recurring tasks are deliberately *not* this — an external scheduler runs them and records the result through `taskplanner_record_run`. If a change starts to run, wait for or retry work inside TaskPlanner, stop and raise it.

## A5 — Classes where there is state or a lifecycle

Free functions threading the same mutable state want to be a class that owns it (`TaskStore`, `ConfigManager`). A class with no state is a namespace and should be functions.

## A6 — Name the shapes

Inline object literals that carry structure get a name: a message payload, an options bag, a config blob, a style block in a webview. A literal repeated twice exists once, named — this includes state names (`'Done'`, `'Recurring'`, …) and file names (`'RECURRING.md'`).

## A7 — Lean on the types

- Discriminated unions over stringly-typed state; exhaustive `switch` closed with a `never` assertion.
- No `as` that papers over a real gap, no `as unknown as` in logic. Casting to silence the compiler is the commonest way this rule gets faked.
- Untrusted input is parsed once at a boundary into typed values: `config.json` in `ConfigManager`, board markdown in the parser, MCP input by its zod schema. Code past the boundary does not re-traverse raw records.
- `strict` is on. `noUncheckedIndexedAccess` is not: turning it on is a finding to weigh (cost: every index read narrows), not a silent change.

## A8 — Evidence lives in Markdown

The *why* of a decision goes where it can be read without opening the source: the task's `### Plan` done-summary and the `**Decisions:**` line of its WORK_LOG entry, and for something lasting, the folder's `CLAUDE.md` or `docs/`. If a change needed explaining in the PR description, that explanation belongs there too.

## A9 — Judge a change by its tier

- **Backend** (`src/core/`, `mcp/`): the layering of A3.
- **Frontend** (`views/vscode/src/views/webview/`, `views/mcp-app/`, the Claude pane in `views/claude/mod/`): rendering apart from state and messaging, one module per surface that talks to the host, named payload types, pure view helpers separate from stateful code. Webviews render HTML strings — a 1000-line panel that mixes markup, state and messages is the tier's main finding.

## Errors and cross-platform

- **A `catch` reports or is the answer.** It may stay silent only when the fallback *is* the result (a missing file, a probe that found nothing), narrowed to the expected error. Anything else reaches the user: an MCP `isError`, a VS Code message, a board diagnostic.
- **Windows and macOS:** paths built with `path.join`/`path.resolve`; file names compared case-insensitively where the file system ignores case; no shell-specific syntax in scripts both run; deletes in teardown use `maxRetries` (a closing handle shows up as `EBUSY`).
