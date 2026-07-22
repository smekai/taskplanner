# TaskPlanner — Development Guide

## What is this?

TaskPlanner is a VS Code extension that provides markdown-based task tracking directly in your project folder. Think lightweight Jira — but stored as `.md` files, git-tracked, and AI-agent friendly.

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Bundler:** esbuild
- **Unit tests:** Vitest (`npm test`)
- **Integration tests:** @vscode/test-cli
- **Linter:** ESLint (`npm run lint`)
- **Formatter:** Prettier (`npm run format`)

## Project Structure

- `src/core/` — Pure logic, zero VS Code dependencies. Models, parser, serializer, stores, config.
- `src/extension/` — VS Code extension shell. Commands, views, providers, watchers.
- `src/test/core/` — Vitest unit tests for core library.
- `src/test/extension/` — VS Code integration tests.
- `resources/` — SVG icons and templates.
- `plugins/taskplanner/` — Shared Cursor/Codex plugin source, manifests, skills, and runtime.
- `dist/` — Generated extension output and channel-specific release packages.

## Key Commands

```bash
npm install          # Install dependencies
npm run build        # Production build (esbuild)
npm run watch        # Dev build with watch mode
npm test             # Run unit tests (Vitest)
npm run lint         # Run ESLint
npm run format       # Run Prettier
npm run package      # Create dist/vscode/taskplanner-<version>.vsix
```

## Task File Format

Tasks are stored in `.tasks/` as markdown files (BACKLOG.md, NEXT.md, IN_PROGRESS.md, DONE.md). Each task is a `##` section:

```markdown
## TASK-001: Task title here
**Priority:** P1
**Tags:** tag1, tag2

Description text in markdown.

---
```

## Changelog

When you move a task to **Done**, add an entry to `CHANGELOG.md` under the `## [Unreleased]` section. Use the appropriate subsection (`Added`, `Changed`, `Fixed`, `Removed`) and reference the task ID. Keep entries concise — one line per change, written from the user's perspective.

## Versioning

Every commit must include a patch version bump. The pre-commit hook runs `scripts/bump-version.js` and synchronizes `package.json`, `package-lock.json`, the MCP server, both plugin manifests, and embedded skill version markers. Use `--no-verify` only when the exact version was set and validated before the commit, so the hook would otherwise double-bump it.

## Architecture Decisions

- **Core is VS Code-free** so it can be reused for JetBrains plugin or CLI later.
- **Regex-based parsing** — no YAML dependency, the format is simple enough.
- **Single file per state** — scales well for typical project task counts.
- **Config in `.tasks/config.json`** — stores operational metadata (next ID, settings).

<!-- TASKPLANNER:START -->
# TaskPlanner — AI Agent Instructions

This project uses [TaskPlanner](https://github.com/smekai/taskplanner) for task management.
Tasks are stored as markdown files in the `.tasks/` directory.

## Task File Structure

Each state has its own file:
- **Backlog** → `BACKLOG.md`
- **Next** → `NEXT.md`
- **In Progress** → `IN_PROGRESS.md`
- **Done** → `DONE.md`
- **Rejected** → `REJECTED.md`

Auxiliary file (optional rolling log, not a task state):
- **Work Log** → `WORK_LOG.md`

## Task Format

Each task is a `## ` heading section separated by `---`:

```markdown
## TASK-001: Task title here
**Priority:** P1 | **Tags:** tag1, tag2

Description text in markdown.

---
```

- **ID prefix:** `TASK`
- **Priorities:** P0, P1, P2, P3, P4

## Workflow for Implementing a Task

When asked to implement a task:

1. **Pick the task** from BACKLOG.md or NEXT.md (highest priority first, or as specified by the user).
2. **Move the task** to IN_PROGRESS.md by cutting it from the source file and pasting it into IN_PROGRESS.md.
3. **Write a plan** — add a `### Plan` subsection under the task heading (see below).
4. **Implement** the task.
5. **Move the task** to DONE.md when complete — trim `### Plan` to a done-summary, append a short entry to `.tasks/WORK_LOG.md` if that file exists, and add a **CHANGELOG.md** entry under `## [Unreleased]` if the project uses this changelog rule.

### Planning Requirement

Before writing any code, you MUST add a `### Plan` subsection under the task heading in IN_PROGRESS.md:

```markdown
## TASK-001: Example task title
**Priority:** P1

Description of the task.

### Plan

- Step 1: ...
- Step 2: ...
- Key files: ...
```

Keep the plan **short** (about 3–7 bullets): intended changes, key files or modules, and notable risks or edge cases. Expand only when the task is large.

The plan is free-form markdown. Write it **before** you start coding.

### Plan Persistence

When moving a completed task to DONE.md, **keep the `### Plan` section** with a condensed summary of what was done. This preserves the implementation history for future reference.

### Work Log

When moving a task to DONE.md, if `.tasks/WORK_LOG.md` exists, append **one short entry at the top** (after the header, before older entries):

```markdown
## TASK-001 — YYYY-MM-DD
**What:** One-line summary of what was delivered.
**Decisions:** Key choices made and why (skip if none).
**Outcome:** Result or follow-ups (skip if obvious from What).

---
```

Keep it to 3–5 lines total. Skip empty fields rather than writing "N/A". Detailed steps belong in the task's `### Plan`, not here.

## Mandatory checklist (do not skip)

These steps are **part of the work**, not optional housekeeping:

- **In Progress:** You must **physically move** the task markdown (the whole `##` section and its `---`) from BACKLOG/NEXT into **IN_PROGRESS.md** before substantive implementation — not only describe that you will.
- **Done:** When the implementation is finished, **move** the same task section from IN_PROGRESS.md into **DONE.md** and add a **CHANGELOG.md** entry under `## [Unreleased]` if the project uses this changelog rule.
- **Plan:** If this project requires a plan (**yes for this project** — see above), the `### Plan` block must exist in IN_PROGRESS **before** coding, and should be **trimmed to a short done-summary** when you move the task to DONE.
- **Work log:** If `.tasks/WORK_LOG.md` exists, append one short entry at the top when moving a task to Done (see **Work Log** above).

## Creating a New Task

When the user asks you to create a task:

1. **Read** `.tasks/config.json` to get the current `nextId` and `idPrefix`.
2. **Generate the ID** — format: `{idPrefix}-{nextId padded to 3 digits}` (e.g. `TASK-015`).
3. **Increment `nextId`** in `.tasks/config.json` and save the file.
4. **Write the task** into `BACKLOG.md` (or the file the user specifies) using this format:

```markdown
## TASK-001: Task title
**Priority:** P2
**Tags:** tag1, tag2
**Updated:** YYYY-MM-DD HH:mm

Description of the task in markdown.

---
```

Rules for new tasks:
- **Priority** is required. If not specified by the user, default to `P2`.
- **Tags** are optional. Pick from the project's tag list if relevant: core, ui, feature, docs, setup, refactor, testing, ci.
- **Updated** — set to the current date/time.
- Add the task at the **top** of the file (after the `# Heading` line).
- Always end the task section with a `---` separator.
- If the user asks to create multiple tasks at once, increment the ID for each one.

## Important Rules

- Do NOT change task IDs.
- Do NOT modify tasks you are not working on.
- Keep the `---` separator between tasks.
- When moving a task, remove it entirely from the source file (including the trailing `---`).

<!-- TASKPLANNER:END -->
