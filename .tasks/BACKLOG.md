# Backlog

## TASK-094: 3.1 phase F: code quality pass before the release
**Priority:** P1 | **Tags:** refactor, testing | **Epic:** 3.1
**Updated:** 2026-11-25 14:23

Phase F of TASK-088. Starts after phases A–E (TASK-087, TASK-089…092) and before the release (TASK-093, now phase G).

Run the project skill `/code-quality` (`.claude/skills/code-quality/SKILL.md`) over everything since `v3.0.12`. One file holds the standard (the Isotopy standard adapted to this repo) and the pass:
- **Part 1, code:** simplicity first (smallest correct change, replace don't accumulate), then A1–A9: comments are a smell, SOLID and interfaces, fat domain and thin edges, named shapes, strict types, evidence in Markdown, judged by tier. Plus errors and cross-platform.
- **Part 2, tests:** AAAAA, one action per test, no logic in a test body, generators over flag factories, component tests first, the mutation check.
- **Part 3, the pass**, in two phases:
  - **Analyse:**
    - Take a green baseline.
    - Run the measurements and the board invariants.
    - Read the diff and the hotspots against every rule.
    - Run `/code-review` on the release diff.
    - Write a ranked report into this task's `### Plan`, each finding naming its rule.
  - **Improve:** only the groups the user accepts, one finding per commit, behaviour and the public API unchanged. Anything deferred becomes its own Backlog task.

Already seen (2026-11-25):
- **Size and counts:**
  - `taskListPanel.ts` (1609 lines) and `kanbanPanel.ts` (1050) are the largest files (A9).
  - 37 complexity candidates.
  - 128 hard-coded state-name literals (A6). Phase C adds `'Recurring'` to several views.
  - 8 type escapes (A7).
  - `noUncheckedIndexedAccess` is off.
- **Phase A and B code, against the standard:**
  - **A3:** "a new task with `repeats` and no state goes to Recurring" is decided in `mcp/src/server.ts` (TASK-089); it belongs in core.
  - **A1/A8:** the `WHY:` in `configManager.addRecurringState` (version gating) and the search-span `WHY:` in `cron.ts` explain design choices, not local logic, so they move to docs or the Plan.
  - **Tests:** "keeps only the latest MAX_RUNS entries" in `taskStore.test.ts` has a `for` loop in its body, and the new store tests have no Arrange/Act/Assert banners.
- **Tooling:** `scripts/bump-version.js` replaces the old version string everywhere in the built bundles, not just the version field. An example text containing the version ("all stores on 3.0.30") made the committed bundles differ from a clean build and failed CI on PR #42. Bump the version field only, or rebuild after the bump.

**Done looks like:** every "fix before release" finding is fixed. Tests have not shrunk without a reason, bundles have not grown, lint warnings have not increased. Deferred items have task IDs.

---
## TASK-093: 3.1 phase G: docs and release 3.1 on every store
**Priority:** P1 | **Tags:** docs, ci | **Epic:** 3.1
**Updated:** 2026-11-25 12:20

Phase G of TASK-088. Last in the epic, after phases A–F, including the code quality pass (TASK-094).

- **Docs:**
  - Root README "How it works" with a recurring task example.
  - `docs/INSTALL.md` task format and agent workflow.
  - Per-host READMEs and the VS Code Marketplace README.
  - Say plainly that cron runs in UTC and that TaskPlanner doesn't run the schedule itself.
- **Changelog:** a `[3.1.0]` section with the date. Release notes written for users.
- **Gate:** `npm run release:check` green.
- **Publish:** VS Code Marketplace, Open VSX, npm `@smekai/taskplanner`, the Claude plugin (repository marketplace; the directory listing is still under review), Cursor and Codex. Tag `v3.1.x`.
- **Check:** the daily release watch confirms 3.1 is live everywhere.

Then TASK-085 (LinkedIn post) can start.

---
## TASK-092: 3.1 phase E: skip writing a state file when nothing changed
**Priority:** P1 | **Tags:** core | **Epic:** 3.1
**Updated:** 2026-11-25 10:14

Phase E of TASK-088. This is part 1 of TASK-064, split out; parts 2 and 3 (append, cut-and-append) stay in TASK-064. Independent of the other phases.

`serializeBoard` always returns a string and `commitWrites` always writes it, even when the result is byte-identical to what is on disk. Compare first and skip the write and rename when they match. That removes a write from every no-op: `updateTask` with identical values, a reorder that lands on the same index, `archiveCompleted` with nothing old enough. It matters more once a daily `record_run` touches the board.

- Change in `FileStore.prepareState` / `commitWrites`.
- Tests: an unchanged write leaves the file's mtime untouched, and the `roundTrip.test.ts` byte identity still passes.
- Changelog entry.

---
## TASK-091: 3.1 phase D: the daily release watch records its runs on the board
**Priority:** P1 | **Tags:** setup | **Epic:** 3.1
**Updated:** 2026-11-25 10:14

Phase D of TASK-088: dogfooding. Starts after TASK-087 and phase B (the `taskplanner_record_run` tool).

- Create a recurring task "Daily store-status watch" in this repo's Recurring state with `Repeats: 0 7 * * *`. That is 10:07 local in UTC; the scheduled task runs at `0 10 * * *` local time.
- Change the `taskplanner-release-watch` scheduled task prompt (`~/.claude/scheduled-tasks/taskplanner-release-watch/SKILL.md`, outside the repo, so ask first) to finish with `taskplanner_record_run` and a one-line result: versions per store, plus anything that changed.
- After a few days, check that the board shows the watch as not due after each run and as due when a run is missed.

---
## TASK-090: 3.1 phase C: show recurring tasks in every view
**Priority:** P0 | **Tags:** feature, ui | **Epic:** 3.1
**Updated:** 2026-11-25 10:14

Phase C of TASK-088. Starts after TASK-087 (core). It can run alongside phase B.

- **Shared:** `TaskViewItem` (`src/core/model/messages.ts`, `taskToViewItem`) gains `repeats`, `lastRun` and `due`.
- **Claude pane and band** (`views/claude/mod/src/boardModel.ts`, `boardReader.ts`, `paneView.ts`):
  - A Recurring tab with a due badge on each card and in the tab count.
  - The band never picks a recurring task as "next". It may show "N due" separately.
  - Rebuild `views/claude/hooks/register.js`.
- **MCP-app board** (`views/mcp-app/board/board.ts`, `viewOptions.ts`): a Recurring column with a due badge.
- **VS Code:**
  - Kanban (`kanbanPanel.ts` `buildHtml`) shows Recurring as its own column rather than a generic custom state.
  - The task list detail form edits `Repeats` and shows `Last run` and Runs.
- **Agent instructions:** `views/vscode/src/ai/aiInstructions.ts` and the per-host skills (Claude, Cursor, Codex) gain the Recurring state and the rule "record a run, never move it to Done".

Check visually in the Claude pane. Changelog entry.

---
## TASK-089: 3.1 phase B: MCP tools for recurring tasks
**Priority:** P0 | **Tags:** feature, core | **Epic:** 3.1
**Updated:** 2026-11-25 10:14

Phase B of TASK-088. Starts after TASK-087 (core).

- `taskplanner_create` and `taskplanner_update` accept `repeats`. Reject an invalid cron expression with a clear error.
- New tool `taskplanner_record_run(task_id, result)` that calls `recordRun`. It is the only way a scheduler writes back.
- `formatTask` shows `Repeats`, `Last run` and due/overdue.
- `taskplanner_list` can filter for due recurring tasks.
- The MCP smoke test covers create recurring → due → record_run → not due.

Files: `mcp/src/server.ts`, `scripts/smoke-test-mcp-server.js`. Changelog entry.

---
## TASK-088: TaskPlanner 3.1 release: recurring tasks
**Priority:** P0 | **Tags:** feature, core, ui, docs | **Epic:** 3.1
**Updated:** 2026-11-25 12:20

Scope for 3.1. Some work never reaches Done. The daily store-status watch (Claude directory, Cursor Marketplace, Codex directory, VS Code Marketplace, Open VSX, npm) runs every day as the `taskplanner-release-watch` scheduled task, and the board doesn't know about it. 3.1 puts that kind of work on the board.

### Decisions
- **Model:** a new built-in **Recurring** state (`RECURRING.md`). Tasks in it never leave it. A config migration adds the state to existing boards, the same way Rejected was added.
- **Schedule:** a cron expression in `**Repeats:**`, evaluated in UTC like every other date on the board. The board shows a task as due when the cron has fired since `**Last run:**`.
- **Run result:** `**Last run:**` plus a `### Runs` section with the last 7 one-line results. Older lines are trimmed automatically.
- TaskPlanner doesn't run anything itself. A scheduler (a Claude scheduled task, cron, CI) does the work and records the run through MCP.
- **Quality gate:** before the release, a code quality pass with the project skill `/code-quality`.

### Phases
- A. TASK-087: core. The state, the fields, `isDue` and `recordRun`. Done (PR #40).
- B. TASK-089: MCP tools, including `taskplanner_record_run`. Starts after A.
- C. TASK-090: views (Claude pane and band, MCP-app board, VS Code) and agent instructions. Starts after A; can run alongside B.
- D. TASK-091: the daily release watch records its runs on the board. Starts after B.
- E. TASK-092: skip the write when nothing changed (TASK-064 part 1). Independent.
- F. TASK-094: code quality pass with `/code-quality`. Starts after A–E.
- G. TASK-093: docs and release on every store. Last.

The LinkedIn announcement (TASK-085) follows the release.

---
## TASK-085: LinkedIn post with the TaskPlanner-in-Claude animation
**Priority:** P0 | **Tags:** docs
**Updated:** 2026-11-25 10:15

After TASK-086 (product README, install guide) and the 3.1 release with recurring tasks (epic TASK-088; it starts once TASK-093 ships 3.1). Draft a LinkedIn post announcing TaskPlanner with the animation recorded for the README (TASK-084): what it is, how it looks in Claude, and where it runs, linking to the install guide. Covers the "Announce on LinkedIn" item of TASK-076.

The user publishes the post; we hand over the text and the media file (GIF, plus MP4 if LinkedIn needs it).

---
## TASK-081: Publish the Codex plugin with bundled local MCP tools
**Priority:** P2 | **Tags:** feature, setup | **Epic:** 3.0
**Updated:** 2026-11-07 13:28

The repository-installed Codex plugin already includes a local stdio MCP server, but the public upload deliberately contains skills only. Add a supported public desktop package that includes the existing MCP tools after confirming OpenAI submission eligibility.

Acceptance criteria:
- Confirm the current OpenAI desktop-only submission requirements and obtain organization approval/allowlisting if still required; do not claim access until it is confirmed. Reference: https://developers.openai.com/plugins/deploy/desktop-only .
- Package the existing server, its MCP configuration and board UI with the seven existing skills. Reuse the shared server build; do not change task IDs, board format, or task workflow.
- Update the public packager, manifest and validators together so they support the MCP package rather than silently stripping its server. Keep a documented skills-only fallback while MCP publication is unavailable.
- Verify a clean installation discovers the tools without a duplicate project MCP entry, resolves the active workspace rather than the plugin cache, and respects host permissions. Exercise list/get/create/update/move, the board, and persistence after restart.
- Update README, submission metadata and privacy/data-access disclosures to describe the actual package and runtime requirements.

**Cross-platform:** Windows and macOS (Linux follows POSIX). Use portable Node/stdio configuration and plugin-root paths, handle spaces and Windows drive paths, avoid shell-specific launch commands, and document missing-Node errors. Run the packed-artifact and installation checks on available platforms; explicitly mark any untested OS. Allocate the next shared patch version for each implementation commit when planning the work.

---
## TASK-023: CI/CD pipeline for extension delivery
**Priority:** P4 | **Tags:** setup, ci
**Updated:** 2026-10-16 17:57

**Validation (2026-07-27):** Partially addressed — not done as originally written.

**Already in place:**
- PR CI workflow (`.github/workflows/ci.yml`): `npm ci`, lint, test, build.
- Manual release path: `npm run release:check`, `npm run package`, CONTRIBUTING publish steps (`vsce` / `ovsx`).
- Extension published on [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=refined.taskplanner) and [Open VSX](https://open-vsx.org/extension/refined/taskplanner).
- Cursor/Codex plugin packaging and validation scripts; Cursor marketplace submission documented (see TASK-035 in Done).

**Still missing:**
- Automated publish/release workflow (tag → build → publish VSIX to Marketplace/Open VSX).
- Auto-merge for PRs into `main` after checks pass.
- JetBrains Marketplace exploration (no IntelliJ plugin in repo yet).

**Scope (revised):** Add release/publish automation and optional auto-merge; treat JetBrains as a separate follow-up once TASK-019 exists.

---
## TASK-059: Move date handling to Luxon
**Priority:** P2 | **Tags:** core, refactor
**Updated:** 2026-10-15 19:48

**Prerequisite for TASK-021** (task date tracking and statistics). Do this first: TASK-021 needs calendar arithmetic — period boundaries, "last N weeks/months" — and that is where a date library earns its place. Landing it before TASK-021 avoids writing that arithmetic by hand and then migrating it.

`src/core/util/time.ts` is 37 hand-written lines: one regex, a five-component round-trip check, two formatters, `isWaiting` and `daysSince`. It is correct and covered by mutation-checked tests, but PR #8 review found two bugs in that round-trip (`12:99` parsed as 13:39; years `0000`–`0099` remapped into the 1900s), which is the class of mistake a library does not make.

### Why Luxon, measured 2026-08-28

All four candidates reject `12:99`, `2026-02-31` and `2026-09-03 soon`, so any of them fixes that class. The separator is UTC:

| library | UTC out of the box | minified | gzipped | status |
| --- | --- | --- | --- | --- |
| **Luxon** | **yes** | 71 KB | 22 KB | maintained, by a moment maintainer |
| moment | yes | 61 KB | 20 KB | **maintenance mode, not for new projects** |
| dayjs | **no** — silently local | 13 KB | 5.5 KB | maintained |
| date-fns | **no** — silently local | 150 KB | 31 KB | maintained |

`dayjs.utc(v, formats, true)` and `date-fns` `parse()` return local time even with the utc plugin: `2026-08-27` came back as `2026-08-26T21:00Z` on a UTC+3 machine. That silently reintroduces the local/UTC split TASK-057 removed, and it would affect every date rather than only malformed ones — so the two smallest options are disqualified on correctness, not size.

moment is excluded because its own maintainers declare it a legacy project in maintenance mode.

### Scope

- Replace the body of `parseTimestamp` with `DateTime.fromFormat(value, format, { zone: 'utc' })` over the two accepted formats. This is the only seam; every other function already routes through it.
- Keep the public signatures — `parseTimestamp`, `currentTimestamp`, `currentDate`, `isWaiting`, `daysSince` are exported from `src/core/index.ts` and are public API of `@smekai/taskplanner`.
- Luxon becomes a real dependency bundled by esbuild into the extension and the npm library; check `dist/extension.js` growth is acceptable (~22 KB gzipped) before committing.
- The existing tests in `src/test/core/parser.test.ts` are the acceptance criteria — they must pass unchanged, including the two-digit-year and out-of-range-time cases. Note one deliberate difference: Luxon parses `0050-01-01` as year 50, while the current code rejects it. Decide whether to keep rejecting it or accept the more correct behaviour, and record the choice.

Do not take this on for its own sake — if TASK-021 is dropped, the hand-written version is correct and tested, and this stays worth doing only for the maintenance argument.

---
## TASK-064: Write only the part of a state file that changed
**Priority:** P2 | **Tags:** core
**Updated:** 2026-11-25 10:15

Every board write rewrites the whole state file. `serializeBoard` copies the bytes of unchanged tasks verbatim, but it still copies them, and `writeFileAtomic` then writes the file from scratch.

Real sizes, which is what settles this:

    this repository   .tasks/DONE.md      84 KB
    isotopy           .tasks/DONE.md     336 KB, growing per completed task
    isotopy           .tasks/NEXT.md      33 KB

I underestimated this earlier by reasoning about a 40 KB file. Moving one task to Done in Isotopy rewrites 336 KB to add about 2 KB, and the file only grows.

## Three parts, increasing in cost and risk

### 1. Do not write when nothing changed

**Split out as TASK-092 (epic 3.1).** This task keeps parts 2 and 3.

`serializeBoard` always returns a string and `commitWrites` always writes it, even when the result is byte-identical to what is on disk. Comparing and skipping is a few lines, changes no behaviour, and removes a write plus a rename from every operation that turned out to be a no-op — `updateTask` with identical values, a reorder that resolves to the same index, `archiveCompleted` when nothing is old enough.

No trade-off. Do this first and independently.

### 2. Append a section instead of rewriting the file

Adding a task to a state file needs no cut: the section is not in the file yet. `createTask`, and a `moveTask` into its destination, are pure appends. Open the file, seek to the end, write the section.

This is where the 336 KB lives: **an append that writes 2 KB instead of 336 KB**, with no change to the order of anything and nothing to decide. It is the largest win in the task and the cheapest to reason about.

### 3. Cut and append for an edited section

Proposed: to change a task, remove its section and write the new version at the end of the file.

This removes the problem that blocks a naive in-place patch — a new section is almost never the same length as the old one, so patching in place would mean shifting the whole tail. Appending sidesteps the length entirely.

A regular file still cannot have bytes removed from the middle, so the cut costs a write of everything after the section plus a truncate. Average saving is about half the file; a task at the end saves nearly all of it, a task at the top saves nothing.

**The good part, which is the point of the design:** after one edit the task sits at the end, so every further edit to it is cheap. That matches how the board is actually used — an agent touches one task repeatedly (move to In Progress, add a plan, update, move to Done) while everything else stays still.

## What this costs, and the decision it needs

**The order of tasks in the file changes on every edit.** That is invisible under the default `priority` sort, but two things do depend on file order:

- `sortBy: 'file'` is a real option in `taskFilter.ts` and means "show them in the order the file has them"
- drag-and-drop in the task list calls `reorderTaskToIndex`, which exists only to let someone choose that order

So a person could drag a task into place, edit it, and watch it jump to the bottom. `CLAUDE.md` already says order within a file carries no meaning beyond the insertion point, which argues the other way. Deciding this is the first step of part 3, not an implementation detail of it.

**Atomicity.** `writeFileAtomic` writes a temporary file and renames it, so a crash leaves either the old file or the new one. Appending and truncating in place give that up: an interruption can leave a half-written section, and a board is edited by a person and an agent at the same time. Mitigations to weigh: append the new section before cutting the old one, so an interruption leaves a duplicate id — which the duplicate detector already handles — rather than a lost task.

## Groundwork already in place

- `splitSections` computes each section's byte offsets and currently throws them away. Carrying `[start, end)` on `RawSection` is a small change.
- `sameTask` already answers which tasks did not change.
- `FileStore.prepareState` / `commitWrites` already separate deciding what to write from writing it, which is where an append or a partial write would slot in.

## Verification

- The byte-identity invariant in `roundTrip.test.ts` must keep passing: whatever the write path does, reading a board and writing it back unchanged returns the same bytes.
- A test that an unchanged write touches the file's mtime not at all.
- For part 3, if it is taken: a test that an interruption between the append and the cut leaves the task findable rather than lost.

---

## TASK-062: Run the published-artifact smoke test under Vitest instead of a hand-rolled script
**Priority:** P3 | **Tags:** testing
**Updated:** 2026-09-21 09:21

`scripts/smoke-test-mcp-server.js` is ~475 lines of plain CJS: a hand-rolled `expect()` (line 29), a hand-rolled `log()` for progress, and a 110-line `McpClient` implementing JSON-RPC over stdout (lines 39–110). Raised in review of PR #11: should it be TypeScript, or component-style tests instead of a script?

**The existing framework can run it.** Vitest has no trouble with a file that spawns children. The constraint is not the framework: the test packs the package, installs the tarball into an empty temp directory and starts processes — 30–60 seconds, and it requires `npm run build` to have run first. The unit suite is 209 tests in well under a second and runs on every commit; putting this in the same run would slow every commit and make unit tests depend on whether the project is built.

So the question is not "Vitest or not" but "which Vitest project", and TypeScript comes free either way: making it TS and moving it to Vitest are the same decision, not two.

### Option 1 — a separate Vitest project

`vitest.config.smoke.ts`, run from `npm run smoke:mcp-server`, excluded from `npm test`. Real `expect()` with proper diffs on failure, named cases instead of `log()` lines, per-case isolation. TypeScript follows from the move rather than being the goal.

### Option 2 — leave it a Node script

All ten files in `scripts/` are plain CJS Node scripts, and this one validates the build, so it should not depend on the build. Converting only this one is inconsistent. If this is the answer, reply on the review thread and close it.

### Option 3 — independent of the above: drop the hand-rolled client

Replace `McpClient` with `Client` + `StdioClientTransport` from `@modelcontextprotocol/sdk`, already in `devDependencies`. That is the single biggest simplification available here, roughly 110 lines deleted.

The package is ESM-only (`"type": "module"`), which is exactly why today's CJS script does not use it. Under Vitest the constraint disappears, so Option 3 is easiest alongside Option 1 — though a CJS script could also reach it through a dynamic `import()`.

### What must not be lost in any move

- **The `bin` check** (lines 343–348): `npm publish` silently drops a `bin` path starting with `./` while `npm pack` keeps it, so the tarball under test passes while the published package ships with no `bin`. This was a real incident; it is the reason the check exists.
- **`childEnv()`** (lines 112–118): strips `TASKPLANNER_WORKSPACE_ROOT`, `CURSOR_WORKSPACE_ROOT`, `VSCODE_WORKSPACE_ROOT`, `PWD` and `INIT_CWD` so that a passing run proves the variable under test is what located `.tasks/`. Without it a green run proves nothing.
- Running against the **packed and installed tarball**, not the working tree.

---

## TASK-019: IntelliJ IDEA extension and Julia format support
**Priority:** P3 | **Tags:** feature
**Updated:** 2026-07-27 13:35

**Validation (2026-07-27):** Still needed — no implementation in repo. README lists JetBrains IDEs as planned. `src/core/` has no `vscode` imports and is reused by the MCP server and plugins today, but there is no IntelliJ/Kotlin/Gradle project and no Julia-related code or docs beyond this task title.

**Scope:**
- New IntelliJ plugin that reuses `src/core/` for parse/serialize/store.
- Clarify **Julia format** before implementation (no definition in codebase — confirm whether this means a Julia-language task file format, a person/project name, or something else).

---

## TASK-021: Task date tracking and statistics
**Priority:** P3 | **Tags:** feature, core
**Updated:** 2026-08-28 07:52

**Blocked on TASK-059** (move date handling to Luxon). Do that first — the statistics here need calendar arithmetic (period boundaries, "last N weeks/months"), which is exactly what the current hand-written `src/core/util/time.ts` does not cover and what a date library exists for. Starting here first means writing that arithmetic by hand and migrating it afterwards.

**Validation (2026-07-27):** Partially addressed — statistics not done; date tracking is incomplete.

**Already in place:**
- `updatedAt` on `Task`; parsed/serialized as `**Updated:**` in markdown.
- Auto-set on create, update, and move (`taskStore.ts`).
- Shown in list cards, Kanban, detail view, and MCP output.
- List filter: group-by **Date** uses `updatedAt` (day bucket).
- Text search matches `updatedAt`.

**Still missing:**
- `createdAt` and `finishedAt` (or equivalent) fields and markdown metadata.
- Statistics UI or reports (cycle time, throughput, performance metrics).

**Scope (revised):** Add created/finished dates with parser/serializer support; build statistics view or export on top of the date fields. Do not re-implement `updatedAt` or group-by-date. All new date parsing and formatting goes through `src/core/util/time.ts` — the board is UTC everywhere and nothing else parses or formats a date.

---
