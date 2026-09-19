# Backlog

## TASK-064: Parsing a board and writing it back is lossless
**Priority:** P1 | **Tags:** core
**Updated:** 2026-09-19 07:44

Split out of `TASK-063`. `serializeStateFile` rebuilds a state file from parsed tasks, so everything the parser did not turn into a `Task` is gone on the next write: prose above the first task, a comment between two tasks, a section whose heading the parser refuses, and the file's own line endings.

Measured on the current parser — original left, result of `parseTasks` then `serializeStateFile` right:

    # Backlog                                # Backlog

    Prose a human wrote at the top.          ## TASK-001: Real
                                             **Priority:** P1
    <!-- keep this -->
    ## TASK-001: Real                        Body.
    **Priority:** P1
                                             ---
    Body.

    ---

    ## task-002: lowercase, refused
    **Priority:** P2

    ---

Prose, the comment and the whole `task-002` section are gone. The parser warned about all three; the content is still unrecoverable.

### The loss is at parse time, not at write time

    export interface ParseResult {
      tasks: Task[];
      warnings: ParseWarning[];
    }

That is the whole result. No preamble, nothing between tasks, no unparsed sections, no line endings. `serializeStateFile` cannot restore what it was never given, so any fix that starts at the serializer is working on the wrong end.

### What was tried and rejected

The first attempt was `upsertTask`/`removeTask` in a `boardEditor` module: find one task's section in the raw text and splice. Review found it cutting into the neighbouring task — a section whose separator is missing has no end to find, so `removeTask('TASK-001')` deleted TASK-002 as well. It was removed before merge rather than published.

Splicing by id is the wrong shape regardless of that bug. It exposes byte-level editing to callers to work around a lossy parser, and it is a second write path that this repository's own code does not use.

### The shape to build

Make the round trip lossless and the editor is unnecessary.

- `ParseResult` carries the file as an ordered list of segments: either a task, or raw text the parser did not claim. `tasks` stays as a projection over that list, so no existing caller changes.
- A task segment keeps the original bytes it was parsed from. Writing a task that did not change re-emits those bytes, so a write only rewrites what actually changed and produces no diff noise.
- A serializer that walks segments and emits each one is the exact inverse of the parser.
- The invariant is testable directly: for any board file `x`, serializing `parseTasks(x)` unchanged returns `x` byte for byte. Property-test it over the boards in this repository and over the archive files.
- `TaskStore` writes through it, so preservation is real for the extension and the MCP tools rather than theoretical for one external consumer.
- `serializeStateFile` stays for building a file from nothing — initializing a state file and writing archives are legitimately full rebuilds.

### Risks

- CRLF must survive: `parseTasks` splits on `/\r?\n/` and normalises today.
- Blank-line placement around sections must be preserved exactly, or every first write after the upgrade produces a large diff.
- The deferred-state path reads raw content without parsing; it must keep working.

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
