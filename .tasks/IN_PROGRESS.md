# In Progress

## TASK-093: 3.1 phase G: docs and release 3.1 on every store
**Priority:** P1 | **Tags:** docs, ci | **Epic:** 3.1
**Updated:** 2026-11-27 09:06

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

### Plan

- Docs (branch `feature/task-093-release-3.1`): root README "How it works" gains a recurring task example; `docs/INSTALL.md` lists RECURRING.md and adds a Recurring tasks section (cron in UTC, TaskPlanner does not run the schedule, a scheduler records runs with `taskplanner_record_run`).
- Host READMEs: Claude and Cursor tool lists name `taskplanner_record_run` (the old list still said board-data); each Usage list gets a recurring line; VS Code README describes the Recurring column and schedule editing; `mcp/README.md` shows the recurring task fields.
- Codex submission `releaseNotes` describe 3.1.
- Version 3.1.0 with `scripts/bump-version.js minor`, `validate:versions`, commit with `--no-verify`; CHANGELOG `[Unreleased]` becomes `[3.1.0] - 2026-11-27` with a short user-facing intro.
- Gate: `npm run release:check` green, build matches the commit. PR, the user merges.
- Publish after merge, each store only with the user's yes: VS Code Marketplace, Open VSX, npm, tag `v3.1.0`; Claude/Cursor/Codex repository marketplaces pick main up. The release watch confirms.
- Risk: plugins on main already say 3.0.63, so 3.1.0 must stay above it (it does).

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
