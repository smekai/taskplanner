# Backlog

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

## TASK-059: Move date handling to Luxon
**Priority:** P2 | **Tags:** core, refactor
**Updated:** 2026-08-28 07:52

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

## TASK-023: CI/CD pipeline for extension delivery
**Priority:** P4 | **Tags:** setup, ci
**Updated:** 2026-07-27 13:35

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
