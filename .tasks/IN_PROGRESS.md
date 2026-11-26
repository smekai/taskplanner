# In Progress

## TASK-094: 3.1 phase F: code quality pass before the release
**Priority:** P1 | **Tags:** refactor, testing | **Epic:** 3.1
**Updated:** 2026-11-26 09:35

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

### Plan

Analysis, 2026-11-26. Scope: `v3.0.12...HEAD`, 32 source files, +1161/−126. Measured with lint, `tsc --noUnusedLocals/--noUnusedParameters`, ESLint complexity rules and a read; no npx tools and no coverage (user's call).

**Baseline:**
- 515 tests; lint 0 errors / 2 warnings (`any` in `pane.test.ts`).
- `tsc` unused-code check clean.
- Bundles: `register.js` 62 400 B, `mcp-server.js` 513 277 B, `extension.js` 151 232 B.

**1. Fix before release**
- **Correctness**, `views/vscode/src/views/webview/kanbanPanel.ts:46`, `taskListPanel.ts:62`, the MCP App board: an open view keeps showing a recurring task as not due after its schedule fires.
  - Cause: these views re-render only on a store or visibility change.
  - Fix: move `scheduleFiredSince` from the Claude mod into core, and re-render on a minute check while a view is open. M.
- **Correctness**, `views/claude/mod/src/boardReader.ts:104`, `mcp/src/server.ts` (list `due`): due counts and `due: true` include recurring tasks in Done or Rejected.
  - Effect: the band total changes with whether Done is loaded.
  - Fix: one core rule counting due work only outside completed states. S.
- **A3**, `mcp/src/server.ts:460`: the MCP handler decides "a task with repeats goes to Recurring", and a create into Recurring without a schedule is accepted (never due, `record_run` refuses it).
  - Fix: a core rule both for the default state and for refusing the empty schedule. S–M.
- **Tooling**, `scripts/bump-version.js`: it replaces the old version string everywhere in built bundles, which failed CI on PR #42.
  - Fix: bump only the version fields. S.

**2. Worth it now**
- **A6**, `src/core/filter/taskFilter.ts:89`/`:136`: `filterAndPaginate` (7) and `groupTasks` (8) take positional parameters, and callers pass placeholders to reach `now`.
  - Fix: a named options object; neither function is in the public API. S.
- **Correctness**, `src/core/config/configManager.ts:92`: an invalid `version` resets to 4 and skips the Recurring migration. Fix: treat it as unversioned. S.
- **Correctness**, `src/core/store/taskStore.ts:510`: `recordRun` stamps Last run from `now` and Updated from the real clock. Fix: one clock. S.
- **Invariant**, `src/core/validation/duplicateDetector.ts:26` (from before 3.0.12): parses `Updated` as local time with `Date.parse`. Fix: core `parseTimestamp`. S.
- **A1/A8**, `src/core/config/configManager.ts:139`: a `WHY:` holds a design rationale. Fix: move it to docs. S.
- **Tests**, `test/core/taskStore.test.ts:403`: a loop in a test body, and the new store tests have no phase banners. S.
- **Skill**, `.claude/skills/code-quality/SKILL.md`: drop the knip/jscpd/madge and coverage steps, per the user. S.

**3. Later (Backlog tasks)**
- **A9**: `taskListPanel.ts` (1655 lines; `handleMessage` complexity 47) and `kanbanPanel.ts` (1059) mix markup, state and messages. Split per surface. L.
- **A6**: hard-coded state names (11 in `kanbanPanel.ts`, 4 in `server.ts`, 4 in `boardModel.ts`). Make them constants. M.
- **Complexity hotspots**: `groupTasks` 27, `parseTaskSection` 24, `setup.ts` command 26, `register()` 205 lines. M–L.
- **A7**: turning on `noUncheckedIndexedAccess`. M.
- **Tests**: Isotopy's ESLint rule against logic in test bodies; type the mod kit `on`/`$` to clear the 2 lint warnings. S–M.

Checked and fine:
- Dates go only through `time.ts`; board state files are written atomically; no env or console in core.
- The other 7 `WHY:` lines explain local quirks.
- `tsc` finds no unused code; no import cycles seen while reading.

---
## TASK-091: 3.1 phase D: the daily release watch records its runs on the board
**Priority:** P1 | **Tags:** setup | **Epic:** 3.1
**Updated:** 2026-11-25 20:31

Phase D of TASK-088: dogfooding. Starts after TASK-087 and phase B (the `taskplanner_record_run` tool).

- Create a recurring task "Daily store-status watch" in this repo's Recurring state with `Repeats: 0 8 * * *` (UTC). The scheduled task runs at `0 10 * * *` local time: 09:00 UTC in winter (UTC+1) and 08:00 UTC in summer (UTC+2). A UTC schedule of 08:00 fires at or before the run all year, so a finished check is never shown as due.
- Where the run is recorded (decided 2026-11-25): in the watch's own worktree `C:\Development\smekai\taskplanner-readme-stats`, committed to the daily "README stats" PR. The main checkout and the user's branches stay untouched, and board changes still go through a PR. Accepted cost: `main` shows the watch as due until that PR is merged, and only runs from merged PRs stay in `main`'s history (`history.jsonl` keeps every run).
- Change the `taskplanner-release-watch` scheduled task prompt (`~/.claude/scheduled-tasks/taskplanner-release-watch/SKILL.md`, outside the repo) to record the run with `taskplanner_record_run` and a one-line result, with a by-hand fallback.
- After a few days, check that the board shows the watch as not due after each run and as due when a run is missed.

### Plan

- Board, through a PR: create "Daily store-status watch" with `repeats: 0 8 * * *`, P2, tag `ci`. Without a state it lands in Recurring. Merge before the prompt changes, because the watch's worktree is rebuilt from `origin/main`.
- Scheduled prompt, step 5:
  - after the README stats script, `taskplanner_record_run` in the stats worktree, with a by-hand fallback;
  - stage and compare `.tasks/RECURRING.md` too;
  - commit message and PR title mention the run;
  - the run is still recorded when the README marker is missing.
- Report: one line on whether the run was recorded and how.
- Verify with one manual run (after asking): the stats PR carries the run, and the watch is not due in the worktree.
- Risk: the scheduled session may lack the MCP tool or permission for it. The by-hand fallback covers that; an allow rule is added only with the user's OK.

---
