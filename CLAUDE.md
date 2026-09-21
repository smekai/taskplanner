# TaskPlanner — Development Guide

VS Code / Cursor extension for markdown task tracking under `.tasks/`. Core is VS Code-free; MCP server ships as `@smekai/taskplanner`.

**Stack:** TypeScript (strict), esbuild, Vitest, ESLint, Prettier.

**Layout:** `src/core/` (library), `src/extension/` (VS Code shell), `src/test/core/`, `plugins/taskplanner/`, `packages/mcp-server/`, `dist/`.

```bash
npm install && npm run build && npm test && npm run lint
npm run package          # VSIX
npm run release:check    # full pre-release gate
```

**Changelog:** on Done, one line under `## [Unreleased]` in CHANGELOG.md (user perspective, task ID).

**Versioning:** every commit bumps patch via `.githooks/pre-commit` (`scripts/bump-version.js`). Use `--no-verify` only when the exact version was already set and validated.

**Architecture:** one markdown file per state; config in `.tasks/config.json`; dates UTC via `src/core/util/time.ts` (`YYYY-MM-DD` / `YYYY-MM-DD HH:MM` only).

**Comments:** `npm run lint` fails on comments in `src/` outside `src/test/` (machine directives exempt; `WHY:` escape hatch). Prefer clearer names over comments.

<!-- TASKPLANNER:START -->
# TaskPlanner — AI Agent Instructions

Tasks live as markdown under `.tasks/`. Prefer the MCP tools over hand-editing whenever they are available.

## States

- **Backlog** → `BACKLOG.md`
- **Next** → `NEXT.md`
- **In Progress** → `IN_PROGRESS.md`
- **Done** → `DONE.md`
- **Rejected** → `REJECTED.md`

- **Work Log** → `WORK_LOG.md` (optional; not a task state)
- Archived Done tasks may live under `.tasks/archive/` when `archiveDoneAfterDays` is set — grep there before concluding a task never existed.

## Format

```markdown
## TASK-001: Task title here
**Priority:** P1 | **Tags:** tag1, tag2

Description text in markdown.

---
```

ID prefix: `TASK`. Priorities: P0, P1, P2, P3, P4.

## Tools

| Tool | Use for |
| --- | --- |
| `taskplanner_list` / `taskplanner_board` | Find work / board overview |
| `taskplanner_get` | Full task |
| `taskplanner_create` | Create (allocates ID) |
| `taskplanner_move` | Change state |
| `taskplanner_update` | Title, description, priority, tags, epic, assignee, waiting-until, plan |

Check once per session whether the tools are available, and say which way you are working. **If they are available, do not hand-edit these files.** Instructions below that describe editing markdown are the fallback only.

If the host reads `.mcp.json` and this repo has none, ask before adding a `taskplanner` server with `npx -y @smekai/taskplanner` (Setup menu can write it too). Humans may edit the markdown freely; agents with working tools must not — hand-edits desynchronise `nextId` and corrupt encodings.

## Workflow

1. **Pick** from Backlog/Next (highest priority, or as specified). Skip any task whose `**Waiting until:**` date has not arrived.
2. **Move** to In Progress — `taskplanner_move`, otherwise cut the section from the source file and paste it into IN_PROGRESS.md.
3. **Write a plan** — `### Plan` under the task heading (see below).
4. **Implement.**
5. **Move** to Done — trim `### Plan` to a done-summary, append a short WORK_LOG entry if that file exists, and a CHANGELOG entry under `## [Unreleased]` if the project uses that rule.

### Planning Requirement

Before coding, add a short `### Plan` (3–7 bullets: changes, key files, risks) under the task in IN_PROGRESS.md. Write it **before** you start. When moving to Done, **trim `### Plan` to a done-summary** — keep the section.

### Work Log

If `.tasks/WORK_LOG.md` exists, append one short entry at the top when moving to Done:

```markdown
## TASK-001 — YYYY-MM-DD
**What:** One-line summary.
**Decisions:** Key choices (skip if none).
**Outcome:** Result or follow-ups (skip if obvious).

---
```

3–5 lines; skip empty fields. Detail belongs in the task's `### Plan`.

## Mandatory checklist

- **In Progress:** The task must actually **move** into IN_PROGRESS.md before substantive work — not only be described as moving. Use `taskplanner_move`; without it, cut the whole `##` section and its `---` by hand.
- **Done:** Move the task into DONE.md; add CHANGELOG under `## [Unreleased]` when the project uses that rule.
- **Plan:** The `### Plan` block must exist in IN_PROGRESS **before** coding, and should be **trimmed to a short done-summary** when you move the task to DONE.
- **Work log:** If WORK_LOG.md exists, one short entry at the top on Done.

## Creating a task

Prefer `taskplanner_create` (it allocates the ID). Fallback without tools:

1. Read `.tasks/config.json` for `nextId` / `idPrefix`.
2. ID = `{idPrefix}-{nextId padded to 3 digits}` (e.g. `TASK-015`).
3. Increment `nextId` and save.
4. Write into BACKLOG.md (or the file the user names):

```markdown
## TASK-001: Task title
**Priority:** P2
**Tags:** tag1, tag2
**Updated:** YYYY-MM-DD HH:mm

Description.

---
```

- Priority required (default P2). Optional `**Waiting until:** YYYY-MM-DD` for externally blocked work.
- Tags optional: core, ui, feature, docs, setup, refactor, testing, ci. Set **Updated**. Insert at the **top** after the `# Heading`. Order within a file carries no meaning — never reorder to match priority. End with `---`. Multiple creates: bump the ID each time.

## Rules

- Prefer tools over hand-edits. Do not change task IDs or touch tasks you are not working on.
- Keep `---` between tasks. Hand-moves: remove the whole section (including `---`) from the source; read/write UTF-8.

<!-- TASKPLANNER:END -->
